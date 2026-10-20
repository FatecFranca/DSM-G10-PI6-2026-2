# backend-MD — Motor de IA e Mineração de Dados

Serviço especializado de Inteligência Artificial e Mineração de Dados do projeto
**Predict Students' Dropout and Academic Success Classification** (PI do 6º semestre).

Classifica estudantes entre `Dropout`, `Enrolled` e `Graduate` e expõe o processo de
Mineração de Dados que produziu o modelo. Não tem tela, não gerencia usuários e não
guarda dado de negócio — quem faz isso é o `backend-Project`, o único consumidor previsto deste serviço.

> A classificação é um resultado estatístico destinado a apoiar a decisão. O campo
> `confidence` é a probabilidade estimada para a classe escolhida. O pipeline não aplica
> etapa de calibração posterior; a aderência entre probabilidade e frequência observada é
> aferida a cada treino e publicada em `metrics.test_calibration_ece`
> (`GET /api/models/active`).

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
| Documento do processo | `ML/Classificacao_Evasao_Estudantes.ipynb` | Jupyter (dev-only) | CSV bruto → as 9 etapas do processo de Mineração de Dados, usando as funções do próprio pipeline e conferindo o resultado contra os artefatos e o `predict.py`; não grava em `artifacts/` |

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

O critério é fixado antes de olhar os resultados e tem quatro etapas
(`select_final` em `ML/train_model.py`):

1. **Filtro de estabilidade:** seguem na disputa só os candidatos cuja distância entre
   acurácia de treino e de validação fica em até `MAX_OVERFIT_GAP` (0,05). É uma
   **preferência deliberada por parcimônia e estabilidade**, não a afirmação de que os
   excluídos generalizariam pior: num ensemble essa distância é estrutural (uma floresta
   com folhas pequenas ajusta quase todo o treino por construção). Por isso o custo do
   corte é medido e publicado na etapa 4.
2. **Score de seleção:** `0,50 × F1 macro + 0,50 × revocação de Dropout`. O F1 macro cuida
   do equilíbrio entre as três classes desbalanceadas; a revocação de `Dropout` entra com
   peso igual porque, num sistema de apoio à identificação de estudantes em risco, deixar
   de sinalizar quem evade é o erro caro.
3. **Desempate por parcimônia:** candidatos a até `EQUIVALENCE_TOLERANCE` (0,01) do melhor
   score são tratados como equivalentes e, entre eles, vence o de **menor distância
   treino-validação** — o mais estável, não o de maior score bruto.
4. **Custo da escolha:** frente ao melhor candidato removido pelo filtro, registra-se quanto
   se abriu mão em F1 macro e quanto se ganhou ou perdeu em revocação de `Dropout`
   (`selection_criteria.cost_vs_best_excluded`).

Por que medir na validação cruzada e não no teste: selecionar pelo teste transforma o teste
em validação e infla as métricas publicadas. Medido no projeto, o otimismo era de ~0,016 de
F1 macro — e a escolha mudava.

#### Resultado do treino atual

Modelo `LogisticRegression-20260908T131859`. Médias da validação cruzada de 10 folds sobre
o conjunto de desenvolvimento, ordenadas pelo score:

| Algoritmo | Acurácia | F1 macro | Revocação Dropout | Score | Distância treino-validação | Situação |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| RandomForestBalanced | 0,7776 | 0,7105 | 0,7583 | 0,7344 | 0,2065 | fora (estabilidade) |
| GradientBoostingClassifier | 0,7742 | 0,6979 | 0,7653 | 0,7316 | 0,0727 | fora (estabilidade) |
| RandomForestClassifier | 0,7737 | 0,6869 | 0,7618 | 0,7244 | 0,1956 | fora (estabilidade) |
| **LogisticRegression** | 0,7652 | 0,6774 | 0,7635 | 0,7205 | 0,0087 | **escolhido** |
| LogisticRegressionBalanced | 0,7471 | 0,7069 | 0,7178 | 0,7124 | 0,0120 | equivalente |
| LinearDiscriminantAnalysisDropoutPrior | 0,7420 | 0,6910 | 0,7117 | 0,7013 | 0,0108 | |
| SVC | 0,7587 | 0,6711 | 0,7284 | 0,6998 | 0,0692 | fora (estabilidade) |
| SVCBalanced | 0,7395 | 0,6981 | 0,6906 | 0,6944 | 0,0807 | fora (estabilidade) |
| LinearDiscriminantAnalysis | 0,7570 | 0,6817 | 0,6905 | 0,6861 | 0,0068 | |
| DecisionTreeClassifier | 0,7366 | 0,6634 | 0,7019 | 0,6826 | 0,0659 | fora (estabilidade) |
| DecisionTreeBalanced | 0,7070 | 0,6713 | 0,6711 | 0,6712 | 0,0622 | fora (estabilidade) |
| GaussianNB | 0,6719 | 0,5705 | 0,6905 | 0,6305 | 0,0066 | |
| KNeighborsClassifier | 0,7109 | 0,5987 | 0,6483 | 0,6235 | 0,0343 | |

- **Por que `LogisticRegression`:** tem o melhor score entre os elegíveis (0,7205). O único
  equivalente, `LogisticRegressionBalanced` (0,7124), tem distância treino-validação maior.
- **Custo frente ao melhor excluído (`RandomForestBalanced`):** −0,0331 de F1 macro e
  **+0,0052 de revocação de `Dropout`**. O modelo escolhido encontra mais evasores que a
  floresta; toda a vantagem dela está no F1 macro, concentrada nas classes que não são
  `Dropout`, sobretudo `Enrolled`. Esse é o argumento para defender a escolha, não a ideia
  de que a floresta "memoriza".
- **No teste (usado uma única vez):** acurácia 0,7684, acurácia balanceada 0,6754, F1 macro
  0,6826, revocação de `Dropout` 0,7676.

Esta tabela é um retrato do treino de 08/09/2026: a seleção é dinâmica, e um retreino pode
eleger outro algoritmo. A fonte de verdade é o `model_metadata.json` (`candidates`,
`selection_criteria` e o texto completo em `selection_rationale`), exposto em
`GET /api/models/active`. Ao retreinar, atualize esta seção.

A comparação dos candidatos não aparece nas telas da Web nem do Mobile. Ela é informação
técnica de quem desenvolve e defende o modelo, e por isso fica documentada aqui.

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

### Mensageria (Kafka REST, Aiven)

Além da API HTTP, o serviço atende o **lote de análise** pelo Kafka quando
`KAFKA_ENABLED=true`. O consumidor roda dentro do mesmo processo Node e usa o mesmo
`classifyBatch` (e o mesmo `pythonRunner.js`) do `POST /api/classify/batch` — não há
serviço Python separado.

```text
consome pae.analysis.requested  { jobId, records: [atributos...] }
publica pae.analysis.completed  { jobId, status: "SUCCEEDED", model, results }
                              ou { jobId, status: "FAILED", error: { code, message } }
```

- A mensagem de pedido **não identifica o estudante**: só atributos. Quem liga resultado
  a estudante é o `backend-Project`, pelo índice do registro.
- Pedido inválido não trava o consumidor: vira resposta `FAILED` (ex.: `INVALID_FEATURES`)
  e o offset é confirmado. Só falha ao publicar a resposta provoca nova tentativa.
- Arquivos: `src/lib/kafkaRest.js` (cliente REST, idêntico ao do `backend-Project`),
  `src/lib/messaging.js` (liga/desliga pelo `.env`) e
  `src/modules/classification/classification.consumer.js`.
- Variáveis `KAFKA_*` no `.env.example`. O grupo de consumo deste serviço
  (`KAFKA_CONSUMER_GROUP`) precisa ser diferente do usado no `backend-Project`.

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
│   ├── Classificacao_Evasao_Estudantes.ipynb   processo de mineração documentado (dev-only)
│   ├── environment.yml          ambiente conda (Python 3.9)
│   ├── requirements.txt         ambiente mínimo de execução
│   ├── artifacts/               modelo, scaler e metadados (gerados)
│   └── reports/                 relatórios e figuras (gerados)
├── prisma/schema.prisma         MlModel
└── src/
    ├── config/                  env, swagger
    ├── lib/
    │   ├── prisma.js            único acesso ao MongoDB
    │   ├── kafkaRest.js         cliente da API REST do Kafka (Aiven)
    │   └── messaging.js         liga/desliga a mensageria pelo .env
    ├── ml/                      pythonRunner (ponte), artifacts, validation
    ├── middlewares/             apiKeyAuth, errorHandler
    ├── modules/                 classification (+ consumidor Kafka), models, health
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
