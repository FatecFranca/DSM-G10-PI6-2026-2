# backend-Project

API REST principal do projeto Predict Students' Dropout and Academic Success Classification
(PI 6º semestre).

Autenticação, usuários, instituições, estudantes, análises, acompanhamentos e indicadores.
É o único back-end acessado pelos clientes Web e Mobile; as classificações são obtidas do
`backend-MD`, por HTTP ou Kafka.

## Stack

| Camada | Tecnologia |
| --- | --- |
| API | Node.js, Express 5.2.1 |
| Banco | MongoDB, Prisma 6.19.3 (database `Mongo-PI-Backend-Project`) |
| Autenticação | jsonwebtoken 9.0.3, bcryptjs 3.0.3 |
| E-mail | nodemailer (SMTP) |
| Mensageria | Kafka (Aiven) via API REST v2 |
| Documentação | swagger-jsdoc 6.3.0, swagger-ui-express 5.0.1 |

## Instalação

Requisitos: Node.js, acesso ao cluster MongoDB e `backend-MD` em execução.

```bash
npm install
```

O `postinstall` executa `prisma generate` e `src/scripts/setup.js`, que é idempotente:

1. cria `.env` a partir de `.env.example`, se não existir;
2. executa `prisma db push`;
3. cria a instituição e os usuários de demonstração, se não existirem (não executa com
   `NODE_ENV=production`).

Falhas geram aviso e não interrompem o `npm install`. Após preencher o `.env`, executar
`npm run setup`.

Geração de `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Variáveis de ambiente

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `3004` | Porta HTTP |
| `NODE_ENV` | `development` | Em `production`, variável obrigatória ausente impede a subida |
| `DB_URL` | | String de conexão MongoDB (obrigatória) |
| `JWT_SECRET` | | Chave de assinatura do JWT (obrigatória) |
| `AUTH_EXPIRES` | `1d` | Validade do JWT |
| `BCRYPT_ROUNDS` | `10` | Custo do hash de senha |
| `MD_API_BASE_URL` | `http://localhost:3003/api/` | URL do `backend-MD` |
| `MD_API_KEY` | | Mesmo valor do `backend-MD` (obrigatória) |
| `MD_TIMEOUT_MS` | `40000` | Timeout das chamadas ao `backend-MD` |
| `CORS_ORIGINS` | `http://localhost:5173` | Origens permitidas, separadas por vírgula |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | porta `587` | Envio do e-mail de recuperação de senha |
| `FRONTEND_URL` | `http://localhost:5173` | Base do link de redefinição de senha |
| `KAFKA_ENABLED` | `false` | Liga o lote de análise via Kafka |
| `KAFKA_REST_URL`, `KAFKA_REST_USERNAME`, `KAFKA_REST_PASSWORD` | | Acesso à API REST do Kafka |
| `KAFKA_TOPIC_ANALYSIS_REQUESTED`, `KAFKA_TOPIC_ANALYSIS_COMPLETED` | | Tópicos |
| `KAFKA_CONSUMER_GROUP` | | Grupo de consumo (`backend-project`) |

Com `KAFKA_ENABLED=true`, todas as variáveis `KAFKA_*` passam a ser obrigatórias.

### Scripts

| Comando | Ação |
| --- | --- |
| `npm start` | `node src/server.js` |
| `npm run start:prod` | Igual ao anterior, com `NODE_ENV=production` |
| `npm run dev` | nodemon |
| `npm run setup` | Reexecuta `src/scripts/setup.js` |
| `npm run prisma:push` | Sincroniza o schema (necessário após alterar `schema.prisma`) |
| `npm run seed` | Instituição e usuários de demonstração |
| `npm run seed:students -- --count=90` | Estudantes a partir do CSV do dataset (requer `backend-MD` ativo) |

| Recurso | URL local |
| --- | --- |
| API | `http://localhost:3004/api` |
| Swagger | `http://localhost:3004/api/docs` |
| Health check | `http://localhost:3004/api/health` |

### Usuários de demonstração

Criados apenas fora de produção.

| E-mail | Senha | Papel |
| --- | --- | --- |
| `admin@pi6.local` | `Admin@123456` | `ADMIN` |
| `analista@pi6.local` | `Analista@123456` | `ANALYST` |
| `consulta@pi6.local` | `Consulta@123456` | `VIEWER` |

## Autenticação

`POST /api/auth/login` retorna um JWT, enviado nas demais requisições em
`Authorization: Bearer <token>`. O usuário é consultado no banco a cada requisição, então
desativação e troca de papel têm efeito imediato.

| Papel | Permissões |
| --- | --- |
| `ADMIN` | Todas as instituições; usuários, instituições e Mineração de Dados |
| `ANALYST` | Estudantes, análises e acompanhamentos da própria instituição |
| `VIEWER` | Leitura na própria instituição |

Usuários não ADMIN ficam restritos à instituição vinculada (`src/middlewares/auth.js`).

### Recuperação de senha

1. `POST /api/auth/forgot-password { email }` responde sempre com a mesma mensagem.
2. Para contas `VIEWER` ativas, gera um token de 32 bytes, grava o hash SHA-256 em
   `users.passwordResetTokenHash` e envia `FRONTEND_URL/reset-password?token=...` por SMTP.
3. `POST /api/auth/reset-password { token, newPassword }` aceita o token uma única vez, em
   até 30 minutos.

Sem SMTP configurado, a solicitação é registrada no log e nenhum e-mail é enviado.
Senhas de `ADMIN` e `ANALYST` são redefinidas por um administrador em
`POST /api/users/{id}/password`.

## Integração com o backend-MD

`src/services/mdClient.js` é o único módulo que chama o `backend-MD`. Envia
`X-API-Key: <MD_API_KEY>` e não repassa o JWT do usuário.

| Resposta do `backend-MD` | Resposta deste serviço |
| --- | --- |
| `422` (atributos inválidos) | `422` |
| `401`/`403` (API Key recusada) | `502 ML_SERVICE_UNAUTHORIZED` |
| Sem resposta | `503 ML_SERVICE_UNREACHABLE` |
| Timeout (`MD_TIMEOUT_MS`) | `504 ML_SERVICE_TIMEOUT` |
| `MD_API_KEY` vazia | `503 ML_SERVICE_NOT_CONFIGURED` (sem chamada) |

### Prioridade de acompanhamento

Calculada em `src/modules/analyses/priority.js` a partir da classe e da confiança.

| Classe | Confiança | Prioridade | Texto |
| --- | --- | --- | --- |
| `Dropout` | ≥ 0,6 | `HIGH` | Acompanhamento prioritário |
| `Dropout` | < 0,6 | `MEDIUM` | Acompanhamento recomendado |
| `Enrolled` | qualquer | `MEDIUM` | Observação continuada (desfecho em aberto) |
| `Graduate` | ≥ 0,6 | `LOW` | Sem indicativo de prioridade |
| `Graduate` | < 0,6 | `MEDIUM` | Observação continuada |

### Lote de análise

`POST /api/analyses/batch` aceita até 200 estudantes.

`KAFKA_ENABLED=false`: chamada HTTP a `POST /classify/batch` do `backend-MD`, resposta
`200` com os resultados.

`KAFKA_ENABLED=true`:

```text
POST /api/analyses/batch
  -> cria AnalysisJob (QUEUED), responde 202 { id, status }
  -> publica pae.analysis.requested { jobId, records }
backend-MD
  -> publica pae.analysis.completed { jobId, status, model, results | error }
consumidor (grupo backend-project)
  -> grava Analysis com jobId, atualiza Student, job DONE ou FAILED
cliente
  -> GET /api/analyses/jobs/{id} até DONE ou FAILED
```

- `records` contém só atributos. Os itens (`studentId`, `institutionId`, `features`) ficam
  no `AnalysisJob` e são associados pelo índice.
- O consumidor ignora jobs que não estão em `QUEUED` e não grava duas análises com o mesmo
  `jobId` para o mesmo estudante.
- Falha ao publicar: job `FAILED` e resposta `503 MESSAGING_UNAVAILABLE`.
- Com o `backend-MD` parado, o pedido permanece no tópico (retenção de 72 h) e o job em
  `QUEUED`.
- Os tópicos são criados no console do Aiven.

| Arquivo | Função |
| --- | --- |
| `src/lib/kafkaRest.js` | Cliente da API REST v2 (mesmo arquivo do `backend-MD`) |
| `src/lib/messaging.js` | Inicialização a partir das variáveis `KAFKA_*` |
| `src/modules/analyses/analysisJobs.js` | Publicação do lote, consulta do job, consumidor |

## Endpoints

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `GET` | `/api/health` | público | Estado da API, banco e `backend-MD` |
| `POST` | `/api/auth/login` | público | Retorna JWT |
| `POST` | `/api/auth/forgot-password` | público | Solicita link de redefinição |
| `POST` | `/api/auth/reset-password` | público | Redefine a senha com o token |
| `GET` | `/api/auth/me` | autenticado | Usuário atual |
| `POST` | `/api/auth/change-password` | autenticado | Troca a própria senha |
| `GET` | `/api/students` | autenticado | Lista, com filtros e paginação |
| `GET` | `/api/students/feature-contract` | autenticado | Contrato de atributos do modelo |
| `GET` | `/api/students/{id}` | autenticado | Detalhe, histórico e acompanhamentos |
| `POST` | `/api/students` | ADMIN, ANALYST | Cadastro |
| `PATCH` | `/api/students/{id}` | ADMIN, ANALYST | Atualização; `features` é mesclado |
| `DELETE` | `/api/students/{id}` | ADMIN, ANALYST | Desativação |
| `GET` | `/api/analyses` | autenticado | Histórico, com filtros |
| `GET` | `/api/analyses/{id}` | autenticado | Detalhe e `featuresSnapshot` |
| `POST` | `/api/analyses/student/{id}` | ADMIN, ANALYST | Analisa e grava |
| `POST` | `/api/analyses/batch` | ADMIN, ANALYST | Lote (`200` ou `202`) |
| `GET` | `/api/analyses/jobs/{id}` | solicitante, ADMIN | Situação do lote |
| `POST` | `/api/analyses/simulate` | ADMIN, ANALYST | Classifica sem gravar |
| `GET` | `/api/follow-ups` | autenticado | Lista |
| `GET` | `/api/follow-ups/{id}` | autenticado | Detalhe |
| `POST` | `/api/follow-ups` | ADMIN, ANALYST | Abertura |
| `PATCH` | `/api/follow-ups/{id}` | ADMIN, ANALYST | Atualização |
| `GET` | `/api/dashboard` | autenticado | Indicadores |
| `GET` | `/api/dashboard/timeline` | autenticado | Série temporal por classe |
| `GET` | `/api/dashboard/institutions` | ADMIN | Comparativo por instituição |
| `GET` | `/api/datamining/model` | ADMIN | Metadados do modelo (repassados do `backend-MD`) |
| `GET` | `/api/users`, `/api/users/{id}` | ADMIN | Consulta |
| `POST` | `/api/users` | ADMIN | Cadastro |
| `PATCH` | `/api/users/{id}` | ADMIN | Atualização |
| `POST` | `/api/users/{id}/password` | ADMIN | Redefine a senha |
| `DELETE` | `/api/users/{id}` | ADMIN | Desativação |
| `GET` | `/api/institutions`, `/api/institutions/{id}` | autenticado | Consulta |
| `POST` | `/api/institutions` | ADMIN | Cadastro |
| `PATCH` | `/api/institutions/{id}` | ADMIN | Atualização |
| `DELETE` | `/api/institutions/{id}` | ADMIN | Desativação |

### Erros

Formato: `{ "error": "<CODIGO>", "message": "...", "details": ... }`

| HTTP | Códigos |
| --- | --- |
| 400 | `INVALID_JSON`, `INVALID_BODY`, `INVALID_ID`, `RESET_TOKEN_INVALID`, `PASSWORD_NOT_CHANGED`, `CANNOT_DEACTIVATE_SELF`, `CANNOT_CHANGE_OWN_ROLE`, `STUDENT_INACTIVE` |
| 401 | `INVALID_CREDENTIALS`, `TOKEN_MISSING`, `TOKEN_INVALID`, `TOKEN_EXPIRED` |
| 403 | `INSUFFICIENT_ROLE`, `INSTITUTION_MISMATCH`, `NO_INSTITUTION_SCOPE`, `USER_INACTIVE` |
| 404 | `ROUTE_NOT_FOUND`, `USER_NOT_FOUND`, `INSTITUTION_NOT_FOUND`, `STUDENT_NOT_FOUND`, `ANALYSIS_NOT_FOUND`, `ANALYSIS_JOB_NOT_FOUND`, `FOLLOWUP_NOT_FOUND` |
| 409 | `EMAIL_ALREADY_USED`, `INSTITUTION_NAME_IN_USE`, `STUDENT_CODE_IN_USE`, `DUPLICATE_VALUE`, `RELATION_CONSTRAINT` |
| 422 | `VALIDATION_ERROR`, `INCOMPLETE_STUDENT_FEATURES`, `INVALID_STUDENT_FEATURES`, `NO_ELIGIBLE_STUDENTS` |
| 502 | `ML_SERVICE_ERROR`, `ML_SERVICE_UNAUTHORIZED`, `ML_INVALID_RESPONSE` |
| 503 | `ML_SERVICE_NOT_CONFIGURED`, `ML_SERVICE_UNREACHABLE`, `MODEL_NOT_TRAINED`, `MESSAGING_UNAVAILABLE` |
| 504 | `ML_SERVICE_TIMEOUT` |

## Modelo de dados

| Coleção | Conteúdo |
| --- | --- |
| `users` | Nome, e-mail, hash da senha, papel (`ADMIN`, `ANALYST`, `VIEWER`), instituição, token de redefinição |
| `institutions` | Instituições atendidas |
| `students` | Cadastro, 36 atributos e resumo da última análise (`lastClassification`, `lastPriority`, ...) |
| `analyses` | Uma entrada por execução: classe, confiança, probabilidades, prioridade, `modelVersion`, `algorithm`, `featuresSnapshot`, `jobId` |
| `analysis_jobs` | Lotes via Kafka: `QUEUED`, `DONE` ou `FAILED`, itens e contagens |
| `follow_ups` | Acompanhamentos: `OPEN`, `IN_PROGRESS`, `DONE` ou `CANCELLED` |

- Análises não são alteradas após a gravação.
- A análise e o resumo no estudante são gravados na mesma transação.
- `DELETE` em usuários, instituições e estudantes define `active = false`.

## Estrutura

```text
backend-Project/
├── prisma/schema.prisma
└── src/
    ├── config/                   env, swagger
    ├── lib/                      prisma, mailer, kafkaRest, messaging
    ├── middlewares/              auth (JWT, papéis, escopo), errorHandler
    ├── services/
    │   ├── mdClient.js           cliente do backend-MD
    │   └── featureContract.js    contrato de atributos em cache
    ├── modules/
    │   ├── auth/
    │   ├── users/
    │   ├── institutions/
    │   ├── students/
    │   ├── analyses/             rotas, priority.js, analysisJobs.js
    │   ├── followups/
    │   ├── dashboard/
    │   ├── datamining/
    │   └── health/
    ├── utils/                    AppError, validate
    ├── scripts/                  setup, seed, seedStudents
    ├── app.js
    └── server.js
```
