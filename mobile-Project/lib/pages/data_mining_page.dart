import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../models/data_mining.dart';
import '../models/enums.dart';
import '../services/api_services.dart';
import '../state/i18n_state.dart';
import '../widgets/app_shell.dart';
import '../widgets/async_builder.dart';
import '../widgets/charts.dart';
import '../widgets/ui.dart';

class DataMiningPage extends StatelessWidget {
  const DataMiningPage({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.i18n;

    return AppScaffold(
      title: t.t('dataMining.title'),
      subtitle: t.t('dataMining.subtitle'),
      child: const AppStack(
        children: [_ModelProcess()],
      ),
    );
  }
}

class _ModelProcess extends StatelessWidget {
  const _ModelProcess();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;
    final api = context.read<Api>();

    return AsyncBuilder<ModelProcessResponse>(
      load: () => api.dataMining.model(),
      loadingBuilder: (_) => const LoadingState(),
      builder: (context, model) {
        final understanding = model.dataUnderstanding;

        return AppStack(
          children: [
            AppAlert(message: t.t('dataMining.modelProcessHint')),

            StatGrid(
              children: [
                StatCard(
                  label: t.t('analysis.algorithm'),
                  value: model.algorithm,
                  tone: StatTone.accent,
                ),
                StatCard(
                  label: t.t('dataMining.testAccuracy'),
                  value: t.formatPercent(model.testAccuracy, 1),
                ),
                StatCard(
                  label: t.t('dataMining.testF1'),
                  value: t.formatNumber(model.testF1Macro, maximumFractionDigits: 4),
                ),
                StatCard(
                  label: t.t('dataMining.recallDropout'),
                  value: t.formatPercent(model.testRecallDropout, 1),
                  meta: t.t('dataMining.recallDropoutHint'),
                  tone: StatTone.accent,
                ),
                StatCard(
                  label: t.t('dataMining.overfitGap'),
                  value: t.formatNumber(model.overfitGap, maximumFractionDigits: 4),
                  meta: '${t.t('dataMining.devAccuracy')}: '
                      '${t.formatPercent(model.devAccuracy, 1)}',
                  tone: model.overfitGap > 0.1 ? StatTone.warning : StatTone.success,
                ),
              ],
            ),

            AppCard(
              title: t.t('dataMining.stepData'),
              child: DefinitionList(
                items: [
                  (
                    term: t.t('dataMining.datasetFile'),
                    value: DefinitionValue('${understanding['file'] ?? '—'}'),
                  ),
                  (
                    term: t.t('dataMining.datasetRows'),
                    value: DefinitionValue(
                      t.formatNumber(Json.intOf(understanding['rows_total'])),
                    ),
                  ),
                  (
                    term: t.t('dataMining.datasetTrain'),
                    value: DefinitionValue(
                      t.formatNumber(Json.intOf(understanding['rows_train'])),
                    ),
                  ),
                  (
                    term: t.t('dataMining.datasetTest'),
                    value: DefinitionValue(
                      t.formatNumber(Json.intOf(understanding['rows_test'])),
                    ),
                  ),
                  (
                    term: t.t('dataMining.datasetHash'),
                    value: DefinitionValue('${understanding['sha256'] ?? '—'}', mono: true),
                  ),
                  (
                    term: t.t('dataMining.trainedAt'),
                    value: DefinitionValue(t.formatDate(model.trainedAt, withTime: true)),
                  ),
                ],
              ),
            ),

            AppCard(
              title: t.t('dataMining.stepPreparation'),
              child: DefinitionList(
                items: [
                  for (final entry in model.preparation.entries)
                    (term: entry.key, value: DefinitionValue('${entry.value}')),
                ],
              ),
            ),

            AppCard(
              title: t.t('dataMining.stepFeatures'),
              hint: model.importanceMethod == null
                  ? null
                  : '${t.t('dataMining.importanceMethod')}: ${model.importanceMethod}',
              child: model.importance.isEmpty
                  ? EmptyState(title: t.t('dataMining.importanceEmpty'))
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          '${t.t('dataMining.featureCount')}: '
                          '${t.formatNumber(model.featureCount)}',
                          style: TextStyle(
                            fontSize: AppSizes.fontSmall,
                            color: colors.textMuted,
                          ),
                        ),
                        const SizedBox(height: 12),
                        BarList(
                          items: [
                            for (final item in model.importance.take(15))
                              BarItem(
                                label: item.feature,
                                value: item.importance,
                                display: t.formatPercent(item.importance, 2),
                              ),
                          ],
                        ),
                      ],
                    ),
            ),

            AppCard(
              title: t.t('dataMining.stepSelection'),
              hint: model.selectionRationale,
              flush: true,
              child: Column(
                children: [
                  for (final candidate in model.candidates)
                    _CandidateTile(
                      candidate: candidate,
                      chosen: candidate.algorithm == model.algorithm,
                    ),
                ],
              ),
            ),

            AppCard(
              title: t.t('dataMining.confusionMatrix'),
              hint: t.t('dataMining.confusionMatrixHint'),
              child: _ConfusionMatrixTable(matrix: model.confusionMatrix),
            ),

            AppCard(
              title: t.t('dataMining.byClass'),
              flush: true,
              child: Column(
                children: [
                  for (final label in model.confusionMatrix.labels)
                    if (model.classificationReport[label] != null)
                      _ClassMetricsTile(
                        label: t.t('classification.$label'),
                        metrics: model.classificationReport[label]!,
                      ),
                ],
              ),
            ),

            AppCard(
              title: t.t('dataMining.environment'),
              child: DefinitionList(
                items: [
                  (
                    term: t.t('analysis.modelVersion'),
                    value: DefinitionValue(model.version, mono: true),
                  ),
                  for (final entry in model.environment.entries)
                    (term: entry.key, value: DefinitionValue(entry.value)),
                ],
              ),
            ),

            Disclaimer(text: model.disclaimer),
          ],
        );
      },
    );
  }
}

class _CandidateTile extends StatelessWidget {
  const _CandidateTile({required this.candidate, required this.chosen});

  final ModelCandidate candidate;
  final bool chosen;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;

    Widget metric(String label, double value) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(fontSize: 10.5, color: colors.textMuted),
            ),
            Text(
              t.formatNumber(value, maximumFractionDigits: 4),
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: colors.text,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
        );

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: chosen ? colors.soft(colors.brand) : null,
        border: Border(bottom: BorderSide(color: colors.border)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  candidate.algorithm,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: chosen ? FontWeight.w700 : FontWeight.w500,
                    color: colors.text,
                  ),
                ),
              ),
              if (chosen) AppBadge(label: t.t('dataMining.chosen')),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: metric(t.t('dataMining.cvAccuracy'), candidate.cvAccuracyMean)),
              Expanded(child: metric(t.t('dataMining.cvF1'), candidate.cvF1MacroMean)),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: metric(t.t('dataMining.recallDropout'), candidate.cvRecallDropoutMean)),
              Expanded(child: metric(t.t('dataMining.selectionScore'), candidate.cvSelectionScore)),
            ],
          ),
          const SizedBox(height: 8),
          metric(t.t('dataMining.overfitGap'), candidate.overfitGap),
        ],
      ),
    );
  }
}

class _ConfusionMatrixTable extends StatelessWidget {
  const _ConfusionMatrixTable({required this.matrix});

  final ConfusionMatrix matrix;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;

    if (matrix.labels.isEmpty) return const SizedBox.shrink();

    Widget cell(String text, {bool header = false, bool diagonal = false}) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 9),
          decoration: BoxDecoration(
            color: header
                ? colors.surfaceAlt
                : diagonal
                    ? colors.soft(colors.success)
                    : null,
            border: Border.all(color: colors.border),
          ),
          child: Text(
            text,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: header ? 10.5 : 12.5,
              fontWeight: header || diagonal ? FontWeight.w600 : FontWeight.w400,
              color: header
                  ? colors.textMuted
                  : diagonal
                      ? colors.softText(colors.success)
                      : colors.textMuted,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        );

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Table(
        defaultColumnWidth: const FixedColumnWidth(96),
        children: [
          TableRow(
            children: [
              cell('${t.t('dataMining.real')} \\ ${t.t('dataMining.predicted')}', header: true),
              for (final label in matrix.labels)
                cell(t.t('classification.$label'), header: true),
            ],
          ),
          for (var row = 0; row < matrix.matrix.length; row++)
            TableRow(
              children: [
                cell(t.t('classification.${matrix.labels[row]}'), header: true),
                for (var column = 0; column < matrix.matrix[row].length; column++)
                  cell(
                    t.formatNumber(matrix.matrix[row][column]),
                    diagonal: row == column,
                  ),
              ],
            ),
        ],
      ),
    );
  }
}

class _ClassMetricsTile extends StatelessWidget {
  const _ClassMetricsTile({required this.label, required this.metrics});

  final String label;
  final ClassMetrics metrics;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;

    Widget metric(String name, String value) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(name, style: TextStyle(fontSize: 10.5, color: colors.textMuted)),
            Text(
              value,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: colors.text,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
        );

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: colors.border)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: colors.text),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: metric(
                  t.t('dataMining.precision'),
                  t.formatNumber(metrics.precision, maximumFractionDigits: 4),
                ),
              ),
              Expanded(
                child: metric(
                  t.t('dataMining.recall'),
                  t.formatNumber(metrics.recall, maximumFractionDigits: 4),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: metric(
                  t.t('dataMining.f1'),
                  t.formatNumber(metrics.f1, maximumFractionDigits: 4),
                ),
              ),
              Expanded(
                child: metric(t.t('dataMining.support'), t.formatNumber(metrics.support)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
