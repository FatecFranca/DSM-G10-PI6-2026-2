import 'package:flutter_test/flutter_test.dart';
import 'package:pae_mobile/models/enums.dart';
import 'package:pae_mobile/state/i18n_state.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late I18nState i18n;

  setUp(() async {
    i18n = I18nState();
    await i18n.load();
    await i18n.setLocale(AppLocale.ptBR);
  });

  test('carrega os três idiomas declarados', () {
    expect(AppLocale.values.map((locale) => locale.code),
        containsAll(['pt-BR', 'en-US', 'es-ES']));
    expect(i18n.ready, isTrue);
  });

  test('resolve chave pontuada', () {
    expect(i18n.t('app.short'), 'PAE');
    expect(i18n.t('nav.dataMining'), 'Mineração de Dados');
  });

  test('interpola {{variavel}}', () {
    expect(
      i18n.t('students.filledOf', {'filled': 12, 'total': 36}),
      '12 de 36 atributos preenchidos',
    );
  });

  test('chave inexistente devolve a própria chave, nunca vazio', () {
    expect(i18n.t('nao.existe'), 'nao.existe');
  });

  test('troca de idioma muda o texto', () async {
    await i18n.setLocale(AppLocale.enUS);
    expect(i18n.t('nav.students'), isNot('Estudantes'));

    await i18n.setLocale(AppLocale.esES);
    expect(i18n.t('nav.students'), isNotEmpty);
  });

  test('todo enum do contrato tem tradução nos três idiomas', () async {
    for (final locale in AppLocale.values) {
      await i18n.setLocale(locale);

      for (final value in Classification.values) {
        final key = 'classification.${value.api}';
        expect(i18n.t(key), isNot(key), reason: '$key faltando em ${locale.code}');
      }
      for (final value in Priority.values) {
        final key = 'priority.${value.api}';
        expect(i18n.t(key), isNot(key), reason: '$key faltando em ${locale.code}');
      }
      for (final value in FollowUpStatus.values) {
        final key = 'followUpStatus.${value.api}';
        expect(i18n.t(key), isNot(key), reason: '$key faltando em ${locale.code}');
      }
      for (final value in AttentionLevel.values) {
        final key = 'attention.${value.api}';
        expect(i18n.t(key), isNot(key), reason: '$key faltando em ${locale.code}');
      }
      for (final value in Role.values) {
        expect(i18n.t('roles.${value.api}'), isNot('roles.${value.api}'));
        expect(i18n.t('roles.${value.api}_hint'), isNot('roles.${value.api}_hint'));
      }
    }
  });

  test('formatação segue o idioma', () async {
    await i18n.setLocale(AppLocale.ptBR);
    expect(i18n.formatNumber(1234.5), '1.234,5');
    expect(i18n.formatPercent(0.758, 1), contains('75,8'));

    await i18n.setLocale(AppLocale.enUS);
    expect(i18n.formatNumber(1234.5), '1,234.5');
  });

  test('data nula vira travessão, como na Web', () {
    expect(i18n.formatDate(null), '—');
  });

  test('descrição de atributo do modelo existe para um campo conhecido', () {
    final info = i18n.featureInfo('tuition_fees_up_to_date');
    expect(info, isNotNull);
    expect(info!.text, isNotEmpty);
  });
}
