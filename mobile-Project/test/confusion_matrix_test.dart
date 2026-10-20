import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pae_mobile/core/theme.dart';
import 'package:pae_mobile/models/data_mining.dart';
import 'package:pae_mobile/pages/data_mining_page.dart';
import 'package:pae_mobile/state/i18n_state.dart';
import 'package:provider/provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late I18nState i18n;

  setUpAll(() async {
    i18n = I18nState();
    await i18n.load();
    await i18n.setLocale(AppLocale.ptBR);
  });

  const matrix = ConfusionMatrix(
    labels: ['Dropout', 'Enrolled', 'Graduate'],
    matrix: [
      [218, 29, 37],
      [43, 53, 63],
      [14, 19, 409],
    ],
  );

  Future<void> pump(WidgetTester tester, double width, {double textScale = 1}) async {
    tester.view.physicalSize = const Size(400, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ChangeNotifierProvider<I18nState>.value(
        value: i18n,
        child: MaterialApp(
          theme: buildAppTheme(Brightness.dark),
          home: MediaQuery(
            data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
            child: Scaffold(
              body: Align(
                alignment: Alignment.topLeft,
                child: SizedBox(width: width, child: const ConfusionMatrixTable(matrix: matrix)),
              ),
            ),
          ),
        ),
      ),
    );
  }

  for (final width in [240.0, 288.0, 328.0]) {
    for (final textScale in [1.0, 1.3]) {
      testWidgets('cabe em $width px sem rolar nem cortar (fonte a ${(textScale * 100).round()}%)', (
        tester,
      ) async {
        await pump(tester, width, textScale: textScale);

        expect(tester.takeException(), isNull);
        expect(find.byType(Scrollable), findsNothing);
        expect(tester.getSize(find.byType(Table)).width, width);
        for (final value in ['218', '53', '409', 'Evasão', 'Matriculado', 'Concluinte']) {
          final rect = tester.getRect(find.text(value).first);
          expect(rect.right, lessThanOrEqualTo(width), reason: '"$value" não pode passar da borda');
        }
      });
    }
  }
}
