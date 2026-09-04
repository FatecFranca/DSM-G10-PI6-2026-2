import '../core/api_client.dart';
import 'i18n_state.dart';

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

Map<String, String> apiFieldIssues(Object? error) =>
    error is ApiException ? error.fieldIssues : const {};
