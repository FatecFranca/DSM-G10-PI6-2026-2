import { useState } from 'react';
import { Link } from 'react-router-dom';

import { AnalysisRow } from '../components/AnalysisResultView';
import { BarList, DonutChart, GroupedBarChart } from '../components/charts';
import { PageHeader } from '../components/Layout';
import {
  Card,
  CLASSIFICATION_COLOR,
  ClassificationBadge,
  Disclaimer,
  EmptyState,
  ErrorState,
  Loading,
  PRIORITY_COLOR,
  PriorityBadge,
  SelectInput,
  Stat,
} from '../components/ui';
import { useApiError } from '../hooks/useApiError';
import { useAsync } from '../hooks/useAsync';
import { dashboardService } from '../services';
import { useAuth } from '../state/AuthContext';
import { useI18n } from '../state/I18nContext';
import type { Classification, Priority } from '../types/api';

export function DashboardPage() {
  const { t, formatNumber, formatPercent, formatDate } = useI18n();
  const { can } = useAuth();
  const { describe } = useApiError();

  const [days, setDays] = useState(180);
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('month');

  const dashboard = useAsync(
    (signal) => dashboardService.get({ days }, signal),
    [days],
  );
  const timeline = useAsync(
    (signal) => dashboardService.timeline({ days, granularity }, signal),
    [days, granularity],
  );

  if (dashboard.loading && !dashboard.data) return <Loading />;
  if (dashboard.error && !dashboard.data) {
    return <ErrorState message={describe(dashboard.error)} onRetry={dashboard.reload} />;
  }
  if (!dashboard.data) return null;

  const { overview, classificationDistribution, priorityDistribution, followUps } = dashboard.data;

  const hasStudents = overview.totalStudents > 0;

  const classSlices = classificationDistribution.items.map((item) => ({
    label: t(`classification.${item.value}`),
    value: item.count,
    color: CLASSIFICATION_COLOR[item.value as Classification] ?? 'var(--brand)',
  }));

  const prioritySlices = priorityDistribution.items.map((item) => ({
    label: t(`priority.${item.value}`),
    value: item.count,
    color: PRIORITY_COLOR[item.value as Priority] ?? 'var(--brand)',
  }));

  return (
    <div className="stack">
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        actions={
          <>
            <SelectInput
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              aria-label={t('dashboard.period')}
              style={{ width: 'auto' }}
            >
              <option value={30}>{t('dashboard.last30')}</option>
              <option value={90}>{t('dashboard.last90')}</option>
              <option value={180}>{t('dashboard.last180')}</option>
              <option value={365}>{t('dashboard.last365')}</option>
            </SelectInput>
          </>
        }
      />

      {!hasStudents ? (
        <Card>
          <EmptyState
            icon="☰"
            title={t('dashboard.emptyState')}
            hint={t('dashboard.emptyStateHint')}
            action={
              can.writeStudents ? (
                <Link className="btn btn--primary btn--sm" to="/students/new">
                  {t('students.new')}
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid--stats">
            <Stat
              label={t('dashboard.totalStudents')}
              value={formatNumber(overview.totalStudents)}
              meta={`${formatNumber(overview.activeStudents)} ${t('dashboard.activeStudents')}`}
              tone="accent"
            />
            <Stat
              label={t('dashboard.analyzedStudents')}
              value={formatNumber(overview.analyzedStudents)}
              meta={`${t('dashboard.coverage')}: ${formatPercent(overview.analysisCoverage, 0)}`}
            />
            <Stat
              label={t('dashboard.pending')}
              value={formatNumber(overview.pendingAnalysis)}
              tone={overview.pendingAnalysis > 0 ? 'warning' : 'success'}
            />
            <Stat
              label={t('dashboard.totalAnalyses')}
              value={formatNumber(overview.totalAnalyses)}
              meta={`${formatNumber(overview.analysesInPeriod)} ${t('dashboard.inPeriod')}`}
            />
            <Stat
              label={t('dashboard.highPriority')}
              value={formatNumber(
                priorityDistribution.items.find((item) => item.value === 'HIGH')?.count ?? 0,
              )}
              tone="danger"
            />
            <Stat
              label={t('dashboard.followUps')}
              value={formatNumber(followUps.open)}
              meta={
                followUps.overdue > 0
                  ? `${formatNumber(followUps.overdue)} ${t('dashboard.followUpsOverdue').toLowerCase()}`
                  : t('dashboard.followUpsOpen')
              }
              tone={followUps.overdue > 0 ? 'warning' : 'default'}
            />
          </div>

          <div className="grid grid--halves">
            <Card
              title={t('dashboard.classDistribution')}
              hint={t('dashboard.classDistributionHint')}
            >
              {classificationDistribution.total === 0 ? (
                <EmptyState title={t('dashboard.recentAnalysesEmpty')} />
              ) : (
                <DonutChart slices={classSlices} caption={t('dashboard.analyzedStudents')} />
              )}
            </Card>

            <Card title={t('dashboard.priorityDistribution')}>
              {priorityDistribution.total === 0 ? (
                <EmptyState title={t('dashboard.recentAnalysesEmpty')} />
              ) : (
                <div className="stack">
                  <BarList
                    items={prioritySlices.map((slice) => ({
                      label: slice.label,
                      value: slice.value,
                      color: slice.color,
                      display: `${formatNumber(slice.value)} · ${formatPercent(
                        priorityDistribution.total > 0 ? slice.value / priorityDistribution.total : 0,
                        0,
                      )}`,
                    }))}
                  />
                  <Disclaimer />
                </div>
              )}
            </Card>
          </div>

          <Card
            title={t('dashboard.timeline')}
            hint={t('dashboard.timelineHint')}
            actions={
              <SelectInput
                value={granularity}
                onChange={(event) =>
                  setGranularity(event.target.value as 'day' | 'week' | 'month')
                }
                aria-label={t('dashboard.granularity')}
                style={{ width: 'auto' }}
              >
                <option value="day">{t('dashboard.granularityDay')}</option>
                <option value="week">{t('dashboard.granularityWeek')}</option>
                <option value="month">{t('dashboard.granularityMonth')}</option>
              </SelectInput>
            }
          >
            {timeline.loading && !timeline.data ? (
              <Loading />
            ) : timeline.data && timeline.data.series.length > 0 ? (
              <GroupedBarChart
                data={timeline.data.series as unknown as Record<string, number | string>[]}
                series={[
                  { key: 'Dropout', label: t('classification.Dropout'), color: CLASSIFICATION_COLOR.Dropout },
                  { key: 'Enrolled', label: t('classification.Enrolled'), color: CLASSIFICATION_COLOR.Enrolled },
                  { key: 'Graduate', label: t('classification.Graduate'), color: CLASSIFICATION_COLOR.Graduate },
                ]}
              />
            ) : (
              <EmptyState title={t('dashboard.timelineEmpty')} />
            )}
          </Card>

          <div className="grid grid--halves">
            <Card
              title={t('dashboard.attentionQueue')}
              hint={t('dashboard.attentionQueueHint')}
              flush
            >
              {dashboard.data.attentionQueue.length === 0 ? (
                <EmptyState title={t('dashboard.attentionQueueEmpty')} />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('students.name')}</th>
                        <th>{t('students.lastResult')}</th>
                        <th>{t('students.lastAnalysis')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.data.attentionQueue.map((student) => (
                        <tr key={student.id}>
                          <td>
                            <Link to={`/students/${student.id}`} className="table__strong">
                              {student.name}
                            </Link>
                            <div className="table__muted">
                              {student.code}
                              {student.course ? ` · ${student.course}` : ''}
                            </div>
                          </td>
                          <td>
                            <AnalysisRow
                              classification={student.lastClassification}
                              confidence={student.lastConfidence}
                            />
                          </td>
                          <td className="table__muted">{formatDate(student.lastAnalysisAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title={t('dashboard.recentAnalyses')} flush>
              {dashboard.data.recentAnalyses.length === 0 ? (
                <EmptyState title={t('dashboard.recentAnalysesEmpty')} />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('analysis.student')}</th>
                        <th>{t('analysis.classificationLabel')}</th>
                        <th>{t('priority.label')}</th>
                        <th>{t('analysis.date')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.data.recentAnalyses.map((analysis) => (
                        <tr key={analysis.id}>
                          <td>
                            {analysis.student ? (
                              <Link to={`/students/${analysis.student.id}`}>
                                {analysis.student.name}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            <ClassificationBadge value={analysis.classification} />
                          </td>
                          <td>
                            <PriorityBadge value={analysis.priority} />
                          </td>
                          <td className="table__muted">{formatDate(analysis.createdAt, true)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {dashboard.data.lastModelUsed && (
            <Card title={t('dashboard.modelInUse')}>
              <div className="row row--between">
                <div>
                  <strong>{dashboard.data.lastModelUsed.algorithm}</strong>{' '}
                  <span className="mono text-muted">{dashboard.data.lastModelUsed.version}</span>
                  <div className="text-sm text-muted">
                    {t('analysis.date')}: {formatDate(dashboard.data.lastModelUsed.at, true)}
                  </div>
                </div>
                <Link className="btn btn--secondary btn--sm" to="/data-mining">
                  {t('dataMining.modelProcess')} →
                </Link>
              </div>
            </Card>
          )}

          <Disclaimer>{dashboard.data.disclaimer}</Disclaimer>
        </>
      )}
    </div>
  );
}
