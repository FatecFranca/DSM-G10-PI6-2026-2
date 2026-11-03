# frontend-Project

Aplicação Web do projeto Predict Students' Dropout and Academic Success Classification
(PI 6º semestre). SPA em React que consome exclusivamente a API do `backend-Project`.

## Stack

| Item | Versão |
| --- | --- |
| React, React DOM | 19.2.8 |
| react-router-dom | 7.18.2 |
| Vite | 8.2.1 |
| TypeScript | 7.0.2 |
| Cypress | 15 |
| @faker-js/faker | 9 (dados de teste) |

Componentes visuais e gráficos são implementados no projeto (CSS e SVG), sem biblioteca de
UI ou de gráficos.

## Instalação

Requisitos: Node.js e `backend-Project` em execução (que depende do `backend-MD`).

```bash
npm install
cp .env.example .env
npm run dev
```

| Comando | Ação |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento em `http://localhost:5173` |
| `npm run build` | `tsc -b && vite build`, saída em `dist/` |
| `npm run preview` | Serve o build em `http://localhost:4173` |

### Configuração

```env
VITE_API_BASE_URL=http://localhost:3004/api
```

Única variável do projeto, tipada em `src/vite-env.d.ts`. O Vite expõe ao navegador apenas
variáveis com prefixo `VITE_`, e todo o conteúdo do `.env` vai para o bundle.

A origem do front-end precisa estar em `CORS_ORIGINS` do `backend-Project`.

## Testes end-to-end

Os testes rodam contra a aplicação real. Antes de executar: `backend-Project` com
`npm run seed` aplicado e `backend-MD` ativos.

| Comando | Ação |
| --- | --- |
| `npm run test` | Sobe o `vite dev`, executa todas as specs e encerra o servidor (`scripts/run-e2e.mjs`) |
| `npm run test:e2e` | `cypress run`, com o servidor já ativo |
| `npm run cypress:open` | Modo interativo |
| `npm run test:stress` | Executa `stress.cy.ts` com 20 estudantes |

| Spec | Cobertura |
| --- | --- |
| `login.cy.ts` | Credenciais inválidas, login, exibir senha, tema |
| `dashboard.cy.ts` | Painel, navegação lateral, logout |
| `students.cy.ts` | Cadastro, listagem, busca vazia, detalhe |
| `users.cy.ts` | Cadastro de usuário (ADMIN) |
| `institutions.cy.ts` | Cadastro de instituição (ADMIN) |
| `followups.cy.ts` | Abertura de acompanhamento pelo detalhe do estudante |
| `analysis.cy.ts` | Simulação de classificação |
| `stress.cy.ts` | Carga de dados; `describe.skip` sem `stress=true` |

`cypress/support/commands.ts` define `cy.loginByApi()`, `cy.visitAuthenticated(path)` e os
comandos `cy.apiCreate*` / `cy.apiEnsure*`, que criam registros direto pela API.
`cypress/support/factories.ts` gera os dados com faker (pt-BR), com os 36 atributos dentro
das faixas do contrato do modelo.

Carga com quantidade definida (servidor já ativo):

```bash
npx cypress run --spec cypress/e2e/stress.cy.ts --expose stress=true,stressCount=100
```

Cada estudante criado recebe uma análise real; instituições, usuários e acompanhamentos são
criados em proporção.

## Telas

| Rota | Conteúdo | Acesso |
| --- | --- | --- |
| `/login` | Login | público |
| `/forgot-password` | Solicitação de redefinição de senha | público |
| `/reset-password?token=` | Nova senha | público |
| `/` | Indicadores, distribuições, fila de atenção, série temporal | autenticado |
| `/students` | Lista com filtros, ordenação e análise em lote | autenticado |
| `/students/new`, `/students/:id/edit` | Cadastro e edição com atributos | ADMIN, ANALYST |
| `/students/:id` | Situação, histórico de análises, acompanhamentos | autenticado |
| `/analysis` | Simulação (ADMIN, ANALYST) e histórico | autenticado |
| `/data-mining` | Processo de construção e métricas do modelo | ADMIN |
| `/follow-ups` | Acompanhamentos (escrita: ADMIN, ANALYST) | autenticado |
| `/admin/users`, `/admin/institutions` | Administração | ADMIN |

`RequireAuth` e `RequireRole` (`src/App.tsx`) controlam a navegação; a autorização é
validada pelo `backend-Project`.

## Resultado de análise

`AnalysisResultView` exibe:

- classe prevista, confiança em barra e texto de prioridade retornado pela API;
- probabilidades das três classes;
- cor associada à classe prevista;
- componente `Disclaimer`;
- `warnings` com atributos fora da faixa observada no treino.

## Formulário de atributos

`FeaturesForm` é montado a partir de `GET /api/students/feature-contract`: nome, rótulo,
tipo e faixa observada de cada atributo. As notas (`admission_grade`,
`previous_qualification_grade`, `curricular_units_*_sem_grade`) podem ser digitadas na
escala portuguesa (0–20 / 0–200) ou brasileira (0–10); o valor gravado é sempre o da escala
portuguesa.

## Lote de análise

`analysesService.runBatch` (`src/services/index.ts`) trata as duas respostas de
`POST /api/analyses/batch`:

- `200`: resultados na resposta;
- `202`: consulta `GET /api/analyses/jobs/{id}` a cada 2 s até `DONE` ou `FAILED`, com
  limite de 5 min (`ANALYSIS_JOB_PENDING`).

Nos dois casos a tela recebe `{ analyzed, skipped }`.

## Estrutura

```text
src/
├── App.tsx                    rotas
├── main.tsx
├── components/
│   ├── ui.tsx                 Card, Stat, Button, Field, selos, medidor
│   ├── charts.tsx             DonutChart, BarList, GroupedBarChart (SVG)
│   ├── Layout.tsx             barra lateral e superior
│   ├── FeaturesForm.tsx
│   ├── AnalysisResultView.tsx
│   └── PaeLogo.tsx
├── pages/                     uma página por rota, admin/ para administração
├── services/
│   ├── api.ts                 cliente HTTP: URL base, token, erros
│   └── index.ts               serviços por área
├── state/                     AuthContext, I18nContext, ThemeContext, ToastContext
├── hooks/                     useAsync, useApiError
├── types/api.ts               tipos dos contratos da API
├── locales/                   pt-BR, en-US, es-ES
└── css/global.css             tokens de design e responsividade
```

- Componentes não chamam `fetch`; toda requisição passa por `src/services/`.
- `useAsync` cancela a requisição anterior quando os parâmetros mudam.
- Token, tema e idioma ficam no `localStorage`.

## Idiomas

pt-BR, en-US e es-ES em `src/locales/`. O idioma inicial vem do navegador e pode ser
alterado na barra superior. Chave ausente usa o texto em pt-BR e gera aviso no console em
desenvolvimento.
