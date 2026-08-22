import { useState } from 'react';
import { Link } from 'react-router-dom';

import { PageHeader } from '../components/Layout';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Pagination,
  PriorityBadge,
  SelectInput,
  StatusBadge,
} from '../components/ui';
import { useApiError } from '../hooks/useApiError';
import { useAsync } from '../hooks/useAsync';
import { followUpsService } from '../services';
import { useAuth } from '../state/AuthContext';
import { useI18n } from '../state/I18nContext';
import { useToast } from '../state/ToastContext';
import type { FollowUpStatus } from '../types/api';

export function FollowUpsPage() {
  const { t, formatDate } = useI18n();
  const { can } = useAuth();
  const { describe } = useApiError();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [mine, setMine] = useState(false);
  const [overdue, setOverdue] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const followUps = useAsync(
    (signal) =>
      followUpsService.list(
        {
          page,
          limit: 20,
          status: status || undefined,
          priority: priority || undefined,
          mine: mine || undefined,
          overdue: overdue || undefined,
        },
        signal,
      ),
    [page, status, priority, mine, overdue],
  );

  async function changeStatus(id: string, next: FollowUpStatus) {
    setUpdating(id);
    try {
      await followUpsService.update(id, { status: next });
      toast.success(t('followUps.updated'));
      followUps.reload();
    } catch (caught) {
      toast.error(describe(caught));
    } finally {
      setUpdating(null);
    }
  }

  const rows = followUps.data?.data ?? [];
  const now = Date.now();

  return (
    <div className="stack">
      <PageHeader title={t('followUps.title')} subtitle={t('followUps.subtitle')} />

      <Card flush>
        <div className="toolbar">
          <Field label={t('followUps.status')}>
            <SelectInput
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('common.all')}</option>
              <option value="OPEN">{t('followUpStatus.OPEN')}</option>
              <option value="IN_PROGRESS">{t('followUpStatus.IN_PROGRESS')}</option>
              <option value="DONE">{t('followUpStatus.DONE')}</option>
              <option value="CANCELLED">{t('followUpStatus.CANCELLED')}</option>
            </SelectInput>
          </Field>

          <Field label={t('priority.label')}>
            <SelectInput
              value={priority}
              onChange={(event) => {
                setPriority(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('common.all')}</option>
              <option value="HIGH">{t('priority.HIGH')}</option>
              <option value="MEDIUM">{t('priority.MEDIUM')}</option>
              <option value="LOW">{t('priority.LOW')}</option>
            </SelectInput>
          </Field>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={mine}
              onChange={(event) => {
                setMine(event.target.checked);
                setPage(1);
              }}
            />
            {t('followUps.onlyMine')}
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={overdue}
              onChange={(event) => {
                setOverdue(event.target.checked);
                setPage(1);
              }}
            />
            {t('followUps.onlyOverdue')}
          </label>
        </div>

        {followUps.loading && !followUps.data ? (
          <Loading />
        ) : followUps.error ? (
          <ErrorState message={describe(followUps.error)} onRetry={followUps.reload} />
        ) : rows.length === 0 ? (
          <EmptyState icon="✓" title={t('followUps.empty')} hint={t('followUps.emptyHint')} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('followUps.titleField')}</th>
                    <th>{t('followUps.student')}</th>
                    <th>{t('followUps.status')}</th>
                    <th>{t('priority.label')}</th>
                    <th>{t('followUps.assignedTo')}</th>
                    <th>{t('followUps.dueDate')}</th>
                    {can.manageFollowUps && <th />}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((followUp) => {
                    const isOverdue =
                      followUp.dueDate !== null &&
                      new Date(followUp.dueDate).getTime() < now &&
                      (followUp.status === 'OPEN' || followUp.status === 'IN_PROGRESS');

                    return (
                      <tr key={followUp.id}>
                        <td>
                          <div className="table__strong">{followUp.title}</div>
                          {followUp.notes && (
                            <div className="table__muted truncate" style={{ maxWidth: 280 }}>
                              {followUp.notes}
                            </div>
                          )}
                        </td>
                        <td>
                          {followUp.student ? (
                            <Link to={`/students/${followUp.student.id}`}>
                              {followUp.student.name}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <StatusBadge value={followUp.status} />
                        </td>
                        <td>
                          <PriorityBadge value={followUp.priority} />
                        </td>
                        <td className="table__muted">
                          {followUp.assignedTo?.name ?? t('followUps.unassigned')}
                        </td>
                        <td className={isOverdue ? undefined : 'table__muted'}>
                          {formatDate(followUp.dueDate)}
                          {isOverdue && (
                            <span className="badge badge--high" style={{ marginLeft: 6 }}>
                              {t('followUps.overdue')}
                            </span>
                          )}
                        </td>
                        {can.manageFollowUps && (
                          <td>
                            <div className="table__actions">
                              {followUp.status === 'OPEN' && (
                                <Button
                                  size="sm"
                                  loading={updating === followUp.id}
                                  onClick={() => changeStatus(followUp.id, 'IN_PROGRESS')}
                                >
                                  {t('followUps.markInProgress')}
                                </Button>
                              )}
                              {(followUp.status === 'OPEN' || followUp.status === 'IN_PROGRESS') && (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  loading={updating === followUp.id}
                                  onClick={() => changeStatus(followUp.id, 'DONE')}
                                >
                                  {t('followUps.markDone')}
                                </Button>
                              )}
                              {(followUp.status === 'DONE' || followUp.status === 'CANCELLED') && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  loading={updating === followUp.id}
                                  onClick={() => changeStatus(followUp.id, 'OPEN')}
                                >
                                  {t('followUps.reopen')}
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={followUps.data!.pagination.page}
              totalPages={followUps.data!.pagination.totalPages}
              total={followUps.data!.pagination.total}
              onChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
