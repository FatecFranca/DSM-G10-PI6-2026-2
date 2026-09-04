import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../models/analysis.dart';
import '../models/enums.dart';
import '../models/student.dart';
import '../services/api_services.dart';
import '../state/api_error_text.dart';
import '../state/auth_state.dart';
import '../state/i18n_state.dart';
import '../widgets/analysis_result_view.dart';
import '../widgets/app_shell.dart';
import '../widgets/async_builder.dart';
import '../widgets/ui.dart';
import 'dashboard_page.dart' show ListRowTile;

/// Detalhe do estudante: situação, histórico, acompanhamentos e atributos.
class StudentDetailPage extends StatefulWidget {
  const StudentDetailPage({super.key, required this.studentId});

  final String studentId;

  @override
  State<StudentDetailPage> createState() => _StudentDetailPageState();
}

class _StudentDetailPageState extends State<StudentDetailPage> {
  final _key = GlobalKey<AsyncBuilderState<Student>>();

  bool _analyzing = false;
  AnalysisResult? _lastResult;

  Future<void> _runAnalysis() async {
    final t = context.i18nRead;
    final api = context.read<Api>();

    setState(() => _analyzing = true);
    try {
      final result = await api.analyses.runForStudent(widget.studentId);
      if (!mounted) return;
      setState(() => _lastResult = result);
      _key.currentState?.refresh();
    } catch (error) {
      if (mounted) {
        showToast(context, describeApiError(t, error), tone: AlertTone.danger);
      }
    } finally {
      if (mounted) setState(() => _analyzing = false);
    }
  }

  Future<void> _deactivate(Student student) async {
    final t = context.i18nRead;
    final api = context.read<Api>();

    final confirmed = await confirmDialog(
      context,
      message: t.t('students.confirmDeactivate', {'name': student.name}),
    );
    if (!confirmed || !mounted) return;

    try {
      await api.students.deactivate(student.id);
      if (!mounted) return;
      showToast(context, t.t('students.deactivated'), tone: AlertTone.success);
      context.go('/students');
    } catch (error) {
      if (mounted) {
        showToast(context, describeApiError(t, error), tone: AlertTone.danger);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = context.read<Api>();

    return Scaffold(
      backgroundColor: context.colors.bg,
      appBar: const AppTopBar(),
      drawer: const AppDrawer(),
      body: AsyncBuilder<Student>(
        key: _key,
        dependencies: [widget.studentId],
        load: () => api.students.get(widget.studentId),
        builder: (context, student) => RefreshIndicator(
          onRefresh: () async => _key.currentState?.refresh(),
          color: context.colors.brand,
          backgroundColor: context.colors.surface,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            child: _StudentDetailBody(
              student: student,
              lastResult: _lastResult,
              analyzing: _analyzing,
              onAnalyze: _runAnalysis,
              onDeactivate: () => _deactivate(student),
              onChanged: () => _key.currentState?.refresh(),
            ),
          ),
        ),
        loadingBuilder: (_) => const LoadingState(),
      ),
    );
  }
}

class _StudentDetailBody extends StatelessWidget {
  const _StudentDetailBody({
    required this.student,
    required this.lastResult,
    required this.analyzing,
    required this.onAnalyze,
    required this.onDeactivate,
    required this.onChanged,
  });

  final Student student;
  final AnalysisResult? lastResult;
  final bool analyzing;
  final VoidCallback onAnalyze;
  final VoidCallback onDeactivate;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;
    final can = context.watch<AuthState>().can;

    final status = student.featuresStatus;
    final canAnalyze = can.runAnalyses && status?.complete == true && student.active;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InkWell(
          onTap: () => context.go('/students'),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                Icon(Icons.arrow_back, size: 16, color: colors.textMuted),
                const SizedBox(width: 6),
                Text(
                  t.t('common.back'),
                  style: TextStyle(fontSize: AppSizes.fontSmall, color: colors.textMuted),
                ),
              ],
            ),
          ),
        ),
        PageHeader(
          title: student.name,
          subtitle: [
            student.code,
            if (student.course != null) student.course!,
            if (student.institution != null) student.institution!.name,
          ].join(' · '),
          actions: [
            if (can.runAnalyses)
              AppButton(
                label: analyzing ? t.t('students.analyzing') : t.t('students.analyzeNow'),
                variant: ButtonVariant.primary,
                loading: analyzing,
                onPressed: canAnalyze ? onAnalyze : null,
              ),
            if (can.writeStudents) ...[
              AppButton(
                label: t.t('common.edit'),
                onPressed: () => context.push('/students/${student.id}/edit'),
              ),
              if (student.active)
                AppButton(
                  label: t.t('common.deactivate'),
                  variant: ButtonVariant.ghost,
                  onPressed: onDeactivate,
                ),
            ],
          ],
        ),
        const SizedBox(height: AppSizes.gap),
        AppStack(
          children: [
            if (status != null && !status.complete)
              AppAlert(
                tone: AlertTone.warning,
                title: t.t('students.attributesIncomplete'),
                message: '${t.t('students.filledOf', {
                      'filled': status.filled,
                      'total': status.total,
                    })}. ${t.t('students.cannotAnalyze')}',
              ),

            if (lastResult != null) AnalysisResultView(result: lastResult!),

            AppCard(
              title: t.t('students.basicData'),
              child: DefinitionList(
                items: [
                  (term: t.t('students.code'), value: DefinitionValue(student.code)),
                  (term: t.t('students.email'), value: DefinitionValue(student.email ?? '—')),
                  (term: t.t('students.course'), value: DefinitionValue(student.course ?? '—')),
                  (
                    term: t.t('students.enrollmentYear'),
                    value: DefinitionValue(
                      student.enrollmentYear == null ? '—' : '${student.enrollmentYear}',
                    ),
                  ),
                  (
                    term: t.t('students.institution'),
                    value: DefinitionValue(student.institution?.name ?? '—'),
                  ),
                  (
                    term: t.t('common.actions'),
                    value: DefinitionValue(
                      student.active ? t.t('common.active') : t.t('common.inactive'),
                    ),
                  ),
                  (
                    term: t.t('students.createdBy'),
                    value: DefinitionValue(student.createdBy?.name ?? '—'),
                  ),
                  (
                    term: t.t('students.attributes'),
                    value: DefinitionValue(
                      status == null
                          ? '—'
                          : status.complete
                              ? t.t('students.attributesComplete')
                              : t.t('students.filledOf', {
                                  'filled': status.filled,
                                  'total': status.total,
                                }),
                    ),
                  ),
                ],
              ),
            ),

            AppCard(
              title: t.t('students.lastResult'),
              child: student.lastClassification == null
                  ? EmptyState(
                      icon: Icons.insights_outlined,
                      title: t.t('classification.notAnalyzed'),
                      hint: canAnalyze ? null : t.t('students.cannotAnalyze'),
                      action: canAnalyze
                          ? AppButton(
                              label: t.t('students.analyzeNow'),
                              variant: ButtonVariant.primary,
                              small: true,
                              loading: analyzing,
                              onPressed: onAnalyze,
                            )
                          : null,
                    )
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            ClassificationBadge(value: student.lastClassification),
                            PriorityBadge(value: student.lastPriority),
                          ],
                        ),
                        const SizedBox(height: 14),
                        DefinitionList(
                          items: [
                            (
                              term: t.t('students.confidence'),
                              value: DefinitionValue(
                                student.lastConfidence == null
                                    ? '—'
                                    : t.formatPercent(student.lastConfidence!, 1),
                              ),
                            ),
                            (
                              term: t.t('students.lastAnalysis'),
                              value: DefinitionValue(
                                t.formatDate(student.lastAnalysisAt, withTime: true),
                              ),
                            ),
                          ],
                        ),
                        Text(
                          t.t('analysis.supportTool'),
                          style: TextStyle(
                            fontSize: AppSizes.fontSmall,
                            color: colors.textMuted,
                          ),
                        ),
                      ],
                    ),
            ),

            AppCard(
              title: t.t('students.history'),
              flush: true,
              child: student.analyses.isEmpty
                  ? EmptyState(
                      icon: Icons.donut_small_outlined,
                      title: t.t('students.historyEmpty'),
                    )
                  : Column(
                      children: [
                        for (final analysis in student.analyses)
                          ListRowTile(
                            title: t.formatDate(analysis.createdAt, withTime: true),
                            subtitle: '${analysis.algorithm} · ${analysis.modelVersion}'
                                '${analysis.clusterId == null ? '' : ' · ${t.t('analysis.clusterId')} ${analysis.clusterId}'}'
                                '${analysis.requestedBy == null ? '' : ' · ${analysis.requestedBy!.name}'}',
                            trailing: PriorityBadge(value: analysis.priority),
                            footer: AnalysisRow(
                              classification: analysis.classification,
                              confidence: analysis.confidence,
                            ),
                          ),
                      ],
                    ),
            ),

            AppCard(
              title: t.t('students.followUps'),
              flush: true,
              actions: can.manageFollowUps
                  ? [
                      AppButton(
                        label: t.t('followUps.new'),
                        small: true,
                        icon: Icons.add,
                        onPressed: () => _openFollowUpSheet(context),
                      ),
                    ]
                  : null,
              child: student.followUps.isEmpty
                  ? EmptyState(
                      icon: Icons.checklist_outlined,
                      title: t.t('students.followUpsEmpty'),
                      hint: t.t('followUps.emptyHint'),
                    )
                  : Column(
                      children: [
                        for (final followUp in student.followUps)
                          ListRowTile(
                            title: followUp.title,
                            subtitle: [
                              followUp.assignedTo?.name ?? t.t('followUps.unassigned'),
                              if (followUp.dueDate != null)
                                '${t.t('followUps.dueDate')}: ${t.formatDate(followUp.dueDate)}',
                            ].join(' · '),
                            trailing: PriorityBadge(value: followUp.priority),
                            footer: StatusBadge(value: followUp.status),
                          ),
                      ],
                    ),
            ),

            if (student.features != null && student.features!.isNotEmpty)
              AppCard(
                title: t.t('students.attributes'),
                hint: t.t('students.attributesHint'),
                child: DefinitionList(
                  items: [
                    for (final entry in student.features!.entries)
                      (
                        term: entry.key,
                        value: DefinitionValue(t.formatNumber(entry.value)),
                      ),
                  ],
                ),
              ),
          ],
        ),
      ],
    );
  }

  void _openFollowUpSheet(BuildContext context) {
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(sheetContext).viewInsets.bottom),
        child: NewFollowUpSheet(
          studentId: student.id,
          analysisId: student.analyses.isEmpty ? null : student.analyses.first.id,
        ),
      ),
    ).then((created) {
      if (created == true) onChanged();
    });
  }
}

/// Abertura de um acompanhamento — o `Modal` da Web vira folha inferior, que é
/// o padrão de formulário curto em Mobile.
class NewFollowUpSheet extends StatefulWidget {
  const NewFollowUpSheet({super.key, required this.studentId, this.analysisId});

  final String studentId;
  final String? analysisId;

  @override
  State<NewFollowUpSheet> createState() => _NewFollowUpSheetState();
}

class _NewFollowUpSheetState extends State<NewFollowUpSheet> {
  final _title = TextEditingController();
  final _notes = TextEditingController();

  Priority _priority = Priority.medium;
  DateTime? _dueDate;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final t = context.i18nRead;
    final api = context.read<Api>();

    if (_title.text.trim().length < 3) return;

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await api.followUps.create(
        studentId: widget.studentId,
        analysisId: widget.analysisId,
        title: _title.text.trim(),
        notes: _notes.text.trim(),
        priority: _priority,
        dueDate: _dueDate,
      );
      if (!mounted) return;
      showToast(context, t.t('followUps.created'), tone: AlertTone.success);
      Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) setState(() => _error = describeApiError(t, error));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.i18n;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            t.t('followUps.new'),
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: context.colors.text,
            ),
          ),
          const SizedBox(height: 16),
          if (_error != null) ...[
            AppAlert(tone: AlertTone.danger, message: _error!),
            const SizedBox(height: 12),
          ],
          LabeledField(
            label: t.t('followUps.titleField'),
            required: true,
            child: AppTextField(controller: _title, enabled: !_saving),
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: t.t('followUps.notes'),
            child: AppTextField(controller: _notes, maxLines: 3, enabled: !_saving),
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: t.t('priority.label'),
            child: AppDropdown<Priority>(
              value: _priority,
              enabled: !_saving,
              onChanged: (value) => setState(() => _priority = value ?? Priority.medium),
              items: [
                (value: Priority.high, label: t.t('priority.HIGH')),
                (value: Priority.medium, label: t.t('priority.MEDIUM')),
                (value: Priority.low, label: t.t('priority.LOW')),
              ],
            ),
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: t.t('followUps.dueDate'),
            child: InkWell(
              onTap: _saving
                  ? null
                  : () async {
                      final now = DateTime.now();
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: _dueDate ?? now,
                        firstDate: now.subtract(const Duration(days: 365)),
                        lastDate: now.add(const Duration(days: 365 * 3)),
                      );
                      if (picked != null) setState(() => _dueDate = picked);
                    },
              child: InputDecorator(
                decoration: const InputDecoration(),
                child: Text(
                  _dueDate == null ? '—' : t.formatDate(_dueDate),
                  style: TextStyle(fontSize: 14, color: context.colors.text),
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              AppButton(
                label: t.t('common.cancel'),
                variant: ButtonVariant.ghost,
                onPressed: _saving ? null : () => Navigator.of(context).pop(false),
              ),
              const SizedBox(width: 8),
              AppButton(
                label: t.t('common.save'),
                variant: ButtonVariant.primary,
                loading: _saving,
                onPressed: _submit,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
