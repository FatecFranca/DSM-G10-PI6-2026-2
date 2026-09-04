import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../models/common.dart';
import '../models/user.dart';
import '../services/api_services.dart';
import '../state/api_error_text.dart';
import '../state/i18n_state.dart';
import '../widgets/app_shell.dart';
import '../widgets/async_builder.dart';
import '../widgets/ui.dart';

/// Administração de instituições — somente para o papel Administrador.
///
/// Desativar uma instituição não apaga o histórico de estudantes e análises
/// vinculados a ela.
class AdminInstitutionsPage extends StatefulWidget {
  const AdminInstitutionsPage({super.key});

  @override
  State<AdminInstitutionsPage> createState() => _AdminInstitutionsPageState();
}

class _AdminInstitutionsPageState extends State<AdminInstitutionsPage> {
  final _listKey = GlobalKey<AsyncBuilderState<Paginated<Institution>>>();
  final _searchController = TextEditingController();

  Timer? _debounce;
  String _search = '';
  int _page = 1;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

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

  Future<void> _deactivate(Institution institution) async {
    final t = context.i18nRead;
    final api = context.read<Api>();

    final confirmed = await confirmDialog(
      context,
      message: t.t('institutions.confirmDeactivate', {'name': institution.name}),
    );
    if (!confirmed || !mounted) return;

    try {
      await api.institutions.deactivate(institution.id);
      if (!mounted) return;
      showToast(context, t.t('institutions.deactivated'), tone: AlertTone.success);
      _listKey.currentState?.refresh();
    } catch (error) {
      if (mounted) {
        showToast(context, describeApiError(t, error), tone: AlertTone.danger);
      }
    }
  }

  void _openForm({Institution? institution}) {
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(sheetContext).viewInsets.bottom),
        child: _InstitutionFormSheet(institution: institution),
      ),
    ).then((saved) {
      if (saved == true) _listKey.currentState?.refresh();
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;
    final api = context.read<Api>();

    return AppScaffold(
      title: t.t('institutions.title'),
      subtitle: t.t('institutions.subtitle'),
      onRefresh: () async => _listKey.currentState?.refresh(),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(),
        backgroundColor: colors.brand,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: Text(t.t('institutions.new')),
      ),
      child: AppCard(
        flush: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.all(14),
              child: AppTextField(
                controller: _searchController,
                hintText: t.t('institutions.searchPlaceholder'),
                onChanged: _onSearchChanged,
                suffix: Icon(Icons.search, size: 19, color: colors.textMuted),
              ),
            ),
            Divider(height: 1, color: colors.border),
            AsyncBuilder<Paginated<Institution>>(
              key: _listKey,
              dependencies: [_page, _search],
              load: () => api.institutions.list(
                page: _page,
                search: _search.isEmpty ? null : _search,
              ),
              builder: (context, page) {
                if (page.isEmpty) {
                  return EmptyState(
                    icon: Icons.apartment_outlined,
                    title: t.t('common.noData'),
                    hint: t.t('common.noDataHint'),
                  );
                }

                return Column(
                  children: [
                    for (final institution in page.data)
                      Container(
                        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                        decoration: BoxDecoration(
                          border: Border(bottom: BorderSide(color: colors.border)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              institution.name,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: colors.text,
                              ),
                            ),
                            if (institution.email != null)
                              Text(
                                institution.email!,
                                style: TextStyle(
                                  fontSize: AppSizes.fontSmall,
                                  color: colors.textMuted,
                                ),
                              ),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              runSpacing: 6,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                if (!institution.active)
                                  AppBadge(label: t.t('common.inactive'), neutral: true),
                                Text(
                                  [
                                    institution.city ?? '—',
                                    if (institution.state != null) institution.state!,
                                  ].join(' / '),
                                  style: TextStyle(
                                    fontSize: AppSizes.fontLabel,
                                    color: colors.textMuted,
                                  ),
                                ),
                                Text(
                                  institution.type ?? '—',
                                  style: TextStyle(
                                    fontSize: AppSizes.fontLabel,
                                    color: colors.textMuted,
                                  ),
                                ),
                                Text(
                                  '${t.t('institutions.students')}: '
                                  '${t.formatNumber(institution.studentCount ?? 0)}',
                                  style: TextStyle(
                                    fontSize: AppSizes.fontLabel,
                                    color: colors.textMuted,
                                  ),
                                ),
                                Text(
                                  '${t.t('institutions.users')}: '
                                  '${t.formatNumber(institution.userCount ?? 0)}',
                                  style: TextStyle(
                                    fontSize: AppSizes.fontLabel,
                                    color: colors.textMuted,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                AppButton(
                                  label: t.t('common.edit'),
                                  small: true,
                                  onPressed: () => _openForm(institution: institution),
                                ),
                                if (institution.active)
                                  AppButton(
                                    label: t.t('common.deactivate'),
                                    small: true,
                                    variant: ButtonVariant.ghost,
                                    onPressed: () => _deactivate(institution),
                                  ),
                              ],
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
    );
  }
}

class _InstitutionFormSheet extends StatefulWidget {
  const _InstitutionFormSheet({required this.institution});

  final Institution? institution;

  @override
  State<_InstitutionFormSheet> createState() => _InstitutionFormSheetState();
}

class _InstitutionFormSheetState extends State<_InstitutionFormSheet> {
  late final _name = TextEditingController(text: widget.institution?.name ?? '');
  late final _city = TextEditingController(text: widget.institution?.city ?? '');
  late final _state = TextEditingController(text: widget.institution?.state ?? '');
  late final _type = TextEditingController(text: widget.institution?.type ?? '');
  late final _email = TextEditingController(text: widget.institution?.email ?? '');
  late final _phone = TextEditingController(text: widget.institution?.phone ?? '');

  late bool _active = widget.institution?.active ?? true;
  bool _saving = false;
  String? _generalError;
  Map<String, String> _fieldErrors = {};

  bool get _isEdit => widget.institution != null;

  @override
  void dispose() {
    _name.dispose();
    _city.dispose();
    _state.dispose();
    _type.dispose();
    _email.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final t = context.i18nRead;
    final api = context.read<Api>();

    setState(() {
      _saving = true;
      _generalError = null;
      _fieldErrors = {};
    });

    final payload = <String, Object?>{
      'name': _name.text.trim(),
      if (_city.text.trim().isNotEmpty) 'city': _city.text.trim(),
      if (_state.text.trim().isNotEmpty) 'state': _state.text.trim(),
      if (_type.text.trim().isNotEmpty) 'type': _type.text.trim(),
      if (_email.text.trim().isNotEmpty) 'email': _email.text.trim(),
      if (_phone.text.trim().isNotEmpty) 'phone': _phone.text.trim(),
      if (_isEdit) 'active': _active,
    };

    try {
      if (_isEdit) {
        await api.institutions.update(widget.institution!.id, payload);
      } else {
        await api.institutions.create(payload);
      }

      if (!mounted) return;
      showToast(
        context,
        t.t(_isEdit ? 'institutions.updated' : 'institutions.created'),
        tone: AlertTone.success,
      );
      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _fieldErrors = apiFieldIssues(error);
        _generalError = describeApiError(t, error);
      });
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
            _isEdit ? t.t('institutions.edit') : t.t('institutions.new'),
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: context.colors.text,
            ),
          ),
          const SizedBox(height: 16),
          if (_generalError != null) ...[
            AppAlert(tone: AlertTone.danger, message: _generalError!),
            const SizedBox(height: 12),
          ],
          LabeledField(
            label: t.t('institutions.name'),
            required: true,
            error: _fieldErrors['name'],
            child: AppTextField(controller: _name, enabled: !_saving),
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: t.t('institutions.city'),
            child: AppTextField(controller: _city, enabled: !_saving),
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: t.t('institutions.state'),
            child: AppTextField(controller: _state, enabled: !_saving),
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: t.t('institutions.type'),
            hint: 'Ex.: pública, privada, ONG, entidade social',
            child: AppTextField(controller: _type, enabled: !_saving),
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: t.t('institutions.email'),
            error: _fieldErrors['email'],
            child: AppTextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              enabled: !_saving,
            ),
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: t.t('institutions.phone'),
            child: AppTextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              enabled: !_saving,
            ),
          ),
          if (_isEdit)
            CheckboxListTile(
              value: _active,
              onChanged: _saving ? null : (value) => setState(() => _active = value ?? true),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              dense: true,
              title: Text(t.t('common.active'), style: const TextStyle(fontSize: 13.5)),
            ),
          const SizedBox(height: 16),
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
