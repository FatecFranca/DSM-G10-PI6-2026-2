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
  SelectInput,
  TextInput,
} from '../../components/ui';
import { useApiError } from '../../hooks/useApiError';
import { useAsync, useDebounced } from '../../hooks/useAsync';
import { institutionsService, usersService } from '../../services';
import { useAuth } from '../../state/AuthContext';
import { useI18n } from '../../state/I18nContext';
import { useToast } from '../../state/ToastContext';
import type { Role, User } from '../../types/api';

export function AdminUsersPage() {
  const { t, formatDate } = useI18n();
  const { user: currentUser } = useAuth();
  const { describe } = useApiError();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<User | null>(null);

  const debouncedSearch = useDebounced(search);

  const users = useAsync(
    (signal) =>
      usersService.list(
        { page, limit: 20, search: debouncedSearch || undefined, role: role || undefined },
        signal,
      ),
    [page, debouncedSearch, role],
  );
  const institutions = useAsync(
    (signal) => institutionsService.list({ limit: 100 }, signal),
    [],
  );

  async function deactivate(target: User) {
    if (!window.confirm(t('users.confirmDeactivate', { name: target.name }))) return;
    try {
      await usersService.deactivate(target.id);
      toast.success(t('users.deactivated'));
      users.reload();
    } catch (caught) {
      toast.error(describe(caught));
    }
  }

  const rows = users.data?.data ?? [];

  return (
    <div className="stack">
      <PageHeader
        title={t('users.title')}
        subtitle={t('users.subtitle')}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            + {t('users.new')}
          </Button>
        }
      />

      <Card flush>
        <div className="toolbar">
          <div className="field toolbar__grow">
            <label className="field__label" htmlFor="user-search">
              {t('common.search')}
            </label>
            <TextInput
              id="user-search"
              value={search}
              placeholder={t('users.searchPlaceholder')}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <Field label={t('users.role')}>
            <SelectInput
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('common.all')}</option>
              <option value="ADMIN">{t('roles.ADMIN')}</option>
              <option value="ANALYST">{t('roles.ANALYST')}</option>
              <option value="VIEWER">{t('roles.VIEWER')}</option>
            </SelectInput>
          </Field>
        </div>

        {users.loading && !users.data ? (
          <Loading />
        ) : users.error ? (
          <ErrorState message={describe(users.error)} onRetry={users.reload} />
        ) : rows.length === 0 ? (
          <EmptyState icon="◑" title={t('common.noData')} hint={t('common.noDataHint')} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('users.name')}</th>
                    <th>{t('users.role')}</th>
                    <th>{t('users.institution')}</th>
                    <th>{t('users.lastLogin')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <div className="table__strong">{entry.name}</div>
                        <div className="table__muted">{entry.email}</div>
                      </td>
                      <td>
                        <span className="badge badge--brand">{t(`roles.${entry.role}`)}</span>
                        {!entry.active && (
                          <span className="badge badge--neutral" style={{ marginLeft: 6 }}>
                            {t('common.inactive')}
                          </span>
                        )}
                      </td>
                      <td className="table__muted">{entry.institution?.name ?? '—'}</td>
                      <td className="table__muted">
                        {entry.lastLoginAt ? formatDate(entry.lastLoginAt, true) : t('common.never')}
                      </td>
                      <td>
                        <div className="table__actions">
                          <Button size="sm" onClick={() => setEditing(entry)}>
                            {t('common.edit')}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setResetting(entry)}>
                            {t('users.resetPassword')}
                          </Button>
                          {entry.active && entry.id !== currentUser?.id && (
                            <Button size="sm" variant="ghost" onClick={() => deactivate(entry)}>
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
              page={users.data!.pagination.page}
              totalPages={users.data!.pagination.totalPages}
              total={users.data!.pagination.total}
              onChange={setPage}
            />
          </>
        )}
      </Card>

      {(creating || editing) && (
        <UserFormModal
          user={editing}
          institutions={institutions.data?.data ?? []}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            users.reload();
          }}
        />
      )}

      {resetting && (
        <ResetPasswordModal
          user={resetting}
          onClose={() => setResetting(null)}
          onSaved={() => setResetting(null)}
        />
      )}
    </div>
  );
}

function UserFormModal({
  user,
  institutions,
  onClose,
  onSaved,
}: {
  user: User | null;
  institutions: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const { describe, fieldIssues } = useApiError();
  const toast = useToast();

  const isEdit = user !== null;
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    role: (user?.role ?? 'VIEWER') as Role,
    institutionId: user?.institutionId ?? '',
    active: user?.active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const institutionRequired = form.role !== 'ADMIN';

  async function submit() {
    setErrors({});
    setGeneralError(null);

    if (institutionRequired && !form.institutionId) {
      setErrors({ institutionId: t('users.institutionRequired') });
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await usersService.update(user.id, {
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          institutionId: form.institutionId || undefined,
          active: form.active,
        });
        toast.success(t('users.updated'));
      } else {
        await usersService.create({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          institutionId: form.institutionId || undefined,
          active: form.active,
        });
        toast.success(t('users.created'));
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
      title={isEdit ? t('users.edit') : t('users.new')}
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

        <Field label={t('users.name')} required error={errors.name}>
          <TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </Field>

        <Field label={t('users.email')} required error={errors.email}>
          <TextInput
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </Field>

        {!isEdit && (
          <Field
            label={t('users.password')}
            required
            error={errors.password}
            hint={t('auth.passwordTooShort')}
          >
            <TextInput
              type="password"
              value={form.password}
              minLength={8}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </Field>
        )}

        <Field label={t('users.role')} required hint={t(`roles.${form.role}_hint`)}>
          <SelectInput
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
          >
            <option value="ADMIN">{t('roles.ADMIN')}</option>
            <option value="ANALYST">{t('roles.ANALYST')}</option>
            <option value="VIEWER">{t('roles.VIEWER')}</option>
          </SelectInput>
        </Field>

        <Field
          label={t('users.institution')}
          required={institutionRequired}
          error={errors.institutionId}
        >
          <SelectInput
            value={form.institutionId}
            onChange={(event) => setForm({ ...form, institutionId: event.target.value })}
          >
            <option value="">{institutionRequired ? t('common.select') : t('common.none')}</option>
            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </SelectInput>
        </Field>

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

function ResetPasswordModal({
  user,
  onClose,
  onSaved,
}: {
  user: User;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const { describe } = useApiError();
  const toast = useToast();

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (password.length < 8) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    if (password !== confirmation) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setSaving(true);
    try {
      await usersService.resetPassword(user.id, password);
      toast.success(t('users.passwordReset'));
      onSaved();
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`${t('users.resetPassword')} — ${user.name}`}
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
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label={t('auth.newPassword')} required>
          <TextInput
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Field label={t('auth.confirmPassword')} required>
          <TextInput
            type="password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
