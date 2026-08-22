import { useMemo } from 'react';

import { useI18n } from '../state/I18nContext';
import type { FeatureSpec, StudentFeatures } from '../types/api';
import { Button, Field, TextInput } from './ui';

const GROUPS: { id: string; titleFallback: string; match: (name: string) => boolean }[] = [
  {
    id: 'academic1',
    titleFallback: '1º semestre',
    match: (name) => name.includes('1st_sem'),
  },
  {
    id: 'academic2',
    titleFallback: '2º semestre',
    match: (name) => name.includes('2nd_sem'),
  },
  {
    id: 'admission',
    titleFallback: 'Ingresso e qualificação',
    match: (name) =>
      [
        'application_mode',
        'application_order',
        'course',
        'daytime_evening_attendance',
        'previous_qualification',
        'previous_qualification_grade',
        'admission_grade',
        'age_at_enrollment',
      ].includes(name),
  },
  {
    id: 'social',
    titleFallback: 'Perfil socioeconômico',
    match: (name) =>
      [
        'marital_status',
        'nationality',
        'international',
        'displaced',
        'educational_special_needs',
        'debtor',
        'tuition_fees_up_to_date',
        'gender',
        'scholarship_holder',
        'mothers_qualification',
        'fathers_qualification',
        'mothers_occupation',
        'fathers_occupation',
      ].includes(name),
  },
  { id: 'macro', titleFallback: 'Contexto econômico', match: () => true },
];

export interface FeaturesFormProps {
  features: FeatureSpec[];
  values: Partial<Record<string, number | ''>>;
  onChange: (name: string, value: number | '') => void;
  onFillWithMeans?: () => void;
  onClear?: () => void;
  disabled?: boolean;
  fieldErrors?: Record<string, string>;
}

export function FeaturesForm({
  features,
  values,
  onChange,
  onFillWithMeans,
  onClear,
  disabled = false,
  fieldErrors = {},
}: FeaturesFormProps) {
  const { t, formatNumber } = useI18n();

  const grouped = useMemo(() => {
    const buckets = GROUPS.map((group) => ({ ...group, items: [] as FeatureSpec[] }));
    for (const feature of features) {
      const bucket = buckets.find((candidate) => candidate.match(feature.name));
      (bucket ?? buckets[buckets.length - 1]).items.push(feature);
    }
    return buckets.filter((bucket) => bucket.items.length > 0);
  }, [features]);

  return (
    <div className="stack">
      {(onFillWithMeans || onClear) && (
        <div className="row">
          {onFillWithMeans && (
            <Button size="sm" onClick={onFillWithMeans} disabled={disabled} type="button">
              {t('students.fillWithMean')}
            </Button>
          )}
          {onClear && (
            <Button size="sm" variant="ghost" onClick={onClear} disabled={disabled} type="button">
              {t('analysis.clearForm')}
            </Button>
          )}
        </div>
      )}

      {grouped.map((group) => (
        <div key={group.id}>
          <h3 className="features-group__title">{group.titleFallback}</h3>
          <div className="features-form">
            {group.items.map((feature) => {
              const rawValue = values[feature.name];
              const filled = rawValue !== '' && rawValue !== undefined;
              const numericValue = filled ? Number(rawValue) : null;
              const outOfRange =
                numericValue !== null &&
                (numericValue < feature.min || numericValue > feature.max);
              const outOfBounds =
                numericValue !== null &&
                (numericValue < feature.hardMin || numericValue > feature.hardMax);
              const boundsError = outOfBounds
                ? t('students.valueOutOfBounds', {
                    min: formatNumber(feature.hardMin),
                    max: formatNumber(feature.hardMax),
                  })
                : undefined;
              const error = fieldErrors[`features.${feature.name}`] ?? boundsError;

              return (
                <Field
                  key={feature.name}
                  label={feature.label}
                  htmlFor={`feature-${feature.name}`}
                  error={error}
                  hint={
                    feature.kind === 'binary'
                      ? '0 ou 1'
                      : `${formatNumber(feature.min)} – ${formatNumber(feature.max)}`
                  }
                >
                  <TextInput
                    id={`feature-${feature.name}`}
                    type="number"
                    inputMode={feature.dtype === 'int' ? 'numeric' : 'decimal'}
                    step={feature.dtype === 'int' ? 1 : 'any'}
                    min={feature.hardMin}
                    max={feature.hardMax}
                    value={rawValue ?? ''}
                    disabled={disabled}
                    invalid={Boolean(error)}
                    className={outOfRange && !outOfBounds ? 'input--out-of-range' : ''}
                    title={outOfRange && !outOfBounds ? t('students.outOfRangeHint') : undefined}
                    onChange={(event) => {
                      const raw = event.target.value;
                      onChange(feature.name, raw === '' ? '' : Number(raw));
                    }}
                  />
                </Field>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function hasOutOfBoundsValues(
  features: FeatureSpec[],
  values: Partial<Record<string, number | ''>>,
): boolean {
  return features.some((feature) => {
    const raw = values[feature.name];
    if (raw === '' || raw === undefined || raw === null) return false;
    const value = Number(raw);
    return Number.isFinite(value) && (value < feature.hardMin || value > feature.hardMax);
  });
}

export function toFeaturePayload(
  values: Partial<Record<string, number | ''>>,
): StudentFeatures {
  const payload: StudentFeatures = {};
  for (const [name, value] of Object.entries(values)) {
    if (value === '' || value === undefined || value === null) continue;
    if (Number.isFinite(Number(value))) payload[name] = Number(value);
  }
  return payload;
}

export function initialFeatureValues(
  features: FeatureSpec[],
  saved?: StudentFeatures | null,
): Record<string, number | ''> {
  const values: Record<string, number | ''> = {};
  for (const feature of features) {
    const current = saved?.[feature.name];
    values[feature.name] = current === undefined || current === null ? '' : current;
  }
  return values;
}

export function fillWithMeans(
  features: FeatureSpec[],
  values: Record<string, number | ''>,
): Record<string, number | ''> {
  const filled = { ...values };
  for (const feature of features) {
    if (filled[feature.name] === '' || filled[feature.name] === undefined) {
      filled[feature.name] = feature.dtype === 'int' ? Math.round(feature.mean) : Number(feature.mean.toFixed(2));
    }
  }
  return filled;
}
