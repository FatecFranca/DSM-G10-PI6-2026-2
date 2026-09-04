import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../core/theme.dart';
import '../state/i18n_state.dart';

class ChartSlice {
  const ChartSlice({required this.label, required this.value, required this.color});

  final String label;
  final double value;
  final Color color;
}

class DonutChart extends StatelessWidget {
  const DonutChart({
    super.key,
    required this.slices,
    this.caption,
    this.size = 168,
    this.thickness = 26,
  });

  final List<ChartSlice> slices;
  final String? caption;
  final double size;
  final double thickness;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;
    final total = slices.fold<double>(0, (sum, slice) => sum + slice.value);

    return Column(
      children: [
        SizedBox(
          width: size,
          height: size,
          child: CustomPaint(
            painter: _DonutPainter(
              slices: slices,
              total: total,
              thickness: thickness,
              trackColor: colors.surfaceInset,
            ),
            child: Center(
              child: Text(
                t.formatNumber(total),
                style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: colors.text),
              ),
            ),
          ),
        ),
        if (caption != null) ...[
          const SizedBox(height: 4),
          Text(
            caption!.toUpperCase(),
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.6,
              color: colors.textMuted,
            ),
          ),
        ],
        const SizedBox(height: 12),
        Wrap(
          spacing: 14,
          runSpacing: 6,
          alignment: WrapAlignment.center,
          children: [
            for (final slice in slices)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(color: slice.color, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '${slice.label}: ',
                    style: TextStyle(fontSize: AppSizes.fontSmall, color: colors.textMuted),
                  ),
                  Text(
                    t.formatNumber(slice.value),
                    style: TextStyle(
                      fontSize: AppSizes.fontSmall,
                      fontWeight: FontWeight.w700,
                      color: colors.text,
                    ),
                  ),
                  if (total > 0)
                    Text(
                      ' (${t.formatPercent(slice.value / total, 0)})',
                      style: TextStyle(fontSize: AppSizes.fontSmall, color: colors.textMuted),
                    ),
                ],
              ),
          ],
        ),
      ],
    );
  }
}

class _DonutPainter extends CustomPainter {
  _DonutPainter({
    required this.slices,
    required this.total,
    required this.thickness,
    required this.trackColor,
  });

  final List<ChartSlice> slices;
  final double total;
  final double thickness;
  final Color trackColor;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (math.min(size.width, size.height) - thickness) / 2;
    final rect = Rect.fromCircle(center: center, radius: radius);

    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = thickness
        ..color = trackColor,
    );

    if (total <= 0) return;

    var start = -math.pi / 2;
    for (final slice in slices) {
      if (slice.value <= 0) continue;
      final sweep = (slice.value / total) * 2 * math.pi;
      canvas.drawArc(
        rect,
        start,
        sweep,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = thickness
          ..color = slice.color,
      );
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(_DonutPainter oldDelegate) =>
      oldDelegate.total != total || oldDelegate.slices != slices;
}

class BarItem {
  const BarItem({required this.label, required this.value, this.color, this.display, this.note});

  final String label;
  final double value;
  final Color? color;

  final String? display;

  final String? note;
}

class BarList extends StatelessWidget {
  const BarList({super.key, required this.items, this.max});

  final List<BarItem> items;
  final double? max;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;

    final ceiling = max ??
        items.fold<double>(0, (highest, item) => math.max(highest, item.value));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 11),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        item.label,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 13, color: colors.text),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      item.display ?? t.formatNumber(item.value),
                      style: TextStyle(
                        fontSize: AppSizes.fontSmall,
                        color: colors.textMuted,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 5),
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: LinearProgressIndicator(
                    value: ceiling > 0 ? (item.value / ceiling).clamp(0.0, 1.0) : 0,
                    minHeight: 9,
                    backgroundColor: colors.surfaceInset,
                    valueColor: AlwaysStoppedAnimation(item.color ?? colors.brand),
                  ),
                ),
                if (item.note != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: Text(
                      item.note!,
                      style: TextStyle(fontSize: AppSizes.fontLabel, color: colors.textSubtle),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

class SeriesConfig {
  const SeriesConfig({required this.label, required this.color, required this.values});

  final String label;
  final Color color;
  final List<int> values;
}

class GroupedBarChart extends StatelessWidget {
  const GroupedBarChart({
    super.key,
    required this.periods,
    required this.series,
    this.height = 230,
  });

  final List<String> periods;
  final List<SeriesConfig> series;
  final double height;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;

    final maxValue = series.fold<int>(
      1,
      (highest, config) => config.values.fold<int>(
        highest,
        (inner, value) => math.max(inner, value),
      ),
    );
    final step = math.max(1, (maxValue / 4).ceil());
    final ceiling = (step * 4).toDouble();

    final width = math.max(320.0, periods.length * 70.0);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: SizedBox(
            width: width,
            height: height,
            child: CustomPaint(
              painter: _GroupedBarPainter(
                periods: periods,
                series: series,
                ceiling: ceiling,
                gridColor: colors.border,
                labelColor: colors.textMuted,
                formatValue: (value) => t.formatNumber(value),
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 14,
          runSpacing: 6,
          children: [
            for (final config in series)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(color: config.color, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    config.label,
                    style: TextStyle(fontSize: AppSizes.fontSmall, color: colors.textMuted),
                  ),
                ],
              ),
          ],
        ),
      ],
    );
  }
}

class _GroupedBarPainter extends CustomPainter {
  _GroupedBarPainter({
    required this.periods,
    required this.series,
    required this.ceiling,
    required this.gridColor,
    required this.labelColor,
    required this.formatValue,
  });

  final List<String> periods;
  final List<SeriesConfig> series;
  final double ceiling;
  final Color gridColor;
  final Color labelColor;
  final String Function(num) formatValue;

  static const double _paddingTop = 14;
  static const double _paddingRight = 8;
  static const double _paddingBottom = 34;
  static const double _paddingLeft = 34;

  @override
  void paint(Canvas canvas, Size size) {
    final plotWidth = size.width - _paddingLeft - _paddingRight;
    final plotHeight = size.height - _paddingTop - _paddingBottom;
    if (plotWidth <= 0 || plotHeight <= 0) return;

    final gridPaint = Paint()
      ..color = gridColor
      ..strokeWidth = 1;

    for (var index = 0; index < 5; index++) {
      final value = (ceiling / 4) * index;
      final y = _paddingTop + plotHeight - (value / ceiling) * plotHeight;
      canvas.drawLine(Offset(_paddingLeft, y), Offset(size.width - _paddingRight, y), gridPaint);
      _text(canvas, formatValue(value), Offset(_paddingLeft - 5, y), align: _Align.right);
    }

    final groupWidth = plotWidth / math.max(periods.length, 1);
    final barWidth = math.max(4.0, math.min(26.0, (groupWidth * 0.7) / series.length));

    for (var groupIndex = 0; groupIndex < periods.length; groupIndex++) {
      final groupX = _paddingLeft + groupIndex * groupWidth;
      final startX = groupX + (groupWidth - barWidth * series.length) / 2;

      for (var seriesIndex = 0; seriesIndex < series.length; seriesIndex++) {
        final config = series[seriesIndex];
        final value = seriesIndex < config.values.length && groupIndex < config.values.length
            ? config.values[groupIndex].toDouble()
            : 0.0;
        final barHeight = (value / ceiling) * plotHeight;

        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(
              startX + seriesIndex * barWidth,
              _paddingTop + plotHeight - barHeight,
              math.max(barWidth - 2, 2),
              barHeight,
            ),
            const Radius.circular(2),
          ),
          Paint()..color = config.color,
        );
      }

      _text(
        canvas,
        periods[groupIndex],
        Offset(groupX + groupWidth / 2, size.height - _paddingBottom + 8),
        align: _Align.center,
      );
    }
  }

  void _text(Canvas canvas, String text, Offset anchor, {required _Align align}) {
    final painter = TextPainter(
      text: TextSpan(text: text, style: TextStyle(fontSize: 10, color: labelColor)),
      textDirection: TextDirection.ltr,
    )..layout();

    final dx = switch (align) {
      _Align.right => anchor.dx - painter.width,
      _Align.center => anchor.dx - painter.width / 2,
      _Align.left => anchor.dx,
    };
    final dy = align == _Align.center ? anchor.dy : anchor.dy - painter.height / 2;

    painter.paint(canvas, Offset(dx, dy));
  }

  @override
  bool shouldRepaint(_GroupedBarPainter oldDelegate) =>
      oldDelegate.periods != periods || oldDelegate.ceiling != ceiling;
}

enum _Align { left, center, right }
