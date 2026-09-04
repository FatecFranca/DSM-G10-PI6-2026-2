import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../models/common.dart';
import '../models/enums.dart';
import '../models/follow_up.dart';
import '../services/api_services.dart';
import '../state/api_error_text.dart';
import '../state/auth_state.dart';
import '../state/i18n_state.dart';
import '../widgets/app_shell.dart';
import '../widgets/async_builder.dart';
import '../widgets/ui.dart';

/// Fila de acompanhamentos: onde as ações tomadas a partir de uma análise ficam
/// registradas e mudam de situação.
class FollowUpsPage extends StatefulWidget {
  const FollowUpsPage({super.key});

  @override
  State<FollowUpsPage> createState() => _FollowUpsPageState();
}

class _FollowUpsPageState extends State<FollowUpsPage> {
  final _listKey = GlobalKey<AsyncBuilderState<Paginated<FollowUp>>>();

  String _status = '';
  String _priority = '';
  bool _mine = false;
  bool _overdue = false;
  int _page = 1;
  String? _updating;
  bool _filtersOpen = false;

  Future<void> _changeStatus(FollowUp followUp, FollowUpStatus next) async {
    final t = context.i18nRead;
    final api = context.read<Api>();

    setState(() => _updating = followUp.id);
    try {
      await api.followUps.updateStatus(followUp.id, next);
      if (!mounted) return;
      showToast(context, t.t('followUps.updated'), tone: AlertTone.success);
      _listKey.currentState?.refresh();
    } catch (error) {
      if (mounted) {
        showToast(context, describeApiError(t, error), tone: AlertTone.danger);
      }
    } finally {
      if (mounted) setState(() => _updating = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;
    final api = context.read<Api>();
    final can = context.watch<AuthState>().can;

    return AppScaffold(
      title: t.t('followUps.title'),
      subtitle: t.t('followUps.subtitle'),
      onRefresh: () async => _listKey.currentState?.refresh(),
      child: AppCard(
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
                      ],
                    ),
                  ),
                  if (_filtersOpen) ...[
                    const SizedBox(height: 12),
                    LabeledField(
                      label: t.t('followUps.status'),
                      child: AppDropdown<String>(
                        value: _status,
                        onChanged: (value) => setState(() {
                          _status = value ?? '';
                          _page = 1;
                        }),
                        items: [
                          (value: '', label: t.t('common.all')),
                          for (final status in FollowUpStatus.values)
                            (
                              value: status.api,
                              label: t.t('followUpStatus.${status.api}'),
                            ),
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
                    const SizedBox(height: 6),
                    CheckboxListTile(
                      value: _mine,
                      onChanged: (value) => setState(() {
                        _mine = value ?? false;
                        _page = 1;
                      }),
                      contentPadding: EdgeInsets.zero,
                      controlAffinity: ListTileControlAffinity.leading,
                      dense: true,
                      title: Text(
                        t.t('followUps.onlyMine'),
                        style: TextStyle(fontSize: 13.5, color: colors.text),
                      ),
                    ),
                    CheckboxListTile(
                      value: _overdue,
                      onChanged: (value) => setState(() {
                        _overdue = value ?? false;
                        _page = 1;
                      }),
                      contentPadding: EdgeInsets.zero,
                      controlAffinity: ListTileControlAffinity.leading,
                      dense: true,
                      title: Text(
                        t.t('followUps.onlyOverdue'),
                        style: TextStyle(fontSize: 13.5, color: colors.text),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Divider(height: 1, color: colors.border),
            AsyncBuilder<Paginated<FollowUp>>(
              key: _listKey,
              dependencies: [_page, _status, _priority, _mine, _overdue],
              load: () => api.followUps.list(
                page: _page,
                status: _status.isEmpty ? null : _status,
                priority: _priority.isEmpty ? null : _priority,
                mine: _mine,
                overdue: _overdue,
              ),
              builder: (context, page) {
                if (page.isEmpty) {
                  return EmptyState(
                    icon: Icons.checklist_outlined,
                    title: t.t('followUps.empty'),
                    hint: t.t('followUps.emptyHint'),
                  );
                }

                return Column(
                  children: [
                    for (final followUp in page.data)
                      _FollowUpTile(
                        followUp: followUp,
                        updating: _updating == followUp.id,
                        canManage: can.manageFollowUps,
                        onChangeStatus: (next) => _changeStatus(followUp, next),
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
    );
  }
}

class _FollowUpTile extends StatelessWidget {
  const _FollowUpTile({
    required this.followUp,
    required this.updating,
    required this.canManage,
    required this.onChangeStatus,
  });

  final FollowUp followUp;
  final bool updating;
  final bool canManage;
  final ValueChanged<FollowUpStatus> onChangeStatus;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;
    final overdue = followUp.isOverdue;

    return Container(
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
              Expanded(
                child: Text(
                  followUp.title,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: colors.text,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              PriorityBadge(value: followUp.priority),
            ],
          ),
          if (followUp.notes != null && followUp.notes!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 3),
              child: Text(
                followUp.notes!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: AppSizes.fontSmall, color: colors.textMuted),
              ),
            ),
          const SizedBox(height: 8),
          if (followUp.student != null)
            InkWell(
              onTap: () => context.push('/students/${followUp.student!.id}'),
              child: Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text(
                  '${t.t('followUps.student')}: ${followUp.student!.name}',
                  style: TextStyle(fontSize: AppSizes.fontSmall, color: colors.brand),
                ),
              ),
            ),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              StatusBadge(value: followUp.status),
              Text(
                followUp.assignedTo?.name ?? t.t('followUps.unassigned'),
                style: TextStyle(fontSize: AppSizes.fontLabel, color: colors.textMuted),
              ),
              if (followUp.dueDate != null)
                Text(
                  '${t.t('followUps.dueDate')}: ${t.formatDate(followUp.dueDate)}',
                  style: TextStyle(
                    fontSize: AppSizes.fontLabel,
                    color: overdue ? colors.danger : colors.textMuted,
                  ),
                ),
              if (overdue) AppBadge(label: t.t('followUps.overdue'), color: colors.danger),
            ],
          ),
          if (canManage) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (followUp.status == FollowUpStatus.open)
                  AppButton(
                    label: t.t('followUps.markInProgress'),
                    small: true,
                    loading: updating,
                    onPressed: () => onChangeStatus(FollowUpStatus.inProgress),
                  ),
                if (followUp.status == FollowUpStatus.open ||
                    followUp.status == FollowUpStatus.inProgress)
                  AppButton(
                    label: t.t('followUps.markDone'),
                    variant: ButtonVariant.primary,
                    small: true,
                    loading: updating,
                    onPressed: () => onChangeStatus(FollowUpStatus.done),
                  ),
                if (followUp.status == FollowUpStatus.done ||
                    followUp.status == FollowUpStatus.cancelled)
                  AppButton(
                    label: t.t('followUps.reopen'),
                    variant: ButtonVariant.ghost,
                    small: true,
                    loading: updating,
                    onPressed: () => onChangeStatus(FollowUpStatus.open),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
