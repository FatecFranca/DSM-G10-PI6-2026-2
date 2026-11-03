# mobile-Project

Aplicativo Flutter do projeto Predict Students' Dropout and Academic Success Classification
(PI 6º semestre).

## Stack

| Item | Pacote / versão |
| --- | --- |
| Framework | Flutter 3.41.5, Dart 3.11.3 |
| Estado | `provider` 6 |
| Navegação | `go_router` 17 |
| HTTP | `http` 1 |
| Token JWT | `flutter_secure_storage` 9 (Keystore / Keychain) |
| Tema e idioma | `shared_preferences` 2 |
| Formatação e i18n | `intl`, `flutter_localizations` |
| Gráficos | `CustomPainter` |
| Ícones | Material Icons |

Application ID: `academico.pi6.pae_mobile`. Plataformas: Android, iOS e Windows.

## Execução

```bash
flutter pub get
flutter run
```

### URL da API

`AppConfig.apiBaseUrl` em `lib/core/config.dart`, constante usada em todas as plataformas e
variantes:

```text
https://pae-pi6.canadacentral.cloudapp.azure.com/api
```

Para usar um `backend-Project` local, alterar a constante:

| Onde o app roda | Endereço |
| --- | --- |
| Emulador Android | `http://10.0.2.2:3004/api` |
| Simulador iOS / Windows | `http://localhost:3004/api` |
| Dispositivo físico na mesma rede | `http://<IP da máquina>:3004/api` |

### HTTP sem TLS

| Plataforma | Configuração | Variantes |
| --- | --- | --- |
| Android | `android:usesCleartextTraffic="true"` em `android/app/src/{debug,profile}/AndroidManifest.xml` | `debug`, `profile` |
| iOS | `NSAllowsLocalNetworking` em `ios/Runner/Info.plist` | todas (somente rede local) |

A variante `release` do Android aceita apenas HTTPS.

### Verificação

```bash
flutter analyze
flutter test
```

| Arquivo | Cobertura |
| --- | --- |
| `models_test.dart` | Desserialização dos contratos, campos ausentes, enums desconhecidos |
| `features_form_test.dart` | Valores iniciais, preenchimento por média, limites, descarte de vazios |
| `i18n_test.dart` | Carga dos três idiomas, chaves pontuadas, interpolação, tradução de todos os enums |
| `app_card_test.dart` | Card comum e expansível, ícone de informação |
| `app_tabs_test.dart` | Abas com ícone de informação |
| `stat_card_test.dart` | Card de estatística, tons, texto longo |
| `confusion_matrix_test.dart` | Matriz de confusão sem rolagem em larguras e escalas de fonte diferentes |
| `ui_dropdown_test.dart` | Valor inicial, troca por código, valor fora da lista |
| `brand_test.dart` | Logos presentes no bundle |

### Build Android

```bash
flutter build apk --release
```

- `android/build.gradle.kts` fixa `compileSdk = 36` para o app e todos os plugins.
- `android/gradle.properties`: `-Xmx2G`.

Ícone e splash: `dart run flutter_launcher_icons` e `dart run flutter_native_splash:create`,
a partir de `branding/`.

## Telas

| Rota | Conteúdo | Acesso |
| --- | --- | --- |
| `/login` | Login | público |
| `/forgot-password` | Solicitação de redefinição de senha | público |
| `/reset-password?token=` | Nova senha | público |
| `/` | Indicadores, distribuições, evolução, fila de atenção | autenticado |
| `/students` | Lista com busca, filtros, ordenação e análise em lote | autenticado |
| `/students/new`, `/students/:id/edit` | Cadastro e edição com atributos | ADMIN, ANALYST |
| `/students/:id` | Situação, histórico, acompanhamentos, atributos | autenticado |
| `/analysis` | Simulação (ADMIN, ANALYST) e histórico | autenticado |
| `/data-mining` | Processo de construção e métricas do modelo | ADMIN |
| `/follow-ups` | Acompanhamentos (escrita: ADMIN, ANALYST) | autenticado |
| `/profile` | Dados do usuário, troca de senha, logout | autenticado |
| `/admin/users`, `/admin/institutions` | Administração | ADMIN |

As rotas são as mesmas do `frontend-Project`. O redirecionamento por sessão fica em
`lib/router.dart`, a partir do `AuthState`; `_RoleGuard` bloqueia rotas por papel.

## Resultado de análise

`analysis_result_view.dart` exibe:

- classe prevista, confiança em barra e texto de prioridade retornado pela API;
- probabilidades das três classes;
- cor associada à classe prevista;
- aviso de apoio à decisão;
- atributos fora da faixa observada no treino.

## Formulário de atributos

`features_form.dart` é montado a partir de `GET /api/students/feature-contract`. As notas
aceitam escala portuguesa (0–20 / 0–200) ou brasileira (0–10), com a mesma conversão da Web;
o valor gravado é o da escala portuguesa.

## Lote de análise

`AnalysesService.runBatch` (`lib/services/api_services.dart`) trata `200` (resultados na
resposta) e `202` (consulta `GET /api/analyses/jobs/{id}` a cada 2 s, limite de 5 min,
erro `ANALYSIS_JOB_PENDING`), com os mesmos parâmetros da Web.

## Diferenças em relação à Web

Cores, raios, espaçamentos e tipografia de `frontend-Project/src/css/global.css` estão em
`lib/core/theme.dart`.

| Web | Mobile |
| --- | --- |
| Barra lateral fixa (248 px) | Drawer aberto pela barra superior |
| Tabelas de 5 a 7 colunas | Um card por registro |
| Filtros visíveis na toolbar | Filtros recolhidos |
| Tooltip de atributo no hover | Bottom sheet ao tocar no ícone |
| Modal centralizado | Bottom sheet |
| Painel de marca no login | Marca compacta |
| | Pull-to-refresh |
| Menu do usuário na barra superior | Tela `/profile` |
| Glifos de texto (`◧`, `◔`, `∅`) | Material Icons |

## Estrutura

```text
mobile-Project/
├── assets/
│   ├── locales/               pt-BR, en-US, es-ES (mesmos arquivos da Web)
│   └── brand/
├── branding/                  fontes do ícone e do splash
├── lib/
│   ├── main.dart              MultiProvider: AuthState, I18nState, ThemeState, Api
│   ├── router.dart            rotas e redirecionamento
│   ├── core/
│   │   ├── config.dart        AppConfig.apiBaseUrl
│   │   ├── api_client.dart    cliente HTTP, token, erros
│   │   └── theme.dart
│   ├── models/                contratos da API
│   ├── services/api_services.dart
│   ├── state/                 auth, i18n, tema, tradução de erros
│   ├── widgets/
│   │   ├── ui.dart            card, stat, selo, medidor, alerta
│   │   ├── charts.dart        rosca, barras, série temporal
│   │   ├── app_shell.dart     drawer, barra superior, cabeçalho
│   │   ├── async_builder.dart
│   │   ├── features_form.dart
│   │   └── analysis_result_view.dart
│   └── pages/                 uma página por rota
└── test/
```