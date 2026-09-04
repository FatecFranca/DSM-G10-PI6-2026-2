import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../models/common.dart';
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

/// Lista de estudantes com busca, filtros, ordenação e análise em lote.
class StudentsPage extends StatefulWidget {
  const StudentsPage({super.key});

  @override
  State<StudentsPage> createState() => _StudentsPageState();
}

class _StudentsPageState extends State<StudentsPage> {
  final _controller = AsyncController();
  final _listKey = GlobalKey<AsyncBuilderState<Paginated<StudentSummary>>>();
  final _searchController = TextEditingController();

  Timer? _debounce;
  String _search = '';
  String _classification = '';
  String _priority = '';
  String _analyzed = '';
  String _sort = 'createdAt';
  int _page = 1;

  final Set<String> _selected = {};
  bool _analyzing = false;
  bool _filtersOpen = false;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _controller.dispose();
    super.dispose();
  }

  /// Mesmo atraso de 400ms do `useDebounced` da Web: evita uma requisição por
  /// tecla digitada.
  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      if (!mounted) return;
      setState(() {
        _search = value;
        _page = 1;
      });
    });
  }

  Future<void> _analyzeSelected() async {
    final t = context.i18nRead;
    final api = context.read<Api>();

    setState(() => _analyzing = true);
    try {
      final result = await api.analyses.runBatch(_selected.toList());
      if (!mounted) return;

      showToast(
        context,
        t.t('students.analyzeBatchDone', {
          'analyzed': result.analyzed,
          'skipped': result.skipped,
        }),
        tone: AlertTone.success,
      );
      if (result.skipped > 0) showToast(context, t.t('students.cannotAnalyze'));

      setState(_selected.clear);
      _listKey.currentState?.refresh();
    } catch (error) {
      if (mounted) {
        showToast(context, describeApiError(t, error), tone: AlertTone.danger);
      }
    } finally {
      if (mounted) setState(() => _analyzing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;
    final api = context.read<Api>();
    final can = context.watch<AuthState>().can;

    return AppScaffold(
      title: t.t('students.title'),
      subtitle: t.t('students.subtitle'),
      onRefresh: () async => _listKey.currentState?.refresh(),
      floatingActionButton: can.writeStudents
          ? FloatingActionButton.extended(
              onPressed: () => context.push('/students/new'),
              backgroundColor: colors.brand,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add),
              label: Text(t.t('students.new')),
            )
          : null,
      actions: [
        if (can.runAnalyses && _selected.isNotEmpty)
          AppButton(
            label: t.t('students.analyzeSelected', {'count': _selected.length}),
            variant: ButtonVariant.primary,
            loading: _analyzing,
            onPressed: _analyzeSelected,
          ),
      ],
      child: AppStack(
        children: [
          AppCard(
            flush: true,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      AppTextField(
                        controller: _searchController,
                        hintText: t.t('students.searchPlaceholder'),
                        onChanged: _onSearchChanged,
                        suffix: Icon(Icons.search, size: 19, color: colors.textMuted),
                      ),
                      const SizedBox(height: 10),
                      // Os cinco filtros da toolbar da Web ficam recolhidos por
                      // padrão: na largura de um celular eles empurrariam a
                      // lista para fora da primeira tela.
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
                          label: t.t('priority.label'),
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
                        LabeledField(
                          label: t.t('students.filterAnalyzed'),
                          child: AppDropdown<String>(
                            value: _analyzed,
                            onChanged: (value) => setState(() {
                              _analyzed = value ?? '';
                              _page = 1;
                            }),
                            items: [
                              (value: '', label: t.t('common.all')),
                              (value: 'true', label: t.t('students.analyzed')),
                              (value: 'false', label: t.t('students.notAnalyzed')),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        LabeledField(
                          label: t.t('students.sort'),
                          child: AppDropdown<String>(
                            value: _sort,
                            onChanged: (value) => setState(() {
                              _sort = value ?? 'createdAt';
                              _page = 1;
                            }),
                            items: [
                              (value: 'createdAt', label: t.t('students.sortCreatedAt')),
                              (value: 'name', label: t.t('students.sortName')),
                              (value: 'priority', label: t.t('students.sortPriority')),
                              (
                                value: 'recentAnalysis',
                                label: t.t('students.sortRecentAnalysis')
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Divider(height: 1, color: colors.border),
                AsyncBuilder<Paginated<StudentSummary>>(
                  key: _listKey,
                  controller: _controller,
                  dependencies: [_page, _search, _classification, _priority, _analyzed, _sort],
                  load: () => api.students.list(
                    page: _page,
                    search: _search.isEmpty ? null : _search,
                    classification: _classification.isEmpty ? null : _classification,
                    priority: _priority.isEmpty ? null : _priority,
                    analyzed: _analyzed.isEmpty ? null : _analyzed == 'true',
                    sort: _sort,
                  ),
                  builder: (context, page) {
                    if (page.isEmpty) {
                      return EmptyState(
                        icon: Icons.people_outline,
                        title: t.t('common.noData'),
                        hint: t.t('common.noDataHint'),
                      );
                    }

                    return Column(
                      children: [
                        for (final student in page.data)
                          ListRowTile(
                            onTap: () => context.push('/students/${student.id}'),
                            leading: can.runAnalyses
                                ? Checkbox(
                                    value: _selected.contains(student.id),
                                    onChanged: (checked) => setState(() {
                                      if (checked == true) {
                                        _selected.add(student.id);
                                      } else {
                                        _selected.remove(student.id);
                                      }
                                    }),
                                  )
                                : null,
                            title: student.name,
                            subtitle: [
                              student.code,
                              if (student.course != null) student.course!,
                              if (student.enrollmentYear != null) '${student.enrollmentYear}',
                              if (!student.active) t.t('common.inactive'),
                            ].join(' · '),
                            trailing: PriorityBadge(value: student.lastPriority),
                            footer: Row(
                              children: [
                                Expanded(
                                  child: AnalysisRow(
                                    classification: student.lastClassification,
                                    confidence: student.lastConfidence,
                                  ),
                                ),
                                Text(
                                  t.formatDate(student.lastAnalysisAt),
                                  style: TextStyle(
                                    fontSize: AppSizes.fontLabel,
                                    color: colors.textMuted,
                                  ),
                                ),
                              ],
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
          ),
          if (can.runAnalyses) AppAlert(message: t.t('analysis.supportTool')),
        ],
      ),
    );
  }
}
