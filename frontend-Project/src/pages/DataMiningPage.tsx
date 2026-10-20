import { BarList } from '../components/charts';
import { PageHeader } from '../components/Layout';
import {
  Alert,
  Card,
  DefinitionList,
  EmptyState,
  Loading,
  Stat,
} from '../components/ui';
import { useApiError } from '../hooks/useApiError';
import { useAsync } from '../hooks/useAsync';
import { dataMiningService } from '../services';
import { useI18n } from '../state/I18nContext';

export function DataMiningPage() {
  const { t } = useI18n();

  return (
    <div className="stack">
      <PageHeader title={t('dataMining.title')} subtitle={t('dataMining.subtitle')} />
      <ModelProcess />
    </div>
  );
}

function ModelProcess() {
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
      <div className="grid grid--stats">
        <Stat
          label={t('analysis.algorithm')}
          value={info.algorithm}
          info={t('dataMining.algorithmInfo')}
          tone="accent"
        />
        <Stat
          label={t('dataMining.testAccuracy')}
          value={formatPercent(evaluation.test_accuracy, 1)}
          info={t('dataMining.testAccuracyInfo')}
        />
        <Stat
          label={t('dataMining.balancedAccuracy')}
          value={formatPercent(evaluation.test_balanced_accuracy, 1)}
          meta={t('dataMining.balancedAccuracyHint')}
          info={t('dataMining.balancedAccuracyInfo')}
        />
        <Stat
          label={t('dataMining.testF1')}
          value={formatNumber(evaluation.test_f1_macro, { maximumFractionDigits: 4 })}
          info={t('dataMining.testF1Info')}
        />
        <Stat
          label={t('dataMining.recallDropout')}
          value={formatPercent(evaluation.test_recall_dropout, 1)}
          meta={t('dataMining.recallDropoutHint')}
          info={t('dataMining.recallDropoutInfo')}
          tone="accent"
        />
        <Stat
          label={t('dataMining.testGap')}
          value={formatNumber(evaluation.generalization_gap, { maximumFractionDigits: 4 })}
          meta={`${t('dataMining.devAccuracy')}: ${formatPercent(evaluation.dev_accuracy, 1)}`}
          info={t('dataMining.testGapInfo')}
          tone={evaluation.generalization_gap > 0.1 ? 'warning' : 'success'}
        />
      </div>

      <Card title={t('dataMining.stepData')} collapsible>
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
                Number((process.dataUnderstanding as Record<string, unknown>).rows_development ?? 0),
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

      <Card title={t('dataMining.stepPreparation')} collapsible>
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
        collapsible
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

      <div className="grid grid--halves">
        <Card
          title={t('dataMining.confusionMatrix')}
          hint={t('dataMining.confusionMatrixHint')}
          collapsible
        >
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

        <Card title={t('dataMining.byClass')} flush collapsible>
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

      <Card title={t('dataMining.environment')} collapsible>
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
    </div>
  );
}
