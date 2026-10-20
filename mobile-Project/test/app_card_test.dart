import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pae_mobile/core/theme.dart';
import 'package:pae_mobile/widgets/ui.dart';

void main() {
  Future<void> pump(WidgetTester tester, Widget child) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(Brightness.dark),
        home: Scaffold(body: SingleChildScrollView(child: child)),
      ),
    );
  }

  testWidgets('card comum mostra o conteúdo direto, sem seta de expandir', (tester) async {
    await pump(tester, const AppCard(title: 'Painel', child: Text('conteúdo')));

    expect(find.text('conteúdo'), findsOneWidget);
    expect(find.byIcon(Icons.expand_more), findsNothing);
  });

  testWidgets('card expansível começa fechado e abre e fecha pelo cabeçalho', (tester) async {
    await pump(
      tester,
      const AppCard(
        title: 'Matriz de confusão',
        hint: 'Linhas: classe real.',
        collapsible: true,
        child: Text('conteúdo'),
      ),
    );

    expect(find.text('Matriz de confusão'), findsOneWidget);
    expect(find.text('Linhas: classe real.'), findsOneWidget);
    expect(find.text('conteúdo'), findsNothing);

    await tester.tap(find.text('Matriz de confusão'));
    await tester.pumpAndSettle();
    expect(find.text('conteúdo'), findsOneWidget);

    await tester.tap(find.text('Matriz de confusão'));
    await tester.pumpAndSettle();
    expect(find.text('conteúdo'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('informação do título aparece ao tocar no ícone', (tester) async {
    await pump(
      tester,
      const AppCard(
        title: 'Distribuição por prioridade',
        titleInfo: 'A classificação é uma ferramenta de apoio à análise.',
        child: Text('conteúdo'),
      ),
    );

    expect(find.text('A classificação é uma ferramenta de apoio à análise.'), findsNothing);

    await tester.tap(find.byIcon(Icons.info_outline));
    await tester.pumpAndSettle();
    expect(find.text('A classificação é uma ferramenta de apoio à análise.'), findsOneWidget);
  });
}
