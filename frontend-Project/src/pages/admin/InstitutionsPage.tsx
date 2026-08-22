import { useState } from 'react';

import { PageHeader } from '../../components/Layout';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Modal,
  Pagination,
  TextInput,
} from '../../components/ui';
import { useApiError } from '../../hooks/useApiError';
import { useAsync, useDebounced } from '../../hooks/useAsync';
import { institutionsService } from '../../services';
import { useI18n } from '../../state/I18nContext';
import { useToast } from '../../state/ToastContext';
import type { Institution } from '../../types/api';

export function AdminInstitutionsPage() {
  const { t, formatNumber } = useI18n();
  const { describe } = useApiError();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Institution | null>(null);
  const [creating, setCreating] = useState(false);

  const debouncedSearch = useDebounced(search);

  const institutions = useAsync(
    (signal) =>
      institutionsService.list({ page, limit: 20, search: debouncedSearch || undefined }, signal),
    [page, debouncedSearch],
  );

  async function deactivate(target: Institution) {
    if (!window.confirm(t('institutions.confirmDeactivate', { name: target.name }))) return;
    try {
      await institutionsService.deactivate(target.id);
      toast.success(t('institutions.deactivated'));
      institutions.reload();
    } catch (caught) {
      toast.error(describe(caught));
    }
  }

  const rows = institutions.data?.data ?? [];

  return (
    <div className="stack">
      <PageHeader
        title={t('institutions.title')}
        subtitle={t('institutions.subtitle')}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            + {t('institutions.new')}
          </Button>
        }
      />

      <Card flush>
        <div className="toolbar">
          <div className="field toolbar__grow">
            <label className="field__label" htmlFor="institution-search">
              {t('common.search')}
            </label>
            <TextInput
              id="institution-search"
              value={search}
              placeholder={t('institutions.searchPlaceholder')}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {institutions.loading && !institutions.data ? (
          <Loading />
        ) : institutions.error ? (
          <ErrorState message={describe(institutions.error)} onRetry={institutions.reload} />
        ) : rows.length === 0 ? (
          <EmptyState icon="⌂" title={t('common.noData')} hint={t('common.noDataHint')} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('institutions.name')}</th>
                    <th>{t('institutions.city')}</th>
                    <th>{t('institutions.type')}</th>
                    <th className="table__num">{t('institutions.students')}</th>
                    <th className="table__num">{t('institutions.users')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((institution) => (
                    <tr key={institution.id}>
                      <td>
                        <div className="table__strong">{institution.name}</div>
                        {institution.email && (
                          <div className="table__muted">{institution.email}</div>
                        )}
                        {!institution.active && (
                          <span className="badge badge--neutral">{t('common.inactive')}</span>
                        )}
                      </td>
                      <td className="table__muted">
                        {institution.city ?? '—'}
                        {institution.state ? ` / ${institution.state}` : ''}
                      </td>
                      <td className="table__muted">{institution.type ?? '—'}</td>
                      <td className="table__num">{formatNumber(institution.studentCount ?? 0)}</td>
                      <td className="table__num">{formatNumber(institution.userCount ?? 0)}</td>
                      <td>
                        <div className="table__actions">
                          <Button size="sm" onClick={() => setEditing(institution)}>
                            {t('common.edit')}
                          </Button>
                          {institution.active && (
                            <Button size="sm" variant="ghost" onClick={() => deactivate(institution)}>
                              {t('common.deactivate')}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={institutions.data!.pagination.page}
              totalPages={institutions.data!.pagination.totalPages}
              total={institutions.data!.pagination.total}
              onChange={setPage}
            />
          </>
        )}
      </Card>

      {(creating || editing) && (
        <InstitutionFormModal
          institution={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            institutions.reload();
          }}
        />
      )}
    </div>
  );
}

function InstitutionFormModal({
  institution,
  onClose,
  onSaved,
}: {
  institution: Institution | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const { describe, fieldIssues } = useApiError();
  const toast = useToast();

  const isEdit = institution !== null;
  const [form, setForm] = useState({
    name: institution?.name ?? '',
    city: institution?.city ?? '',
    state: institution?.state ?? '',
    type: institution?.type ?? '',
    email: institution?.email ?? '',
    phone: institution?.phone ?? '',
    active: institution?.active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setErrors({});
    setGeneralError(null);
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      type: form.type.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      ...(isEdit ? { active: form.active } : {}),
    };

    try {
      if (isEdit) {
        await institutionsService.update(institution.id, payload);
        toast.success(t('institutions.updated'));
      } else {
        await institutionsService.create(payload);
        toast.success(t('institutions.created'));
      }
      onSaved();
    } catch (caught) {
      setErrors(fieldIssues(caught));
      setGeneralError(describe(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isEdit ? t('institutions.edit') : t('institutions.new')}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" loading={saving} onClick={submit}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="stack stack--tight">
        {generalError && <Alert tone="danger">{generalError}</Alert>}

        <Field label={t('institutions.name')} required error={errors.name}>
          <TextInput
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>

        <div className="form-grid">
          <Field label={t('institutions.city')}>
            <TextInput
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
            />
          </Field>
          <Field label={t('institutions.state')}>
            <TextInput
              value={form.state}
              onChange={(event) => setForm({ ...form, state: event.target.value })}
            />
          </Field>
        </div>

        <Field label={t('institutions.type')} hint="Ex.: pública, privada, ONG, entidade social">
          <TextInput
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value })}
          />
        </Field>

        <div className="form-grid">
          <Field label={t('institutions.email')} error={errors.email}>
            <TextInput
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </Field>
          <Field label={t('institutions.phone')}>
            <TextInput
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </Field>
        </div>

        {isEdit && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm({ ...form, active: event.target.checked })}
            />
            {t('common.active')}
          </label>
        )}
      </div>
    </Modal>
  );
}
