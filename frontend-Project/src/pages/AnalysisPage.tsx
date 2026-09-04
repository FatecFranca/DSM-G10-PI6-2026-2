import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { AnalysisResultView, AnalysisRow } from '../components/AnalysisResultView';
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
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Pagination,
  PriorityBadge,
  SelectInput,
  Tabs,
  TextInput,
} from '../components/ui';
import { useApiError } from '../hooks/useApiError';
import { useAsync } from '../hooks/useAsync';
import { analysesService, studentsService } from '../services';
import { useAuth } from '../state/AuthContext';
import { useI18n } from '../state/I18nContext';
import { useToast } from '../state/ToastContext';
import type { AnalysisResult } from '../types/api';

type TabId = 'simulate' | 'history';

export function AnalysisPage() {
  const { t } = useI18n();
  const { can } = useAuth();
  const [tab, setTab] = useState<TabId>(can.runAnalyses ? 'simulate' : 'history');

  const tabs = [
    ...(can.runAnalyses ? [{ id: 'simulate' as TabId, label: t('analysis.simulate') }] : []),
    { id: 'history' as TabId, label: t('analysis.history') },
  ];

  return (
    <div className="stack">
      <PageHeader title={t('analysis.title')} subtitle={t('analysis.subtitle')} />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'simulate' ? <SimulateTab /> : <HistoryTab />}
    </div>
  );
}

function SimulateTab() {
  const { t } = useI18n();
  const { describe, fieldIssues } = useApiError();
  const toast = useToast();

  const contract = useAsync(() => studentsService.featureContract(), []);

  const [values, setValues] = useState<Record<string, number | ''>>({});
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [running, setRunning] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (contract.data) setValues(initialFeatureValues(contract.data.features, null));
  }, [contract.data]);

  if (contract.loading && !contract.data) return <Loading />;
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
  if (!contract.data) return null;

  const features = toFeaturePayload(values);
  const missing = contract.data.featureCount - Object.keys(features).length;
  const boundsInvalid = hasOutOfBoundsValues(contract.data.features, values);

  async function run() {
    setErrors({});
    setGeneralError(null);
    setRunning(true);
    try {
      setResult(await analysesService.simulate(features));
    } catch (caught) {
      setErrors(fieldIssues(caught));
      setGeneralError(describe(caught));
      toast.error(describe(caught));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="stack">
      <Alert tone="info">{t('analysis.simulateHint')}</Alert>

      {generalError && <Alert tone="danger">{generalError}</Alert>}

      {result ? (
        <AnalysisResultView result={result} />
      ) : (
        <Card>
          <EmptyState icon="◈" title={t('analysis.noResultYet')} />
        </Card>
      )}

      <Card
        title={t('analysis.formTitle')}
        hint={t('students.attributesHint')}
        actions={
          <>
            <span className={`badge ${missing === 0 ? 'badge--low' : 'badge--medium'}`}>
              {t('students.filledOf', {
                filled: contract.data.featureCount - missing,
                total: contract.data.featureCount,
              })}
            </span>
            <Button
              variant="primary"
              loading={running}
              disabled={missing > 0 || boundsInvalid}
              onClick={run}
            >
              {running ? t('analysis.running') : t('analysis.run')}
            </Button>
          </>
        }
      >
        <div className="stack">
          {missing > 0 && <Alert tone="info">{t('students.cannotAnalyze')}</Alert>}

          <FeaturesForm
            features={contract.data.features}
            values={values}
            fieldErrors={errors}
            disabled={running}
            onChange={(name, value) => setValues((current) => ({ ...current, [name]: value }))}
            onFillWithMeans={() =>
              setValues((current) => fillWithMeans(contract.data!.features, current))
            }
            onClear={() => {
              setValues(initialFeatureValues(contract.data!.features, null));
              setResult(null);
            }}
          />
        </div>
      </Card>
    </div>
  );
}

function HistoryTab() {
  const { t, formatDate } = useI18n();
  const { describe } = useApiError();

  const [page, setPage] = useState(1);
  const [classification, setClassification] = useState('');
  const [priority, setPriority] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const analyses = useAsync(
    (signal) =>
      analysesService.list(
        {
          page,
          limit: 20,
          classification: classification || undefined,
          priority: priority || undefined,
          from: from ? new Date(from).toISOString() : undefined,
          to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
        },
        signal,
      ),
    [page, classification, priority, from, to],
  );

  const rows = analyses.data?.data ?? [];

  return (
    <Card flush title={t('analysis.history')} hint={t('analysis.historyHint')}>
      <div className="toolbar">
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

        <Field label={t('analysis.filterPriority')}>
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

        <Field label={t('analysis.filterFrom')}>
          <TextInput
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
        </Field>

        <Field label={t('analysis.filterTo')}>
          <TextInput
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
        </Field>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setClassification('');
            setPriority('');
            setFrom('');
            setTo('');
            setPage(1);
          }}
        >
          {t('common.clearFilters')}
        </Button>
      </div>

      {analyses.loading && !analyses.data ? (
        <Loading />
      ) : analyses.error ? (
        <ErrorState message={describe(analyses.error)} onRetry={analyses.reload} />
      ) : rows.length === 0 ? (
        <EmptyState icon="◔" title={t('common.noData')} hint={t('common.noDataHint')} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('analysis.date')}</th>
                  <th>{t('analysis.student')}</th>
                  <th>{t('analysis.classificationLabel')}</th>
                  <th>{t('priority.label')}</th>
                  <th>{t('analysis.model')}</th>
                  <th>{t('analysis.requestedBy')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((analysis) => (
                  <tr key={analysis.id}>
                    <td className="table__muted">{formatDate(analysis.createdAt, true)}</td>
                    <td>
                      {analysis.student ? (
                        <Link to={`/students/${analysis.student.id}`} className="table__strong">
                          {analysis.student.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                      {analysis.student && (
                        <div className="table__muted">{analysis.student.code}</div>
                      )}
                    </td>
                    <td>
                      <AnalysisRow
                        classification={analysis.classification}
                        confidence={analysis.confidence}
                      />
                    </td>
                    <td>
                      <PriorityBadge value={analysis.priority} />
                    </td>
                    <td className="table__muted">
                      {analysis.algorithm}
                      <div className="mono" style={{ fontSize: 11 }}>
                        {analysis.modelVersion}
                      </div>
                    </td>
                    <td className="table__muted">{analysis.requestedBy?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={analyses.data!.pagination.page}
            totalPages={analyses.data!.pagination.totalPages}
            total={analyses.data!.pagination.total}
            onChange={setPage}
          />
        </>
      )}
    </Card>
  );
}
