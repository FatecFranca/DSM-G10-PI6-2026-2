import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../state/AuthContext';
import { LOCALES, useI18n, type LocaleCode } from '../state/I18nContext';
import { Button, ThemeToggle } from './ui';

interface NavItem {
  to: string;
  labelKey: string;
  icon: string;
  visible: boolean;
}

export function AppLayout() {
  const { t, locale, setLocale } = useI18n();
  const { user, logout, can } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  const mainItems: NavItem[] = [
    { to: '/', labelKey: 'nav.dashboard', icon: '◧', visible: true },
    { to: '/students', labelKey: 'nav.students', icon: '☰', visible: true },
    { to: '/analysis', labelKey: 'nav.analysis', icon: '◈', visible: true },
    { to: '/data-mining', labelKey: 'nav.dataMining', icon: '◔', visible: true },
    { to: '/follow-ups', labelKey: 'nav.followUps', icon: '✓', visible: true },
  ];

  const adminItems: NavItem[] = [
    { to: '/admin/users', labelKey: 'nav.users', icon: '◑', visible: can.manageUsers },
    {
      to: '/admin/institutions',
      labelKey: 'nav.institutions',
      icon: '⌂',
      visible: can.manageInstitutions,
    },
  ];

  const showAdmin = adminItems.some((item) => item.visible);

  return (
    <div className="app-shell">
      {drawerOpen && <div className="sidebar__scrim" onClick={() => setDrawerOpen(false)} />}

      <aside className={`sidebar${drawerOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <span className="sidebar__logo" aria-hidden="true">
            {t('app.short')}
          </span>
          <div className="sidebar__brand-text">
            <div className="sidebar__title">{t('app.title')}</div>
            <div className="sidebar__subtitle">{t('app.subtitle')}</div>
          </div>
        </div>

        <nav className="sidebar__nav">
          {mainItems
            .filter((item) => item.visible)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
                }
              >
                <span className="sidebar__icon" aria-hidden="true">
                  {item.icon}
                </span>
                {t(item.labelKey)}
              </NavLink>
            ))}

          {showAdmin && (
            <>
              <div className="sidebar__section">{t('nav.administration')}</div>
              {adminItems
                .filter((item) => item.visible)
                .map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
                    }
                  >
                    <span className="sidebar__icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    {t(item.labelKey)}
                  </NavLink>
                ))}
            </>
          )}
        </nav>

        <div className="sidebar__footer" />
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            className="topbar__menu"
            onClick={() => setDrawerOpen((open) => !open)}
            aria-label={t('nav.dashboard')}
            aria-expanded={drawerOpen}
          >
            ☰
          </button>

          <div className="topbar__spacer" />

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

          <div className="topbar__user">
            <div className="topbar__user-info">
              <div className="topbar__user-name">{user?.name}</div>
              <div className="topbar__user-role">
                {user ? t(`roles.${user.role}`) : ''}
                {user?.institution ? ` · ${user.institution.name}` : ''}
              </div>
            </div>
            <span className="avatar" aria-hidden="true">
              {initials(user?.name)}
            </span>
            <Button variant="ghost" size="sm" onClick={logout}>
              {t('common.logout')}
            </Button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function initials(name: string | undefined): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}
