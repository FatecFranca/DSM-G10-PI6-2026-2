import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { Alert, Button, Field, TextInput, ThemeToggle } from '../components/ui';
import { useApiError } from '../hooks/useApiError';
import { authService } from '../services';
import { useI18n } from '../state/I18nContext';

export function ForgotPasswordPage() {
  const { t } = useI18n();
  const { describe } = useApiError();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authService.forgotPassword(email.trim());
      setSent(true);
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth__brand" aria-hidden="true">
        <div className="auth__brand-inner">
          <div className="auth__brand-logo">{t('app.short')}</div>
          <h1 className="auth__brand-title">{t('app.title')}</h1>
          <p className="auth__brand-subtitle">{t('app.subtitle')}</p>
        </div>
      </div>

      <div className="auth__panel">
        <div className="auth__panel-top">
          <ThemeToggle />
        </div>

        <div className="auth__panel-body">
          <div className="auth__form">
            <div className="auth__mobile-brand">
              <span className="sidebar__logo" aria-hidden="true">
                {t('app.short')}
              </span>
              <div>
                <div style={{ fontWeight: 650, fontSize: 14 }}>{t('app.title')}</div>
                <div className="text-sm text-muted">{t('app.subtitle')}</div>
              </div>
            </div>

            <h2 className="auth__title">{t('auth.forgotPasswordTitle')}</h2>
            <p className="auth__subtitle">{t('auth.forgotPasswordSubtitle')}</p>

            {sent ? (
              <Alert tone="success">{t('auth.forgotPasswordSent')}</Alert>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="auth__fields">
                  {error && <Alert tone="danger">{error}</Alert>}

                  <Field label={t('auth.email')} htmlFor="email" required>
                    <TextInput
                      id="email"
                      type="email"
                      autoComplete="username"
                      autoFocus
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="nome@instituicao.org"
                    />
                  </Field>

                  <Button type="submit" variant="primary" block loading={submitting}>
                    {submitting
                      ? t('auth.forgotPasswordSubmitting')
                      : t('auth.forgotPasswordSubmit')}
                  </Button>
                </div>
              </form>
            )}

            <div className="auth__footer">
              <Link to="/login">← {t('auth.backToLogin')}</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
