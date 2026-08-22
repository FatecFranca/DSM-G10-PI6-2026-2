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
npm run cypress:open     # modo interativo
npm run test:e2e         # modo headless (CI)
```

Requer os três serviços no ar (`backend-MD`, `backend-Project` com `npm run seed` e
`npm run seed:students` executados, e `frontend-Project` em `npm run dev`) — os testes
rodam contra a aplicação real, não contra mocks.

- `cypress/e2e/login.cy.ts` — credenciais inválidas, login válido, mostrar/ocultar senha,
  alternância de tema.
- `cypress/e2e/dashboard.cy.ts` — cabeçalho do painel, navegação pela sidebar, logout.
- `cypress/e2e/students.cy.ts` — listagem, busca sem resultado, abertura de detalhe.
- `cypress/e2e/analysis.cy.ts` — simulação de classificação de ponta a ponta.

`cypress/support/commands.ts` expõe `cy.loginByApi()` (autentica direto via API, sem
passar pela tela) e `cy.visitAuthenticated(path)` (injeta o token antes da SPA montar).

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
| `/data-mining` | Perfis descobertos · Processo do modelo | todos |
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
