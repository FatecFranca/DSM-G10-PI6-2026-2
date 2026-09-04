import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show TextInputFormatter;

import '../core/theme.dart';
import '../models/enums.dart';
import '../state/i18n_state.dart';

Color classificationColor(BuildContext context, Classification value) => switch (value) {
  Classification.dropout => context.colors.dropout,
  Classification.enrolled => context.colors.enrolled,
  Classification.graduate => context.colors.graduate,
};

Color priorityColor(BuildContext context, Priority value) => switch (value) {
  Priority.high => context.colors.danger,
  Priority.medium => context.colors.warning,
  Priority.low => context.colors.success,
};

class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    this.title,
    this.hint,
    this.actions,
    this.flush = false,
    required this.child,
  });

  final String? title;
  final String? hint;
  final List<Widget>? actions;

  final bool flush;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final hasHeader = title != null || (actions?.isNotEmpty ?? false);

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border.all(color: colors.border),
        borderRadius: BorderRadius.circular(AppSizes.radius),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (hasHeader)
            Container(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
              decoration: BoxDecoration(
                border: Border(bottom: BorderSide(color: colors.border)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (title != null)
                    Text(
                      title!,
                      style: TextStyle(
                        fontSize: AppSizes.fontCardTitle,
                        fontWeight: FontWeight.w600,
                        color: colors.text,
                      ),
                    ),
                  if (hint != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        hint!,
                        style: TextStyle(fontSize: AppSizes.fontHint, color: colors.textMuted),
                      ),
                    ),
                  if (actions?.isNotEmpty ?? false)
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Wrap(spacing: 8, runSpacing: 8, children: actions!),
                    ),
                ],
              ),
            ),
          Padding(
            padding: flush ? EdgeInsets.zero : const EdgeInsets.all(AppSizes.cardPadding),
            child: child,
          ),
        ],
      ),
    );
  }
}

enum StatTone { normal, accent, danger, warning, success }

class StatCard extends StatelessWidget {
  const StatCard({
    super.key,
    required this.label,
    required this.value,
    this.meta,
    this.tone = StatTone.normal,
  });

  final String label;
  final String value;
  final String? meta;
  final StatTone tone;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final accent = switch (tone) {
      StatTone.normal => null,
      StatTone.accent => colors.brand,
      StatTone.danger => colors.danger,
      StatTone.warning => colors.warning,
      StatTone.success => colors.success,
    };

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppSizes.radius),
        border: Border.all(color: colors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          if (accent != null)
            Positioned(left: 0, top: 0, bottom: 0, width: 3, child: ColoredBox(color: accent)),
          Padding(
            padding: EdgeInsets.fromLTRB(accent == null ? 14 : 17, 12, 14, 12),
            child: _content(colors),
          ),
        ],
      ),
    );
  }

  Widget _content(AppColors colors) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label.toUpperCase(),
          maxLines: StatGrid.labelLines,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: AppSizes.fontLabel,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
            height: StatGrid.labelLineHeight,
            color: colors.textMuted,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          value,
          maxLines: StatGrid.valueLines,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: AppSizes.fontStatValue,
            fontWeight: FontWeight.w700,
            height: StatGrid.valueLineHeight,
            color: colors.text,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
        if (meta != null)
          Padding(
            padding: const EdgeInsets.only(top: 3),
            child: Text(
              meta!,
              maxLines: StatGrid.metaLines,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: AppSizes.fontHint,
                height: StatGrid.metaLineHeight,
                color: colors.textMuted,
              ),
            ),
          ),
      ],
    );
  }
}

class StatGrid extends StatelessWidget {
  const StatGrid({super.key, required this.children, this.spacing = 12});

  final List<Widget> children;
  final double spacing;

  static const int labelLines = 2;
  static const int valueLines = 2;
  static const int metaLines = 2;

  static const double labelLineHeight = 1.3;
  static const double valueLineHeight = 1.15;
  static const double metaLineHeight = 1.4;

  static const double _chrome = 12 + 12 + 6 + 3 + 2;

  static double heightFor(BuildContext context) {
    final scaler = MediaQuery.textScalerOf(context);

    double bloco(double fontSize, int linhas, double alturaLinha) =>
        (scaler.scale(fontSize) * alturaLinha).ceilToDouble() * linhas;

    return _chrome +
        bloco(AppSizes.fontLabel, labelLines, labelLineHeight) +
        bloco(AppSizes.fontStatValue, valueLines, valueLineHeight) +
        bloco(AppSizes.fontHint, metaLines, metaLineHeight);
  }

  @override
  Widget build(BuildContext context) {
    final cardHeight = heightFor(context);

    return LayoutBuilder(
      builder: (context, constraints) {
        final available = constraints.maxWidth;
        if (!available.isFinite) {
          return Wrap(spacing: spacing, runSpacing: spacing, children: children);
        }

        final columns = ((available + spacing) / (150 + spacing)).floor().clamp(1, 4);
        final itemWidth = (available - spacing * (columns - 1)) / columns;

        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [
            for (final child in children)
              SizedBox(width: itemWidth, height: cardHeight, child: child),
          ],
        );
      },
    );
  }
}

enum ButtonVariant { primary, secondary, ghost, danger }

class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    this.onPressed,
    this.variant = ButtonVariant.secondary,
    this.small = false,
    this.loading = false,
    this.block = false,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final ButtonVariant variant;
  final bool small;
  final bool loading;
  final bool block;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final disabled = onPressed == null || loading;

    final (Color background, Color foreground, Color border) = switch (variant) {
      ButtonVariant.primary => (colors.brand, Colors.white, Colors.transparent),
      ButtonVariant.secondary => (colors.surface, colors.text, colors.borderStrong),
      ButtonVariant.ghost => (Colors.transparent, colors.textMuted, Colors.transparent),
      ButtonVariant.danger => (colors.danger, Colors.white, Colors.transparent),
    };

    final child = Row(
      mainAxisSize: block ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (loading) ...[
          SizedBox(
            width: 13,
            height: 13,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: variant == ButtonVariant.primary || variant == ButtonVariant.danger
                  ? Colors.white
                  : colors.brand,
            ),
          ),
          const SizedBox(width: 7),
        ] else if (icon != null) ...[
          Icon(icon, size: small ? 15 : 17, color: foreground),
          const SizedBox(width: 7),
        ],
        Flexible(
          child: Text(
            label,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: small ? AppSizes.fontSmall : 13.5,
              fontWeight: FontWeight.w600,
              color: foreground,
            ),
          ),
        ),
      ],
    );

    return Opacity(
      opacity: disabled ? 0.55 : 1,
      child: Material(
        color: background,
        borderRadius: BorderRadius.circular(AppSizes.radiusSm),
        child: InkWell(
          onTap: disabled ? null : onPressed,
          borderRadius: BorderRadius.circular(AppSizes.radiusSm),
          child: Container(
            width: block ? double.infinity : null,
            padding: small
                ? const EdgeInsets.symmetric(horizontal: 10, vertical: 7)
                : const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            decoration: BoxDecoration(
              border: Border.all(color: border),
              borderRadius: BorderRadius.circular(AppSizes.radiusSm),
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}

class AppBadge extends StatelessWidget {
  const AppBadge({super.key, required this.label, this.color, this.neutral = false});

  final String label;
  final Color? color;
  final bool neutral;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final base = color ?? colors.brand;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: neutral ? colors.surfaceInset : colors.soft(base),
        border: Border.all(color: neutral ? colors.border : colors.softBorder(base)),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: AppSizes.fontLabel,
          fontWeight: FontWeight.w700,
          color: neutral ? colors.textMuted : colors.softText(base),
        ),
      ),
    );
  }
}

class ClassificationBadge extends StatelessWidget {
  const ClassificationBadge({super.key, required this.value});

  final Classification? value;

  @override
  Widget build(BuildContext context) {
    final t = context.i18n;
    if (value == null) {
      return AppBadge(label: t.t('classification.notAnalyzed'), neutral: true);
    }
    return AppBadge(
      label: t.t('classification.${value!.api}'),
      color: classificationColor(context, value!),
    );
  }
}

class PriorityBadge extends StatelessWidget {
  const PriorityBadge({super.key, required this.value});

  final Priority? value;

  @override
  Widget build(BuildContext context) {
    if (value == null) return const AppBadge(label: '—', neutral: true);
    return AppBadge(
      label: context.i18n.t('priority.${value!.api}'),
      color: priorityColor(context, value!),
    );
  }
}

class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.value});

  final FollowUpStatus value;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final label = context.i18n.t('followUpStatus.${value.api}');

    return switch (value) {
      FollowUpStatus.open => AppBadge(label: label, color: colors.info),
      FollowUpStatus.inProgress => AppBadge(label: label, color: colors.warning),
      FollowUpStatus.done => AppBadge(label: label, color: colors.success),
      FollowUpStatus.cancelled => AppBadge(label: label, neutral: true),
    };
  }
}

class ConfidenceMeter extends StatelessWidget {
  const ConfidenceMeter({super.key, required this.value, this.classification});

  final double? value;
  final Classification? classification;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;

    if (value == null) {
      return Text(
        '—',
        style: TextStyle(color: colors.textMuted, fontSize: AppSizes.fontSmall),
      );
    }

    final ratio = value!.clamp(0.0, 1.0);
    final color = classification == null
        ? colors.brand
        : classificationColor(context, classification!);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 74,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: ratio,
              minHeight: 6,
              backgroundColor: colors.surfaceInset,
              valueColor: AlwaysStoppedAnimation(color),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          t.formatPercent(ratio, 0),
          style: TextStyle(
            fontSize: AppSizes.fontSmall,
            fontWeight: FontWeight.w600,
            color: colors.textMuted,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }
}

enum AlertTone { info, warning, danger, success }

class AppAlert extends StatelessWidget {
  const AppAlert({
    super.key,
    required this.message,
    this.title,
    this.tone = AlertTone.info,
    this.child,
  });

  final String message;
  final String? title;
  final AlertTone tone;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final (Color color, IconData icon) = switch (tone) {
      AlertTone.info => (colors.info, Icons.info_outline),
      AlertTone.warning => (colors.warning, Icons.warning_amber_outlined),
      AlertTone.danger => (colors.danger, Icons.error_outline),
      AlertTone.success => (colors.success, Icons.check_circle_outline),
    };

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: colors.soft(color),
        border: Border.all(color: colors.softBorder(color)),
        borderRadius: BorderRadius.circular(AppSizes.radiusSm),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 17, color: colors.softText(color)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 2),
                    child: Text(
                      title!,
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: colors.softText(color),
                      ),
                    ),
                  ),
                Text(
                  message,
                  style: TextStyle(fontSize: 13, height: 1.5, color: colors.softText(color)),
                ),
                if (child != null) Padding(padding: const EdgeInsets.only(top: 6), child: child),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class Disclaimer extends StatelessWidget {
  const Disclaimer({super.key, this.text});

  final String? text;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;
    final message = text ?? '${t.t('analysis.supportTool')} ${t.t('analysis.notCalibrated')}';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(12, 9, 12, 9),
      decoration: BoxDecoration(
        color: colors.surfaceInset,
        border: Border(left: BorderSide(color: colors.borderStrong, width: 3)),
        borderRadius: const BorderRadius.only(
          topRight: Radius.circular(AppSizes.radiusSm),
          bottomRight: Radius.circular(AppSizes.radiusSm),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline, size: 14, color: colors.textMuted),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: TextStyle(fontSize: AppSizes.fontHint, height: 1.5, color: colors.textMuted),
            ),
          ),
        ],
      ),
    );
  }
}

class LoadingState extends StatelessWidget {
  const LoadingState({super.key, this.label});

  final String? label;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 44, horizontal: 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(strokeWidth: 2, color: colors.brand),
          ),
          const SizedBox(height: 10),
          Text(
            label ?? context.i18n.t('common.loading'),
            style: TextStyle(fontSize: 13, color: colors.textMuted),
          ),
        ],
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    this.icon = Icons.inbox_outlined,
    required this.title,
    this.hint,
    this.action,
  });

  final IconData icon;
  final String title;
  final String? hint;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Opacity(opacity: 0.5, child: Icon(icon, size: 32, color: colors.textMuted)),
          const SizedBox(height: 8),
          Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: colors.text),
          ),
          if (hint != null) ...[
            const SizedBox(height: 6),
            Text(
              hint!,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: colors.textMuted),
            ),
          ],
          if (action != null) ...[const SizedBox(height: 12), action!],
        ],
      ),
    );
  }
}

class ErrorStateView extends StatelessWidget {
  const ErrorStateView({super.key, required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final t = context.i18n;
    return EmptyState(
      icon: Icons.warning_amber_outlined,
      title: t.t('common.error'),
      hint: message,
      action: onRetry == null
          ? null
          : AppButton(label: t.t('common.retry'), small: true, onPressed: onRetry),
    );
  }
}

class PaginationBar extends StatelessWidget {
  const PaginationBar({
    super.key,
    required this.page,
    required this.totalPages,
    required this.total,
    required this.onChange,
  });

  final int page;
  final int totalPages;
  final int total;
  final ValueChanged<int> onChange;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;

    if (total == 0) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: colors.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              '${t.formatNumber(total)} ${t.t('common.total').toLowerCase()}',
              style: TextStyle(fontSize: 13, color: colors.textMuted),
            ),
          ),
          IconButton(
            onPressed: page <= 1 ? null : () => onChange(page - 1),
            icon: const Icon(Icons.chevron_left),
            tooltip: t.t('common.previous'),
            visualDensity: VisualDensity.compact,
          ),
          Text('$page / $totalPages', style: TextStyle(fontSize: 13, color: colors.textMuted)),
          IconButton(
            onPressed: page >= totalPages ? null : () => onChange(page + 1),
            icon: const Icon(Icons.chevron_right),
            tooltip: t.t('common.next'),
            visualDensity: VisualDensity.compact,
          ),
        ],
      ),
    );
  }
}

class AppTabs extends StatelessWidget {
  const AppTabs({super.key, required this.labels, required this.active, required this.onChange});

  final List<String> labels;
  final int active;
  final ValueChanged<int> onChange;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Container(
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: colors.border)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            for (var index = 0; index < labels.length; index++)
              InkWell(
                onTap: () => onChange(index),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                  decoration: BoxDecoration(
                    border: Border(
                      bottom: BorderSide(
                        color: index == active ? colors.brand : Colors.transparent,
                        width: 2,
                      ),
                    ),
                  ),
                  child: Text(
                    labels[index],
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: index == active ? colors.brand : colors.textMuted,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class DefinitionList extends StatelessWidget {
  const DefinitionList({super.key, required this.items});

  final List<({String term, Widget value})> items;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.term.toUpperCase(),
                  style: TextStyle(
                    fontSize: AppSizes.fontLabel,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.4,
                    color: colors.textMuted,
                  ),
                ),
                const SizedBox(height: 2),
                DefaultTextStyle.merge(
                  style: TextStyle(fontSize: 14, color: colors.text),
                  child: item.value,
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class DefinitionValue extends StatelessWidget {
  const DefinitionValue(this.text, {super.key, this.mono = false, this.color});

  final String text;
  final bool mono;
  final Color? color;

  @override
  Widget build(BuildContext context) => Text(
    text,
    style: TextStyle(fontSize: mono ? 12 : 14, fontFamily: mono ? 'monospace' : null, color: color),
  );
}

class LabeledField extends StatelessWidget {
  const LabeledField({
    super.key,
    required this.label,
    this.required = false,
    this.hint,
    this.error,
    this.info,
    required this.child,
  });

  final String label;
  final bool required;
  final String? hint;
  final String? error;
  final FeatureInfo? info;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Flexible(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: AppSizes.fontSmall,
                  fontWeight: FontWeight.w600,
                  color: colors.text,
                ),
              ),
            ),
            if (required)
              Text(
                ' *',
                style: TextStyle(color: colors.danger, fontSize: AppSizes.fontSmall),
              ),
            if (info != null) FeatureInfoButton(info: info!, title: label),
          ],
        ),
        const SizedBox(height: 5),
        child,
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              error!,
              style: TextStyle(
                fontSize: AppSizes.fontLabel,
                color: colors.danger,
                fontWeight: FontWeight.w500,
              ),
            ),
          )
        else if (hint != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              hint!,
              style: TextStyle(fontSize: AppSizes.fontLabel, color: colors.textSubtle),
            ),
          ),
      ],
    );
  }
}

class FeatureInfoButton extends StatelessWidget {
  const FeatureInfoButton({super.key, required this.info, required this.title});

  final FeatureInfo info;
  final String title;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return IconButton(
      onPressed: () => _show(context),
      icon: Icon(Icons.info_outline, size: 16, color: colors.textSubtle),
      visualDensity: VisualDensity.compact,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
      tooltip: info.text,
    );
  }

  void _show(BuildContext context) {
    final colors = context.colors;
    final t = context.i18nRead;

    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.5,
        maxChildSize: 0.9,
        builder: (_, controller) => ListView(
          controller: controller,
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
          children: [
            Text(
              title,
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: colors.text),
            ),
            const SizedBox(height: 10),
            Text(info.text, style: TextStyle(fontSize: 13.5, height: 1.55, color: colors.text)),
            if (info.options.isNotEmpty) ...[
              const SizedBox(height: 14),
              for (final option in info.options)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 34,
                        child: Text(
                          option.code,
                          style: TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: colors.brand,
                          ),
                        ),
                      ),
                      Expanded(
                        child: Text(
                          option.label,
                          style: TextStyle(fontSize: 13, color: colors.text),
                        ),
                      ),
                    ],
                  ),
                ),
              if (!info.exhaustive)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    t.t('students.featureExamplesNote'),
                    style: TextStyle(
                      fontSize: AppSizes.fontLabel,
                      fontStyle: FontStyle.italic,
                      color: colors.textMuted,
                    ),
                  ),
                ),
            ],
            if (info.note != null)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  info.note!,
                  style: TextStyle(
                    fontSize: AppSizes.fontLabel,
                    fontStyle: FontStyle.italic,
                    color: colors.textMuted,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    this.controller,
    this.hintText,
    this.keyboardType,
    this.obscureText = false,
    this.enabled = true,
    this.invalid = false,
    this.outOfRange = false,
    this.maxLines = 1,
    this.autofocus = false,
    this.suffix,
    this.onChanged,
    this.onSubmitted,
    this.textInputAction,
    this.inputFormatters,
  });

  final TextEditingController? controller;
  final String? hintText;
  final TextInputType? keyboardType;
  final bool obscureText;
  final bool enabled;
  final bool invalid;

  final bool outOfRange;

  final int maxLines;
  final bool autofocus;
  final Widget? suffix;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final TextInputAction? textInputAction;
  final List<TextInputFormatter>? inputFormatters;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return TextField(
      controller: controller,
      enabled: enabled,
      obscureText: obscureText,
      keyboardType: keyboardType,
      inputFormatters: inputFormatters,
      maxLines: obscureText ? 1 : maxLines,
      autofocus: autofocus,
      textInputAction: textInputAction,
      style: TextStyle(fontSize: 14, color: colors.text),
      onChanged: onChanged,
      onSubmitted: onSubmitted,
      decoration: InputDecoration(
        hintText: hintText,
        suffixIcon: suffix,
        fillColor: outOfRange ? colors.soft(colors.warning) : colors.surface,
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSizes.radiusSm),
          borderSide: BorderSide(
            color: invalid
                ? colors.danger
                : outOfRange
                ? colors.warning
                : colors.borderStrong,
          ),
        ),
      ),
    );
  }
}

class AppDropdown<T> extends StatelessWidget {
  const AppDropdown({
    super.key,
    required this.value,
    required this.items,
    required this.onChanged,
    this.enabled = true,
    this.invalid = false,
  });

  final T value;
  final List<({T value, String label})> items;
  final ValueChanged<T?>? onChanged;
  final bool enabled;
  final bool invalid;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    final hasValue = items.any((item) => item.value == value);

    return DropdownButtonFormField<T?>(
      initialValue: hasValue ? value : null,
      isExpanded: true,
      onChanged: enabled ? onChanged : null,
      style: TextStyle(fontSize: 14, color: colors.text),
      dropdownColor: colors.surface,
      icon: Icon(Icons.expand_more, color: colors.textMuted, size: 20),
      decoration: InputDecoration(
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSizes.radiusSm),
          borderSide: BorderSide(color: invalid ? colors.danger : colors.borderStrong),
        ),
      ),
      items: [
        for (final item in items)
          DropdownMenuItem<T?>(
            value: item.value,
            child: Text(item.label, overflow: TextOverflow.ellipsis),
          ),
      ],
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key});

  final String title;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.only(bottom: 6),
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: colors.border)),
      ),
      child: Text(
        title.toUpperCase(),
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.6,
          color: colors.textMuted,
        ),
      ),
    );
  }
}

class AppStack extends StatelessWidget {
  const AppStack({super.key, required this.children, this.gap = AppSizes.gap});

  final List<Widget> children;
  final double gap;

  @override
  Widget build(BuildContext context) {
    final spaced = <Widget>[];
    for (var index = 0; index < children.length; index++) {
      if (index > 0) spaced.add(SizedBox(height: gap));
      spaced.add(children[index]);
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: spaced);
  }
}

void showToast(BuildContext context, String message, {AlertTone tone = AlertTone.info}) {
  final colors = context.colors;
  final color = switch (tone) {
    AlertTone.success => colors.success,
    AlertTone.danger => colors.danger,
    AlertTone.warning => colors.warning,
    AlertTone.info => colors.brand,
  };

  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        duration: Duration(seconds: tone == AlertTone.danger ? 7 : 4),
        backgroundColor: colors.surface,
        content: Container(
          padding: const EdgeInsets.only(left: 11),
          decoration: BoxDecoration(
            border: Border(left: BorderSide(color: color, width: 3)),
          ),
          child: Text(message, style: TextStyle(color: colors.text, fontSize: 13.5)),
        ),
      ),
    );
}

Future<bool> confirmDialog(BuildContext context, {required String message}) async {
  final t = context.i18nRead;
  final result = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      content: Text(message, style: const TextStyle(fontSize: 14)),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: Text(t.t('common.cancel')),
        ),
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(true),
          child: Text(t.t('common.confirm')),
        ),
      ],
    ),
  );
  return result ?? false;
}
