import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import enUS from '../locales/en-US.json';
import esES from '../locales/es-ES.json';
import ptBR from '../locales/pt-BR.json';

export const LOCALES = {
  'pt-BR': { label: 'Português (BR)', short: 'PT', messages: ptBR as unknown as LocaleTree },
  'en-US': { label: 'English (US)', short: 'EN', messages: enUS as unknown as LocaleTree },
  'es-ES': { label: 'Español (ES)', short: 'ES', messages: esES as unknown as LocaleTree },
} as const;

export type LocaleCode = keyof typeof LOCALES;

type LocaleTree = { [key: string]: string | LocaleTree };

export interface FeatureInfoOption {
  code: string;
  label: string;
}

export interface FeatureInfo {
  text: string;
  options?: FeatureInfoOption[];
  exhaustive?: boolean;
  note?: string;
}

const FALLBACK_LOCALE: LocaleCode = 'pt-BR';
const STORAGE_KEY = 'pi6.locale';

const FEATURE_INFO: Record<LocaleCode, Record<string, FeatureInfo>> = {
  'pt-BR': (ptBR as unknown as { featureDescriptions: Record<string, FeatureInfo> }).featureDescriptions,
  'en-US': (enUS as unknown as { featureDescriptions: Record<string, FeatureInfo> }).featureDescriptions,
  'es-ES': (esES as unknown as { featureDescriptions: Record<string, FeatureInfo> }).featureDescriptions,
};

function resolvePath(tree: LocaleTree, path: string): string | undefined {
  const value = path.split('.').reduce<string | LocaleTree | undefined>((node, segment) => {
    if (node === undefined || typeof node === 'string') return undefined;
    return node[segment];
  }, tree);

  return typeof value === 'string' ? value : undefined;
}

function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    values[key] === undefined ? match : String(values[key]),
  );
}

function detectInitialLocale(): LocaleCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in LOCALES) return stored as LocaleCode;
  } catch {
  }

  const preferred = navigator.language;
  if (preferred in LOCALES) return preferred as LocaleCode;

  const base = preferred.split('-')[0];
  const match = (Object.keys(LOCALES) as LocaleCode[]).find((code) => code.startsWith(base));
  return match ?? FALLBACK_LOCALE;
}

interface I18nContextValue {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
  getFeatureInfo: (featureName: string) => FeatureInfo | undefined;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatPercent: (ratio: number, digits?: number) => string;
  formatDate: (value: string | Date | null | undefined, withTime?: boolean) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(detectInitialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
    }
  }, [locale]);

  const t = useCallback(
    (key: string, values?: Record<string, string | number>) => {
      const translated =
        resolvePath(LOCALES[locale].messages, key) ??
        resolvePath(LOCALES[FALLBACK_LOCALE].messages, key);

      if (translated === undefined) {
        if (import.meta.env.DEV) console.warn(`[i18n] chave sem tradução: ${key}`);
        return key;
      }
      return interpolate(translated, values);
    },
    [locale],
  );

  const getFeatureInfo = useCallback(
    (featureName: string) => FEATURE_INFO[locale][featureName] ?? FEATURE_INFO[FALLBACK_LOCALE][featureName],
    [locale],
  );

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(value),
    [locale],
  );

  const formatPercent = useCallback(
    (ratio: number, digits = 1) =>
      new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(ratio),
    [locale],
  );

  const formatDate = useCallback(
    (value: string | Date | null | undefined, withTime = false) => {
      if (!value) return '—';
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return '—';
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'short',
        ...(withTime && { timeStyle: 'short' }),
      }).format(date);
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale: setLocaleState, t, getFeatureInfo, formatNumber, formatPercent, formatDate }),
    [locale, t, getFeatureInfo, formatNumber, formatPercent, formatDate],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n precisa estar dentro de <I18nProvider>.');
  return context;
}
