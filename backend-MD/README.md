# backend-MD

Serviço de classificação e Mineração de Dados do projeto Predict Students' Dropout and
Academic Success Classification (PI 6º semestre).

Classifica um estudante em `Dropout`, `Enrolled` ou `Graduate` a partir de 36 atributos e
publica os metadados do modelo em uso. Consumido apenas pelo `backend-Project`, autenticado
por API Key. Não possui interface, usuários nem dados de negócio.

## Stack

| Camada | Tecnologia |
| --- | --- |
| API | Node.js, Express 5.2.1 |
| ML | Python 3.9, scikit-learn 1.6.1, pandas 2.3.3, numpy 2.0.2, joblib 1.5.2 |
| Banco | MongoDB, Prisma 6.19.3 (database `Mongo-PI-Backend-MD`, coleção `ml_models`) |
| Mensageria | Kafka (Aiven) via API REST v2 |
| Documentação | swagger-jsdoc 6.3.0, swagger-ui-express 5.0.1 |

A API executa `ML/predict.py` via `child_process` a cada requisição de classificação. A
entrada é enviada em JSON pelo stdin e a saída lida do stdout. O custo de inicialização do
interpretador é de ~1-2 s por chamada; para mais de um estudante, usar
`POST /api/classify/batch`. Processos simultâneos são limitados por `ML_MAX_CONCURRENCY`.

## Instalação

Requisitos: Node.js, Python 3.9+ e acesso ao cluster MongoDB.

```bash
npm install
```

O `postinstall` executa `prisma generate` e `src/scripts/setup.js`, que é idempotente:

1. cria `.env` a partir de `.env.example`, se não existir;
2. executa `prisma db push`;
3. cria o ambiente virtual em `ML/.venv` e instala `ML/requirements.txt`. Interpretador
   procurado, em ordem: `py -3.10`, `py -3.9`, `python` (Windows); `python3.10`,
   `python3.9`, `python3`, `python` (demais);
4. executa `prepare_data.py` e `train_model.py`, se os artefatos não existirem;
5. registra o modelo atual na coleção `ml_models`.

Falhas em qualquer etapa geram aviso e não interrompem o `npm install`. Após preencher o
`.env`, executar `npm run setup` para concluir as etapas pendentes.

Geração de `MD_API_KEY` (o valor deve ser o mesmo no `.env` do `backend-Project`):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Variáveis de ambiente

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `3003` | Porta HTTP |
| `NODE_ENV` | `development` | Em `production`, variável obrigatória ausente impede a subida |
| `DB_URL` | | String de conexão MongoDB (obrigatória) |
| `MD_API_KEY` | | Chave de serviço compartilhada com o `backend-Project` (obrigatória) |
| `CORS_ORIGINS` | vazio | Origens permitidas, separadas por vírgula |
| `PYTHON_BIN` | `ML/.venv`, se existir; senão `python`/`python3` | Interpretador Python |
| `ML_TIMEOUT_MS` | `30000` | Tempo máximo de execução do script Python |
| `ML_MAX_BATCH_SIZE` | `500` | Registros por lote |
| `ML_MAX_CONCURRENCY` | núcleos − 1 (mín. 2) | Processos Python simultâneos |
| `KAFKA_ENABLED` | `false` | Liga o consumidor Kafka |
| `KAFKA_REST_URL`, `KAFKA_REST_USERNAME`, `KAFKA_REST_PASSWORD` | | Acesso à API REST do Kafka |
| `KAFKA_TOPIC_ANALYSIS_REQUESTED`, `KAFKA_TOPIC_ANALYSIS_COMPLETED` | | Tópicos de entrada e saída |
| `KAFKA_CONSUMER_GROUP` | | Grupo de consumo (`backend-md`) |

### Scripts

| Comando | Ação |
| --- | --- |
| `npm start` | `node src/server.js` |
| `npm run start:prod` | Igual ao anterior, com `NODE_ENV=production` |
| `npm run dev` | nodemon |
| `npm run setup` | Reexecuta `src/scripts/setup.js` |
| `npm run prisma:push` | Sincroniza o schema |
| `npm run ml:prepare` | `prepare_data.py` |
| `npm run ml:train` | `train_model.py` |
| `npm run ml:pipeline` | `ml:prepare` seguido de `ml:train` |
| `npm run ml:explore` | `explore.py` (gera figuras em `ML/reports/figures/`) |
| `npm run ml:register` | Registra os artefatos atuais em `ml_models` e desativa as versões anteriores |

Ambiente conda, como alternativa ao `.venv`:

```bash
conda env create -f ML/environment.yml
conda activate pi6-backend-md-ml
```

| Recurso | URL local |
| --- | --- |
| API | `http://localhost:3003/api` |
| Swagger | `http://localhost:3003/api/docs` |
| Health check | `http://localhost:3003/api/health` |

## Pipeline de ML

| Etapa | Arquivo | Entrada | Saída |
| --- | --- | --- | --- |
| Ambiente | `ML/environment.yml`, `ML/requirements.txt` | | ambiente Python |
| Preparação | `ML/prepare_data.py` | CSV bruto | `data/processed/`, `artifacts/label_map.json`, `artifacts/feature_spec.json`, `reports/preparation_report.json` |
| Treinamento | `ML/train_model.py` | dataset tratado | `artifacts/model.pkl`, `artifacts/scaler.pkl`, `artifacts/model_metadata.json` |
| Inferência | `ML/predict.py` | JSON (stdin) | JSON (stdout) |
| Exploração | `ML/explore.py` | dataset tratado | `reports/figures/*.png` |
| Notebook | `ML/Classificacao_Evasao_Estudantes.ipynb` | CSV bruto | processo de Mineração de Dados documentado; não grava em `artifacts/` |

`ML/config.py` concentra caminhos, contrato de atributos, `RANDOM_STATE = 42`,
`TEST_SIZE = 0.20` e `CV_SPLITS = 10`.

### Dataset

`ML/predic-students-dataset.csv`: 4.424 registros, 36 atributos e a coluna `Target`.
Separador `;`, UTF-8 com BOM. Sem valores ausentes e sem duplicatas.

| Classe | Código | Registros | % |
| --- | ---: | ---: | ---: |
| `Dropout` | 0 | 1.421 | 32,1 |
| `Enrolled` | 1 | 794 | 17,9 |
| `Graduate` | 2 | 2.209 | 49,9 |

### Seleção do modelo

Implementada em `select_final` (`ML/train_model.py`):

1. Divisão estratificada 80/20 (desenvolvimento/teste).
2. 13 candidatos avaliados por `StratifiedKFold` de 10 folds sobre o conjunto de
   desenvolvimento. Cada candidato roda em `Pipeline(StandardScaler, estimador)`, com o
   scaler reajustado em cada fold.
3. Exclusão dos candidatos com diferença entre acurácia de treino e de validação acima de
   `MAX_OVERFIT_GAP = 0.05`.
4. Score: `0.5 × F1 macro + 0.5 × recall(Dropout)`.
5. Candidatos a até `EQUIVALENCE_TOLERANCE = 0.01` do melhor score são equivalentes; vence
   o de menor diferença treino-validação.
6. Avaliação única no conjunto de teste.
7. Registro da diferença em F1 macro e recall de `Dropout` frente ao melhor candidato
   excluído (`selection_criteria.cost_vs_best_excluded`).

### Treino atual

`LogisticRegression-20260908T131859`. Médias da validação cruzada (10 folds):

| Algoritmo | Acurácia | F1 macro | Recall Dropout | Score | Gap treino-val. | Situação |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| RandomForestBalanced | 0,7776 | 0,7105 | 0,7583 | 0,7344 | 0,2065 | excluído |
| GradientBoostingClassifier | 0,7742 | 0,6979 | 0,7653 | 0,7316 | 0,0727 | excluído |
| RandomForestClassifier | 0,7737 | 0,6869 | 0,7618 | 0,7244 | 0,1956 | excluído |
| LogisticRegression | 0,7652 | 0,6774 | 0,7635 | 0,7205 | 0,0087 | selecionado |
| LogisticRegressionBalanced | 0,7471 | 0,7069 | 0,7178 | 0,7124 | 0,0120 | equivalente |
| LinearDiscriminantAnalysisDropoutPrior | 0,7420 | 0,6910 | 0,7117 | 0,7013 | 0,0108 | |
| SVC | 0,7587 | 0,6711 | 0,7284 | 0,6998 | 0,0692 | excluído |
| SVCBalanced | 0,7395 | 0,6981 | 0,6906 | 0,6944 | 0,0807 | excluído |
| LinearDiscriminantAnalysis | 0,7570 | 0,6817 | 0,6905 | 0,6861 | 0,0068 | |
| DecisionTreeClassifier | 0,7366 | 0,6634 | 0,7019 | 0,6826 | 0,0659 | excluído |
| DecisionTreeBalanced | 0,7070 | 0,6713 | 0,6711 | 0,6712 | 0,0622 | excluído |
| GaussianNB | 0,6719 | 0,5705 | 0,6905 | 0,6305 | 0,0066 | |
| KNeighborsClassifier | 0,7109 | 0,5987 | 0,6483 | 0,6235 | 0,0343 | |

Diferença frente a `RandomForestBalanced`: −0,0331 de F1 macro, +0,0052 de recall de
`Dropout`.

Conjunto de teste (885 registros):

| Métrica | Valor |
| --- | ---: |
| Acurácia | 0,7684 |
| Acurácia balanceada | 0,6754 |
| F1 macro | 0,6826 |
| Recall `Dropout` | 0,7676 |
| ECE | 0,0159 |
| MCE | 0,0638 |
| Log loss | 0,5846 |

Valores do treino de 08/09/2026. A fonte é `ML/artifacts/model_metadata.json`, exposto em
`GET /api/models/active`.

### Metadados registrados

Cada treino grava em `model_metadata.json`: hiperparâmetros, hash SHA-256 do dataset, ordem
das features, métricas de validação e de teste (matriz de confusão 3x3 e relatório por
classe incluídos), métricas de calibração, versões de Python e bibliotecas e data do
treinamento.

## API

Todas as rotas, exceto `/api/health` e `/api/docs`, exigem `X-API-Key: <MD_API_KEY>`
(alternativa: `Authorization: Bearer <MD_API_KEY>`).

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/health` | Estado da API, do banco e da camada de ML |
| `GET` | `/api/features` | Contrato de atributos (`feature_spec.json`) |
| `POST` | `/api/classify` | Classifica um registro |
| `POST` | `/api/classify/batch` | Classifica até `ML_MAX_BATCH_SIZE` registros |
| `GET` | `/api/models/active` | Metadados do modelo carregado do disco |
| `GET` | `/api/models` | Versões registradas em `ml_models` |
| `GET` | `/api/models/{version}` | Metadados de uma versão |
| `POST` | `/api/models/register` | Registra os artefatos atuais |

```bash
curl -X POST http://localhost:3003/api/classify \
  -H "X-API-Key: $MD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"features": { "...": "36 atributos" }}'
```

```json
{
  "classification": "Dropout",
  "classId": 0,
  "confidence": 0.999,
  "probabilities": { "Dropout": 0.999, "Enrolled": 0.001, "Graduate": 0.0 },
  "model": { "version": "LogisticRegression-20260908T131859", "algorithm": "LogisticRegression" },
  "disclaimer": "..."
}
```

`confidence` é a probabilidade estimada para a classe prevista.

### Erros

Formato: `{ "error": "<CODIGO>", "message": "...", "details": ... }`

| Código | HTTP | Causa |
| --- | --- | --- |
| `API_KEY_MISSING` | 401 | Header ausente |
| `API_KEY_INVALID` | 401 | Chave diferente de `MD_API_KEY` |
| `API_KEY_NOT_CONFIGURED` | 503 | `MD_API_KEY` vazia no servidor |
| `INVALID_FEATURES` | 422 | Atributo ausente ou não numérico |
| `EMPTY_RECORDS` | 400 | Lote sem registros |
| `BATCH_TOO_LARGE` | 400 | Lote acima de `ML_MAX_BATCH_SIZE` |
| `MODEL_NOT_TRAINED` | 503 | Artefatos ausentes em `ML/artifacts/` |
| `FEATURE_SPEC_UNAVAILABLE` | 503 | `feature_spec.json` ausente |
| `ML_RUNTIME_UNAVAILABLE` | 503 | Interpretador Python não encontrado |
| `ML_TIMEOUT` | 504 | Execução acima de `ML_TIMEOUT_MS` |
| `MODEL_VERSION_NOT_FOUND` | 404 | Versão inexistente em `ml_models` |

## Mensageria

Com `KAFKA_ENABLED=true`, um consumidor no mesmo processo Node atende o lote de análise
usando o mesmo `classifyBatch` da rota HTTP.

| Tópico | Papel | Payload |
| --- | --- | --- |
| `pae.analysis.requested` | consome (grupo `backend-md`) | `{ jobId, records }` |
| `pae.analysis.completed` | produz | `{ jobId, status: "SUCCEEDED", model, results }` ou `{ jobId, status: "FAILED", error }` |

- `records` contém somente atributos; a correlação com o estudante é feita pelo índice no
  `backend-Project`.
- Erro de validação gera resposta `FAILED` e o offset é confirmado. Falha ao publicar a
  resposta mantém o offset e a mensagem é reprocessada.
- Os tópicos são criados no console do Aiven; a API REST não cria tópicos.

| Arquivo | Função |
| --- | --- |
| `src/lib/kafkaRest.js` | Cliente da API REST v2 (mesmo arquivo do `backend-Project`) |
| `src/lib/messaging.js` | Inicialização a partir das variáveis `KAFKA_*` |
| `src/modules/classification/classification.consumer.js` | Consumidor do lote |

## Estrutura

```text
backend-MD/
├── ML/
│   ├── config.py                 caminhos, contrato de atributos, sementes
│   ├── prepare_data.py
│   ├── train_model.py
│   ├── predict.py                inferência (stdin/stdout)
│   ├── explore.py
│   ├── Classificacao_Evasao_Estudantes.ipynb
│   ├── environment.yml
│   ├── requirements.txt
│   ├── predic-students-dataset.csv
│   ├── data/processed/           gerado
│   ├── artifacts/                gerado: model.pkl, scaler.pkl, *.json
│   └── reports/                  gerado
├── prisma/schema.prisma          MlModel
└── src/
    ├── config/                   env, swagger
    ├── lib/                      prisma, kafkaRest, messaging
    ├── ml/                       pythonRunner, artifacts, validation
    ├── middlewares/              apiKeyAuth, errorHandler
    ├── modules/                  classification, models, health
    ├── scripts/                  setup, runMl, registerModel
    ├── app.js
    └── server.js
```
