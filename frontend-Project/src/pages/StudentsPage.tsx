import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AnalysisRow } from '../components/AnalysisResultView';
import { PageHeader } from '../components/Layout';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Pagination,
  PriorityBadge,
  SelectInput,
  TextInput,
} from '../components/ui';
import { useApiError } from '../hooks/useApiError';
import { useAsync, useDebounced } from '../hooks/useAsync';
import { analysesService, studentsService, type StudentFilters } from '../services';
import { useAuth } from '../state/AuthContext';
import { useI18n } from '../state/I18nContext';
import { useToast } from '../state/ToastContext';

export function StudentsPage() {
  const { t, formatDate } = useI18n();
  const { can } = useAuth();
  const { describe } = useApiError();
  const toast = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [classification, setClassification] = useState('');
  const [priority, setPriority] = useState('');
  const [analyzed, setAnalyzed] = useState('');
  const [sort, setSort] = useState<StudentFilters['sort']>('createdAt');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);

  const debouncedSearch = useDebounced(search);

  const students = useAsync(
    (signal) =>
      studentsService.list(
        {
          page,
          limit: 20,
          search: debouncedSearch || undefined,
          classification: classification || undefined,
          priority: priority || undefined,
          analyzed: analyzed === '' ? undefined : analyzed === 'true',
          sort,
        },
        signal,
      ),
    [page, debouncedSearch, classification, priority, analyzed, sort],
  );

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const ids = students.data?.data.map((student) => student.id) ?? [];
    setSelected((current) =>
      ids.every((id) => current.has(id)) ? new Set() : new Set(ids),
    );
  }

  async function analyzeSelected() {
    if (selected.size === 0) return;
    setAnalyzing(true);
    try {
      const result = await analysesService.runBatch([...selected]);
      toast.success(
        t('students.analyzeBatchDone', {
          analyzed: result.analyzed,
          skipped: result.skipped.length,
        }),
      );
      if (result.skipped.length > 0) {
        toast.notify(t('students.cannotAnalyze'), 'info');
      }
      setSelected(new Set());
      students.reload();
    } catch (caught) {
      toast.error(describe(caught));
    } finally {
      setAnalyzing(false);
    }
  }

  const rows = students.data?.data ?? [];
  const allSelected = rows.length > 0 && rows.every((student) => selected.has(student.id));

  return (
    <div className="stack">
      <PageHeader
        title={t('students.title')}
        subtitle={t('students.subtitle')}
        actions={
          <>
            {can.runAnalyses && selected.size > 0 && (
              <Button variant="primary" loading={analyzing} onClick={analyzeSelected}>
                {t('students.analyzeSelected', { count: selected.size })}
              </Button>
            )}
            {can.writeStudents && (
              <Button variant={selected.size > 0 ? 'secondary' : 'primary'} onClick={() => navigate('/students/new')}>
                + {t('students.new')}
              </Button>
            )}
          </>
        }
      />

      <Card flush>
        <div className="toolbar">
          <div className="field toolbar__grow">
            <label className="field__label" htmlFor="student-search">
              {t('common.search')}
            </label>
            <TextInput
              id="student-search"
              value={search}
              placeholder={t('students.searchPlaceholder')}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <Field label={t('analysis.filterClassification')}>
            <SelectInput
              value={classification}
              onChange={(event) => {
                setClassification(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('common.all')}</option>
              <option value="Dropout">{t('classification.Dropout')}</option>
              <option value="Enrolled">{t('classification.Enrolled')}</option>
              <option value="Graduate">{t('classification.Graduate')}</option>
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

          <Field label={t('students.filterAnalyzed')}>
            <SelectInput
              value={analyzed}
              onChange={(event) => {
                setAnalyzed(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('common.all')}</option>
              <option value="true">{t('students.analyzed')}</option>
              <option value="false">{t('students.notAnalyzed')}</option>
            </SelectInput>
          </Field>

          <Field label={t('students.sort')}>
            <SelectInput
              value={sort}
              onChange={(event) => setSort(event.target.value as StudentFilters['sort'])}
            >
              <option value="createdAt">{t('students.sortCreatedAt')}</option>
              <option value="name">{t('students.sortName')}</option>
              <option value="priority">{t('students.sortPriority')}</option>
              <option value="recentAnalysis">{t('students.sortRecentAnalysis')}</option>
            </SelectInput>
          </Field>
        </div>

        {students.loading && !students.data ? (
          <Loading />
        ) : students.error ? (
          <ErrorState message={describe(students.error)} onRetry={students.reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="☰"
            title={t('common.noData')}
            hint={t('common.noDataHint')}
            action={
              can.writeStudents ? (
                <Link className="btn btn--primary btn--sm" to="/students/new">
                  {t('students.new')}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    {can.runAnalyses && (
                      <th style={{ width: 36 }}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleAll}
                          aria-label={t('common.selected', { count: selected.size })}
                        />
                      </th>
                    )}
                    <th>{t('students.name')}</th>
                    <th>{t('students.course')}</th>
                    <th>{t('students.lastResult')}</th>
                    <th>{t('priority.label')}</th>
                    <th>{t('students.lastAnalysis')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((student) => (
                    <tr key={student.id}>
                      {can.runAnalyses && (
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(student.id)}
                            onChange={() => toggle(student.id)}
                            aria-label={student.name}
                          />
                        </td>
                      )}
                      <td>
                        <Link to={`/students/${student.id}`} className="table__strong">
                          {student.name}
                        </Link>
                        <div className="table__muted">
                          {student.code}
                          {!student.active && ` · ${t('common.inactive')}`}
                        </div>
                      </td>
                      <td className="table__muted">
                        {student.course ?? '—'}
                        {student.enrollmentYear ? ` · ${student.enrollmentYear}` : ''}
                      </td>
                      <td>
                        <AnalysisRow
                          classification={student.lastClassification}
                          confidence={student.lastConfidence}
                        />
                      </td>
                      <td>
                        <PriorityBadge value={student.lastPriority} />
                      </td>
                      <td className="table__muted">{formatDate(student.lastAnalysisAt)}</td>
                      <td>
                        <div className="table__actions">
                          <Link className="btn btn--ghost btn--sm" to={`/students/${student.id}`}>
                            {t('common.details')}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={students.data!.pagination.page}
              totalPages={students.data!.pagination.totalPages}
              total={students.data!.pagination.total}
              onChange={setPage}
            />
          </>
        )}
      </Card>

      {can.runAnalyses && rows.length > 0 && (
        <Alert tone="info">{t('analysis.supportTool')}</Alert>
      )}
    </div>
  );
}
