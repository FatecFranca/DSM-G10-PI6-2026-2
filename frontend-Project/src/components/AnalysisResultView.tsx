import { Link } from 'react-router-dom';

import { useI18n } from '../state/I18nContext';
import type { AnalysisResult, Classification } from '../types/api';
import { BarList } from './charts';
import {
  Alert,
  AttentionBadge,
  Card,
  CLASSIFICATION_COLOR,
  ClassificationBadge,
  ConfidenceMeter,
  DefinitionList,
  Disclaimer,
  PriorityBadge,
} from './ui';

export function AnalysisResultView({
  result,
  showStudentLink = false,
}: {
  result: AnalysisResult;
  showStudentLink?: boolean;
}) {
  const { t, formatNumber, formatPercent, formatDate } = useI18n();

  const { analysis, recommendation, cluster, model } = result;
  const classification = analysis.classification;

  const probabilities = analysis.probabilities
    ? (Object.entries(analysis.probabilities) as [Classification, number][])
        .sort(([, a], [, b]) => b - a)
        .map(([className, value]) => ({
          label: t(`classification.${className}`),
          value,
          color: CLASSIFICATION_COLOR[className],
          display: formatPercent(value, 1),
        }))
    : [];

  return (
    <div className="stack">
      <Card title={t('analysis.result')}>
        <div className="stack">
          <div className="result-hero">
            <div className="result-hero__block">
              <div className="result-hero__label">{t('analysis.classificationLabel')}</div>
              <div className="result-hero__value" style={{ color: CLASSIFICATION_COLOR[classification] }}>
                {t(`classification.${classification}`)}
              </div>
              <p className="result-hero__note">{t(`classification.${classification}_hint`)}</p>
            </div>

            <div className="result-hero__block">
              <div className="result-hero__label">{t('analysis.confidenceLabel')}</div>
              <div className="result-hero__value">
                {analysis.confidence === null ? '—' : formatPercent(analysis.confidence, 1)}
              </div>
              <p className="result-hero__note">{t('analysis.notCalibrated')}</p>
            </div>

            <div className="result-hero__block">
              <div className="result-hero__label">{t('analysis.statusLabel')}</div>
              <div className="row" style={{ marginBottom: 6 }}>
                <PriorityBadge value={recommendation.priority} />
              </div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{recommendation.label}</div>
              <p className="result-hero__note">{recommendation.description}</p>
            </div>
          </div>

          {probabilities.length > 0 && (
            <div>
              <div className="result-hero__label" style={{ marginBottom: 8 }}>
                {t('analysis.probabilities')}
              </div>
              <BarList items={probabilities} max={1} />
            </div>
          )}

          <Disclaimer />
        </div>
      </Card>

      {result.warnings && result.warnings.length > 0 && (
        <Alert tone="warning" title={t('analysis.warningsTitle')}>
          <p>{t('students.outOfRangeHint')}</p>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {result.warnings.map((warning) => (
              <li key={warning.feature}>
                <strong>{warning.label ?? warning.feature}</strong>: {formatNumber(warning.value)}{' '}
                <span className="text-muted">
                  ({formatNumber(warning.trainedRange[0])} – {formatNumber(warning.trainedRange[1])})
                </span>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="grid grid--halves">
        <Card title={t('analysis.cluster')}>
          {cluster ? (
            <div className="stack stack--tight">
              <div className="row">
                <span className="badge badge--brand">
                  {t('analysis.clusterId')} {cluster.clusterId}
                </span>
                <AttentionBadge value={cluster.attentionLevel} />
              </div>

              <DefinitionList
                items={[
                  ...(cluster.profile?.dropoutRatio !== undefined
                    ? [
                        {
                          term: t('analysis.clusterDropoutRate'),
                          value: formatPercent(cluster.profile.dropoutRatio, 1),
                        },
                      ]
                    : []),
                  ...(cluster.profile?.size !== undefined
                    ? [
                        {
                          term: t('dataMining.groupSize'),
                          value: formatNumber(cluster.profile.size),
                        },
                      ]
                    : []),
                  ...(cluster.distance !== undefined
                    ? [
                        {
                          term: t('analysis.clusterDistance'),
                          value: formatNumber(cluster.distance, { maximumFractionDigits: 2 }),
                        },
                      ]
                    : []),
                ]}
              />

              {recommendation.factors.escalatedByCluster && (
                <Alert tone="warning">{t('analysis.escalatedByCluster')}</Alert>
              )}

              <p className="text-sm text-muted">{t('dataMining.profilesHint')}</p>
            </div>
          ) : (
            <p className="text-muted text-sm">{t('analysis.clusterNone')}</p>
          )}
        </Card>

        <Card title={t('analysis.model')}>
          <DefinitionList
            items={[
              { term: t('analysis.algorithm'), value: model.algorithm },
              {
                term: t('analysis.modelVersion'),
                value: <span className="mono">{model.version}</span>,
              },
              ...(result.createdAt
                ? [{ term: t('analysis.date'), value: formatDate(result.createdAt, true) }]
                : []),
              ...(showStudentLink && result.studentId
                ? [
                    {
                      term: t('analysis.student'),
                      value: (
                        <Link to={`/students/${result.studentId}`}>
                          {result.student?.name ?? t('analysis.viewStudent')}
                        </Link>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

export function AnalysisRow({
  classification,
  confidence,
}: {
  classification: Classification | null;
  confidence: number | null;
}) {
  return (
    <div className="row" style={{ gap: 8 }}>
      <ClassificationBadge value={classification} />
      <ConfidenceMeter value={confidence} classification={classification} />
    </div>
  );
}
