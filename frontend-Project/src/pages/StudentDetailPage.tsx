import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { AnalysisResultView, AnalysisRow } from '../components/AnalysisResultView';
import { PageHeader } from '../components/Layout';
import {
  Alert,
  Button,
  Card,
  ClassificationBadge,
  DefinitionList,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Modal,
  PriorityBadge,
  SelectInput,
  StatusBadge,
  TextInput,
} from '../components/ui';
import { useApiError } from '../hooks/useApiError';
import { useAsync } from '../hooks/useAsync';
import { analysesService, followUpsService, studentsService } from '../services';
import { useAuth } from '../state/AuthContext';
import { useI18n } from '../state/I18nContext';
import { useToast } from '../state/ToastContext';
import type { AnalysisResult, Priority } from '../types/api';

export function StudentDetailPage() {
  const { id = '' } = useParams();
  const { t, formatDate, formatNumber, formatPercent } = useI18n();
  const { can } = useAuth();
  const { describe } = useApiError();
  const toast = useToast();
  const navigate = useNavigate();

  const [analyzing, setAnalyzing] = useState(false);
  const [lastResult, setLastResult] = useState<AnalysisResult | null>(null);
  const [followUpOpen, setFollowUpOpen] = useState(false);

  const student = useAsync((signal) => studentsService.get(id, signal), [id]);

  async function runAnalysis() {
    setAnalyzing(true);
    try {
      const result = await analysesService.runForStudent(id);
      setLastResult(result);
      student.reload();
    } catch (caught) {
      toast.error(describe(caught));
    } finally {
      setAnalyzing(false);
    }
  }

  async function deactivate() {
    if (!student.data) return;
    if (!window.confirm(t('students.confirmDeactivate', { name: student.data.name }))) return;
    try {
      await studentsService.deactivate(id);
      toast.success(t('students.deactivated'));
      navigate('/students');
    } catch (caught) {
      toast.error(describe(caught));
    }
  }

  if (student.loading && !student.data) return <Loading />;
  if (student.error && !student.data) {
    return <ErrorState message={describe(student.error)} onRetry={student.reload} />;
  }
  if (!student.data) return null;

  const data = student.data;
  const status = data.featuresStatus;
  const canAnalyze = can.runAnalyses && status?.complete === true && data.active;

  return (
    <div className="stack">
      <PageHeader
        title={data.name}
        subtitle={`${data.code}${data.course ? ` · ${data.course}` : ''}${
          data.institution ? ` · ${data.institution.name}` : ''
        }`}
        actions={
          <>
            <Link className="btn btn--ghost" to="/students">
              ← {t('common.back')}
            </Link>
            {can.runAnalyses && (
              <Button
                variant="primary"
                loading={analyzing}
                disabled={!canAnalyze}
                onClick={runAnalysis}
                title={canAnalyze ? undefined : t('students.cannotAnalyze')}
              >
                {analyzing ? t('students.analyzing') : t('students.analyzeNow')}
              </Button>
            )}
            {can.writeStudents && (
              <>
                <Link className="btn btn--secondary" to={`/students/${id}/edit`}>
                  {t('common.edit')}
                </Link>
                {data.active && (
                  <Button variant="ghost" onClick={deactivate}>
                    {t('common.deactivate')}
                  </Button>
                )}
              </>
            )}
          </>
        }
      />

      {status && !status.complete && (
        <Alert tone="warning" title={t('students.attributesIncomplete')}>
          {t('students.filledOf', { filled: status.filled, total: status.total })}.{' '}
          {t('students.cannotAnalyze')}
          {can.writeStudents && (
            <>
              {' '}
              <Link to={`/students/${id}/edit`}>{t('common.edit')} →</Link>
            </>
          )}
        </Alert>
      )}

      {lastResult && <AnalysisResultView result={lastResult} />}

      <div className="grid grid--halves">
        <Card title={t('students.basicData')}>
          <DefinitionList
            items={[
              { term: t('students.code'), value: data.code },
              { term: t('students.email'), value: data.email ?? '—' },
              { term: t('students.course'), value: data.course ?? '—' },
              { term: t('students.enrollmentYear'), value: data.enrollmentYear ?? '—' },
              { term: t('students.institution'), value: data.institution?.name ?? '—' },
              {
                term: t('common.actions'),
                value: data.active ? t('common.active') : t('common.inactive'),
              },
              { term: t('students.createdBy'), value: data.createdBy?.name ?? '—' },
              {
                term: t('students.attributes'),
                value: status
                  ? status.complete
                    ? t('students.attributesComplete')
                    : t('students.filledOf', { filled: status.filled, total: status.total })
                  : '—',
              },
            ]}
          />
        </Card>

        <Card title={t('students.lastResult')}>
          {data.lastClassification ? (
            <div className="stack stack--tight">
              <div className="row">
                <ClassificationBadge value={data.lastClassification} />
                <PriorityBadge value={data.lastPriority} />
              </div>
              <DefinitionList
                items={[
                  {
                    term: t('students.confidence'),
                    value:
                      data.lastConfidence === null
                        ? '—'
                        : formatPercent(data.lastConfidence, 1),
                  },
                  { term: t('students.lastAnalysis'), value: formatDate(data.lastAnalysisAt, true) },
                ]}
              />
              <p className="text-sm text-muted">{t('analysis.supportTool')}</p>
            </div>
          ) : (
            <EmptyState
              icon="◈"
              title={t('classification.notAnalyzed')}
              hint={canAnalyze ? undefined : t('students.cannotAnalyze')}
              action={
                canAnalyze ? (
                  <Button size="sm" variant="primary" onClick={runAnalysis} loading={analyzing}>
                    {t('students.analyzeNow')}
                  </Button>
                ) : undefined
              }
            />
          )}
        </Card>
      </div>

      <Card title={t('students.history')} flush>
        {!data.analyses || data.analyses.length === 0 ? (
          <EmptyState icon="◔" title={t('students.historyEmpty')} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('analysis.date')}</th>
                  <th>{t('analysis.classificationLabel')}</th>
                  <th>{t('priority.label')}</th>
                  <th>{t('analysis.cluster')}</th>
                  <th>{t('analysis.model')}</th>
                  <th>{t('analysis.requestedBy')}</th>
                </tr>
              </thead>
              <tbody>
                {data.analyses.map((analysis) => (
                  <tr key={analysis.id}>
                    <td className="table__muted">{formatDate(analysis.createdAt, true)}</td>
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
                      {analysis.clusterId === null ? '—' : `#${analysis.clusterId}`}
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
        )}
      </Card>

      <Card
        title={t('students.followUps')}
        actions={
          can.manageFollowUps && (
            <Button size="sm" onClick={() => setFollowUpOpen(true)}>
              + {t('followUps.new')}
            </Button>
          )
        }
        flush
      >
        {!data.followUps || data.followUps.length === 0 ? (
          <EmptyState icon="✓" title={t('students.followUpsEmpty')} hint={t('followUps.emptyHint')} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('followUps.titleField')}</th>
                  <th>{t('followUps.status')}</th>
                  <th>{t('priority.label')}</th>
                  <th>{t('followUps.assignedTo')}</th>
                  <th>{t('followUps.dueDate')}</th>
                </tr>
              </thead>
              <tbody>
                {data.followUps.map((followUp) => (
                  <tr key={followUp.id}>
                    <td className="table__strong">{followUp.title}</td>
                    <td>
                      <StatusBadge value={followUp.status} />
                    </td>
                    <td>
                      <PriorityBadge value={followUp.priority} />
                    </td>
                    <td className="table__muted">
                      {followUp.assignedTo?.name ?? t('followUps.unassigned')}
                    </td>
                    <td className="table__muted">{formatDate(followUp.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {data.features && (
        <Card title={t('students.attributes')} hint={t('students.attributesHint')}>
          <div className="definition-list">
            {Object.entries(data.features).map(([name, value]) => (
              <div key={name}>
                <div className="definition-list__term mono" style={{ textTransform: 'none' }}>
                  {name}
                </div>
                <div className="definition-list__value">{formatNumber(value)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {followUpOpen && (
        <NewFollowUpModal
          studentId={id}
          analysisId={data.analyses?.[0]?.id}
          onClose={() => setFollowUpOpen(false)}
          onCreated={() => {
            setFollowUpOpen(false);
            toast.success(t('followUps.created'));
            student.reload();
          }}
        />
      )}
    </div>
  );
}

function NewFollowUpModal({
  studentId,
  analysisId,
  onClose,
  onCreated,
}: {
  studentId: string;
  analysisId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const { describe } = useApiError();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (title.trim().length < 3) return;
    setSaving(true);
    try {
      await followUpsService.create({
        studentId,
        analysisId,
        title: title.trim(),
        notes: notes.trim() || undefined,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      });
      onCreated();
    } catch (caught) {
      toast.error(describe(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={t('followUps.new')}
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
        <Field label={t('followUps.titleField')} required>
          <TextInput value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label={t('followUps.notes')}>
          <textarea
            className="textarea"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
        <div className="form-grid">
          <Field label={t('priority.label')}>
            <SelectInput
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
            >
              <option value="HIGH">{t('priority.HIGH')}</option>
              <option value="MEDIUM">{t('priority.MEDIUM')}</option>
              <option value="LOW">{t('priority.LOW')}</option>
            </SelectInput>
          </Field>
          <Field label={t('followUps.dueDate')}>
            <TextInput
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
