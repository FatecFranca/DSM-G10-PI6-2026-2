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
que estão vinculados. A regra fica em um lugar só (`middlewares/auth.js`), aplicada nas
consultas Prisma.

O usuário é relido do banco a cada requisição, em vez de confiar apenas no conteúdo do
token: um usuário desativado ou rebaixado perde acesso imediatamente, sem esperar o token
expirar.

---

## Integração com o backend-MD

```text
cliente → backend-Project (valida, aplica regra de negócio)
        → backend-MD (classifica / agrupa)
        → backend-Project (deriva prioridade, grava histórico)
        → cliente
```

Autenticação intra-serviço por **API Key** no header `X-API-Key`, nunca o JWT do usuário —
são credenciais de camadas diferentes: o JWT identifica a pessoa, a API Key identifica o
serviço.

Somente `src/services/mdClient.js` conhece o endereço do `backend-MD`. É também onde as
falhas dele são traduzidas: um `422` por atributo ausente continua `422` (o dado que chegou
aqui está errado), mas um `401` por API Key inválida vira `502` — é problema de
configuração do servidor, e devolver `401` faria o usuário achar que a sessão expirou.

**Prioridade de acompanhamento** (`src/modules/analyses/priority.js`) é regra de negócio
deste serviço: o `backend-MD` devolve classe e confiança; decidir o que a instituição faz
com isso é daqui.

| Resultado | Prioridade | Leitura |
| --- | --- | --- |
| `Dropout`, confiança ≥ 0,6 | HIGH | Acompanhamento prioritário |
| `Dropout`, confiança < 0,6 | MEDIUM | Acompanhamento recomendado |
| `Enrolled` | MEDIUM | Observação continuada (desfecho em aberto) |
| `Graduate`, confiança ≥ 0,6 | LOW | Sem indicativo de prioridade |
| `Graduate`, confiança < 0,6 | MEDIUM | Observação continuada |

Um perfil de agrupamento com atenção `alta` eleva a prioridade em um nível — o agrupamento
nunca define a prioridade sozinho, mas evita subestimar um caso.

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
| `POST` | `/api/analyses/batch` | ADMIN, ANALYST | Analisa até 200 estudantes |
| `POST` | `/api/analyses/simulate` | ADMIN, ANALYST | Classifica sem persistir |
| `GET` | `/api/follow-ups` | todos | Fila de acompanhamentos |
| `POST` | `/api/follow-ups` | ADMIN, ANALYST | Abre acompanhamento |
| `PATCH` | `/api/follow-ups/{id}` | ADMIN, ANALYST | Atualiza situação |
| `GET` | `/api/dashboard` | todos | Indicadores consolidados |
| `GET` | `/api/dashboard/timeline` | todos | Série temporal por classe |
| `GET` | `/api/dashboard/institutions` | ADMIN | Comparativo entre instituições |
| `GET` | `/api/datamining/profiles` | todos | Perfis descobertos |
| `GET` | `/api/datamining/model` | todos | Modelo em uso e seu processo |
| `GET` | `/api/datamining/cluster-distribution` | todos | Perfis × estudantes analisados |
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

---

## Modelo de dados

| Coleção | Papel |
| --- | --- |
| `users` | Contas de acesso, papel e vínculo com instituição |
| `institutions` | Entidades atendidas; delimitam escopo de acesso |
| `students` | Cadastro + atributos acadêmicos/socioeconômicos + resumo da última análise |
| `analyses` | Histórico imutável: qual estudante, quando, qual resultado, qual versão do modelo |
| `follow_ups` | Ações tomadas a partir das análises |

Decisões que valem registrar:

- **Análise nunca é sobrescrita.** Cada execução gera um novo registro; sem isso o
  histórico perderia sentido.
- **`featuresSnapshot`** guarda cópia dos atributos enviados: sem ela, uma análise antiga
  não poderia ser auditada depois que o cadastro do estudante mudasse.
- **Resumo desnormalizado** no estudante (`lastClassification`, `lastPriority`, …) para
  listagens e painéis não precisarem varrer o histórico. Gravado na mesma transação da
  análise, para o estudante nunca apontar para um resultado não persistido.
- **Desativação em vez de exclusão** para usuários, instituições e estudantes: todos são
  referenciados por histórico.
- **Só a identidade do modelo** (`modelVersion`, `algorithm`) é guardada aqui. Os
  metadados técnicos (hiperparâmetros, métricas de treino, versão do dataset) ficam no
  `backend-MD` e não são copiados.

---

## Estrutura

```text
backend-Project/
├── prisma/schema.prisma
└── src/
    ├── config/                  env, swagger
    ├── lib/prisma.js            único acesso ao MongoDB
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
    │   ├── followups/           acompanhamento
    │   ├── dashboard/           indicadores e séries
    │   ├── datamining/          repasse dos resultados analíticos
    │   └── health/
    ├── utils/                   AppError, validate (validação sem lib extra)
    ├── scripts/                 seed, seedStudents
    ├── app.js
    └── server.js
```

## O que NÃO pertence a este serviço

Treinamento de modelos, algoritmos de classificação, experimentos de Mineração de Dados,
componentes de UI e lógica de apresentação. A inteligência analítica fica isolada no
`backend-MD`.
