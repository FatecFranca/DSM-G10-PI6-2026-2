# backend-MD — Motor de IA e Mineração de Dados

Serviço especializado de Inteligência Artificial e Mineração de Dados do projeto
**Predict Students' Dropout and Academic Success Classification** (PI do 6º semestre).

Classifica estudantes entre `Dropout`, `Enrolled` e `Graduate` e expõe o processo de
Mineração de Dados que produziu o modelo. Não tem tela, não gerencia usuários e não
guarda dado de negócio — quem faz isso é o `backend-Project`, o único consumidor previsto deste serviço.

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
4. treina o modelo (`prepare_data.py` → `train_model.py`), se os artefatos ainda não
   existirem;
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

npm run ml:pipeline       # prepare_data → train_model
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

### Tarefa de aprendizado: somente Classificação

`docs/dataset/BASE-ML.md` exige **mínimo uma e no máximo duas** tarefas entre Classificação,
Regressão, Regra de associação, Clustering e Recomendação. Este projeto aplica **uma:
classificação supervisionada** em 3 classes.

Existiu aqui um agrupamento por `KMeans`, removido em 03/09/2026. A base é rotulada e o
problema é de classificação; o agrupamento também não se sustentava empiricamente
(silhueta 0,214, com 74,6% dos registros num único grupo). O histórico completo da decisão
está na seção 10 do `CONTEXT.md`.

As quatro etapas são desacopladas e podem ser executadas isoladamente.

| Etapa | Script | Comando | Entrada → Saída |
| --- | --- | --- | --- |
| 1. Ambiente | `ML/environment.yml` | — | declaração do ambiente reprodutível |
| 2. Preparação | `ML/prepare_data.py` | `npm run ml:prepare` | CSV bruto → `data/processed/`, `artifacts/label_map.json`, `artifacts/feature_spec.json`, `reports/preparation_report.json` |
| 3. Treinamento | `ML/train_model.py` | `npm run ml:train` | dataset tratado → `artifacts/model.pkl`, `artifacts/scaler.pkl`, `artifacts/model_metadata.json` |
| 4. Inferência | `ML/predict.py` | acionado pela API | JSON (stdin) → JSON (stdout) |
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

O dataset é dividido em **desenvolvimento (80%) e teste (20%)**. Treze algoritmos
candidatos — incluindo variantes com `class_weight="balanced"` — são comparados por
validação cruzada de 10 folds **apenas sobre o desenvolvimento**. O conjunto de teste não
participa da escolha: ele é usado uma única vez, no fim, para a estimativa honesta.

A seleção tem três etapas:

1. **Descarte por memorização:** candidatos cuja distância entre acurácia de treino e de
   validação passa de 0,05 são eliminados. Isso remove Random Forest (gap 0,21),
   Gradient Boosting, SVC e as árvores de decisão.
2. **Score de seleção:** `0,50 × F1 macro + 0,50 × revocação de Dropout`. O F1 macro cuida
   do equilíbrio entre as três classes desbalanceadas; a revocação de `Dropout` entra com
   peso igual porque, num sistema de apoio à identificação de estudantes em risco, deixar
   de sinalizar quem evade é o erro caro.
3. **Empate:** candidatos dentro de 0,01 do melhor score são tratados como equivalentes;
   entre eles vence o de maior score, com a menor distância treino-validação como critério
   de desempate.

Por que medir na validação cruzada e não no teste: selecionar pelo teste transforma o teste
em validação e infla as métricas publicadas. Medido no projeto, o otimismo era de ~0,016 de
F1 macro — e a escolha mudava.

O `model_metadata.json` registra a comparação completa dos candidatos, o critério
aplicado e a justificativa da escolha.

### Reprodutibilidade

Semente fixa (`RANDOM_STATE = 42`), split 80/20 estratificado, e cada modelo serializado
acompanha: hiperparâmetros, impressão digital SHA-256 do dataset, ordem das features,
métricas (incluindo matriz de confusão 3x3 e relatório por classe), versões de Python e
bibliotecas, e data do treinamento.

**Sem vazamento de dados:** na comparação, cada candidato roda dentro de um
`Pipeline(StandardScaler → estimador)`, então o normalizador é reajustado dentro de cada
fold, sem enxergar os dados de validação daquele fold. O modelo final e seu `scaler` são
ajustados no conjunto de desenvolvimento; o conjunto de teste nunca participa de nenhum
ajuste nem da escolha do algoritmo.

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
| `GET` | `/api/models/active` | Metadados do modelo em uso (lidos do artefato) |
| `GET` | `/api/models` | Histórico de versões registradas no banco |
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
  "model": { "version": "...", "algorithm": "LogisticRegression" },
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
│   ├── explore.py               exploração visual (dev-only)
│   ├── environment.yml          ambiente conda (Python 3.9)
│   ├── requirements.txt         ambiente mínimo de execução
│   ├── artifacts/               modelo, scaler e metadados (gerados)
│   └── reports/                 relatórios e figuras (gerados)
├── prisma/schema.prisma         MlModel
└── src/
    ├── config/                  env, swagger
    ├── lib/prisma.js            único acesso ao MongoDB
    ├── ml/                      pythonRunner (ponte), artifacts, validation
    ├── middlewares/             apiKeyAuth, errorHandler
    ├── modules/                 classification, models, health
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
