# mobile-Project — Aplicativo Flutter

Interface Mobile da plataforma **Predict Students' Dropout and Academic Success
Classification** (PI do 6º semestre).

Consome o **mesmo** `backend-Project` que a Web, com os mesmos contratos de API. Todos os
dados, inclusive os resultados de IA, vêm de lá.

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Flutter 3.41.5 · Dart 3.11.3 |
| Estado | `provider` |
| Navegação | `go_router` (mesmas rotas da Web) |
| Rede | `http`, centralizado em `core/api_client.dart` |
| Sessão | `flutter_secure_storage` (Keystore/Keychain) |
| Tema e idioma | `shared_preferences` |
| Formatação | `intl` |
| Gráficos | `CustomPainter` próprio |

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

### HTTP em texto claro só em desenvolvimento

O Android 9+ e o iOS bloqueiam HTTP sem TLS por padrão. Para o ambiente local em
`http://`, a exceção está habilitada **apenas** nas variantes de desenvolvimento:

- Android: `usesCleartextTraffic` nos manifestos `debug` e `profile`. A variante
  `release` exige HTTPS.
- iOS: `NSAllowsLocalNetworking`, que libera a rede local sem liberar HTTP para a
  internet.

Em produção, aponte `API_BASE_URL` para um endereço HTTPS.

### Verificação

```bash
flutter analyze     # sem apontamentos
flutter test        # 27 testes de unidade
```

Os testes cobrem a leitura dos contratos da API (incluindo campo ausente e confiança
nula), as regras do formulário de atributos (médias, limites rígidos, descarte de
vazios), a regra de "acompanhamento vencido" e o i18n — inclusive um teste que verifica
que **todo** valor de enum do contrato tem tradução nos três idiomas.

### Build Android

O build usa o Android SDK 36: o `compileSdk` de todos os módulos (app e plugins) está
fixado em `android/build.gradle.kts`. O Gradle roda com 2 GB de heap
(`android/gradle.properties`).

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
| `/data-mining` | Processo de construção do modelo | todos |
| `/follow-ups` | Fila de acompanhamentos | todos (escrita: ADMIN, ANALYST) |
| `/profile` | Perfil, troca da própria senha, sair | todos |
| `/admin/users`, `/admin/institutions` | Administração | ADMIN |

As rotas são as mesmas do `frontend-Project`.

O menu e as ações se ajustam ao papel do usuário; a autorização em si é feita pelo
Back-End.

---

## Como um resultado de IA aparece

Cada resultado (`analysis_result_view.dart`) mostra, como na Web:

- a classificação, a confiança como **score com barra** e a situação de acompanhamento
  (texto calculado pelo Back-End);
- as probabilidades das três classes;
- a cor da classe prevista;
- a ressalva de apoio à decisão;
- os atributos fora da faixa observada no treino, destacados no campo e listados nos
  avisos.

## Formulário de atributos

`FeaturesForm` é **gerado** a partir de `GET /api/students/feature-contract`, que repassa
o contrato do `backend-MD`: nome, rótulo, tipo e faixa observada no treino. Se o modelo
for retreinado com outro conjunto de atributos, o formulário acompanha sem mudança no
código.

A alternância entre a escala portuguesa (0–20 / 0–200) e a brasileira (0–10) está aqui
também, com a mesma conversão da Web: o valor guardado é sempre o da escala portuguesa,
que é a que vai para a análise.

---

## Diferenças em relação à Web

O app usa os mesmos tokens de cor, raio, espaçamento e tipografia da Web, portados de
`global.css` para `core/theme.dart`. A interação muda onde o celular pede:

| Web | Mobile |
| --- | --- |
| Barra lateral fixa (248px) | Gaveta pela barra superior |
| Tabelas de 5–7 colunas | Um bloco por registro, dados empilhados |
| Filtros sempre visíveis na toolbar | Filtros recolhidos atrás de "Filtros" |
| Tooltip de atributo no *hover* | Folha inferior ao tocar no ícone |
| Modal centralizado | Folha inferior |
| Painel de marca no login | Marca compacta |
| — | Puxar para atualizar |
| Menu de usuário na barra superior | Tela `/profile` |
| Glifos de texto nos ícones (`◧`, `◔`, `∅`) | Material Icons |

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

Toda chamada HTTP passa por `services/api_services.dart`, sobre o cliente de
`core/api_client.dart`.

`AsyncBuilder` numera as requisições e descarta a resposta que chega fora de ordem,
evitando que um resultado atrasado sobrescreva a tela com dado obsoleto ao trocar filtros
rapidamente.
