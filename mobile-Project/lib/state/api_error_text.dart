import '../core/api_client.dart';
import 'i18n_state.dart';

/// Traduz um erro da API para a mensagem exibida ao usuário — equivalente ao
/// `useApiError` da Web.
///
/// A regra é a mesma: primeiro tenta a tradução do **código** (`errors.<CODE>`);
/// se não houver chave, cai na mensagem que o Back-End mandou; e só então na
/// mensagem genérica. Assim uma mensagem nova do servidor nunca vira tela em
/// branco, e uma conhecida aparece no idioma escolhido.
String describeApiError(I18nState t, Object? error) {
  if (error is! ApiException) {
    return error is Exception || error is Error
        ? t.t('errors.generic')
        : '${error ?? t.t('errors.generic')}';
  }

  final key = 'errors.${error.code}';
  final translated = t.t(key);
  if (translated != key) return translated;

  return error.message.isNotEmpty ? error.message : t.t('errors.generic');
}

/// Erros de validação por campo (`details: [{ field, message }]`).
Map<String, String> apiFieldIssues(Object? error) =>
    error is ApiException ? error.fieldIssues : const {};
