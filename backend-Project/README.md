# backend-Project — API principal da plataforma

Núcleo de negócio, API REST e orquestração da plataforma
**Predict Students' Dropout and Academic Success Classification** (PI do 6º semestre).

É a interface oficial de comunicação dos clientes **Web, Mobile e Desktop** com o
Back-End, e o **gateway único** para dados e para resultados de IA: nenhum cliente fala
com o `backend-MD` diretamente.

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| API | Node.js + Express 5.2.1 |
| Banco | MongoDB via Prisma 6.19.3 (database `Mongo-PI-Backend-Project`) |
| Autenticação | JWT (`jsonwebtoken`) + hash de senha com bcryptjs |
| Documentação | swagger-jsdoc + swagger-ui-express |

---

## Instalação

```bash
npm install
npm start
```

> `npm start` roda em primeiro plano (`node src/server.js`, sem daemon). Use uma aba de
> terminal dedicada a este serviço — `Ctrl+C` nela para só o `backend-Project`, sem afetar
> o `backend-MD` nem o Front-End, desde que cada um rode na sua própria aba.

`npm install` faz **tudo sozinho** (hook `postinstall` → `src/scripts/setup.js`), de forma
idempotente:

1. cria o `.env` a partir de `.env.example`, se ainda não existir;
2. sincroniza o schema com o MongoDB (`prisma db push`);
3. cria a instituição e os usuários de demonstração, se ainda não existirem (pulado
   automaticamente quando `NODE_ENV=production`, porque usam senhas padrão).

Nenhum passo interrompe o `npm install` se falhar (banco fora do ar): o script avisa e
segue, e `npm start` reporta o mesmo problema com mais detalhe.

**Só é necessário editar algo manualmente** se o `.env` acabou de ser criado a partir do
exemplo: preencha `DB_URL`, gere `JWT_SECRET` e `MD_API_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # JWT_SECRET
```

`MD_API_KEY` deve ser **idêntico** ao configurado no `backend-MD` — é o segredo
compartilhado entre os dois serviços. Depois, rode `npm install` de novo (ou
`npm run setup`) para o script terminar o provisionamento.

- API: `http://localhost:3004`
- Documentação: `http://localhost:3004/api/docs`
- Saúde: `http://localhost:3004/api/health`

### Dados de demonstração

`npm install` já cria a instituição e os três usuários (um por papel). Para popular o
painel com estudantes reais do dataset (requer o `backend-MD` no ar — o contrato de
atributos vem de lá, e as colunas do CSV são mapeadas por posição contra esse contrato):

```bash
npm run seed:students -- --count=90
```

Depois, analise o lote via `POST /api/analyses/batch` para os indicadores aparecerem no
painel.

Usuários criados pelo seed (apenas desenvolvimento — o script recusa rodar em produção):

| E-mail | Senha | Papel |
| --- | --- | --- |
| `admin@pi6.local` | `Admin@123456` | ADMIN |
| `analista@pi6.local` | `Analista@123456` | ANALYST |
| `consulta@pi6.local` | `Consulta@123456` | VIEWER |

---

## Autenticação e papéis

Login em `POST /api/auth/login` devolve um JWT, enviado depois em
`Authorization: Bearer <token>`.

| Papel | Pode |
| --- | --- |
| `ADMIN` | Tudo, em todas as instituições; administra usuários e instituições |
| `ANALYST` | Cadastrar estudantes, executar análises e conduzir acompanhamentos na própria instituição |
| `VIEWER` | Somente leitura no escopo da própria instituição |

**Escopo por instituição:** usuários que não são ADMIN só alcançam dados da instituição a
que estão vinculados (`middlewares/auth.js`).

Desativar ou rebaixar um usuário tem efeito imediato, sem esperar o token expirar.

---

## Integração com o backend-MD

```text
cliente → backend-Project (valida, aplica regra de negócio)
        → backend-MD (classifica)
        → backend-Project (deriva prioridade, grava histórico)
        → cliente
```

A chamada ao `backend-MD` é autenticada por **API Key** no header `X-API-Key`
(`MD_API_KEY`, mesmo valor nos dois serviços).

`src/services/mdClient.js` é o único módulo que chama o `backend-MD` e traduz as falhas
dele: atributo inválido continua `422`; API Key recusada vira `502`
(`ML_SERVICE_UNAUTHORIZED`).

**Prioridade de acompanhamento** (`src/modules/analyses/priority.js`): a partir da classe
e da confiança devolvidas pelo `backend-MD`, este serviço define a prioridade.

| Resultado | Prioridade | Leitura |
| --- | --- | --- |
| `Dropout`, confiança ≥ 0,6 | HIGH | Acompanhamento prioritário |
| `Dropout`, confiança < 0,6 | MEDIUM | Acompanhamento recomendado |
| `Enrolled` | MEDIUM | Observação continuada (desfecho em aberto) |
| `Graduate`, confiança ≥ 0,6 | LOW | Sem indicativo de prioridade |
| `Graduate`, confiança < 0,6 | MEDIUM | Observação continuada |

### Lote de análise via mensageria (Kafka REST, Aiven)

Com `KAFKA_ENABLED=true`, `POST /api/analyses/batch` deixa de chamar o `backend-MD` por
HTTP e passa a conversar com ele pelo Kafka:

```text
POST /analyses/batch → AnalysisJob QUEUED → 202 { id, status }
                     → publica pae.analysis.requested { jobId, records }
backend-MD classifica → publica pae.analysis.completed { jobId, status, model, results }
consumidor deste serviço → grava Analysis (com jobId) + atualiza Student → job DONE/FAILED
cliente → GET /analyses/jobs/{id} até DONE ou FAILED
```

| Arquivo | Papel |
| --- | --- |
| `src/lib/kafkaRest.js` | Cliente da API REST v2 do Kafka (produzir, consumir, confirmar offset). Idêntico ao do `backend-MD` |
| `src/lib/messaging.js` | Liga/desliga pela configuração e instancia o cliente com as variáveis `KAFKA_*` |
| `src/modules/analyses/analysisJobs.js` | Enfileira o lote, consulta o job e consome o resultado |

- O pedido publicado leva **só os atributos**; a correlação com o estudante volta pelo
  índice do registro, contra os `items` guardados no `AnalysisJob`.
- Entrega **pelo menos uma vez**: o consumidor é idempotente (ignora job já concluído e
  não regrava estudante que já tem análise daquele job).
- Se o Kafka estiver fora na hora do pedido, o job vira `FAILED` e a resposta é
  `503 MESSAGING_UNAVAILABLE` — nada fica "enfileirado" sem ter sido publicado.
- Se o `backend-MD` estiver fora, o pedido fica retido no tópico e é processado quando
  ele voltar; o job permanece `QUEUED` até lá.
- `KAFKA_ENABLED=false` (ou ausente) mantém o comportamento síncrono anterior (`200` com
  os resultados).

Os tópicos `pae.analysis.requested` e `pae.analysis.completed` precisam existir no Aiven
(a API REST não cria tópicos). Depois de mudar o `schema.prisma`, rode
`npm run prisma:push` para criar a coleção `analysis_jobs` e os índices.

---

## Endpoints

| Método | Rota | Papel | Descrição |
| --- | --- | --- | --- |
| `GET` | `/api/health` | público | Estado da API, banco e serviço de IA |
| `POST` | `/api/auth/login` | público | Autentica e devolve JWT |
| `GET` | `/api/auth/me` | todos | Perfil do usuário autenticado |
| `POST` | `/api/auth/change-password` | todos | Troca a própria senha |
| `GET` | `/api/students` | todos | Lista estudantes (escopo por instituição) |
| `GET` | `/api/students/feature-contract` | todos | Contrato de atributos do modelo |
| `GET` | `/api/students/{id}` | todos | Detalhe + histórico + acompanhamentos |
| `POST` | `/api/students` | ADMIN, ANALYST | Cadastra estudante |
| `PATCH` | `/api/students/{id}` | ADMIN, ANALYST | Atualiza (atributos são mesclados) |
| `DELETE` | `/api/students/{id}` | ADMIN, ANALYST | Desativa |
| `GET` | `/api/analyses` | todos | Histórico de análises, com filtros |
| `GET` | `/api/analyses/{id}` | todos | Detalhe + cópia dos atributos usados |
| `POST` | `/api/analyses/student/{id}` | ADMIN, ANALYST | Analisa e grava histórico |
| `POST` | `/api/analyses/batch` | ADMIN, ANALYST | Analisa até 200 estudantes (`202` + job com mensageria ativa) |
| `GET` | `/api/analyses/jobs/{id}` | quem pediu, ADMIN | Andamento do lote enfileirado |
| `POST` | `/api/analyses/simulate` | ADMIN, ANALYST | Classifica sem persistir |
| `GET` | `/api/follow-ups` | todos | Fila de acompanhamentos |
| `POST` | `/api/follow-ups` | ADMIN, ANALYST | Abre acompanhamento |
| `PATCH` | `/api/follow-ups/{id}` | ADMIN, ANALYST | Atualiza situação |
| `GET` | `/api/dashboard` | todos | Indicadores consolidados |
| `GET` | `/api/dashboard/timeline` | todos | Série temporal por classe |
| `GET` | `/api/dashboard/institutions` | ADMIN | Comparativo entre instituições |
| `GET` | `/api/datamining/model` | todos | Modelo em uso e seu processo |
| `GET` `POST` `PATCH` `DELETE` | `/api/users` | ADMIN | Administração de usuários |
| `GET` `POST` `PATCH` `DELETE` | `/api/institutions` | ADMIN (escrita) | Administração de instituições |

### Erros

Formato único: `{ "error": "<CODE>", "message": "...", "details": ... }`

| Código | HTTP | Significado |
| --- | --- | --- |
| `INVALID_CREDENTIALS` | 401 | E-mail ou senha inválidos |
| `TOKEN_EXPIRED` / `TOKEN_INVALID` | 401 | Sessão inválida |
| `INSUFFICIENT_ROLE` | 403 | Papel sem permissão |
| `INSTITUTION_MISMATCH` | 403 | Registro de outra instituição |
| `VALIDATION_ERROR` | 422 | Campos inválidos (com `details` por campo) |
| `INCOMPLETE_STUDENT_FEATURES` | 422 | Faltam atributos para analisar |
| `STUDENT_CODE_IN_USE` | 409 | Código repetido na instituição |
| `MODEL_NOT_TRAINED` | 503 | Serviço de IA sem modelo |
| `ML_SERVICE_UNREACHABLE` | 503 | Serviço de IA fora |
| `ML_SERVICE_TIMEOUT` | 504 | Serviço de IA demorou demais |
| `MESSAGING_UNAVAILABLE` | 503 | Kafka indisponível — o lote não foi enfileirado |
| `ANALYSIS_JOB_NOT_FOUND` | 404 | Job inexistente ou de outro usuário |

---

## Modelo de dados

| Coleção | Papel |
| --- | --- |
| `users` | Contas de acesso, papel e vínculo com instituição |
| `institutions` | Entidades atendidas; delimitam escopo de acesso |
| `students` | Cadastro + atributos acadêmicos/socioeconômicos + resumo da última análise |
| `analyses` | Histórico de análises: qual estudante, quando, qual resultado, qual versão do modelo (`modelVersion`, `algorithm`) |
| `analysis_jobs` | Lotes enviados pela mensageria: situação (`QUEUED`/`DONE`/`FAILED`), itens e contagens |
| `follow_ups` | Ações tomadas a partir das análises |

- Cada análise gera um novo registro em `analyses`, com cópia dos atributos usados
  (`featuresSnapshot`); registros anteriores não são alterados.
- O estudante guarda um resumo da última análise (`lastClassification`, `lastPriority`, …),
  gravado na mesma transação da análise.
- `DELETE` em usuários, instituições e estudantes **desativa** o registro, sem excluí-lo.
- Os metadados técnicos do modelo (hiperparâmetros, métricas, dataset) ficam no
  `backend-MD`; este serviço os repassa em `GET /api/datamining/model`.

---

## Estrutura

```text
backend-Project/
├── prisma/schema.prisma
└── src/
    ├── config/                  env, swagger
    ├── lib/
    │   ├── prisma.js            único acesso ao MongoDB
    │   ├── kafkaRest.js         cliente da API REST do Kafka (Aiven)
    │   └── messaging.js         liga/desliga a mensageria pelo .env
    ├── middlewares/             auth (JWT + papéis + escopo), errorHandler
    ├── services/
    │   ├── mdClient.js          único lugar que conhece o backend-MD
    │   └── featureContract.js   contrato de atributos, em cache
    ├── modules/
    │   ├── auth/                login, perfil, senha
    │   ├── users/               administração de usuários
    │   ├── institutions/        administração de instituições
    │   ├── students/            cadastro e consulta
    │   ├── analyses/            orquestração com o serviço de IA + priority.js
    │   │                        + analysisJobs.js (lote via Kafka)
    │   ├── followups/           acompanhamento
    │   ├── dashboard/           indicadores e séries
    │   ├── datamining/          repasse dos resultados analíticos
    │   └── health/
    ├── utils/                   AppError, validate (validação sem lib extra)
    ├── scripts/                 seed, seedStudents
    ├── app.js
    └── server.js
```
