import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pae_mobile/core/theme.dart';
import 'package:pae_mobile/widgets/ui.dart';

void main() {
  const opcoes = [
    (value: 'a', label: 'Opção A'),
    (value: 'b', label: 'Opção B'),
  ];

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

    alterarDeFora(() => valor = 'b');
    await tester.pump();

    expect(
      indiceExibido(tester),
      1,
      reason: 'o campo precisa seguir o valor do pai, não guardar o seu próprio',
    );
  });

  testWidgets('valor fora da lista de opções não derruba a tela', (tester) async {
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
