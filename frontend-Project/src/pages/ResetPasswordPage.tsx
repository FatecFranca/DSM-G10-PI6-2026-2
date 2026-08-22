import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { Alert, Button, Field, PasswordInput, ThemeToggle } from '../components/ui';
import { useApiError } from '../hooks/useApiError';
import { authService } from '../services';
import { useI18n } from '../state/I18nContext';

export function ResetPasswordPage() {
  const { t } = useI18n();
  const { describe } = useApiError();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setSubmitting(true);
    try {
      await authService.resetPassword(token, newPassword);
      setDone(true);
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

            <h2 className="auth__title">{t('auth.resetPasswordTitle')}</h2>
            <p className="auth__subtitle">{t('auth.resetPasswordSubtitle')}</p>

            {!token ? (
              <Alert tone="danger">{t('auth.resetPasswordTokenMissing')}</Alert>
            ) : done ? (
              <Alert tone="success">{t('auth.resetPasswordSuccess')}</Alert>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="auth__fields">
                  {error && <Alert tone="danger">{error}</Alert>}

                  <Field label={t('auth.newPassword')} htmlFor="newPassword" required>
                    <PasswordInput
                      id="newPassword"
                      autoComplete="new-password"
                      required
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                    />
                  </Field>

                  <Field label={t('auth.confirmPassword')} htmlFor="confirmPassword" required>
                    <PasswordInput
                      id="confirmPassword"
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                  </Field>

                  <Button type="submit" variant="primary" block loading={submitting}>
                    {submitting ? t('auth.resetPasswordSubmitting') : t('auth.resetPasswordSubmit')}
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
