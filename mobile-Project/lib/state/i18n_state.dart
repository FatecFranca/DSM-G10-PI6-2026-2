import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Idiomas disponíveis — os mesmos três da Web.
enum AppLocale {
  ptBR('pt-BR', 'pt_BR', 'Português (BR)', 'PT'),
  enUS('en-US', 'en_US', 'English (US)', 'EN'),
  esES('es-ES', 'es_ES', 'Español (ES)', 'ES');

  const AppLocale(this.code, this.intlCode, this.label, this.short);

  /// Código usado no arquivo de tradução e na chave de armazenamento.
  final String code;

  /// Código no formato que o pacote `intl` espera (`pt_BR`).
  final String intlCode;

  final String label;
  final String short;

  Locale get flutterLocale => Locale(code.split('-')[0], code.split('-')[1]);

  static AppLocale? fromCode(String? code) {
    for (final locale in AppLocale.values) {
      if (locale.code == code) return locale;
    }
    return null;
  }
}

/// Descrição de um atributo do modelo, exibida no ícone de ajuda do formulário.
class FeatureInfo {
  const FeatureInfo({
    required this.text,
    required this.options,
    required this.exhaustive,
    required this.note,
  });

  final String text;
  final List<({String code, String label})> options;

  /// `false` quando a lista de códigos é apenas exemplificativa.
  final bool exhaustive;
  final String? note;

  static FeatureInfo? fromJson(Object? value) {
    if (value is String) {
      return FeatureInfo(text: value, options: const [], exhaustive: true, note: null);
    }
    if (value is! Map) return null;

    final rawOptions = value['options'];
    return FeatureInfo(
      text: value['text'] is String ? value['text'] as String : '',
      options: rawOptions is List
          ? rawOptions
              .whereType<Map>()
              .map((option) => (
                    code: '${option['code']}',
                    label: '${option['label']}',
                  ))
              .toList()
          : const [],
      exhaustive: value['exhaustive'] is bool ? value['exhaustive'] as bool : true,
      note: value['note'] is String ? value['note'] as String : null,
    );
  }
}

/// Traduções e formatação por idioma.
///
/// Os arquivos em `assets/locales/` são **cópias fiéis** de
/// `frontend-Project/src/locales/`: mesmas chaves, mesmos textos, mesma
/// interpolação `{{variavel}}`. Uma chave sem tradução cai no pt-BR e avisa no
/// console em modo de desenvolvimento — nunca renderiza vazio.
class I18nState extends ChangeNotifier {
  I18nState();

  static const _storageKey = 'pi6.locale';
  static const AppLocale _fallback = AppLocale.ptBR;

  final Map<AppLocale, Map<String, dynamic>> _messages = {};
  AppLocale _locale = _fallback;
  bool _ready = false;

  AppLocale get locale => _locale;
  bool get ready => _ready;

  Future<void> load() async {
    for (final locale in AppLocale.values) {
      final raw = await rootBundle.loadString('assets/locales/${locale.code}.json');
      _messages[locale] = jsonDecode(raw) as Map<String, dynamic>;
    }
    _locale = await _detectInitialLocale();
    _ready = true;
    notifyListeners();
  }

  Future<AppLocale> _detectInitialLocale() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final stored = AppLocale.fromCode(prefs.getString(_storageKey));
      if (stored != null) return stored;
    } catch (error) {
      debugPrint('[i18n] não foi possível ler o idioma salvo: $error');
    }

    final device = WidgetsBinding.instance.platformDispatcher.locale;
    final exact = AppLocale.fromCode('${device.languageCode}-${device.countryCode}');
    if (exact != null) return exact;

    for (final locale in AppLocale.values) {
      if (locale.code.startsWith(device.languageCode)) return locale;
    }
    return _fallback;
  }

  Future<void> setLocale(AppLocale next) async {
    if (next == _locale) return;
    _locale = next;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_storageKey, next.code);
    } catch (error) {
      debugPrint('[i18n] não foi possível salvar o idioma: $error');
    }
  }

  String? _resolve(Map<String, dynamic>? tree, String path) {
    Object? node = tree;
    for (final segment in path.split('.')) {
      if (node is! Map) return null;
      node = node[segment];
    }
    return node is String ? node : null;
  }

  /// Traduz uma chave pontuada (`students.filledOf`), interpolando
  /// `{{variavel}}`.
  String t(String key, [Map<String, Object> values = const {}]) {
    final translated = _resolve(_messages[_locale], key) ?? _resolve(_messages[_fallback], key);

    if (translated == null) {
      if (kDebugMode) debugPrint('[i18n] chave sem tradução: $key');
      return key;
    }

    if (values.isEmpty) return translated;
    return translated.replaceAllMapped(RegExp(r'\{\{(\w+)\}\}'), (match) {
      final value = values[match.group(1)];
      return value == null ? match.group(0)! : '$value';
    });
  }

  /// Descrição de um atributo do modelo (`featureDescriptions.<nome>`).
  FeatureInfo? featureInfo(String featureName) {
    final current = _messages[_locale]?['featureDescriptions'];
    final fallback = _messages[_fallback]?['featureDescriptions'];
    final value = (current is Map ? current[featureName] : null) ??
        (fallback is Map ? fallback[featureName] : null);
    return FeatureInfo.fromJson(value);
  }

  String formatNumber(num value, {int? maximumFractionDigits}) {
    final format = NumberFormat.decimalPattern(_locale.intlCode);
    if (maximumFractionDigits != null) {
      format.maximumFractionDigits = maximumFractionDigits;
    }
    return format.format(value);
  }

  /// Percentual com casas fixas, como o `formatPercent` da Web.
  String formatPercent(num ratio, [int digits = 1]) {
    final format = NumberFormat.decimalPercentPattern(
      locale: _locale.intlCode,
      decimalDigits: digits,
    );
    return format.format(ratio);
  }

  String formatDate(DateTime? value, {bool withTime = false}) {
    if (value == null) return '—';
    final format = withTime
        ? DateFormat.yMd(_locale.intlCode).add_Hm()
        : DateFormat.yMd(_locale.intlCode);
    return format.format(value);
  }

  /// Data no formato aceito pelos filtros por período (`yyyy-MM-dd`).
  String formatIsoDate(DateTime value) => DateFormat('yyyy-MM-dd').format(value);
}

/// Açúcar sintático para `context.i18n.t(...)` dentro de um `build`.
///
/// Assina as mudanças de idioma, então a tela se redesenha sozinha quando o
/// usuário troca de língua.
extension I18nContext on BuildContext {
  I18nState get i18n => watch<I18nState>();

  /// Versão que **não** assina — para usar em callbacks (`onPressed`), onde
  /// `watch` não é permitido.
  I18nState get i18nRead => read<I18nState>();
}
