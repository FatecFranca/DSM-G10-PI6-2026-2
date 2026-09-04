import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../services/api_services.dart';
import '../state/api_error_text.dart';
import '../state/auth_state.dart';
import '../state/i18n_state.dart';
import '../widgets/app_shell.dart';
import '../widgets/ui.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final _currentPassword = TextEditingController();
  final _newPassword = TextEditingController();
  final _confirmation = TextEditingController();

  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _currentPassword.dispose();
    _newPassword.dispose();
    _confirmation.dispose();
    super.dispose();
  }

  Future<void> _changePassword() async {
    final t = context.i18nRead;
    final api = context.read<Api>();

    setState(() => _error = null);

    if (_newPassword.text.length < 8) {
      setState(() => _error = t.t('auth.passwordTooShort'));
      return;
    }
    if (_newPassword.text != _confirmation.text) {
      setState(() => _error = t.t('auth.passwordMismatch'));
      return;
    }

    setState(() => _saving = true);
    try {
      await api.auth.changePassword(_currentPassword.text, _newPassword.text);
      if (!mounted) return;
      showToast(context, t.t('auth.passwordChanged'), tone: AlertTone.success);
      _currentPassword.clear();
      _newPassword.clear();
      _confirmation.clear();
    } catch (error) {
      if (mounted) setState(() => _error = describeApiError(t, error));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;
    final user = context.watch<AuthState>().user;

    if (user == null) return const SizedBox.shrink();

    return AppScaffold(
      title: t.t('auth.profile'),
      subtitle: t.t('auth.welcome', {'name': user.name}),
      child: AppStack(
        children: [
          AppCard(
            child: Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: colors.brandSoft,
                  child: Text(
                    user.initials,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: colors.brandDark,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user.name,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
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
                    ],
                  ),
                ),
              ],
            ),
          ),

          AppCard(
            child: DefinitionList(
              items: [
                (
                  term: t.t('auth.role'),
                  value: AppBadge(label: t.t('roles.${user.role.api}')),
                ),
                (
                  term: t.t('auth.institution'),
                  value: DefinitionValue(user.institution?.name ?? '—'),
                ),
                (
                  term: t.t('users.lastLogin'),
                  value: DefinitionValue(
                    user.lastLoginAt == null
                        ? t.t('common.never')
                        : t.formatDate(user.lastLoginAt, withTime: true),
                  ),
                ),
                (
                  term: t.t('roles.${user.role.api}'),
                  value: DefinitionValue(t.t('roles.${user.role.api}_hint')),
                ),
              ],
            ),
          ),

          AppCard(
            title: t.t('auth.changePassword'),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_error != null) ...[
                  AppAlert(tone: AlertTone.danger, message: _error!),
                  const SizedBox(height: 12),
                ],
                LabeledField(
                  label: t.t('auth.currentPassword'),
                  required: true,
                  child: AppTextField(
                    controller: _currentPassword,
                    obscureText: true,
                    enabled: !_saving,
                  ),
                ),
                const SizedBox(height: 12),
                LabeledField(
                  label: t.t('auth.newPassword'),
                  required: true,
                  hint: t.t('auth.passwordTooShort'),
                  child: AppTextField(
                    controller: _newPassword,
                    obscureText: true,
                    enabled: !_saving,
                  ),
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
                AppButton(
                  label: _saving ? t.t('common.saving') : t.t('common.save'),
                  variant: ButtonVariant.primary,
                  loading: _saving,
                  onPressed: _changePassword,
                ),
              ],
            ),
          ),

          AppButton(
            label: t.t('common.logout'),
            variant: ButtonVariant.ghost,
            icon: Icons.logout,
            block: true,
            onPressed: () => context.read<AuthState>().logout(),
          ),
        ],
      ),
    );
  }
}

class NotFoundPage extends StatelessWidget {
  const NotFoundPage({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.i18n;

    return AppScaffold(
      title: t.t('errors.notFoundTitle'),
      child: AppCard(
        child: EmptyState(
          icon: Icons.help_outline,
          title: t.t('errors.notFoundTitle'),
          hint: t.t('errors.notFoundHint'),
          action: AppButton(
            label: t.t('errors.goHome'),
            variant: ButtonVariant.primary,
            small: true,
            onPressed: () => context.go('/'),
          ),
        ),
      ),
    );
  }
}
