# Plataforma de Acompanhamento Educacional

Projeto Interdisciplinar do 6º semestre (Fatec Franca — Desenvolvimento de Software
Multiplataforma): plataforma que usa dados educacionais (dataset **Predict Students'
Dropout and Academic Success Classification**) para apoiar instituições educacionais e
sociais de Franca/SP na identificação e priorização de estudantes que merecem
acompanhamento.

> A classificação produzida é **apoio à tomada de decisão**, não uma garantia sobre o
> futuro de um estudante. Os scores de confiança não são probabilidades calibradas.

---

## Contexto acadêmico e institucional

**Tema e objetivo oficiais do 6º semestre** (Manual de Projetos Interdisciplinares —
DSM, Fatec Franca, v04):

> Tema: Desenvolvimento de Software Multiplataforma (web, mobile e desktop) com
> integração entre Back-End, Front-End, API e Banco de Dados.
>
> Objetivo: empregar linguagens de programação para Web, Mobile e Desktop;
> desenvolver back-end e front-end por meio de framework; integrar back-end e
> front-end; implementar banco de dados com algum SGBD; manter controle de
> versionamento.

Como cada exigência é atendida nesta solução:

| Exigência do manual | Nesta solução |
| --- | --- |
| Back-end via framework | Express 5.2.1 (`backend-Project`, `backend-MD`) |
| Front-end via framework | React 19 + Vite + TypeScript (`frontend-Project`) |
| Integração back-end ↔ front-end | API REST documentada em Swagger, gateway único no `backend-Project` |
| Banco de dados (SGBD) | MongoDB via Prisma, cluster único com databases separados por domínio |
| Multiplataforma — Web | Implementado (`frontend-Project`) |
| Multiplataforma — Mobile | Planejado (`mobile-Project`, Flutter) — evolução futura declarada desde a raiz do PI 5 |
| Multiplataforma — Desktop | Planejado — evolução futura |
| Controle de versionamento | Git/GitHub, conforme exigido pelo manual como portfólio |
| Mineração de Dados (disciplina satélite) | Pipeline completo em `backend-MD/ML` — preparação, comparação de algoritmos, avaliação, aprendizado supervisionado e não supervisionado |

**Problema real escolhido pelo grupo:** o manual permite que cada grupo escolha, em
comum acordo, um problema alinhado a desafios reais da sociedade (seção 6 do manual).
A ambientação textual do produto é voltada ao cenário de Franca/SP — no mesmo espírito
do trabalho articulado pelo **CMDCAF** (Conselho Municipal dos Direitos da Criança e do
Adolescente de Franca), órgão deliberativo e de controle de políticas municipais de
proteção à infância e adolescência, que registra e acompanha entidades de atendimento
no município. Isso é ambientação de tema acadêmico, não uma parceria oficial: a
plataforma não é operada pelo CMDCAF nem por nenhum órgão público, é um produto de
Projeto Interdisciplinar que usa esse contexto local para dar significado real ao
problema de evasão e sucesso acadêmico tratado pelo dataset.

---

## Componentes

```text
        ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
        │ frontend-Project│   │  mobile-Project │   │    Desktop      │
        │   Web (React)   │   │     Flutter     │   │                 │ 
        └────────┬────────┘   └────────┬────────┘   └────────┬────────┘
                 │                     │                     │
                 └──────────── HTTP / JSON ──────────────────┘
                                       │
                          ┌────────────▼────────────┐
                          │    backend-Project      │
                          │  API principal · negócio│
                          │  autenticação · gateway │
                          └──────┬───────────┬──────┘
                                 │           │
                    ┌────────────▼──┐   ┌────▼─────────────────┐
                    │   MongoDB     │   │     backend-MD       │
                    │ dado de       │   │  IA / ML / Mineração │
                    │ negócio       │   │  (Node + Python)     │
                    └───────────────┘   └────┬─────────────────┘
                                             │
                                        ┌────▼──────────┐
                                        │   MongoDB     │
                                        │ metadado de   │
                                        │ modelo (ML)   │
                                        └───────────────┘
```

| Componente | Porta | Responsabilidade | Estado |
| --- | --- | --- | --- |
| [`backend-MD`](backend-MD/) | 3003 | Motor de IA e Mineração de Dados | implementado |
| [`backend-Project`](backend-Project/) | 3004 | API principal, negócio e orquestração | implementado |
| [`frontend-Project`](frontend-Project/) | 5173 | Aplicação Web | implementado |
| [`mobile-Project`](mobile-Project/) | — | Aplicativo Flutter | desenvolvimento futuro |

**Regras de arquitetura que atravessam tudo:**

- Nenhum cliente (Web, Mobile, Desktop) fala com o `backend-MD`. O `backend-Project` é o
  gateway único, inclusive para resultados de IA.
- Nenhum Front-End acessa o MongoDB.
- Os dois bancos vivem no mesmo cluster MongoDB, em **databases distintos**: dado de
  negócio (`Mongo-PI-Backend-Project`) separado de metadado técnico de ML
  (`Mongo-PI-Backend-MD`). Acesso exclusivamente via Prisma nos dois.

---

## Subir a solução

Pré-requisitos: Node.js 20+, Python 3.9+ (para o `backend-MD` provisionar o venv sozinho),
e um cluster MongoDB.

> **Cada serviço roda em primeiro plano no terminal** (`npm start` = `node src/server.js`,
> sem daemon nem gerenciador de processos). Isso é proposital, para manter a operação
> simples: use **uma aba de terminal por serviço** (3 no total — `backend-MD`,
> `backend-Project`, `frontend-Project`). `Ctrl+C` em uma aba derruba **só aquele**
> serviço; as outras abas continuam rodando normalmente. Rodar dois serviços na mesma
> aba, um atrás do outro, é o que faz parecer que `Ctrl+C` "atrapalha" — na verdade
> cada aba só pode segurar um processo em primeiro plano por vez.

### Primeira vez (repositório recém-clonado)

Os `.env` precisam de segredos que não vêm prontos em um clone novo. Gere-os e preencha
`backend-MD/.env.example` → `.env` e `backend-Project/.env.example` → `.env` com o mesmo
`DB_URL` de cluster e o mesmo `MD_API_KEY` (compartilhado entre os dois):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"          # MD_API_KEY
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"    # JWT_SECRET
```

### 1. `backend-MD` — serviço de IA

```bash
cd backend-MD
npm install    # cria .env (se faltar), sincroniza o banco, prepara o venv Python
               # e treina o modelo + agrupamento — tudo automático e idempotente
npm start      # :3003
```

### 2. `backend-Project` — API principal

```bash
cd backend-Project
npm install    # cria .env (se faltar), sincroniza o banco e cria a instituição +
               # usuários de demonstração — automático e idempotente
npm start      # :3004
```

Para popular o painel com estudantes reais do dataset (requer o passo 1 já no ar):

```bash
npm run seed:students -- --count=90
```

Abra uma **nova aba de terminal** antes do próximo passo — não reaproveite a mesma aba
onde o `backend-MD` está rodando, senão você precisaria parar um serviço para iniciar
o outro.

### 3. `frontend-Project` — Web

Novamente em uma aba de terminal própria:

```bash
cd frontend-Project
npm install
cp .env.example .env
npm run dev              # :5173
```

Ao final, você deve ter **3 abas de terminal abertas ao mesmo tempo**, uma por serviço.
Entre em `http://localhost:5173` com `admin@pi6.local` / `Admin@123456`. Para popular o
painel, selecione os estudantes na lista e use **Analisar selecionados**.

> Cada `npm install` dos dois backends é seguro de reexecutar: ele verifica o que já está
> pronto (banco sincronizado, ambiente Python, modelo treinado, usuários criados) e pula o
> que não precisa refazer.

---

## Fluxo de uma análise

```text
1. Web envia POST /api/analyses/student/{id}   (JWT do usuário)
2. backend-Project valida escopo e cadastro completo de atributos
3. backend-Project → backend-MD  POST /api/classify   (X-API-Key de serviço)
4. backend-MD valida entrada e aciona o Python via child_process
5. Python aplica o scaler persistido, carrega o modelo e prediz
6. backend-MD devolve { classification, confidence, probabilities, model }
7. backend-Project deriva a prioridade de acompanhamento (regra de negócio)
8. backend-Project grava no histórico e atualiza o resumo do estudante
9. Web apresenta classificação, score e situação — com a ressalva de apoio à decisão
```

---

## O modelo

Dataset: 4.424 estudantes, 36 atributos, 3 classes desbalanceadas
(`Graduate` 49,9% · `Dropout` 32,1% · `Enrolled` 17,9%).

Nove algoritmos são comparados por validação cruzada (10 folds) e avaliados em treino e
teste. A seleção usa F1 macro no teste como métrica principal — por causa do
desbalanceamento — com desempate por menor distância treino-teste, para não escolher um
modelo que decora o treino por uma vantagem de milésimos.

Análise complementar não supervisionada (KMeans, k escolhido por silhueta) encontrou um
perfil com **82,5% de evasão histórica** concentrando 19% dos registros — o tipo de achado
que a área de Mineração de Dados da interface expõe.

Detalhes de pipeline, reprodutibilidade e endpoints: [`backend-MD/README.md`](backend-MD/README.md).

---

## Documentação

| Onde | O quê |
| --- | --- |
| `http://localhost:3004/api/docs` | Swagger da API principal |
| `http://localhost:3003/api/docs` | Swagger do serviço de IA |
| [`backend-MD/README.md`](backend-MD/README.md) | Pipeline de ML, dataset, seleção do modelo |
| [`backend-Project/README.md`](backend-Project/README.md) | Papéis, modelo de dados, regra de prioridade |
| [`frontend-Project/README.md`](frontend-Project/README.md) | Telas, apresentação dos dados de IA, i18n |
| `*/.IA/CONTEXT.md` | Instruções de arquitetura por componente (não versionado) |

## Segurança

- Autenticação de usuário por JWT; senhas com hash bcrypt.
- Autenticação entre serviços por API Key (`X-API-Key`), separada da credencial de usuário.
- Autorização por papel (ADMIN / ANALYST / VIEWER) e escopo por instituição.
- Segredos apenas em `.env`, nunca versionados. O `backend-MD` recusa requisições se a
  chave de serviço não estiver configurada, em vez de liberar acesso.
- CORS restrito: o `backend-MD` não libera nenhuma origem de navegador por padrão, porque
  nenhum Front-End deveria alcançá-lo.
