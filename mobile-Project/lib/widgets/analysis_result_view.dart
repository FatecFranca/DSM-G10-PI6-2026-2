import 'package:flutter/material.dart';

import '../core/theme.dart';
import '../models/analysis.dart';
import '../models/enums.dart';
import '../state/i18n_state.dart';
import 'charts.dart';
import 'ui.dart';

class AnalysisResultView extends StatelessWidget {
  const AnalysisResultView({super.key, required this.result});

  final AnalysisResult result;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;
    final classification = result.classification;
    final recommendation = result.recommendation;

    final probabilities = result.probabilities.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return AppStack(
      children: [
        AppCard(
          title: t.t('analysis.result'),
          child: AppStack(
            children: [
              _HeroBlock(
                label: t.t('analysis.classificationLabel'),
                value: classification == null
                    ? '—'
                    : t.t('classification.${classification.api}'),
                valueColor: classification == null
                    ? colors.text
                    : classificationColor(context, classification),
                note: classification == null
                    ? null
                    : t.t('classification.${classification.api}_hint'),
              ),
              _HeroBlock(
                label: t.t('analysis.confidenceLabel'),
                value: result.confidence == null
                    ? '—'
                    : t.formatPercent(result.confidence!, 1),
                note: t.t('analysis.notCalibrated'),
                extra: ConfidenceMeter(
                  value: result.confidence,
                  classification: classification,
                ),
              ),
              _HeroBlock(
                label: t.t('analysis.statusLabel'),
                value: recommendation.label,
                valueSize: 16,
                note: recommendation.description,
                badge: PriorityBadge(value: recommendation.priority),
              ),
              if (probabilities.isNotEmpty)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _Label(t.t('analysis.probabilities')),
                    const SizedBox(height: 8),
                    BarList(
                      max: 1,
                      items: [
                        for (final entry in probabilities)
                          BarItem(
                            label: t.t('classification.${entry.key}'),
                            value: entry.value,
                            display: t.formatPercent(entry.value, 1),
                            color: Classification.fromApi(entry.key) == null
                                ? colors.brand
                                : classificationColor(
                                    context,
                                    Classification.fromApi(entry.key)!,
                                  ),
                          ),
                      ],
                    ),
                  ],
                ),
              const Disclaimer(),
            ],
          ),
        ),
        if (result.warnings.isNotEmpty)
          AppAlert(
            tone: AlertTone.warning,
            title: t.t('analysis.warningsTitle'),
            message: t.t('students.outOfRangeHint'),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final warning in result.warnings)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      '• ${warning.label ?? warning.feature}: '
                      '${t.formatNumber(warning.value)} '
                      '(${t.formatNumber(warning.rangeMin)} – ${t.formatNumber(warning.rangeMax)})',
                      style: TextStyle(fontSize: 12.5, color: colors.softText(colors.warning)),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

class _HeroBlock extends StatelessWidget {
  const _HeroBlock({
    required this.label,
    required this.value,
    this.valueColor,
    this.valueSize = 25,
    this.note,
    this.badge,
    this.extra,
  });

  final String label;
  final String value;
  final Color? valueColor;
  final double valueSize;
  final String? note;
  final Widget? badge;
  final Widget? extra;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Label(label),
        const SizedBox(height: 6),
        if (badge != null) ...[badge!, const SizedBox(height: 6)],
        Text(
          value,
          style: TextStyle(
            fontSize: valueSize,
            fontWeight: FontWeight.w700,
            height: 1.2,
            color: valueColor ?? colors.text,
          ),
        ),
        if (extra != null) ...[const SizedBox(height: 8), extra!],
        if (note != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              note!,
              style: TextStyle(fontSize: AppSizes.fontSmall, color: colors.textMuted),
            ),
          ),
      ],
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Text(
        text.toUpperCase(),
        style: TextStyle(
          fontSize: AppSizes.fontLabel,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.5,
          color: context.colors.textMuted,
        ),
      );
}

class AnalysisRow extends StatelessWidget {
  const AnalysisRow({super.key, required this.classification, required this.confidence});

  final Classification? classification;
  final double? confidence;

  @override
  Widget build(BuildContext context) => Wrap(
        spacing: 8,
        runSpacing: 6,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          ClassificationBadge(value: classification),
          ConfidenceMeter(value: confidence, classification: classification),
        ],
      );
}
