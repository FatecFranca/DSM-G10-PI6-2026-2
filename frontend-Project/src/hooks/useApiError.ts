import { useCallback } from 'react';

import { ApiError } from '../services/api';
import { useI18n } from '../state/I18nContext';

export interface FieldIssue {
  field: string;
  message: string;
}

export function useApiError() {
  const { t } = useI18n();

  const describe = useCallback(
    (error: unknown): string => {
      if (!(error instanceof ApiError)) {
        return (error as Error)?.message ?? t('errors.generic');
      }

      const translated = t(`errors.${error.code}`);
      if (translated !== `errors.${error.code}`) return translated;

      return error.message || t('errors.generic');
    },
    [t],
  );

  const fieldIssues = useCallback((error: unknown): Record<string, string> => {
    if (!(error instanceof ApiError) || !Array.isArray(error.details)) return {};

    const issues: Record<string, string> = {};
    for (const detail of error.details as FieldIssue[]) {
      if (detail && typeof detail.field === 'string' && typeof detail.message === 'string') {
        issues[detail.field] = detail.message;
      }
    }
    return issues;
  }, []);

  return { describe, fieldIssues };
}
