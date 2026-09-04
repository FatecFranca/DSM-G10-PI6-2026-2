import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../models/common.dart';
import '../models/enums.dart';
import '../models/user.dart';
import '../services/api_services.dart';
import '../state/api_error_text.dart';
import '../state/auth_state.dart';
import '../state/i18n_state.dart';
import '../widgets/app_shell.dart';
import '../widgets/async_builder.dart';
import '../widgets/ui.dart';

/// Administração de usuários — somente para o papel Administrador.
class AdminUsersPage extends StatefulWidget {
  const AdminUsersPage({super.key});

  @override
  State<AdminUsersPage> createState() => _AdminUsersPageState();
}

class _AdminUsersPageState extends State<AdminUsersPage> {
  final _listKey = GlobalKey<AsyncBuilderState<Paginated<User>>>();
  final _searchController = TextEditingController();

  Timer? _debounce;
  String _search = '';
  String _role = '';
  int _page = 1;
  List<Institution> _institutions = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadInstitutions());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadInstitutions() async {
    try {
      final page = await context.read<Api>().institutions.list(limit: 100);
      if (mounted) setState(() => _institutions = page.data);
    } catch (_) {
      // A lista de instituições só alimenta o seletor do formulário; sem ela a
      // listagem de usuários continua utilizável.
    }
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

  Future<void> _deactivate(User user) async {
    final t = context.i18nRead;
    final api = context.read<Api>();

    final confirmed = await confirmDialog(
      context,
      message: t.t('users.confirmDeactivate', {'name': user.name}),
    );
    if (!confirmed || !mounted) return;

    try {
      await api.users.deactivate(user.id);
      if (!mounted) return;
      showToast(context, t.t('users.deactivated'), tone: AlertTone.success);
      _listKey.currentState?.refresh();
    } catch (error) {
      if (mounted) {
        showToast(context, describeApiError(t, error), tone: AlertTone.danger);
      }
    }
  }

  void _openForm({User? user}) {
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(sheetContext).viewInsets.bottom),
        child: _UserFormSheet(user: user, institutions: _institutions),
      ),
    ).then((saved) {
      if (saved == true) _listKey.currentState?.refresh();
    });
  }

  void _openPasswordReset(User user) {
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(sheetContext).viewInsets.bottom),
        child: _ResetPasswordSheet(user: user),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;
    final api = context.read<Api>();
    final currentUser = context.watch<AuthState>().user;

    return AppScaffold(
      title: t.t('users.title'),
      subtitle: t.t('users.subtitle'),
      onRefresh: () async => _listKey.currentState?.refresh(),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(),
        backgroundColor: colors.brand,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: Text(t.t('users.new')),
      ),
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
                  AppTextField(
                    controller: _searchController,
                    hintText: t.t('users.searchPlaceholder'),
                    onChanged: _onSearchChanged,
                    suffix: Icon(Icons.search, size: 19, color: colors.textMuted),
                  ),
                  const SizedBox(height: 12),
                  LabeledField(
                    label: t.t('users.role'),
                    child: AppDropdown<String>(
                      value: _role,
                      onChanged: (value) => setState(() {
                        _role = value ?? '';
                        _page = 1;
                      }),
                      items: [
                        (value: '', label: t.t('common.all')),
                        for (final role in Role.values)
                          (value: role.api, label: t.t('roles.${role.api}')),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Divider(height: 1, color: colors.border),
            AsyncBuilder<Paginated<User>>(
              key: _listKey,
              dependencies: [_page, _search, _role],
              load: () => api.users.list(
                page: _page,
                search: _search.isEmpty ? null : _search,
                role: _role.isEmpty ? null : _role,
              ),
              builder: (context, page) {
                if (page.isEmpty) {
                  return EmptyState(
                    icon: Icons.manage_accounts_outlined,
                    title: t.t('common.noData'),
                    hint: t.t('common.noDataHint'),
                  );
                }

                return Column(
                  children: [
                    for (final user in page.data)
                      Container(
                        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                        decoration: BoxDecoration(
                          border: Border(bottom: BorderSide(color: colors.border)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              user.name,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: colors.text,
                              ),
                            ),
                            Text(
                              user.email,
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
                                AppBadge(label: t.t('roles.${user.role.api}')),
                                if (!user.active)
                                  AppBadge(label: t.t('common.inactive'), neutral: true),
                                Text(
                                  user.institution?.name ?? '—',
                                  style: TextStyle(
                                    fontSize: AppSizes.fontLabel,
                                    color: colors.textMuted,
                                  ),
                                ),
                                Text(
                                  '${t.t('users.lastLogin')}: '
                                  '${user.lastLoginAt == null ? t.t('common.never') : t.formatDate(user.lastLoginAt, withTime: true)}',
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
                                  onPressed: () => _openForm(user: user),
                                ),
                                AppButton(
                                  label: t.t('users.resetPassword'),
                                  small: true,
                                  variant: ButtonVariant.ghost,
                                  onPressed: () => _openPasswordReset(user),
                                ),
                                // O Back-End recusa desativar a própria conta;
                                // o botão some para não oferecer o que falharia.
                                if (user.active && user.id != currentUser?.id)
                                  AppButton(
                                    label: t.t('common.deactivate'),
                                    small: true,
                                    variant: ButtonVariant.ghost,
                                    onPressed: () => _deactivate(user),
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

class _UserFormSheet extends StatefulWidget {
  const _UserFormSheet({required this.user, required this.institutions});

  final User? user;
  final List<Institution> institutions;

  @override
  State<_UserFormSheet> createState() => _UserFormSheetState();
}

class _UserFormSheetState extends State<_UserFormSheet> {
  late final TextEditingController _name =
      TextEditingController(text: widget.user?.name ?? '');
  late final TextEditingController _email =
      TextEditingController(text: widget.user?.email ?? '');
  final _password = TextEditingController();

  late Role _role = widget.user?.role ?? Role.viewer;
  late String? _institutionId = widget.user?.institutionId;
  late bool _active = widget.user?.active ?? true;

  bool _saving = false;
  String? _generalError;
  Map<String, String> _fieldErrors = {};

  bool get _isEdit => widget.user != null;
  bool get _institutionRequired => _role != Role.admin;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final t = context.i18nRead;
    final api = context.read<Api>();

    setState(() {
      _generalError = null;
      _fieldErrors = {};
    });

    if (_institutionRequired && (_institutionId == null || _institutionId!.isEmpty)) {
      setState(() => _fieldErrors = {'institutionId': t.t('users.institutionRequired')});
      return;
    }

    setState(() => _saving = true);
    try {
      final payload = <String, Object?>{
        'name': _name.text.trim(),
        'email': _email.text.trim(),
        'role': _role.api,
        if (_institutionId != null && _institutionId!.isNotEmpty)
          'institutionId': _institutionId,
        'active': _active,
      };

      if (_isEdit) {
        await api.users.update(widget.user!.id, payload);
      } else {
        await api.users.create({...payload, 'password': _password.text});
      }

      if (!mounted) return;
      showToast(
        context,
        t.t(_isEdit ? 'users.updated' : 'users.created'),
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
            _isEdit ? t.t('users.edit') : t.t('users.new'),
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
            label: t.t('users.name'),
            required: true,
            error: _fieldErrors['name'],
            child: AppTextField(controller: _name, enabled: !_saving),
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: t.t('users.email'),
            required: true,
            error: _fieldErrors['email'],
            child: AppTextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              enabled: !_saving,
            ),
          ),
          if (!_isEdit) ...[
            const SizedBox(height: 12),
            LabeledField(
              label: t.t('users.password'),
              required: true,
              hint: t.t('auth.passwordTooShort'),
              error: _fieldErrors['password'],
              child: AppTextField(
                controller: _password,
                obscureText: true,
                enabled: !_saving,
              ),
            ),
          ],
          const SizedBox(height: 12),
          LabeledField(
            label: t.t('users.role'),
            required: true,
            hint: t.t('roles.${_role.api}_hint'),
            child: AppDropdown<Role>(
              value: _role,
              enabled: !_saving,
              onChanged: (value) => setState(() => _role = value ?? Role.viewer),
              items: [
                for (final role in Role.values)
                  (value: role, label: t.t('roles.${role.api}')),
              ],
            ),
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: t.t('users.institution'),
            required: _institutionRequired,
            error: _fieldErrors['institutionId'],
            child: AppDropdown<String?>(
              value: _institutionId,
              enabled: !_saving,
              invalid: _fieldErrors.containsKey('institutionId'),
              onChanged: (value) => setState(() => _institutionId = value),
              items: [
                (
                  value: null,
                  label: _institutionRequired ? t.t('common.select') : t.t('common.none'),
                ),
                for (final institution in widget.institutions)
                  (value: institution.id, label: institution.name),
              ],
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

class _ResetPasswordSheet extends StatefulWidget {
  const _ResetPasswordSheet({required this.user});

  final User user;

  @override
  State<_ResetPasswordSheet> createState() => _ResetPasswordSheetState();
}

class _ResetPasswordSheetState extends State<_ResetPasswordSheet> {
  final _password = TextEditingController();
  final _confirmation = TextEditingController();

  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _password.dispose();
    _confirmation.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final t = context.i18nRead;
    final api = context.read<Api>();

    if (_password.text.length < 8) {
      setState(() => _error = t.t('auth.passwordTooShort'));
      return;
    }
    if (_password.text != _confirmation.text) {
      setState(() => _error = t.t('auth.passwordMismatch'));
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await api.users.resetPassword(widget.user.id, _password.text);
      if (!mounted) return;
      showToast(context, t.t('users.passwordReset'), tone: AlertTone.success);
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
            '${t.t('users.resetPassword')} — ${widget.user.name}',
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
            label: t.t('auth.newPassword'),
            required: true,
            child: AppTextField(controller: _password, obscureText: true, enabled: !_saving),
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: t.t('auth.confirmPassword'),
            required: true,
            child: AppTextField(
              controller: _confirmation,
              obscureText: true,
              enabled: !_saving,
            ),
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
