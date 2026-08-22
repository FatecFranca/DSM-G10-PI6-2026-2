# backend-MD — Motor de IA e Mineração de Dados

Serviço especializado de Inteligência Artificial e Mineração de Dados do projeto
**Predict Students' Dropout and Academic Success Classification** (PI do 6º semestre).

Classifica estudantes entre `Dropout`, `Enrolled` e `Graduate` e disponibiliza análise
não supervisionada de perfis. Não tem tela, não gerencia usuários e não guarda dado de
negócio — quem faz isso é o `backend-Project`, o único consumidor previsto deste serviço.

> A classificação é **apoio à tomada de decisão**, não uma garantia sobre o futuro de um
> estudante. O campo `confidence` é a probabilidade estimada pelo modelo e não passou por
> calibração estatística.

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| API | Node.js + Express 5.2.1 |
| ML / Mineração de Dados | Python 3.9 + scikit-learn 1.6.1, pandas 2.3.3, numpy 2.0.2, joblib 1.5.2 |
| Banco | MongoDB via Prisma 6.19.3 (database `Mongo-PI-Backend-MD`) |
| Documentação | swagger-jsdoc + swagger-ui-express |

**Ponte Express → Python:** processo Python acionado via `child_process` sob demanda
(decisão registrada na seção 6 do `CONTEXT.md`). O JSON entra pelo stdin do script e sai
pelo stdout. Consequência: o custo de subida do interpretador (~1-2s) é pago por
requisição — por isso existe o endpoint em lote, preferível a N chamadas unitárias.

---

## Instalação

```bash
npm install
npm start
```

> `npm start` roda em primeiro plano (`node src/server.js`, sem daemon). Use uma aba de
> terminal dedicada a este serviço — `Ctrl+C` nela para só o `backend-MD`, sem afetar o
> `backend-Project` nem o Front-End, desde que cada um rode na sua própria aba.

`npm install` faz **tudo sozinho** (hook `postinstall` → `src/scripts/setup.js`), de forma
idempotente — reexecutar não repete trabalho já feito:

1. cria o `.env` a partir de `.env.example`, se ainda não existir;
2. sincroniza o schema com o MongoDB (`prisma db push`);
3. cria o ambiente Python em `ML/.venv` e instala as dependências de ML, se ainda não
   existir (tenta `py -3.10`, `py -3.9`, `python`/`python3` na ordem);
4. treina o modelo (`prepare_data.py` → `train_model.py`) e o agrupamento
   (`train_clusters.py`), se os artefatos ainda não existirem;
5. registra os metadados do modelo no MongoDB.

Nenhum passo interrompe o `npm install` se falhar (banco fora do ar, Python ausente): o
script avisa e segue, e `npm start` reporta o mesmo problema com mais detalhe.

**Só é necessário editar algo manualmente** se o `.env` acabou de ser criado a partir do
exemplo: preencha `DB_URL` e gere `MD_API_KEY` (o **mesmo** valor precisa estar no `.env`
do `backend-Project`):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Depois, rode `npm install` de novo (ou `npm run setup`) para o script terminar o
provisionamento com as credenciais corretas.

### Rodando os passos manualmente

Se preferir controlar cada etapa (ou usar conda em vez do venv automático):

```bash
npm run setup             # reexecuta src/scripts/setup.js sozinho
npm run prisma:push       # só o schema

conda env create -f ML/environment.yml && conda activate pi6-backend-md-ml   # alternativa ao venv

npm run ml:pipeline       # prepare_data → train_model → train_clusters
npm run ml:register       # registra os metadados técnicos no MongoDB
```

Se o interpretador Python estiver em outro lugar, aponte `PYTHON_BIN` no `.env`.

### Executar

```bash
npm run dev               # nodemon
npm start                 # produção
```

- API: `http://localhost:3003`
- Documentação: `http://localhost:3003/api/docs`
- Saúde: `http://localhost:3003/api/health`

---

## Pipeline de ML

As quatro etapas são desacopladas e podem ser executadas isoladamente.

| Etapa | Script | Comando | Entrada → Saída |
| --- | --- | --- | --- |
| 1. Ambiente | `ML/environment.yml` | — | declaração do ambiente reprodutível |
| 2. Preparação | `ML/prepare_data.py` | `npm run ml:prepare` | CSV bruto → `data/processed/`, `artifacts/label_map.json`, `artifacts/feature_spec.json`, `reports/preparation_report.json` |
| 3. Treinamento | `ML/train_model.py` | `npm run ml:train` | dataset tratado → `artifacts/model.pkl`, `artifacts/scaler.pkl`, `artifacts/model_metadata.json` |
| 4. Inferência | `ML/predict.py` | acionado pela API | JSON (stdin) → JSON (stdout) |
| Complementar | `ML/train_clusters.py` | `npm run ml:cluster` | dataset tratado + scaler → `artifacts/cluster_model.pkl`, `artifacts/cluster_metadata.json` |
| Exploração | `ML/explore.py` | `npm run ml:explore` | dataset tratado → `reports/figures/*.png` (dev-only) |

### Dataset

`ML/predic-students-dataset.csv` — 4.424 registros, separador `;`, UTF-8 com BOM,
36 atributos + `Target`. Sem valores ausentes e sem duplicatas.

Distribuição das classes (desbalanceada, razão 2,78x):

| Classe | Registros | Proporção |
| --- | --- | --- |
| `Graduate` | 2.209 | 49,9% |
| `Dropout` | 1.421 | 32,1% |
| `Enrolled` | 794 | 17,9% |

### Como o modelo é escolhido

Nove algoritmos candidatos são comparados por validação cruzada (10 folds estratificados)
e avaliados em treino e teste. A seleção tem duas etapas:

1. **Métrica principal:** F1 macro no conjunto de teste — preferido à acurácia porque as
   três classes são desbalanceadas, e um modelo pode ter boa acurácia acertando só
   `Dropout` e `Graduate` enquanto erra sistematicamente `Enrolled`.
2. **Desempate por generalização:** candidatos dentro de 0,01 de F1 macro do melhor são
   tratados como empatados (a diferença é ruído em ~885 registros de teste); entre eles
   ganha o de menor distância treino-teste.

Sem a etapa 2 a escolha cai em um Random Forest que decora o treino (acurácia 0,985 no
treino contra 0,758 no teste) por uma vantagem de milésimos — exatamente o overfitting
que a seção 6.1.3 do `CONTEXT.md` manda evitar.

O `model_metadata.json` registra a comparação completa dos candidatos, o critério
aplicado e a justificativa da escolha.

### Reprodutibilidade

Semente fixa (`RANDOM_STATE = 42`), split 80/20 estratificado, e cada modelo serializado
acompanha: hiperparâmetros, impressão digital SHA-256 do dataset, ordem das features,
métricas (incluindo matriz de confusão 3x3 e relatório por classe), versões de Python e
bibliotecas, e data do treinamento.

**Sem vazamento de dados:** o `StandardScaler` é ajustado uma única vez, apenas sobre
`X_train`, depois do split. Na comparação por validação cruzada cada candidato roda dentro
de um `Pipeline(StandardScaler → estimador)`, de modo que o normalizador é reajustado a
cada fold.

---

## Endpoints

Autenticação por **API Key de serviço** no header `X-API-Key` (ou
`Authorization: Bearer <api_key>`). Não há autenticação de usuário final aqui.

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/health` | Estado do serviço, banco e camada de ML — **público** |
| `GET` | `/api/features` | Contrato de atributos aceito pelo modelo |
| `POST` | `/api/classify` | Classifica um estudante |
| `POST` | `/api/classify/batch` | Classifica um lote (preferível a N chamadas) |
| `GET` | `/api/clustering/profiles` | Perfis descobertos pelo agrupamento |
| `POST` | `/api/clustering/assign` | Atribui estudante(s) a um perfil |
| `GET` | `/api/models/active` | Metadados do modelo em uso (lidos do artefato) |
| `GET` | `/api/models` | Histórico de versões registradas no banco |
| `GET` | `/api/models/clustering` | Histórico de execuções de agrupamento |
| `GET` | `/api/models/{version}` | Metadados completos de uma versão |
| `POST` | `/api/models/register` | Registra os artefatos atuais no banco |

Exemplo:

```bash
curl -X POST http://localhost:3003/api/classify \
  -H "X-API-Key: $MD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"features": { ... 36 atributos ... }}'
```

```json
{
  "classification": "Dropout",
  "classId": 0,
  "confidence": 0.999,
  "probabilities": { "Dropout": 0.999, "Enrolled": 0.001, "Graduate": 0.0 },
  "model": { "version": "...", "algorithm": "LinearDiscriminantAnalysis" },
  "disclaimer": "A classificação é apoio à tomada de decisão..."
}
```

### Erros

Formato único: `{ "error": "<CODE>", "message": "...", "details": ... }`

| Código | HTTP | Significado |
| --- | --- | --- |
| `API_KEY_MISSING` / `API_KEY_INVALID` | 401 | Chave ausente ou incorreta |
| `INVALID_FEATURES` | 422 | Atributos ausentes ou não numéricos |
| `BATCH_TOO_LARGE` | 400 | Lote acima de `ML_MAX_BATCH_SIZE` |
| `MODEL_NOT_TRAINED` | 503 | Pipeline não executado |
| `CLUSTERING_NOT_TRAINED` | 503 | `train_clusters.py` não executado |
| `ML_TIMEOUT` | 504 | Script Python excedeu `ML_TIMEOUT_MS` |

---

## Estrutura

```text
backend-MD/
├── ML/                          camada de ML (Python)
│   ├── config.py                fonte única de caminhos, contrato e semente
│   ├── prepare_data.py          etapa 2
│   ├── train_model.py           etapa 3
│   ├── predict.py               etapa 4 — stdin/stdout
│   ├── train_clusters.py        não supervisionado
│   ├── cluster_assign.py        inferência de perfil
│   ├── explore.py               exploração visual (dev-only)
│   ├── environment.yml          ambiente conda (Python 3.9)
│   ├── requirements.txt         ambiente mínimo de execução
│   ├── artifacts/               modelo, scaler e metadados (gerados)
│   └── reports/                 relatórios e figuras (gerados)
├── prisma/schema.prisma         MlModel, ClusteringModel
└── src/
    ├── config/                  env, swagger
    ├── lib/prisma.js            único acesso ao MongoDB
    ├── ml/                      pythonRunner (ponte), artifacts, validation
    ├── middlewares/             apiKeyAuth, errorHandler
    ├── modules/                 classification, clustering, models, health
    ├── scripts/                 runMl, registerModel
    ├── app.js
    └── server.js
```

## O que NÃO pertence a este serviço

Telas, autenticação de usuário, cadastro de usuários/estudantes, navegação, regra de
negócio e o histórico de análises por estudante (quem foi analisado, quando, com qual
resultado) — tudo isso é do `backend-Project`.

Aqui só existe **metadado técnico de reprodutibilidade do modelo**. As duas coisas não
devem ser fundidas nem duplicadas entre os projetos.
