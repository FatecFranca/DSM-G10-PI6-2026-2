import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pae_mobile/core/theme.dart';
import 'package:pae_mobile/widgets/ui.dart';

void main() {
  Future<List<int>> pump(WidgetTester tester) async {
    final changes = <int>[];
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(Brightness.dark),
        home: Scaffold(
          body: AppTabs(
            labels: const ['Simular análise', 'Histórico'],
            infos: const {0: 'Nada é gravado no histórico.'},
            active: 1,
            onChange: changes.add,
          ),
        ),
      ),
    );
    return changes;
  }

  testWidgets('mostra o ícone de informação só na aba que tem texto', (tester) async {
    await pump(tester);

    expect(find.byIcon(Icons.info_outline), findsOneWidget);
    expect(
      find.descendant(of: find.byType(Row), matching: find.text('Simular análise')),
      findsOneWidget,
    );
  });

  testWidgets('tocar no ícone mostra o texto sem trocar de aba', (tester) async {
    final changes = await pump(tester);

    await tester.tap(find.byIcon(Icons.info_outline));
    await tester.pumpAndSettle();

    expect(find.text('Nada é gravado no histórico.'), findsOneWidget);
    expect(changes, isEmpty);
  });

  testWidgets('tocar no nome da aba continua trocando de aba', (tester) async {
    final changes = await pump(tester);

    await tester.tap(find.text('Simular análise'));
    await tester.pump();

    expect(changes, [0]);
  });
}
