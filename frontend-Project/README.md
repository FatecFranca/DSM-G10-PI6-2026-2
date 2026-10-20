# frontend-Project — Aplicação Web

Interface Web da plataforma **Predict Students' Dropout and Academic Success
Classification** (PI do 6º semestre).

Apresenta, interage e consome serviços. Regra de negócio pertence ao Back-End; a
inteligência analítica pertence ao `backend-MD`.

---

## Stack

React 19.2.8 · Vite 8.2.1 · TypeScript 7.0.2 · react-router-dom 7.18.2

Os componentes visuais e os gráficos (rosca, barras, série temporal) são próprios, em CSS
e SVG — veja `components/ui.tsx` e `components/charts.tsx`.

---

## Instalação

```bash
npm install
cp .env.example .env
npm run dev              # http://localhost:5173
```

```bash
npm run build            # tsc -b && vite build
npm run preview
```

Requer o `backend-Project` no ar em `http://localhost:3004` (e o `backend-MD`, que aquele
consulta). Entre com um dos usuários criados por `npm run seed` no `backend-Project`.

---

## Testes end-to-end (Cypress)

```bash
npm run test              # sobe o dev server sozinho, roda todos os fluxos e encerra
npm run cypress:open      # modo interativo
npm run test:e2e          # modo headless, assume que o dev server já está no ar
npm run test:stress       # geração em massa de dados aleatórios (opt-in, ver abaixo)
```

`npm run test` usa `scripts/run-e2e.mjs` para subir o `vite dev`, esperar
`http://localhost:5173` responder (via `wait-on`) e derrubar o servidor ao final (via
`tree-kill`) — só o servidor do Front-End é automático. O `backend-Project` (com
`npm run seed` executado) e o `backend-MD` **precisam já estar no ar** antes de rodar
qualquer um destes comandos, porque os testes usam a aplicação real.

- `cypress/e2e/login.cy.ts` — credenciais inválidas, login válido, mostrar/ocultar senha,
  alternância de tema.
- `cypress/e2e/dashboard.cy.ts` — cabeçalho do painel, navegação pela sidebar, logout.
- `cypress/e2e/students.cy.ts` — cadastro de um novo estudante (dados aleatórios) pela
  tela, listagem, busca sem resultado, abertura de detalhe.
- `cypress/e2e/users.cy.ts` — administrador cria uma nova conta de usuário (dados
  aleatórios) pela tela de Administração.
- `cypress/e2e/institutions.cy.ts` — administrador cria uma nova instituição (dados
  aleatórios) pela tela de Administração.
- `cypress/e2e/followups.cy.ts` — abre um acompanhamento (dados aleatórios) a partir do
  detalhe de um estudante.
- `cypress/e2e/analysis.cy.ts` — simulação de classificação de ponta a ponta.
- `cypress/e2e/stress.cy.ts` — **desativado por padrão** (`describe.skip`); veja a seção
  seguinte.

`cypress/support/commands.ts` expõe `cy.loginByApi()` (autentica direto via API, sem
passar pela tela), `cy.visitAuthenticated(path)` (injeta o token antes da SPA montar) e um
conjunto de comandos `cy.apiCreate*`/`cy.apiEnsure*` que criam instituição, usuário,
estudante (com os 36 atributos aleatórios dentro dos limites do contrato do modelo) e
rodam uma análise, direto pela API — usados tanto para preparar cenário (ex.: garantir que
existe uma instituição antes de testar o cadastro de estudante) quanto pelo
`stress.cy.ts`. Os valores aleatórios em si vêm de `cypress/support/factories.ts`
(`@faker-js/faker`, localizado em pt-BR).

### Geração de massa de dados (stress test)

`stress.cy.ts` não roda dentro de `npm run test`. Para gerar volume de propósito:

```bash
npm run test:stress                                   # ~20 estudantes (padrão)
npx cypress run --spec cypress/e2e/stress.cy.ts --env stress=true,stressCount=100
```

Isso cria estudantes com os 36 atributos sorteados dentro da faixa aceita pelo modelo
(não apenas a média), roda uma análise real para cada um (bate no `backend-MD`), e cria
instituições, usuários e acompanhamentos proporcionalmente — útil para popular um
ambiente de desenvolvimento/homologação com uma base realista antes de testar
performance, paginação ou os gráficos do painel com volume de verdade.

---

## Configuração

```env
VITE_API_BASE_URL=http://localhost:3004/api
```

É a única variável: a URL do `backend-Project`, por onde chegam todos os dados, inclusive
os resultados de IA.

O Vite só expõe ao navegador variáveis com o prefixo `VITE_`. As variáveis esperadas estão
declaradas em `src/vite-env.d.ts`.

Tudo que chega ao navegador é público: não coloque segredos no `.env` do Front-End.

---

## Telas

| Rota | Tela | Acesso |
| --- | --- | --- |
| `/login` | Acesso | público |
| `/` | Painel: indicadores, distribuições, fila de atenção, série temporal | todos |
| `/students` | Lista com filtros, ordenação e análise em lote | todos |
| `/students/new`, `/students/:id/edit` | Cadastro/edição + atributos | ADMIN, ANALYST |
| `/students/:id` | Detalhe: situação, histórico, acompanhamentos | todos |
| `/analysis` | Simular classificação · Histórico de análises | todos (simular: ADMIN, ANALYST) |
| `/data-mining` | Processo de construção do modelo | todos |
| `/follow-ups` | Fila de acompanhamentos | todos (escrita: ADMIN, ANALYST) |
| `/admin/users`, `/admin/institutions` | Administração | ADMIN |

O menu e as ações se ajustam ao papel do usuário; a autorização em si é feita pelo
Back-End.

---

## Como um resultado de IA aparece

Cada resultado (`AnalysisResultView`) mostra:

- a classificação, a confiança como **score com barra** e a situação de acompanhamento
  (texto calculado pelo Back-End);
- as probabilidades das três classes;
- a cor da classe prevista;
- o aviso de apoio à decisão (`Disclaimer`);
- os atributos fora da faixa observada no treino, destacados no formulário e listados em
  `warnings`.

## Formulário de atributos

`FeaturesForm` é **gerado** a partir de `GET /api/students/feature-contract`, que repassa o
contrato do `backend-MD`: nome, rótulo legível, tipo e faixa observada no treino. Se o
modelo for retreinado com outro conjunto de atributos, o formulário acompanha sem mudança
no código.

---

## Estrutura

```text
frontend-Project/src/
├── components/
│   ├── ui.tsx                 primitivos: Card, Stat, Button, Field, selos, medidor…
│   ├── charts.tsx             DonutChart, BarList, GroupedBarChart (SVG próprio)
│   ├── Layout.tsx             barra lateral + superior, navegação por papel
│   ├── FeaturesForm.tsx       formulário gerado pelo contrato do modelo
│   └── AnalysisResultView.tsx apresentação de um resultado de IA
├── pages/                     uma tela por rota (+ admin/)
├── services/
│   ├── api.ts                 cliente HTTP central: token, erros, URL única
│   └── index.ts               um módulo de serviço por área funcional
├── state/
│   ├── AuthContext.tsx        sessão, token e permissões derivadas do papel
│   ├── I18nContext.tsx        idioma, formatação de número/data
│   └── ToastContext.tsx       mensagens de retorno de ação
├── hooks/                     useAsync (carregamento com cancelamento), useApiError
├── types/api.ts               contratos da API em TypeScript
├── locales/                   pt-BR · en-US · es-ES
└── css/global.css             tokens, componentes e responsividade
```

Toda chamada HTTP passa por `services/`: `api.ts` cuida do token, dos erros e da URL, e
`index.ts` tem um serviço por área funcional.

`useAsync` cancela a requisição anterior ao trocar filtros, evitando que uma resposta
atrasada sobrescreva a tela com dado obsoleto.

---

## Idiomas

Português (BR), inglês (EUA) e espanhol (ES), em `src/locales`. O idioma é detectado do
navegador, pode ser trocado no topo da tela e fica guardado. Chave sem tradução cai no
pt-BR e avisa no console em desenvolvimento — nunca renderiza vazio.

## Responsividade

Desktop, notebook, tablet e telas menores. Até 1024px a barra lateral vira gaveta;
tabelas largas rolam horizontalmente dentro do próprio container, sem estourar a página.
