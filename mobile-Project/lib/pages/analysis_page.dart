import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../models/analysis.dart';
import '../models/common.dart';
import '../models/feature_contract.dart';
import '../services/api_services.dart';
import '../state/api_error_text.dart';
import '../state/auth_state.dart';
import '../state/i18n_state.dart';
import '../widgets/analysis_result_view.dart';
import '../widgets/app_shell.dart';
import '../widgets/async_builder.dart';
import '../widgets/features_form.dart';
import '../widgets/ui.dart';
import 'dashboard_page.dart' show ListRowTile;

class AnalysisPage extends StatefulWidget {
  const AnalysisPage({super.key});

  @override
  State<AnalysisPage> createState() => _AnalysisPageState();
}

class _AnalysisPageState extends State<AnalysisPage> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final t = context.i18n;
    final can = context.watch<AuthState>().can;

    final tabs = [
      if (can.runAnalyses) t.t('analysis.simulate'),
      t.t('analysis.history'),
    ];
    final showSimulate = can.runAnalyses && _tab == 0;

    return AppScaffold(
      title: t.t('analysis.title'),
      subtitle: t.t('analysis.subtitle'),
      child: AppStack(
        children: [
          AppTabs(
            labels: tabs,
            active: _tab.clamp(0, tabs.length - 1),
            onChange: (index) => setState(() => _tab = index),
          ),
          showSimulate ? const _SimulateTab() : const _HistoryTab(),
        ],
      ),
    );
  }
}

class _SimulateTab extends StatefulWidget {
  const _SimulateTab();

  @override
  State<_SimulateTab> createState() => _SimulateTabState();
}

class _SimulateTabState extends State<_SimulateTab> {
  FeatureContract? _contract;
  Map<String, double?> _values = {};
  int _revision = 0;

  AnalysisResult? _result;
  bool _loading = true;
  bool _running = false;
  String? _loadError;
  String? _generalError;
  Map<String, String> _fieldErrors = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });

    try {
      final contract = await context.read<Api>().students.featureContract();
      if (!mounted) return;
      setState(() {
        _contract = contract;
        _values = initialFeatureValues(contract.features, null);
        _revision++;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadError = describeApiError(context.i18nRead, error);
        _loading = false;
      });
    }
  }

  Future<void> _run() async {
    final t = context.i18nRead;
    final api = context.read<Api>();

    setState(() {
      _running = true;
      _generalError = null;
      _fieldErrors = {};
    });

    try {
      final result = await api.analyses.simulate(toFeaturePayload(_values));
      if (mounted) setState(() => _result = result);
    } catch (error) {
      if (!mounted) return;
      final message = describeApiError(t, error);
      setState(() {
        _fieldErrors = apiFieldIssues(error);
        _generalError = message;
      });
      showToast(context, message, tone: AlertTone.danger);
    } finally {
      if (mounted) setState(() => _running = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.i18n;

    if (_loading) return const LoadingState();

    if (_loadError != null || _contract == null) {
      return AppStack(
        children: [
          ErrorStateView(message: _loadError ?? t.t('errors.generic'), onRetry: _load),
          AppAlert(
            tone: AlertTone.warning,
            title: t.t('dataMining.unavailable'),
            message: t.t('dataMining.unavailableHint'),
          ),
        ],
      );
    }

    final contract = _contract!;
    final missing = contract.featureCount - toFeaturePayload(_values).length;
    final boundsInvalid = hasOutOfBoundsValues(contract.features, _values);

    return AppStack(
      children: [
        AppAlert(message: t.t('analysis.simulateHint')),
        if (_generalError != null) AppAlert(tone: AlertTone.danger, message: _generalError!),
        if (_result != null)
          AnalysisResultView(result: _result!)
        else
          AppCard(
            child: EmptyState(
              icon: Icons.insights_outlined,
              title: t.t('analysis.noResultYet'),
            ),
          ),
        AppCard(
          title: t.t('analysis.formTitle'),
          hint: t.t('students.attributesHint'),
          actions: [
            AppBadge(
              label: t.t('students.filledOf', {
                'filled': contract.featureCount - missing,
                'total': contract.featureCount,
              }),
              color: missing == 0 ? context.colors.success : context.colors.warning,
            ),
            AppButton(
              label: _running ? t.t('analysis.running') : t.t('analysis.run'),
              variant: ButtonVariant.primary,
              small: true,
              loading: _running,
              onPressed: missing > 0 || boundsInvalid ? null : _run,
            ),
          ],
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (missing > 0) ...[
                AppAlert(message: t.t('students.cannotAnalyze')),
                const SizedBox(height: AppSizes.gap),
              ],
              FeaturesForm(
                features: contract.features,
                values: _values,
                revision: _revision,
                disabled: _running,
                fieldErrors: _fieldErrors,
                onChanged: (name, value) => setState(() => _values[name] = value),
                onFillWithMeans: () => setState(() {
                  _values = fillWithMeans(contract.features, _values);
                  _revision++;
                }),
                onClear: () => setState(() {
                  _values = initialFeatureValues(contract.features, null);
                  _revision++;
                  _result = null;
                }),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _HistoryTab extends StatefulWidget {
  const _HistoryTab();

  @override
  State<_HistoryTab> createState() => _HistoryTabState();
}

class _HistoryTabState extends State<_HistoryTab> {
  String _classification = '';
  String _priority = '';
  DateTime? _from;
  DateTime? _to;
  int _page = 1;
  bool _filtersOpen = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;
    final api = context.read<Api>();

    return AppCard(
      title: t.t('analysis.history'),
      hint: t.t('analysis.historyHint'),
      flush: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                InkWell(
                  onTap: () => setState(() => _filtersOpen = !_filtersOpen),
                  child: Row(
                    children: [
                      Icon(
                        _filtersOpen ? Icons.expand_less : Icons.tune,
                        size: 18,
                        color: colors.textMuted,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        t.t('common.filters'),
                        style: TextStyle(fontSize: 13.5, color: colors.textMuted),
                      ),
                      const Spacer(),
                      if (_classification.isNotEmpty ||
                          _priority.isNotEmpty ||
                          _from != null ||
                          _to != null)
                        AppButton(
                          label: t.t('common.clearFilters'),
                          small: true,
                          variant: ButtonVariant.ghost,
                          onPressed: () => setState(() {
                            _classification = '';
                            _priority = '';
                            _from = null;
                            _to = null;
                            _page = 1;
                          }),
                        ),
                    ],
                  ),
                ),
                if (_filtersOpen) ...[
                  const SizedBox(height: 12),
                  LabeledField(
                    label: t.t('analysis.filterClassification'),
                    child: AppDropdown<String>(
                      value: _classification,
                      onChanged: (value) => setState(() {
                        _classification = value ?? '';
                        _page = 1;
                      }),
                      items: [
                        (value: '', label: t.t('common.all')),
                        (value: 'Dropout', label: t.t('classification.Dropout')),
                        (value: 'Enrolled', label: t.t('classification.Enrolled')),
                        (value: 'Graduate', label: t.t('classification.Graduate')),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  LabeledField(
                    label: t.t('analysis.filterPriority'),
                    child: AppDropdown<String>(
                      value: _priority,
                      onChanged: (value) => setState(() {
                        _priority = value ?? '';
                        _page = 1;
                      }),
                      items: [
                        (value: '', label: t.t('common.all')),
                        (value: 'HIGH', label: t.t('priority.HIGH')),
                        (value: 'MEDIUM', label: t.t('priority.MEDIUM')),
                        (value: 'LOW', label: t.t('priority.LOW')),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _DateFilter(
                          label: t.t('analysis.filterFrom'),
                          value: _from,
                          onChanged: (value) => setState(() {
                            _from = value;
                            _page = 1;
                          }),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _DateFilter(
                          label: t.t('analysis.filterTo'),
                          value: _to,
                          onChanged: (value) => setState(() {
                            _to = value;
                            _page = 1;
                          }),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          Divider(height: 1, color: colors.border),
          AsyncBuilder<Paginated<AnalysisRecord>>(
            dependencies: [_page, _classification, _priority, _from, _to],
            load: () => api.analyses.list(
              page: _page,
              classification: _classification.isEmpty ? null : _classification,
              priority: _priority.isEmpty ? null : _priority,
              from: _from,
              to: _to == null
                  ? null
                  : DateTime(_to!.year, _to!.month, _to!.day, 23, 59, 59),
            ),
            builder: (context, page) {
              if (page.isEmpty) {
                return EmptyState(
                  icon: Icons.donut_small_outlined,
                  title: t.t('common.noData'),
                  hint: t.t('common.noDataHint'),
                );
              }

              return Column(
                children: [
                  for (final analysis in page.data)
                    ListRowTile(
                      onTap: analysis.student == null
                          ? null
                          : () => context.push('/students/${analysis.student!.id}'),
                      title: analysis.student?.name ?? '—',
                      subtitle: [
                        t.formatDate(analysis.createdAt, withTime: true),
                        analysis.algorithm,
                        if (analysis.requestedBy != null)
                          '${t.t('analysis.requestedBy')}: ${analysis.requestedBy!.name}',
                      ].join(' · '),
                      trailing: PriorityBadge(value: analysis.priority),
                      footer: AnalysisRow(
                        classification: analysis.classification,
                        confidence: analysis.confidence,
                      ),
                    ),
                  PaginationBar(
                    page: page.pagination.page,
                    totalPages: page.pagination.totalPages,
                    total: page.pagination.total,
                    onChange: (next) => setState(() => _page = next),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _DateFilter extends StatelessWidget {
  const _DateFilter({required this.label, required this.value, required this.onChanged});

  final String label;
  final DateTime? value;
  final ValueChanged<DateTime?> onChanged;

  @override
  Widget build(BuildContext context) {
    final t = context.i18n;

    return LabeledField(
      label: label,
      child: InkWell(
        onTap: () async {
          final now = DateTime.now();
          final picked = await showDatePicker(
            context: context,
            initialDate: value ?? now,
            firstDate: DateTime(now.year - 5),
            lastDate: DateTime(now.year + 1),
          );
          if (picked != null) onChanged(picked);
        },
        child: InputDecorator(
          decoration: InputDecoration(
            suffixIcon: value == null
                ? const Icon(Icons.calendar_today_outlined, size: 17)
                : IconButton(
                    icon: const Icon(Icons.close, size: 17),
                    onPressed: () => onChanged(null),
                  ),
          ),
          child: Text(
            value == null ? '—' : t.formatDate(value),
            style: TextStyle(fontSize: 14, color: context.colors.text),
          ),
        ),
      ),
    );
  }
}
