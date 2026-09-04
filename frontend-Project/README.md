# frontend-Project — Aplicação Web

Interface Web da plataforma **Predict Students' Dropout and Academic Success
Classification** (PI do 6º semestre).

Apresenta, interage e consome serviços. Regra de negócio pertence ao Back-End; a
inteligência analítica pertence ao `backend-MD`.

---

## Stack

React 19.2.8 · Vite 8.2.1 · TypeScript 7.0.2 · react-router-dom 7.18.2

Sem biblioteca de UI e sem biblioteca de gráficos: os componentes visuais e os gráficos
(rosca, barras, série temporal) são próprios, em CSS e SVG. Menos dependência para manter
em um projeto acadêmico, e a stack fixada na seção 4 do `CONTEXT.md` é respeitada.

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

`npm run test` usa `scripts/run-e2e.mjs` para subir o `vite dev` sozinho, esperar
`http://localhost:5173` responder (via `wait-on`) e depois derrubar o servidor pelo PID que
ele mesmo abriu (via `tree-kill`) ao final — só isso é automático. Optamos por esse script
próprio em vez do pacote `start-server-and-test` porque ele depende de `ps-tree`, que no
Windows usa `wmic.exe` para descobrir o processo do servidor — e o `wmic` foi removido das
versões recentes do Windows 11, quebrando a limpeza ao final do teste (o teste em si passa,
só a etapa de encerrar o servidor falha). O `backend-Project` (com `npm run seed`
executado) e o `backend-MD` **precisam já estar no
ar** antes de rodar qualquer um destes comandos; os testes batem na aplicação real, nunca
em mocks.

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

`stress.cy.ts` não roda dentro de `npm run test` — ele criaria dezenas de registros a cada
execução normal, o que não é o que se quer na validação do dia a dia. Para gerar volume de
propósito:

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

**Existe apenas uma URL de API**, apontando para o `backend-Project`. Não há — e não deve
haver — variável apontando para o `backend-MD`: resultados de IA chegam pelo
`backend-Project`, que é o gateway único. Se uma configuração desse tipo aparecer no
código, a regra da seção 6 do `CONTEXT.md` está sendo violada.

O prefixo `VITE_` é obrigatório: o Vite só expõe ao navegador variáveis com esse prefixo.
Sem ele, `import.meta.env` não vê o valor — é bug, não questão de nomenclatura. As
variáveis esperadas estão declaradas em `src/vite-env.d.ts`, então ler uma inexistente é
erro de compilação.

Tudo que chega ao navegador é público. **Nenhum segredo aqui.**

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

O menu e as ações se ajustam ao papel do usuário. Isso é **experiência de uso**: a
autorização real está no Back-End, que recusaria a requisição de todo jeito.

---

## Como os dados de IA são apresentados

A seção 9 do `CONTEXT.md` define que o resultado não pode parecer certeza. Na prática:

- classificação, confiança/score e situação aparecem juntos, e o texto da situação vem da
  leitura de acompanhamento calculada no Back-End — a interface não recalcula prioridade;
- a confiança é mostrada como **score com barra**, não como "probabilidade de evasão";
- a cor acompanha a classe prevista, não o valor: confiança alta em `Dropout` não é "bom",
  é sinal forte de risco;
- as probabilidades das três classes ficam visíveis, para que um resultado de 54% não
  pareça igual a um de 99%;
- o componente `Disclaimer` acompanha todo resultado de IA;
- valores fora da faixa observada no treino são destacados no formulário e listados em
  `warnings` — o modelo extrapolou, e a confiança ali é menos confiável.

## O formulário de atributos não conhece as 36 colunas

`FeaturesForm` é **gerado** a partir de `GET /api/students/feature-contract`, que repassa o
contrato do `backend-MD`: nome, rótulo legível, tipo e faixa observada no treino. Se o
modelo for retreinado com outro conjunto de atributos, a tela acompanha sozinha — e não há
uma segunda lista de colunas para manter em sincronia.

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

**Nenhum componente chama `fetch` diretamente.** Toda rede passa por `services/` — é o que
mantém verificável a regra de não espalhar URLs e não duplicar chamadas HTTP.

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

## O que NÃO fazer aqui

Conectar ao MongoDB, executar classificação no navegador, duplicar regra de negócio do
Back-End, guardar segredo, chamar o `backend-MD` diretamente (em nenhuma hipótese), ou
tratar a estrutura do banco como contrato da interface.
