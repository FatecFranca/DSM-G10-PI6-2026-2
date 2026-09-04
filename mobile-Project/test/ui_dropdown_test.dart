import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pae_mobile/core/theme.dart';
import 'package:pae_mobile/widgets/ui.dart';

/// O `AppDropdown` precisa ser um componente **controlado**: quem manda é o
/// `value` que o pai passa, como nos `<select>` da Web. É disso que dependem o
/// "Limpar filtros" do histórico de análises e a carga dos dados no formulário
/// de estudante.
///
/// O comportamento vem do `DropdownButtonFormField`, cujo estado ressincroniza
/// quando `initialValue` muda (`_DropdownButtonFormFieldState.didUpdateWidget`
/// chama `setValue`). Não é óbvio olhando só a classe base `FormFieldState`,
/// que sincroniza apenas `forceErrorText` — daí valer um teste fixando isso,
/// para que uma troca futura de widget não derrube a garantia em silêncio.
///
/// O terceiro caso já pegou um defeito real: valor fora da lista de opções
/// dispara asserção no widget e derruba a tela.
void main() {
  const opcoes = [
    (value: 'a', label: 'Opção A'),
    (value: 'b', label: 'Opção B'),
  ];

  /// Monta o campo deixando o teste trocar o valor "de fora", como faz o botão
  /// de limpar filtros.
  Future<StateSetter> montar(
    WidgetTester tester,
    ValueGetter<String?> valor, {
    List<({String value, String label})> items = opcoes,
  }) async {
    late StateSetter alterarDeFora;

    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(Brightness.dark),
        home: Scaffold(
          body: StatefulBuilder(
            builder: (context, setState) {
              alterarDeFora = setState;
              return AppDropdown<String?>(
                value: valor(),
                items: items,
                onChanged: (_) {},
              );
            },
          ),
        ),
      ),
    );

    return alterarDeFora;
  }

  /// Índice que o `DropdownButton` está de fato exibindo.
  int indiceExibido(WidgetTester tester) =>
      tester.widget<IndexedStack>(find.byType(IndexedStack)).index!;

  testWidgets('exibe a opção correspondente ao valor inicial', (tester) async {
    await montar(tester, () => 'a');
    expect(indiceExibido(tester), 0);
  });

  testWidgets('acompanha a troca de valor feita por código', (tester) async {
    String? valor = 'a';
    final alterarDeFora = await montar(tester, () => valor);

    expect(indiceExibido(tester), 0);

    // Equivalente ao "Limpar filtros": o estado muda sem toque no campo.
    alterarDeFora(() => valor = 'b');
    await tester.pump();

    expect(
      indiceExibido(tester),
      1,
      reason: 'o campo precisa seguir o valor do pai, não guardar o seu próprio',
    );
  });

  testWidgets('valor fora da lista de opções não derruba a tela', (tester) async {
    // Acontece ao editar um estudante cuja instituição foi desativada e por
    // isso não veio na listagem de instituições ativas.
    await montar(tester, () => 'instituicao-inexistente');

    expect(tester.takeException(), isNull);
    expect(find.byType(AppDropdown<String?>), findsOneWidget);
  });

  testWidgets('desabilitado não aceita interação', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(Brightness.dark),
        home: Scaffold(
          body: AppDropdown<String?>(
            value: 'a',
            items: opcoes,
            enabled: false,
            onChanged: (_) {},
          ),
        ),
      ),
    );

    final botao = tester.widget<DropdownButton<String?>>(
      find.byType(DropdownButton<String?>),
    );
    expect(botao.onChanged, isNull);
  });
}
