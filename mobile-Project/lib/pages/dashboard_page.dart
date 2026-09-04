import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../models/dashboard.dart';
import '../models/enums.dart';
import '../services/api_services.dart';
import '../state/auth_state.dart';
import '../state/i18n_state.dart';
import '../widgets/analysis_result_view.dart';
import '../widgets/app_shell.dart';
import '../widgets/async_builder.dart';
import '../widgets/charts.dart';
import '../widgets/ui.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  final _controller = AsyncController();
  final _dashboardKey = GlobalKey<AsyncBuilderState<Dashboard>>();

  int _days = 180;
  String _granularity = 'month';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.i18n;
    final api = context.read<Api>();

    return AppScaffold(
      title: t.t('dashboard.title'),
      subtitle: t.t('dashboard.subtitle'),
      onRefresh: () async => _dashboardKey.currentState?.refresh(),
      actions: [
        SizedBox(
          width: 200,
          child: AppDropdown<int>(
            value: _days,
            onChanged: (value) => setState(() => _days = value ?? 180),
            items: [
              (value: 30, label: t.t('dashboard.last30')),
              (value: 90, label: t.t('dashboard.last90')),
              (value: 180, label: t.t('dashboard.last180')),
              (value: 365, label: t.t('dashboard.last365')),
            ],
          ),
        ),
      ],
      child: AsyncBuilder<Dashboard>(
        key: _dashboardKey,
        controller: _controller,
        dependencies: [_days],
        load: () => api.dashboard.get(days: _days),
        builder: (context, dashboard) => dashboard.hasStudents
            ? _DashboardBody(
                dashboard: dashboard,
                days: _days,
                granularity: _granularity,
                onGranularityChanged: (value) => setState(() => _granularity = value),
              )
            : AppCard(
                child: EmptyState(
                  icon: Icons.people_outline,
                  title: t.t('dashboard.emptyState'),
                  hint: t.t('dashboard.emptyStateHint'),
                  action: context.read<AuthState>().can.writeStudents
                      ? AppButton(
                          label: t.t('students.new'),
                          variant: ButtonVariant.primary,
                          small: true,
                          onPressed: () => context.go('/students/new'),
                        )
                      : null,
                ),
              ),
      ),
    );
  }
}

class _DashboardBody extends StatelessWidget {
  const _DashboardBody({
    required this.dashboard,
    required this.days,
    required this.granularity,
    required this.onGranularityChanged,
  });

  final Dashboard dashboard;
  final int days;
  final String granularity;
  final ValueChanged<String> onGranularityChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;
    final api = context.read<Api>();

    final classDistribution = dashboard.classificationDistribution;
    final priorityDistribution = dashboard.priorityDistribution;

    return AppStack(
      children: [
        StatGrid(
          children: [
            StatCard(
              label: t.t('dashboard.totalStudents'),
              value: t.formatNumber(dashboard.totalStudents),
              meta: '${t.formatNumber(dashboard.activeStudents)} ${t.t('dashboard.activeStudents')}',
              tone: StatTone.accent,
            ),
            StatCard(
              label: t.t('dashboard.analyzedStudents'),
              value: t.formatNumber(dashboard.analyzedStudents),
              meta: '${t.t('dashboard.coverage')}: '
                  '${t.formatPercent(dashboard.analysisCoverage, 0)}',
            ),
            StatCard(
              label: t.t('dashboard.pending'),
              value: t.formatNumber(dashboard.pendingAnalysis),
              tone: dashboard.pendingAnalysis > 0 ? StatTone.warning : StatTone.success,
            ),
            StatCard(
              label: t.t('dashboard.totalAnalyses'),
              value: t.formatNumber(dashboard.totalAnalyses),
              meta: '${t.formatNumber(dashboard.analysesInPeriod)} ${t.t('dashboard.inPeriod')}',
            ),
            StatCard(
              label: t.t('dashboard.highPriority'),
              value: t.formatNumber(priorityDistribution.countOf(Priority.high.api)),
              tone: StatTone.danger,
            ),
            StatCard(
              label: t.t('dashboard.followUps'),
              value: t.formatNumber(dashboard.followUpsOpen),
              meta: dashboard.followUpsOverdue > 0
                  ? '${t.formatNumber(dashboard.followUpsOverdue)} '
                      '${t.t('dashboard.followUpsOverdue').toLowerCase()}'
                  : t.t('dashboard.followUpsOpen'),
              tone: dashboard.followUpsOverdue > 0 ? StatTone.warning : StatTone.normal,
            ),
          ],
        ),

        AppCard(
          title: t.t('dashboard.classDistribution'),
          hint: t.t('dashboard.classDistributionHint'),
          child: classDistribution.total == 0
              ? EmptyState(title: t.t('dashboard.recentAnalysesEmpty'))
              : DonutChart(
                  caption: t.t('dashboard.analyzedStudents'),
                  slices: [
                    for (final item in classDistribution.items)
                      ChartSlice(
                        label: t.t('classification.${item.value}'),
                        value: item.count.toDouble(),
                        color: Classification.fromApi(item.value) == null
                            ? colors.brand
                            : classificationColor(
                                context,
                                Classification.fromApi(item.value)!,
                              ),
                      ),
                  ],
                ),
        ),

        AppCard(
          title: t.t('dashboard.priorityDistribution'),
          child: priorityDistribution.total == 0
              ? EmptyState(title: t.t('dashboard.recentAnalysesEmpty'))
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    BarList(
                      items: [
                        for (final item in priorityDistribution.items)
                          BarItem(
                            label: t.t('priority.${item.value}'),
                            value: item.count.toDouble(),
                            color: Priority.fromApi(item.value) == null
                                ? colors.brand
                                : priorityColor(context, Priority.fromApi(item.value)!),
                            display: '${t.formatNumber(item.count)} · '
                                '${t.formatPercent(priorityDistribution.total > 0 ? item.count / priorityDistribution.total : 0, 0)}',
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const Disclaimer(),
                  ],
                ),
        ),

        AppCard(
          title: t.t('dashboard.timeline'),
          hint: t.t('dashboard.timelineHint'),
          actions: [
            SizedBox(
              width: 180,
              child: AppDropdown<String>(
                value: granularity,
                onChanged: (value) => onGranularityChanged(value ?? 'month'),
                items: [
                  (value: 'day', label: t.t('dashboard.granularityDay')),
                  (value: 'week', label: t.t('dashboard.granularityWeek')),
                  (value: 'month', label: t.t('dashboard.granularityMonth')),
                ],
              ),
            ),
          ],
          child: AsyncBuilder<Timeline>(
            dependencies: [days, granularity],
            load: () => api.dashboard.timeline(days: days, granularity: granularity),
            builder: (context, timeline) => timeline.series.isEmpty
                ? EmptyState(title: t.t('dashboard.timelineEmpty'))
                : GroupedBarChart(
                    periods: [for (final point in timeline.series) point.period],
                    series: [
                      for (final classification in Classification.values)
                        SeriesConfig(
                          label: t.t('classification.${classification.api}'),
                          color: classificationColor(context, classification),
                          values: [
                            for (final point in timeline.series) point.valueOf(classification),
                          ],
                        ),
                    ],
                  ),
          ),
        ),

        AppCard(
          title: t.t('dashboard.attentionQueue'),
          hint: t.t('dashboard.attentionQueueHint'),
          flush: true,
          child: dashboard.attentionQueue.isEmpty
              ? EmptyState(title: t.t('dashboard.attentionQueueEmpty'))
              : Column(
                  children: [
                    for (final student in dashboard.attentionQueue)
                      ListRowTile(
                        onTap: () => context.push('/students/${student.id}'),
                        title: student.name,
                        subtitle: [
                          student.code,
                          if (student.course != null) student.course!,
                        ].join(' · '),
                        trailing: Text(
                          t.formatDate(student.lastAnalysisAt),
                          style: TextStyle(
                            fontSize: AppSizes.fontSmall,
                            color: colors.textMuted,
                          ),
                        ),
                        footer: AnalysisRow(
                          classification: student.lastClassification,
                          confidence: student.lastConfidence,
                        ),
                      ),
                  ],
                ),
        ),

        AppCard(
          title: t.t('dashboard.recentAnalyses'),
          flush: true,
          child: dashboard.recentAnalyses.isEmpty
              ? EmptyState(title: t.t('dashboard.recentAnalysesEmpty'))
              : Column(
                  children: [
                    for (final analysis in dashboard.recentAnalyses)
                      ListRowTile(
                        onTap: analysis.student == null
                            ? null
                            : () => context.push('/students/${analysis.student!.id}'),
                        title: analysis.student?.name ?? '—',
                        subtitle: t.formatDate(analysis.createdAt, withTime: true),
                        footer: Wrap(
                          spacing: 8,
                          runSpacing: 6,
                          children: [
                            ClassificationBadge(value: analysis.classification),
                            PriorityBadge(value: analysis.priority),
                          ],
                        ),
                      ),
                  ],
                ),
        ),

        if (dashboard.lastModelUsed != null)
          AppCard(
            title: t.t('dashboard.modelInUse'),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  dashboard.lastModelUsed!.algorithm,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: colors.text,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  dashboard.lastModelUsed!.version,
                  style: TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 12,
                    color: colors.textMuted,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${t.t('analysis.date')}: '
                  '${t.formatDate(dashboard.lastModelUsedAt, withTime: true)}',
                  style: TextStyle(fontSize: AppSizes.fontSmall, color: colors.textMuted),
                ),
                const SizedBox(height: 12),
                AppButton(
                  label: '${t.t('dataMining.modelProcess')} →',
                  small: true,
                  onPressed: () => context.go('/data-mining'),
                ),
              ],
            ),
          ),

        Disclaimer(text: dashboard.disclaimer),
      ],
    );
  }
}

class ListRowTile extends StatelessWidget {
  const ListRowTile({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
    this.footer,
    this.onTap,
    this.leading,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;
  final Widget? footer;
  final VoidCallback? onTap;
  final Widget? leading;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: colors.border)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (leading != null) ...[leading!, const SizedBox(width: 10)],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: onTap == null ? colors.text : colors.brand,
                        ),
                      ),
                      if (subtitle != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(
                            subtitle!,
                            style: TextStyle(
                              fontSize: AppSizes.fontSmall,
                              color: colors.textMuted,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                if (trailing != null) ...[const SizedBox(width: 10), trailing!],
              ],
            ),
            if (footer != null) Padding(padding: const EdgeInsets.only(top: 8), child: footer!),
          ],
        ),
      ),
    );
  }
}
