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
**Tecnologia planejada:** Flutter  
**Status:** Desenvolvimento futuro.

Este projeto será a aplicação Mobile do PI do 6º semestre e representa a continuidade direta do requisito Mobile existente no PI do 5º semestre.

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

### Framework

- Flutter

### Linguagem

- Dart

A versão do Flutter/Dart deve ser definida no momento da criação do projeto e registrada neste documento quando estabelecida.

### Gerenciamento de estado

`Decisão em aberto — bloqueante para começar a estruturar telas com mais de um widget dependente de estado compartilhado.`

Ainda não foi escolhida a abordagem de gerenciamento de estado (ex.: Provider, Riverpod, Bloc/Cubit, GetX). Sem essa definição, uma IA implementando o app pode escolher uma abordagem incompatível com o resto do time ou trocar de padrão no meio do desenvolvimento.

Sugestão para avaliação (não é decisão tomada): **Provider** é uma opção simples e oficialmente recomendada pelo próprio time do Flutter para apps de porte pequeno/médio como este, com curva de aprendizado baixa — adequada ao escopo de um PI acadêmico. Mas isso precisa ser confirmado pelo responsável do projeto antes de qualquer IA usar essa lib no código; não adotar automaticamente só por estar sugerida aqui.

### Persistência local

`Decisão em aberto — bloqueante para implementar sessão/cache local (seção 10).`

Ainda não foi escolhida a biblioteca de persistência local. Opções relevantes para o escopo descrito na seção 10 (sessão, configurações, dados temporários, cache controlado):

- **SharedPreferences** (ou `shared_preferences`): adequado para dados simples de configuração e flags — **não deve ser usado para token de autenticação ou qualquer dado sensível**, pois não é criptografado.
- **flutter_secure_storage**: para o que exige segurança (ex.: token/credencial de sessão — ver seção 9), já que `SharedPreferences` não é apropriado para isso.
- **Hive** ou **sqflite**: se surgir necessidade de cache estruturado mais robusto (não parece necessário no escopo atual).

Sugestão para avaliação (não é decisão tomada): `SharedPreferences` para configurações/flags simples **combinado com** `flutter_secure_storage` especificamente para token/credencial de sessão (seção 9 exige "armazenar credenciais de forma segura" — `SharedPreferences` sozinho não atende esse requisito). Confirmar com o responsável do projeto antes de implementar.

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

## 14. Regras para uma IA que desenvolver o Mobile

Quando o projeto Flutter for iniciado:

1. Inspecionar a versão do Flutter/Dart.
2. Verificar se o gerenciamento de estado e a persistência local (seção 4) já foram decididos; se não, perguntar antes de escrever qualquer código de estado ou de armazenamento local.
3. Registrar a arquitetura escolhida.
4. Respeitar o padrão de gerenciamento de estado definido pelo projeto.
5. Centralizar serviços HTTP.
6. Criar modelos de dados alinhados aos contratos da API.
7. Não duplicar regra de negócio.
8. Não acessar o banco diretamente.
9. Não colocar credenciais no código.
10. Reutilizar padrões de autenticação existentes.
11. Implementar tratamento consistente de loading, sucesso e erro.
12. Manter compatibilidade com Web e Desktop por meio da API principal.

---

## 15. Princípio arquitetural

> **mobile-Project é a interface móvel do sistema e deve consumir a mesma API principal utilizada pelas demais plataformas.**

O Mobile deve ser desacoplado da implementação interna do banco e do modelo de Machine Learning.