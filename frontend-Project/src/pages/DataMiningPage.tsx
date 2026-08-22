import { useState } from 'react';

import { BarList, DonutChart } from '../components/charts';
import { PageHeader } from '../components/Layout';
import {
  Alert,
  AttentionBadge,
  Card,
  CLASSIFICATION_COLOR,
  DefinitionList,
  Disclaimer,
  EmptyState,
  ErrorState,
  Loading,
  Stat,
  Tabs,
} from '../components/ui';
import { useApiError } from '../hooks/useApiError';
import { useAsync } from '../hooks/useAsync';
import { dataMiningService } from '../services';
import { useI18n } from '../state/I18nContext';
import type { Classification } from '../types/api';

type TabId = 'profiles' | 'model';

export function DataMiningPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<TabId>('profiles');

  return (
    <div className="stack">
      <PageHeader title={t('dataMining.title')} subtitle={t('dataMining.subtitle')} />
      <Tabs
        tabs={[
          { id: 'profiles', label: t('dataMining.profiles') },
          { id: 'model', label: t('dataMining.modelProcess') },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'profiles' ? <ProfilesTab /> : <ModelTab />}
    </div>
  );
}

function ProfilesTab() {
  const { t, formatNumber, formatPercent } = useI18n();
  const { describe } = useApiError();

  const profiles = useAsync((signal) => dataMiningService.profiles(signal), []);
  const distribution = useAsync(
    (signal) => dataMiningService.clusterDistribution(undefined, signal),
    [],
  );

  if (profiles.loading && !profiles.data) return <Loading />;
  if (profiles.error) {
    return (
      <div className="stack">
        <Alert tone="warning" title={t('dataMining.unavailable')}>
          {describe(profiles.error)}
        </Alert>
        <Card>
          <EmptyState
            icon="◔"
            title={t('dataMining.profilesEmpty')}
            hint={t('dataMining.unavailableHint')}
          />
        </Card>
      </div>
    );
  }
  if (!profiles.data) return null;

  const { clustering, profiles: groups, selectionRationale } = profiles.data;
  const local = distribution.data;

  return (
    <div className="stack">
      <Alert tone="info">{t('dataMining.profilesHint')}</Alert>

      <div className="grid grid--stats">
        <Stat label={t('dataMining.algorithm')} value={clustering.algorithm} tone="accent" />
        <Stat label={t('dataMining.groups')} value={formatNumber(clustering.k)} />
        <Stat
          label={t('dataMining.silhouette')}
          value={formatNumber(clustering.silhouette, { maximumFractionDigits: 4 })}
        />
        <Stat
          label={t('dataMining.localCount')}
          value={formatNumber(local?.totalAnalysesWithCluster ?? 0)}
          meta={t('dataMining.localDistributionHint')}
        />
      </div>

      <Card title={t('dataMining.selectionRationale')}>
        <p className="text-sm">{selectionRationale}</p>
      </Card>

      {local && local.distribution.length > 0 && (
        <Card
          title={t('dataMining.localDistribution')}
          hint={t('dataMining.localDistributionHint')}
        >
          <BarList
            max={local.totalAnalysesWithCluster}
            items={local.distribution.map((item) => ({
              label: `${t('dataMining.group')} ${item.clusterId}`,
              value: item.localCount,
              color:
                item.attentionLevel === 'alta'
                  ? 'var(--danger)'
                  : item.attentionLevel === 'média'
                    ? 'var(--warning)'
                    : 'var(--success)',
              display: `${formatNumber(item.localCount)} · ${formatPercent(item.localRatio, 1)}`,
              title: `${t('dataMining.dropoutRate')}: ${formatPercent(item.dropoutRatio, 1)}`,
            }))}
          />
        </Card>
      )}

      <div className="grid grid--halves">
        {groups.map((profile) => {
          const slices = (
            Object.entries(profile.classDistribution) as [Classification, { count: number; ratio: number }][]
          ).map(([className, value]) => ({
            label: t(`classification.${className}`),
            value: value.count,
            color: CLASSIFICATION_COLOR[className],
          }));

          const localEntry = local?.distribution.find(
            (item) => item.clusterId === profile.clusterId,
          );

          return (
            <Card
              key={profile.clusterId}
              title={`${t('dataMining.group')} ${profile.clusterId}`}
              actions={<AttentionBadge value={profile.attentionLevel} />}
            >
              <div className="stack">
                <DefinitionList
                  items={[
                    { term: t('dataMining.groupSize'), value: formatNumber(profile.size) },
                    { term: t('dataMining.groupShare'), value: formatPercent(profile.ratio, 1) },
                    {
                      term: t('dataMining.dropoutRate'),
                      value: (
                        <strong
                          style={{
                            color:
                              profile.dropoutRatio >= 0.5
                                ? 'var(--danger)'
                                : profile.dropoutRatio >= 0.25
                                  ? 'var(--warning)'
                                  : 'var(--success)',
                          }}
                        >
                          {formatPercent(profile.dropoutRatio, 1)}
                        </strong>
                      ),
                    },
                    ...(localEntry
                      ? [
                          {
                            term: t('dataMining.localCount'),
                            value: formatNumber(localEntry.localCount),
                          },
                        ]
                      : []),
                  ]}
                />

                <div>
                  <div className="result-hero__label" style={{ marginBottom: 6 }}>
                    {t('dataMining.classDistribution')}
                  </div>
                  <DonutChart slices={slices} caption={t('dataMining.groupSize')} size={148} />
                </div>

                <details>
                  <summary className="text-sm text-muted" style={{ cursor: 'pointer' }}>
                    {t('dataMining.featureMeans')}
                  </summary>
                  <div className="definition-list" style={{ marginTop: 10 }}>
                    {Object.entries(profile.featureMeans).map(([name, value]) => (
                      <div key={name}>
                        <div
                          className="definition-list__term mono"
                          style={{ textTransform: 'none' }}
                        >
                          {name}
                        </div>
                        <div className="definition-list__value">
                          {formatNumber(value, { maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            </Card>
          );
        })}
      </div>

      <Disclaimer>{profiles.data.disclaimer}</Disclaimer>
    </div>
  );
}

function ModelTab() {
  const { t, formatNumber, formatPercent, formatDate } = useI18n();
  const { describe } = useApiError();

  const model = useAsync((signal) => dataMiningService.model(signal), []);

  if (model.loading && !model.data) return <Loading />;
  if (model.error) {
    return (
      <div className="stack">
        <Alert tone="warning" title={t('dataMining.unavailable')}>
          {describe(model.error)}
        </Alert>
        <Card>
          <EmptyState icon="◈" title={t('dataMining.unavailableHint')} />
        </Card>
      </div>
    );
  }
  if (!model.data) return null;

  const { model: info, process, environment } = model.data;
  const evaluation = process.evaluation;
  const report = evaluation.classification_report as Record<
    string,
    { precision: number; recall: number; 'f1-score': number; support: number }
  >;
  const matrix = evaluation.confusion_matrix;

  return (
    <div className="stack">
      <Alert tone="info">{t('dataMining.modelProcessHint')}</Alert>

      <div className="grid grid--stats">
        <Stat label={t('analysis.algorithm')} value={info.algorithm} tone="accent" />
        <Stat
          label={t('dataMining.testAccuracy')}
          value={formatPercent(evaluation.test_accuracy, 1)}
        />
        <Stat label={t('dataMining.testF1')} value={formatNumber(evaluation.test_f1_macro, { maximumFractionDigits: 4 })} />
        <Stat
          label={t('dataMining.overfitGap')}
          value={formatNumber(evaluation.overfit_gap, { maximumFractionDigits: 4 })}
          meta={`${t('dataMining.trainAccuracy')}: ${formatPercent(evaluation.train_accuracy, 1)}`}
          tone={evaluation.overfit_gap > 0.1 ? 'warning' : 'success'}
        />
      </div>

      <Card title={t('dataMining.stepData')}>
        <DefinitionList
          items={[
            {
              term: t('dataMining.datasetFile'),
              value: String((process.dataUnderstanding as Record<string, unknown>).file ?? '—'),
            },
            {
              term: t('dataMining.datasetRows'),
              value: formatNumber(
                Number((process.dataUnderstanding as Record<string, unknown>).rows_total ?? 0),
              ),
            },
            {
              term: t('dataMining.datasetTrain'),
              value: formatNumber(
                Number((process.dataUnderstanding as Record<string, unknown>).rows_train ?? 0),
              ),
            },
            {
              term: t('dataMining.datasetTest'),
              value: formatNumber(
                Number((process.dataUnderstanding as Record<string, unknown>).rows_test ?? 0),
              ),
            },
            {
              term: t('dataMining.datasetHash'),
              value: (
                <span className="mono truncate" style={{ display: 'block' }}>
                  {String((process.dataUnderstanding as Record<string, unknown>).sha256 ?? '—')}
                </span>
              ),
            },
            { term: t('dataMining.trainedAt'), value: formatDate(info.trainedAt, true) },
          ]}
        />
      </Card>

      <Card title={t('dataMining.stepPreparation')}>
        <div className="definition-list">
          {Object.entries(process.preparation as Record<string, unknown>).map(([key, value]) => (
            <div key={key}>
              <div className="definition-list__term mono" style={{ textTransform: 'none' }}>
                {key}
              </div>
              <div className="definition-list__value text-sm">
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title={t('dataMining.stepFeatures')}
        hint={
          process.featureSelection.importanceMethod
            ? `${t('dataMining.importanceMethod')}: ${process.featureSelection.importanceMethod}`
            : undefined
        }
      >
        {process.featureSelection.importance && process.featureSelection.importance.length > 0 ? (
          <div className="stack">
            <p className="text-sm text-muted">
              {t('dataMining.featureCount')}: {formatNumber(process.featureSelection.count)}
            </p>
            <BarList
              items={process.featureSelection.importance.slice(0, 15).map((item) => ({
                label: item.feature,
                value: item.importance,
                display: formatPercent(item.importance, 2),
              }))}
            />
          </div>
        ) : (
          <EmptyState title={t('dataMining.importanceEmpty')} />
        )}
      </Card>

      <Card
        title={t('dataMining.stepSelection')}
        hint={
          <span className="card__hint--stretch-last">{process.modelSelection.rationale}</span>
        }
        flush
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('dataMining.candidateAlgorithm')}</th>
                <th className="table__num">{t('dataMining.cvAccuracy')}</th>
                <th className="table__num">{t('dataMining.trainAccuracy')}</th>
                <th className="table__num">{t('dataMining.testAccuracy')}</th>
                <th className="table__num">{t('dataMining.testF1')}</th>
                <th className="table__num">{t('dataMining.overfitGap')}</th>
              </tr>
            </thead>
            <tbody>
              {(process.modelSelection.candidates as unknown as Record<string, number | string>[]).map(
                (candidate) => {
                  const chosen = candidate.algorithm === info.algorithm;
                  return (
                    <tr key={String(candidate.algorithm)}>
                      <td className={chosen ? 'table__strong' : undefined}>
                        {String(candidate.algorithm)}
                        {chosen && (
                          <span className="badge badge--brand" style={{ marginLeft: 8 }}>
                            {t('dataMining.chosen')}
                          </span>
                        )}
                      </td>
                      <td className="table__num">
                        {formatNumber(Number(candidate.cv_accuracy_mean), {
                          maximumFractionDigits: 4,
                        })}
                      </td>
                      <td className="table__num">
                        {formatNumber(Number(candidate.train_accuracy), {
                          maximumFractionDigits: 4,
                        })}
                      </td>
                      <td className="table__num">
                        {formatNumber(Number(candidate.test_accuracy), {
                          maximumFractionDigits: 4,
                        })}
                      </td>
                      <td className="table__num">
                        {formatNumber(Number(candidate.test_f1_macro), {
                          maximumFractionDigits: 4,
                        })}
                      </td>
                      <td className="table__num">
                        {formatNumber(Number(candidate.overfit_gap), { maximumFractionDigits: 4 })}
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid--halves">
        <Card title={t('dataMining.confusionMatrix')} hint={t('dataMining.confusionMatrixHint')}>
          <div style={{ overflowX: 'auto' }}>
            <table className="matrix">
              <thead>
                <tr>
                  <th className="matrix__axis">
                    {t('dataMining.real')} \ {t('dataMining.predicted')}
                  </th>
                  {matrix.labels.map((label) => (
                    <th key={label}>{t(`classification.${label}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.matrix.map((row, rowIndex) => (
                  <tr key={matrix.labels[rowIndex]}>
                    <th>{t(`classification.${matrix.labels[rowIndex]}`)}</th>
                    {row.map((value, columnIndex) => (
                      <td
                        key={columnIndex}
                        className={
                          rowIndex === columnIndex ? 'matrix__diagonal' : 'matrix__off'
                        }
                      >
                        {formatNumber(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title={t('dataMining.byClass')} flush>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('analysis.classificationLabel')}</th>
                  <th className="table__num">{t('dataMining.precision')}</th>
                  <th className="table__num">{t('dataMining.recall')}</th>
                  <th className="table__num">{t('dataMining.f1')}</th>
                  <th className="table__num">{t('dataMining.support')}</th>
                </tr>
              </thead>
              <tbody>
                {matrix.labels.map((label) => {
                  const metrics = report[label];
                  if (!metrics) return null;
                  return (
                    <tr key={label}>
                      <td>{t(`classification.${label}`)}</td>
                      <td className="table__num">
                        {formatNumber(metrics.precision, { maximumFractionDigits: 4 })}
                      </td>
                      <td className="table__num">
                        {formatNumber(metrics.recall, { maximumFractionDigits: 4 })}
                      </td>
                      <td className="table__num">
                        {formatNumber(metrics['f1-score'], { maximumFractionDigits: 4 })}
                      </td>
                      <td className="table__num">{formatNumber(metrics.support)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title={t('dataMining.environment')}>
        <DefinitionList
          items={[
            {
              term: t('analysis.modelVersion'),
              value: <span className="mono">{info.version}</span>,
            },
            ...Object.entries(environment).map(([key, value]) => ({
              term: key,
              value: String(value),
            })),
          ]}
        />
      </Card>

      <Disclaimer>{model.data.disclaimer}</Disclaimer>
    </div>
  );
}
