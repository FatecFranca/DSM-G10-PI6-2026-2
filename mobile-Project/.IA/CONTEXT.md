# CONTEXT.md — mobile-Project

> ## Como uma IA deve ler este documento
>
> Este arquivo é uma **instrução operacional** para uma IA que vai desenvolver este componente — não é documentação de referência opcional que pode ser lida por cima.
>
> - `Decisão confirmada`: já foi decidida pelo responsável do projeto. Seguir sem questionar. Só revisitar com justificativa técnica forte, e mesmo assim perguntar antes de mudar.
> - `Decisão em aberto`: ponto em aberto, risco conhecido ou regra que exige atenção redobrada. Se o texto disser que é uma pendência que bloqueia implementação, a IA deve **parar e perguntar ao responsável do projeto antes de prosseguir** — nunca decidir sozinha e seguir em frente.
> - Se algo neste documento parecer contradizer outro `CONTEXT.md` dos demais componentes (`backend-MD`, `backend-Project`, `frontend-Project`, `mobile-Project`), isso é sinal de alerta — não deve ser resolvido por suposição, e sim reportado antes de codar.


## 1. Identidade

**Nome:** Predict Students' Dropout and Academic Success Classification  
**Componente:** `mobile-Project`  
**Tecnologia:** Flutter 3.41.5 / Dart 3.11.3  
**Status:** Implementado.

Este projeto é a aplicação Mobile do PI do 6º semestre e representa a continuidade direta
do requisito Mobile existente no PI do 5º semestre.

O app cobre as mesmas áreas funcionais da Web: acesso, painel, estudantes (listagem,
cadastro, detalhe, análise individual e em lote), análise (simulação e histórico),
mineração de dados (perfis e processo do modelo), acompanhamento e administração de
usuários e instituições. Ver `README.md` para telas, decisões de adaptação ao celular e
como executar.

---

## 2. Objetivo

A aplicação Mobile deverá permitir que usuários em campo utilizem as principais funcionalidades da plataforma sem depender da interface Web.

Exemplos:

- login;
- consulta de estudantes;
- cadastro/edição conforme permissão;
- envio de informações para análise;
- consulta da classificação;
- consulta de histórico;
- notificações;
- acompanhamento de situações prioritárias.

As funcionalidades definitivas devem ser definidas conforme a evolução da aplicação.

---

## 3. Relação com o PI do 5º semestre

O Mobile é uma das partes que deve permanecer na evolução do projeto.

O 5º semestre determina desenvolvimento de Front-End Mobile integrado ao Back-End RESTful e ao classificador.

No 6º semestre, o Mobile passa a compartilhar a infraestrutura de Back-End com Web e Desktop.

Arquitetura esperada:

```text
Flutter
   |
   | HTTPS / JSON
   v
backend-Project
   |
   +------> Banco
   |
   +------> backend-MD
```

O aplicativo nunca deve conectar diretamente ao MongoDB.

---

## 4. Tecnologia

### Framework e linguagem

- Flutter `3.41.5` (canal stable)
- Dart `3.11.3`

`Decisão confirmada` (registrada em 02/09/2026, na criação do projeto): estas são as
versões usadas para gerar e validar o aplicativo. `flutter analyze` roda sem nenhum
apontamento e a suíte de testes de unidade passa nessas versões.

O identificador do aplicativo é `academico.pi6.pae_mobile` — deliberadamente neutro:
a plataforma **não** é operada pelo CMDCAF nem por nenhum órgão público, então o
identificador não deve sugerir domínio institucional que o projeto não tem.

### Gerenciamento de estado

`Decisão confirmada` (autorizada pelo responsável do projeto em 02/09/2026, encerrando a
pendência bloqueante): **Provider** (`provider`), exatamente a opção que estava sugerida
para avaliação nesta seção.

Motivo: é a abordagem oficialmente recomendada pelo time do Flutter para apps de porte
pequeno/médio, com curva de aprendizado baixa — adequada ao escopo de um PI acadêmico e
ao tamanho deste app.

Como está aplicado:

- `AuthState`, `I18nState` e `ThemeState` são `ChangeNotifier` expostos por
  `MultiProvider` na raiz (`lib/main.dart`);
- `Api` (o conjunto de serviços HTTP) é um `Provider` simples, sem notificação — não é
  estado, é dependência;
- estado local de tela (filtros, página atual, formulário em edição) fica no próprio
  `State` do widget, sem subir para o Provider: só é compartilhado o que mais de uma
  tela precisa enxergar.

### Navegação

`Decisão confirmada` (02/09/2026): **go_router**, com as **mesmas rotas** do
`frontend-Project` (`/students/:id`, `/data-mining`, `/admin/users`, ...).

Motivo: manter os caminhos iguais aos da Web permite falar de uma tela por endereço entre
as duas plataformas. O redirecionamento por sessão fica em um lugar só
(`lib/router.dart`), observando o `AuthState`: nenhuma tela navega para o login na mão.

### Comunicação HTTP

`Decisão confirmada` (02/09/2026): pacote **`http`**, encapsulado em `lib/core/api_client.dart`.

Existe **uma única** URL de API configurada, apontando para o `backend-Project`
(`AppConfig.apiBaseUrl`, definível por `--dart-define=API_BASE_URL=...`). Não há — e não
deve haver — configuração apontando para o `backend-MD`: ver seção 7.

### Persistência local

`Decisão confirmada` (autorizada pelo responsável do projeto em 02/09/2026, encerrando a
pendência bloqueante): **`shared_preferences` + `flutter_secure_storage`**, cada um no seu
papel — exatamente a combinação que estava sugerida para avaliação nesta seção.

| Dado | Onde | Por quê |
| --- | --- | --- |
| Token de sessão (JWT) | `flutter_secure_storage` | Keystore no Android, Keychain no iOS. A seção 9 exige guardar credencial de forma segura, e `SharedPreferences` não é criptografado. |
| Tema (claro/escuro) | `shared_preferences` | Configuração simples, não sensível. |
| Idioma | `shared_preferences` | Configuração simples, não sensível. |

`Hive`/`sqflite` **não** foram adotados: não existe, no escopo atual, cache estruturado
que justifique um banco local — e a seção 10 é explícita em não usar armazenamento local
como substituto do banco principal.

> Nota de versão: `flutter_secure_storage` está fixado em `^9.2.4`, e não na linha 11.x.
> A 11.x exige compilar contra o Android SDK 37; o projeto está alinhado ao SDK 36 em
> `android/build.gradle.kts`, que é o que o Flutter 3.41.5 usa. Ao atualizar o Flutter,
> os dois podem subir juntos.

### Internacionalização

`Decisão confirmada` (02/09/2026): os arquivos de tradução em `assets/locales/` são
**cópias fiéis** de `frontend-Project/src/locales/` — mesmas chaves, mesmos textos, mesma
interpolação `{{variavel}}`.

Consequência a respeitar: quando um texto mudar na Web, a cópia precisa ser refeita. Não
traduzir de novo do zero aqui, e não criar chave que só exista no Mobile sem que a Web
também precise dela — isso faria as duas interfaces divergirem no vocabulário do domínio.
A formatação de número, percentual e data usa `intl`, equivalente ao `Intl` do navegador.

---

## 5. Responsabilidades

O Mobile deve:

- fornecer experiência adaptada para dispositivos móveis;
- consumir API REST;
- gerenciar estado de interface;
- realizar navegação;
- tratar autenticação;
- apresentar resultados do sistema;
- utilizar recursos do dispositivo quando necessários;
- permitir consulta e operação em campo;
- implementar persistência local somente quando houver necessidade real.

---

## 6. O que NÃO fazer

Não:

- acessar banco diretamente;
- incorporar o modelo de Machine Learning dentro do aplicativo sem decisão arquitetural explícita;
- duplicar regras do Back-End;
- guardar secrets;
- criar uma API paralela;
- depender de endpoints exclusivos quando um contrato comum já atende Web/Mobile/Desktop sem necessidade.

A classificação deve ser realizada no serviço de IA/API definido pela arquitetura.

---

## 7. Comunicação

O padrão esperado é:

```text
Flutter
  |
  | HTTPS
  v
backend-Project
  |
  +----> backend-MD
  |
  +----> MongoDB
```

O aplicativo deve trabalhar com JSON e contratos definidos pela API.

---

## 8. Classificação

Fluxo conceitual:

```text
Usuário
   |
   v
Tela de análise
   |
   v
Flutter envia dados
   |
   v
backend-Project
   |
   v
backend-MD
   |
   v
Classificação
   |
   v
backend-Project
   |
   v
Flutter
   |
   v
Resultado
```

O Mobile deve apresentar o resultado de maneira compreensível.

Exemplo:

```text
Análise concluída

Classificação:
Dropout

Indicador:
Acompanhamento prioritário
```

Não transformar a saída do modelo em diagnóstico ou certeza.

---

## 9. Autenticação

A autenticação deve ocorrer através da API principal.

O aplicativo deverá:

- enviar credenciais;
- receber a resposta de autenticação;
- armazenar apenas o necessário;
- enviar token/credencial de sessão conforme contrato da API;
- remover credenciais de forma segura no logout.

Não armazenar senha em texto puro.

> Ver seção 4 ("Persistência local") para a biblioteca a ser usada para guardar esse token com segurança — `SharedPreferences` não é apropriado para isso.

---

## 10. Persistência local

Persistência local poderá ser usada para:

- sessão;
- configurações;
- dados temporários;
- cache controlado.

Dados sensíveis devem receber tratamento apropriado.

Não utilizar armazenamento local como substituto do banco principal.

> A biblioteca específica para cada tipo de dado listado acima está definida (como pendência) na seção 4.

---

## 11. Notificações

A arquitetura pode utilizar notificações para comunicar:

- novas análises;
- necessidade de acompanhamento;
- alterações relevantes;
- eventos da instituição.

A implementação definitiva depende da infraestrutura de comunicação selecionada.

---

## 12. UX

O Mobile deve priorizar:

- ações rápidas;
- leitura clara;
- acessibilidade;
- poucos passos por operação;
- feedback visual;
- mensagens de erro compreensíveis;
- estados de carregamento;
- adaptação a diferentes tamanhos de tela.

A interface deve refletir o mesmo domínio da Web, mas não precisa reproduzir exatamente o mesmo layout.

---

## 13. Integração multiplataforma

Web, Mobile e Desktop devem compartilhar:

- domínio funcional;
- autenticação;
- contratos de API;
- banco por meio do Back-End;
- regras de negócio;
- serviço de IA.

Cada plataforma poderá possuir uma experiência específica.

---

## 14. Regras para uma IA que modificar o Mobile

O projeto já existe. Antes de alterar código:

1. Ler a estrutura atual (`lib/`) e o `README.md`.
2. Respeitar as decisões já fechadas na seção 4: **Provider** para estado,
   **go_router** para navegação, **`http`** para rede, **`shared_preferences` +
   `flutter_secure_storage`** para persistência local. Não trocar nenhuma delas sem
   justificativa técnica forte e sem perguntar antes.
3. Centralizar serviços HTTP: nenhuma tela chama `http` diretamente — tudo passa por
   `lib/core/api_client.dart` e `lib/services/api_services.dart`.
4. Criar modelos de dados alinhados aos contratos da API (`lib/models/`), tolerantes a
   campo ausente: um campo novo no Back-End não pode derrubar a tela.
5. Não duplicar regra de negócio. Prioridade de acompanhamento, escopo por instituição e
   validação de atributos são do `backend-Project`; aqui só se apresenta.
6. Não acessar o banco diretamente e não chamar o `backend-MD` (ver seção 7).
7. Não colocar credencial no código: tudo que vai para o APK é público.
8. Reaproveitar os primitivos visuais de `lib/widgets/ui.dart` em vez de estilizar
   widget solto — eles são a tradução dos tokens do `global.css` da Web.
9. Manter os três idiomas em sincronia com `frontend-Project/src/locales/` (seção 4).
10. Implementar tratamento consistente de carregando, sucesso e erro (`AsyncBuilder`).
11. Manter compatibilidade com Web e Desktop por meio da API principal.
12. Rodar `flutter analyze` e `flutter test` antes de dar por concluído.

---

## 15. Princípio arquitetural

> **mobile-Project é a interface móvel do sistema e deve consumir a mesma API principal utilizada pelas demais plataformas.**

O Mobile deve ser desacoplado da implementação interna do banco e do modelo de Machine Learning.