import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  FeaturesForm,
  fillWithMeans,
  hasOutOfBoundsValues,
  initialFeatureValues,
  toFeaturePayload,
} from '../components/FeaturesForm';
import { PageHeader } from '../components/Layout';
import {
  Alert,
  Button,
  Card,
  ErrorState,
  Field,
  Loading,
  SelectInput,
  TextInput,
} from '../components/ui';
import { useApiError } from '../hooks/useApiError';
import { useAsync } from '../hooks/useAsync';
import { institutionsService, studentsService } from '../services';
import { useAuth } from '../state/AuthContext';
import { useI18n } from '../state/I18nContext';
import { useToast } from '../state/ToastContext';

export function StudentFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);

  const { t } = useI18n();
  const { can, user } = useAuth();
  const { describe, fieldIssues } = useApiError();
  const toast = useToast();
  const navigate = useNavigate();

  const contract = useAsync((signal) => studentsService.featureContract(), []);
  const student = useAsync(
    (signal) => (id ? studentsService.get(id, signal) : Promise.resolve(null)),
    [id],
  );
  const institutions = useAsync(
    (signal) =>
      can.seeAllInstitutions
        ? institutionsService.list({ limit: 100, active: true }, signal)
        : Promise.resolve(null),
    [can.seeAllInstitutions],
  );

  const [form, setForm] = useState({
    code: '',
    name: '',
    email: '',
    course: '',
    enrollmentYear: '',
    institutionId: '',
  });
  const [featureValues, setFeatureValues] = useState<Record<string, number | ''>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (!contract.data) return;
    setFeatureValues(initialFeatureValues(contract.data.features, student.data?.features ?? null));
  }, [contract.data, student.data]);

  useEffect(() => {
    if (!student.data) return;
    setForm({
      code: student.data.code,
      name: student.data.name,
      email: student.data.email ?? '',
      course: student.data.course ?? '',
      enrollmentYear: student.data.enrollmentYear ? String(student.data.enrollmentYear) : '',
      institutionId: student.data.institutionId,
    });
  }, [student.data]);

  const missingCount = useMemo(() => {
    if (!contract.data) return 0;
    return contract.data.features.filter(
      (feature) => featureValues[feature.name] === '' || featureValues[feature.name] === undefined,
    ).length;
  }, [contract.data, featureValues]);

  const boundsInvalid = useMemo(() => {
    if (!contract.data) return false;
    return hasOutOfBoundsValues(contract.data.features, featureValues);
  }, [contract.data, featureValues]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setGeneralError(null);
    setSaving(true);

    const features = toFeaturePayload(featureValues);
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      course: form.course.trim() || undefined,
      enrollmentYear: form.enrollmentYear ? Number(form.enrollmentYear) : undefined,
      ...(can.seeAllInstitutions && form.institutionId
        ? { institutionId: form.institutionId }
        : {}),
      ...(Object.keys(features).length > 0 ? { features } : {}),
    };

    try {
      const saved = isEdit
        ? await studentsService.update(id!, payload)
        : await studentsService.create(payload);

      toast.success(isEdit ? t('students.updated') : t('students.created'));
      if (saved.warnings && saved.warnings.length > 0) {
        toast.notify(t('students.outOfRangeHint'), 'info');
      }
      navigate(`/students/${saved.id}`);
    } catch (caught) {
      setErrors(fieldIssues(caught));
      setGeneralError(describe(caught));
    } finally {
      setSaving(false);
    }
  }

  if (!can.writeStudents) {
    return <Alert tone="danger">{t('errors.INSUFFICIENT_ROLE')}</Alert>;
  }
  if (contract.loading || (isEdit && student.loading)) return <Loading />;
  if (contract.error) {
    return (
      <div className="stack">
        <ErrorState message={describe(contract.error)} onRetry={contract.reload} />
        <Alert tone="warning" title={t('dataMining.unavailable')}>
          {t('dataMining.unavailableHint')}
        </Alert>
      </div>
    );
  }
  if (isEdit && student.error) {
    return <ErrorState message={describe(student.error)} onRetry={student.reload} />;
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <PageHeader
        title={isEdit ? t('students.edit') : t('students.new')}
        subtitle={t('students.subtitle')}
        actions={
          <>
            <Link className="btn btn--ghost" to={isEdit ? `/students/${id}` : '/students'}>
              {t('common.cancel')}
            </Link>
            <Button type="submit" variant="primary" loading={saving} disabled={boundsInvalid}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </>
        }
      />

      {generalError && <Alert tone="danger">{generalError}</Alert>}

      <Card title={t('students.basicData')}>
        <div className="form-grid">
          <Field label={t('students.code')} required error={errors.code}>
            <TextInput
              value={form.code}
              required
              invalid={Boolean(errors.code)}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
            />
          </Field>

          <Field label={t('students.name')} required error={errors.name}>
            <TextInput
              value={form.name}
              required
              minLength={3}
              invalid={Boolean(errors.name)}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>

          <Field label={t('students.email')} error={errors.email}>
            <TextInput
              type="email"
              value={form.email}
              invalid={Boolean(errors.email)}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </Field>

          <Field label={t('students.course')} error={errors.course}>
            <TextInput
              value={form.course}
              onChange={(event) => setForm({ ...form, course: event.target.value })}
            />
          </Field>

          <Field label={t('students.enrollmentYear')} error={errors.enrollmentYear}>
            <TextInput
              type="number"
              min={1900}
              max={2200}
              value={form.enrollmentYear}
              onChange={(event) => setForm({ ...form, enrollmentYear: event.target.value })}
            />
          </Field>

          {can.seeAllInstitutions ? (
            <Field label={t('students.institution')} required error={errors.institutionId}>
              <SelectInput
                value={form.institutionId}
                required
                disabled={isEdit}
                invalid={Boolean(errors.institutionId)}
                onChange={(event) => setForm({ ...form, institutionId: event.target.value })}
              >
                <option value="">{t('common.select')}</option>
                {institutions.data?.data.map((institution) => (
                  <option key={institution.id} value={institution.id}>
                    {institution.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
          ) : (
            <Field label={t('students.institution')}>
              <TextInput value={user?.institution?.name ?? ''} disabled readOnly />
            </Field>
          )}
        </div>
      </Card>

      <Card
        title={t('students.attributes')}
        hint={t('students.attributesHint')}
        actions={
          <span className={`badge ${missingCount === 0 ? 'badge--low' : 'badge--medium'}`}>
            {missingCount === 0
              ? t('students.attributesComplete')
              : t('students.filledOf', {
                  filled: contract.data!.featureCount - missingCount,
                  total: contract.data!.featureCount,
                })}
          </span>
        }
      >
        <div className="stack">
          {missingCount > 0 && (
            <Alert tone="info">{t('students.cannotAnalyze')}</Alert>
          )}

          <FeaturesForm
            features={contract.data!.features}
            values={featureValues}
            fieldErrors={errors}
            onChange={(name, value) =>
              setFeatureValues((current) => ({ ...current, [name]: value }))
            }
            onFillWithMeans={() =>
              setFeatureValues((current) => fillWithMeans(contract.data!.features, current))
            }
            onClear={() =>
              setFeatureValues(initialFeatureValues(contract.data!.features, null))
            }
            disabled={saving}
          />
        </div>
      </Card>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Link className="btn btn--ghost" to={isEdit ? `/students/${id}` : '/students'}>
          {t('common.cancel')}
        </Link>
        <Button type="submit" variant="primary" loading={saving}>
          {saving ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    </form>
  );
}
