import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

import { useI18n } from '../state/I18nContext';
import { useTheme } from '../state/ThemeContext';
import type { AttentionLevel, Classification, FollowUpStatus, Priority } from '../types/api';

interface CardProps {
  title?: ReactNode;
  hint?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}

export function Card({ title, hint, actions, children, flush }: CardProps) {
  return (
    <section className="card">
      {(title || actions) && (
        <header className="card__header">
          <div>
            {title && <h2 className="card__title">{title}</h2>}
            {hint && <p className="card__hint">{hint}</p>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </header>
      )}
      <div className={flush ? 'card__body card__body--flush' : 'card__body'}>{children}</div>
    </section>
  );
}

interface StatProps {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  tone?: 'default' | 'accent' | 'danger' | 'warning' | 'success';
}

export function Stat({ label, value, meta, tone = 'default' }: StatProps) {
  const toneClass = tone === 'default' ? '' : ` stat--${tone}`;
  return (
    <div className={`stat${toneClass}`}>
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {meta && <div className="stat__meta">{meta}</div>}
    </div>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  loading?: boolean;
  block?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  block = false,
  children,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    `btn--${variant}`,
    size === 'sm' ? 'btn--sm' : '',
    block ? 'btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading && (
        <span
          className={`spinner spinner--inline${variant === 'primary' || variant === 'danger' ? ' spinner--light' : ''}`}
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { isDark, toggleTheme } = useTheme();
  const { t } = useI18n();
  const label = t(isDark ? 'common.switchToLight' : 'common.switchToDark');

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">{isDark ? '☀' : '☾'}</span>
    </button>
  );
}

interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, required, hint, error, children }: FieldProps) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={htmlFor}>
        {label}
        {required && <span className="field__required">*</span>}
      </label>
      {children}
      {error ? (
        <span className="field__error">{error}</span>
      ) : (
        hint && <span className="field__hint">{hint}</span>
      )}
    </div>
  );
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function TextInput({ invalid, className = '', ...rest }: TextInputProps) {
  return <input className={`input${invalid ? ' input--error' : ''} ${className}`.trim()} {...rest} />;
}

function EyeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A11 11 0 0 1 12 5c6.5 0 10.5 7 10.5 7a15.6 15.6 0 0 1-3.4 4.2M6.6 6.6C3.6 8.4 1.5 12 1.5 12s4 7 10.5 7c1.4 0 2.7-.3 3.9-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

export function PasswordInput({
  id,
  className = '',
  style,
  ...rest
}: Omit<TextInputProps, 'type'> & { id: string }) {
  const [visible, setVisible] = useState(false);
  const { t } = useI18n();
  const label = t(visible ? 'auth.hidePassword' : 'auth.showPassword');

  return (
    <div className="input-group">
      <TextInput
        id={id}
        type={visible ? 'text' : 'password'}
        className={className}
        style={{ paddingRight: 38, ...style }}
        {...rest}
      />
      <button
        type="button"
        className="input-icon-btn"
        onClick={() => setVisible((current) => !current)}
        aria-label={label}
        title={label}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

interface SelectInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export function SelectInput({ invalid, className = '', children, ...rest }: SelectInputProps) {
  return (
    <select className={`select${invalid ? ' select--error' : ''} ${className}`.trim()} {...rest}>
      {children}
    </select>
  );
}

const CLASSIFICATION_CLASS: Record<Classification, string> = {
  Dropout: 'badge--dropout',
  Enrolled: 'badge--enrolled',
  Graduate: 'badge--graduate',
};

export const CLASSIFICATION_COLOR: Record<Classification, string> = {
  Dropout: 'var(--dropout)',
  Enrolled: 'var(--enrolled)',
  Graduate: 'var(--graduate)',
};

export function ClassificationBadge({ value }: { value: Classification | null | undefined }) {
  const { t } = useI18n();
  if (!value) return <span className="badge badge--neutral">{t('classification.notAnalyzed')}</span>;
  return <span className={`badge ${CLASSIFICATION_CLASS[value]}`}>{t(`classification.${value}`)}</span>;
}

const PRIORITY_CLASS: Record<Priority, string> = {
  HIGH: 'badge--high',
  MEDIUM: 'badge--medium',
  LOW: 'badge--low',
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  HIGH: 'var(--danger)',
  MEDIUM: 'var(--warning)',
  LOW: 'var(--success)',
};

export function PriorityBadge({ value }: { value: Priority | null | undefined }) {
  const { t } = useI18n();
  if (!value) return <span className="badge badge--neutral">—</span>;
  return <span className={`badge ${PRIORITY_CLASS[value]}`}>{t(`priority.${value}`)}</span>;
}

const ATTENTION_CLASS: Record<AttentionLevel, string> = {
  alta: 'badge--high',
  média: 'badge--medium',
  baixa: 'badge--low',
};

export function AttentionBadge({ value }: { value: AttentionLevel | null | undefined }) {
  const { t } = useI18n();
  if (!value) return null;
  return <span className={`badge ${ATTENTION_CLASS[value] ?? 'badge--neutral'}`}>{t(`attention.${value}`)}</span>;
}

const STATUS_CLASS: Record<FollowUpStatus, string> = {
  OPEN: 'badge--info',
  IN_PROGRESS: 'badge--medium',
  DONE: 'badge--low',
  CANCELLED: 'badge--neutral',
};

export function StatusBadge({ value }: { value: FollowUpStatus }) {
  const { t } = useI18n();
  return <span className={`badge ${STATUS_CLASS[value]}`}>{t(`followUpStatus.${value}`)}</span>;
}

export function ConfidenceMeter({
  value,
  classification,
}: {
  value: number | null | undefined;
  classification?: Classification | null;
}) {
  const { formatPercent } = useI18n();

  if (value === null || value === undefined) return <span className="text-muted">—</span>;

  const color = classification ? CLASSIFICATION_COLOR[classification] : 'var(--brand)';

  return (
    <div className="meter">
      <div className="meter__track">
        <div
          className="meter__fill"
          style={{ width: `${Math.min(Math.max(value, 0), 1) * 100}%`, background: color }}
        />
      </div>
      <span className="meter__value">{formatPercent(value, 0)}</span>
    </div>
  );
}

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title?: ReactNode;
  children?: ReactNode;
}) {
  const icon = { info: 'ℹ', warning: '⚠', danger: '⚠', success: '✓' }[tone];
  return (
    <div className={`alert alert--${tone}`} role={tone === 'danger' ? 'alert' : undefined}>
      <span className="alert__icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        {title && <div className="alert__title">{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function Disclaimer({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  return (
    <p className="disclaimer">
      <span aria-hidden="true">ℹ</span>
      <span>{children ?? `${t('analysis.supportTool')} ${t('analysis.notCalibrated')}`}</span>
    </p>
  );
}

export function Loading({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="state">
      <span className="spinner" aria-hidden="true" />
      <span className="state__hint">{label ?? t('common.loading')}</span>
    </div>
  );
}

export function EmptyState({
  icon = '∅',
  title,
  hint,
  action,
}: {
  icon?: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state">
      <span className="state__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="state__title">{title}</span>
      {hint && <span className="state__hint">{hint}</span>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="state">
      <span className="state__icon" aria-hidden="true">
        ⚠
      </span>
      <span className="state__title">{t('common.error')}</span>
      <span className="state__hint">{message}</span>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const { t, formatNumber } = useI18n();

  if (total === 0) return null;

  return (
    <div className="pagination">
      <span>
        {formatNumber(total)} {t('common.total').toLowerCase()}
      </span>
      <div className="pagination__controls">
        <Button size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          ← {t('common.previous')}
        </Button>
        <span>
          {t('common.page')} {page} {t('common.of')} {totalPages}
        </span>
        <Button size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          {t('common.next')} →
        </Button>
      </div>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <header className="modal__header">
          <h2 className="card__title">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar">
            ✕
          </Button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={tab.id === active}
          className={`tabs__tab${tab.id === active ? ' tabs__tab--active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function DefinitionList({
  items,
}: {
  items: { term: string; value: ReactNode }[];
}) {
  return (
    <div className="definition-list">
      {items.map((item) => (
        <div key={item.term}>
          <div className="definition-list__term">{item.term}</div>
          <div className="definition-list__value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
