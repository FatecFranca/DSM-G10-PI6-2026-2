import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { Alert, Button, Field, PasswordInput, TextInput, ThemeToggle } from '../components/ui';
import { useApiError } from '../hooks/useApiError';
import { useAuth } from '../state/AuthContext';
import { LOCALES, useI18n, type LocaleCode } from '../state/I18nContext';

const HIGHLIGHTS = [
  { icon: '⌂', titleKey: 'auth.highlightNetworkTitle', textKey: 'auth.highlightNetworkText' },
  { icon: '◈', titleKey: 'auth.highlightModelTitle', textKey: 'auth.highlightModelText' },
  { icon: '✓', titleKey: 'auth.highlightFollowUpTitle', textKey: 'auth.highlightFollowUpText' },
] as const;

export function LoginPage() {
  const { t, locale, setLocale } = useI18n();
  const { login, authenticated, loading: authLoading } = useAuth();
  const { describe } = useApiError();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authLoading && authenticated) {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate((location.state as { from?: string } | null)?.from ?? '/', { replace: true });
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

          <ul className="auth__highlights">
            {HIGHLIGHTS.map((item) => (
              <li className="auth__highlight" key={item.titleKey}>
                <span className="auth__highlight-icon">{item.icon}</span>
                <span className="auth__highlight-text">
                  <strong>{t(item.titleKey)}</strong>
                  {t(item.textKey)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="auth__panel">
        <div className="auth__panel-top">
          <ThemeToggle />
          <select
            className="select"
            style={{ width: 'auto', padding: '5px 8px', fontSize: 13 }}
            value={locale}
            onChange={(event) => setLocale(event.target.value as LocaleCode)}
            aria-label={t('common.language')}
          >
            {(Object.keys(LOCALES) as LocaleCode[]).map((code) => (
              <option key={code} value={code}>
                {LOCALES[code].short}
              </option>
            ))}
          </select>
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

            <h2 className="auth__title">{t('auth.loginTitle')}</h2>
            <p className="auth__subtitle">{t('auth.loginSubtitle')}</p>

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

                <Field label={t('auth.password')} htmlFor="password" required>
                  <PasswordInput
                    id="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </Field>

                <Button type="submit" variant="primary" block loading={submitting}>
                  {submitting ? t('auth.submitting') : t('auth.submit')}
                </Button>

                <div style={{ textAlign: 'center' }}>
                  <Link to="/forgot-password" className="text-sm">
                    {t('auth.forgotPasswordLink')}
                  </Link>
                </div>
              </div>
            </form>

            <div className="auth__footer">
              <div className="auth__footer-note">
                <span aria-hidden="true">ℹ</span>
                <span>{t('analysis.supportTool')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
