import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pae_mobile/core/theme.dart';
import 'package:pae_mobile/widgets/ui.dart';

void main() {
  Future<void> pump(WidgetTester tester, Widget child, {Size? size}) async {
    if (size != null) {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
    }

    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(Brightness.dark),
        home: Scaffold(body: child),
      ),
    );
  }

  for (final tone in StatTone.values) {
    testWidgets('renderiza rótulo e valor com tom ${tone.name}', (tester) async {
      await pump(tester, StatCard(label: 'Estudantes cadastrados', value: '1.234', tone: tone));

      expect(
        tester.takeException(),
        isNull,
        reason: 'o cartão de tom ${tone.name} não pode falhar ao pintar',
      );
      expect(find.text('1.234'), findsOneWidget);
      expect(find.text('ESTUDANTES CADASTRADOS'), findsOneWidget);
    });
  }

  testWidgets('mostra o texto de apoio quando informado', (tester) async {
    await pump(
      tester,
      const StatCard(
        label: 'Acompanhamentos',
        value: '7',
        meta: '2 vencidos',
        tone: StatTone.warning,
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.text('2 vencidos'), findsOneWidget);
  });

  testWidgets('texto de apoio longo não estoura o cartão', (tester) async {
    await pump(
      tester,
      StatGrid(
        children: const [
          StatCard(label: 'Algoritmo', value: 'LinearDiscriminantAnalysis', tone: StatTone.accent),
          StatCard(label: 'Grupos', value: '3'),
          StatCard(label: 'F1 macro no teste', value: '0,686'),
          StatCard(
            label: 'Estudantes analisados',
            value: '90',
            meta:
                'Cruza os perfis descobertos no treino com os estudantes '
                'efetivamente analisados nesta base.',
          ),
        ],
      ),
      size: const Size(360, 640),
    );

    expect(
      tester.takeException(),
      isNull,
      reason: 'a altura do cartão precisa acompanhar o conteúdo, sem transbordar',
    );
    expect(find.text('LinearDiscriminantAnalysis'), findsOneWidget);
    expect(find.text('90'), findsOneWidget);
  });

  testWidgets('todos os cartoes tem exatamente a mesma altura', (tester) async {
    await pump(
      tester,
      StatGrid(
        children: const [
          StatCard(label: 'Algoritmo', value: 'LinearDiscriminantAnalysis', tone: StatTone.accent),
          StatCard(label: 'Grupos', value: '3'),
          StatCard(label: 'Estudantes cadastrados', value: '1.234', meta: '90 ativos'),
          StatCard(
            label: 'Estudantes analisados',
            value: '90',
            meta:
                'Cruza os perfis descobertos no treino com os estudantes '
                'efetivamente analisados nesta base.',
          ),
        ],
      ),
      size: const Size(360, 900),
    );

    expect(tester.takeException(), isNull);

    final alturas = tester
        .widgetList<StatCard>(find.byType(StatCard))
        .map((card) => tester.getSize(find.byWidget(card)).height)
        .toSet();

    expect(
      alturas,
      hasLength(1),
      reason: 'os cartoes precisam ter altura identica, e nao acompanhar o conteudo',
    );
  });

  for (final escala in [1.0, 1.15, 1.3, 1.5, 2.0]) {
    testWidgets('fonte do sistema a ${(escala * 100).round()}% nao faz o cartao transbordar', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        MaterialApp(
          theme: buildAppTheme(Brightness.dark),
          home: MediaQuery(
            data: MediaQueryData(textScaler: TextScaler.linear(escala)),
            child: const Scaffold(
              body: StatGrid(
                children: [
                  StatCard(label: 'Estudantes cadastrados', value: '1.234', meta: '90 ativos'),
                  StatCard(
                    label: 'Estudantes analisados',
                    value: '90',
                    meta:
                        'Cruza os perfis descobertos no treino com os estudantes '
                        'efetivamente analisados nesta base.',
                  ),
                ],
              ),
            ),
          ),
        ),
      );

      expect(tester.takeException(), isNull);
    });
  }
}
