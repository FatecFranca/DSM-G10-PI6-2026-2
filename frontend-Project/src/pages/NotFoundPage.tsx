import { Link } from 'react-router-dom';

import { Card, EmptyState } from '../components/ui';
import { useI18n } from '../state/I18nContext';

export function NotFoundPage() {
  const { t } = useI18n();

  return (
    <Card>
      <EmptyState
        icon="?"
        title={t('errors.notFoundTitle')}
        hint={t('errors.notFoundHint')}
        action={
          <Link className="btn btn--primary btn--sm" to="/">
            {t('errors.goHome')}
          </Link>
        }
      />
    </Card>
  );
}
