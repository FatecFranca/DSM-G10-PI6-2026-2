# mobile-Project — Aplicativo Flutter

Interface Mobile da plataforma **Predict Students' Dropout and Academic Success
Classification** (PI do 6º semestre).

Consome o **mesmo** `backend-Project` que a Web, com os mesmos contratos de API e a mesma
regra de negócio. Não há endpoint exclusivo do Mobile, não há classificação embarcada no
aparelho e não há acesso ao banco: o app apresenta, interage e consome serviços.

---

## Stack

| Camada | Escolha |
| --- | --- |
| Framework | Flutter 3.41.5 · Dart 3.11.3 |
| Estado | `provider` |
| Navegação | `go_router` (mesmas rotas da Web) |
| Rede | `http`, centralizado em `core/api_client.dart` |
| Sessão | `flutter_secure_storage` (Keystore/Keychain) |
| Tema e idioma | `shared_preferences` |
| Formatação | `intl` |
| Gráficos | `CustomPainter` próprio — sem biblioteca |

As decisões de estado e de persistência local estavam em aberto no `.IA/CONTEXT.md` e
foram fechadas em 02/09/2026; a seção 4 daquele documento registra cada uma com o motivo.

---

## Executar

Pré-requisitos: Flutter 3.41.5+, e o `backend-Project` (:3004) e o `backend-MD` (:3003)
no ar — o app não funciona sozinho, como nenhum dos clientes.

```bash
cd mobile-Project
flutter pub get
flutter run
```

### A URL da API muda conforme onde o app roda

`localhost` significa coisas diferentes em cada lugar, e é aqui que a maioria dos "não
conecta" acontece:

| Onde o app roda | Endereço do `backend-Project` |
| --- | --- |
| Emulador Android | `http://10.0.2.2:3004/api` — **padrão do app**, não precisa configurar |
| Simulador iOS / desktop | `http://localhost:3004/api` — padrão nessas plataformas |
| Celular físico no Wi-Fi | IP da sua máquina na rede, informado na hora de rodar |

Para o celular físico:

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.0.10:3004/api
```

Troque `192.168.0.10` pelo IP da máquina que roda o `backend-Project` (`ipconfig` no
Windows). O `CORS_ORIGINS` do back-end não interfere aqui: CORS é regra de navegador, e o
app não é um.

Entre com um dos usuários criados pelo seed do `backend-Project` — por exemplo
`admin@pi6.local` / `Admin@123456`.

### HTTP em texto claro é liberado só em desenvolvimento

O Android 9+ e o iOS bloqueiam HTTP sem TLS por padrão. Como o ambiente local roda em
`http://`, a exceção existe — mas **apenas** nas variantes de desenvolvimento:

- Android: `usesCleartextTraffic` está nos manifestos `debug` e `profile`. A variante
  `release` continua exigindo HTTPS.
- iOS: `NSAllowsLocalNetworking`, que abre a exceção para a rede local sem liberar HTTP
  para a internet.

Em produção o app fala com a API por HTTPS, como a seção 7 do `.IA/CONTEXT.md` pede.

### Verificação

```bash
flutter analyze     # sem apontamentos
flutter test        # 27 testes de unidade
```

Os testes cobrem a leitura dos contratos da API (incluindo resposta sem agrupamento e
campo ausente), as regras do formulário de atributos (médias, limites rígidos, descarte de
vazios), a regra de "acompanhamento vencido" e o i18n — inclusive um teste que verifica
que **todo** valor de enum do contrato tem tradução nos três idiomas, que é o tipo de
buraco que só aparece em produção.

---

## Telas

| Rota | Tela | Acesso |
| --- | --- | --- |
| `/login` | Acesso | público |
| `/forgot-password`, `/reset-password` | Recuperação de senha | público |
| `/` | Painel: indicadores, distribuições, evolução, fila de atenção | todos |
| `/students` | Lista com busca, filtros, ordenação e análise em lote | todos |
| `/students/new`, `/students/:id/edit` | Cadastro/edição + atributos | ADMIN, ANALYST |
| `/students/:id` | Detalhe: situação, histórico, acompanhamentos, atributos | todos |
| `/analysis` | Simular análise · Histórico | todos (simular: ADMIN, ANALYST) |
| `/data-mining` | Perfis descobertos · Processo do modelo | todos |
| `/follow-ups` | Fila de acompanhamentos | todos (escrita: ADMIN, ANALYST) |
| `/profile` | Perfil, troca da própria senha, sair | todos |
| `/admin/users`, `/admin/institutions` | Administração | ADMIN |

As rotas são **as mesmas do `frontend-Project`**, de propósito: dá para falar de uma tela
por endereço entre as duas plataformas.

O menu e as ações se ajustam ao papel do usuário. Isso é **experiência de uso** — a
autorização real está no Back-End, que recusaria a requisição de todo jeito.

---

## Como os dados de IA são apresentados

Mesmas regras da Web (seção 9 do `.IA/CONTEXT.md`), porque o risco é o mesmo:

- classificação, confiança/score e situação aparecem juntas, e o texto da situação vem da
  leitura de acompanhamento calculada no Back-End — o app **não** recalcula prioridade;
- a confiança é mostrada como score com barra, nunca como "probabilidade de evasão";
- a cor acompanha a classe prevista, não o valor: confiança alta em `Evasão` não é "bom",
  é sinal forte de risco;
- as probabilidades das três classes ficam visíveis, para que 54% não pareça igual a 99%;
- a ressalva acompanha todo resultado de IA;
- valores fora da faixa observada no treino são destacados no campo e listados nos avisos.

## O formulário de atributos não conhece as 36 colunas

`FeaturesForm` é **gerado** a partir de `GET /api/students/feature-contract`, que repassa
o contrato do `backend-MD`: nome, rótulo, tipo e faixa observada no treino. Se o modelo
for retreinado com outro conjunto de atributos, a tela acompanha sozinha — e não existe
uma segunda lista de colunas para manter em sincronia.

A alternância entre a escala portuguesa (0–20 / 0–200) e a brasileira (0–10) está aqui
também, com a mesma conversão da Web: o valor guardado é sempre o da escala portuguesa,
que é a que vai para a análise.

---

## O que muda em relação à Web (e por quê)

O app é fiel ao design do `frontend-Project` — mesmos tokens de cor, raio, espaçamento e
tipografia, portados de `global.css` para `core/theme.dart`. O que muda é o que não cabe
em um celular:

| Web | Mobile | Motivo |
| --- | --- | --- |
| Barra lateral fixa (248px) | Gaveta pela barra superior | É o que o próprio `global.css` já faz abaixo de 1024px |
| Tabelas de 5–7 colunas | Um bloco por registro, dados empilhados | Uma tabela larga em 360dp exige rolagem horizontal, ruim de usar com o polegar |
| Filtros sempre visíveis na toolbar | Filtros recolhidos atrás de "Filtros" | Cinco campos empurrariam a lista para fora da primeira tela |
| Tooltip de atributo no *hover* | Folha inferior ao tocar no ícone | Não existe *hover* em toque |
| Modal centralizado | Folha inferior | Padrão de formulário curto em Mobile |
| Painel de marca no login | Marca compacta | A Web também esconde esse painel abaixo de 860px |
| — | Puxar para atualizar | Gesto esperado em Mobile, sem equivalente na Web |
| Menu de usuário na barra superior | Tela `/profile` | Cabe pouca coisa na barra superior; a troca de senha ganhou lugar próprio |

Os ícones de navegação e de estado usam Material Icons em vez dos glifos de texto da Web
(`◧`, `◔`, `∅`): nem toda fonte de sistema Android cobre esses pontos de código, e o que
falha vira um quadrado vazio.

---

## Estrutura

```text
mobile-Project/
├── assets/locales/            pt-BR · en-US · es-ES (cópias fiéis das da Web)
├── lib/
│   ├── core/
│   │   ├── config.dart        única URL de API, por plataforma e --dart-define
│   │   ├── api_client.dart    cliente HTTP, erros e token seguro
│   │   └── theme.dart         tokens do global.css portados
│   ├── models/                contratos da API em Dart
│   ├── services/
│   │   └── api_services.dart  um serviço por área funcional
│   ├── state/                 auth, i18n, tema, tradução de erro
│   ├── widgets/
│   │   ├── ui.dart            primitivos: card, stat, selo, medidor, alerta…
│   │   ├── charts.dart        rosca, barras e série temporal (CustomPainter)
│   │   ├── app_shell.dart     gaveta, barra superior, cabeçalho de tela
│   │   ├── async_builder.dart carregando/erro/dados, ignorando resposta atrasada
│   │   ├── features_form.dart formulário gerado pelo contrato do modelo
│   │   └── analysis_result_view.dart  apresentação de um resultado de IA
│   ├── pages/                 uma tela por rota
│   ├── router.dart            rotas + redirecionamento por sessão
│   └── main.dart
└── test/                      testes de unidade
```

**Nenhuma tela chama `http` diretamente.** Toda rede passa por `services/` — é o que
mantém verificável a regra de não espalhar URLs e não duplicar chamadas.

`AsyncBuilder` numera as requisições e descarta a resposta que chega fora de ordem,
evitando que um resultado atrasado sobrescreva a tela com dado obsoleto ao trocar filtros
rapidamente.

---

## Notas de build

- `android/build.gradle.kts` fixa o `compileSdk` de **todos** os módulos (app e plugins)
  em 36. Sem isso, cada plugin compila contra a plataforma Android que declara, e o build
  só passa se exatamente aquelas plataformas estiverem instaladas — o mesmo commit
  funciona em uma máquina e falha em outra.
- `android/gradle.properties` usa 2 GB de heap em vez dos 8 GB que o Flutter gera por
  padrão. Com o padrão, o daemon do Gradle morre por falta de memória em máquinas de
  8–16 GB de RAM.
- `flutter_secure_storage` está em `^9.2.4` e não na linha 11.x, que exigiria o SDK 37.

## O que NÃO fazer aqui

Acessar o banco diretamente, chamar o `backend-MD` (em nenhuma hipótese — o
`backend-Project` é o gateway único, inclusive para resultados de IA), embarcar o modelo
de ML no aplicativo, duplicar regra de negócio do Back-End, guardar segredo, ou criar
endpoint paralelo quando um contrato comum já atende Web, Mobile e Desktop.
