import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../services/api_services.dart';
import '../state/api_error_text.dart';
import '../state/i18n_state.dart';
import '../widgets/app_shell.dart';
import '../widgets/ui.dart';

class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({super.key});

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  final _email = TextEditingController();

  bool _submitting = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final t = context.i18nRead;
    setState(() {
      _error = null;
      _submitting = true;
    });

    try {
      await context.read<Api>().auth.forgotPassword(_email.text.trim());
      if (mounted) setState(() => _sent = true);
    } catch (error) {
      if (mounted) setState(() => _error = describeApiError(t, error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;

    return AuthScaffold(
      title: t.t('auth.forgotPasswordTitle'),
      subtitle: t.t('auth.forgotPasswordSubtitle'),
      footer: TextButton(
        onPressed: () => context.go('/login'),
        child: Text(
          '← ${t.t('auth.backToLogin')}',
          style: TextStyle(fontSize: AppSizes.fontSmall, color: colors.brand),
        ),
      ),
      child: _sent
          ? AppAlert(tone: AlertTone.success, message: t.t('auth.forgotPasswordSent'))
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_error != null) ...[
                  AppAlert(tone: AlertTone.danger, message: _error!),
                  const SizedBox(height: 15),
                ],
                LabeledField(
                  label: t.t('auth.email'),
                  required: true,
                  child: AppTextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    hintText: 'nome@instituicao.org',
                    enabled: !_submitting,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _submit(),
                  ),
                ),
                const SizedBox(height: 20),
                AppButton(
                  label: _submitting
                      ? t.t('auth.forgotPasswordSubmitting')
                      : t.t('auth.forgotPasswordSubmit'),
                  variant: ButtonVariant.primary,
                  block: true,
                  loading: _submitting,
                  onPressed: _submit,
                ),
              ],
            ),
    );
  }
}

class ResetPasswordPage extends StatefulWidget {
  const ResetPasswordPage({super.key, required this.token});

  final String token;

  @override
  State<ResetPasswordPage> createState() => _ResetPasswordPageState();
}

class _ResetPasswordPageState extends State<ResetPasswordPage> {
  late final TextEditingController _token = TextEditingController(text: widget.token);
  final _password = TextEditingController();
  final _confirmation = TextEditingController();

  bool _submitting = false;
  bool _done = false;
  String? _error;

  @override
  void dispose() {
    _token.dispose();
    _password.dispose();
    _confirmation.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final t = context.i18nRead;
    setState(() => _error = null);

    if (_password.text.length < 8) {
      setState(() => _error = t.t('auth.passwordTooShort'));
      return;
    }
    if (_password.text != _confirmation.text) {
      setState(() => _error = t.t('auth.passwordMismatch'));
      return;
    }

    setState(() => _submitting = true);
    try {
      await context.read<Api>().auth.resetPassword(_token.text.trim(), _password.text);
      if (mounted) setState(() => _done = true);
    } catch (error) {
      if (mounted) setState(() => _error = describeApiError(t, error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;

    return AuthScaffold(
      title: t.t('auth.resetPasswordTitle'),
      subtitle: t.t('auth.resetPasswordSubtitle'),
      footer: TextButton(
        onPressed: () => context.go('/login'),
        child: Text(
          '← ${t.t('auth.backToLogin')}',
          style: TextStyle(fontSize: AppSizes.fontSmall, color: colors.brand),
        ),
      ),
      child: _done
          ? AppAlert(tone: AlertTone.success, message: t.t('auth.resetPasswordSuccess'))
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_error != null) ...[
                  AppAlert(tone: AlertTone.danger, message: _error!),
                  const SizedBox(height: 15),
                ],
                if (widget.token.isEmpty) ...[
                  AppAlert(
                    tone: AlertTone.warning,
                    message: t.t('auth.resetPasswordTokenMissing'),
                  ),
                  const SizedBox(height: 15),
                  LabeledField(
                    label: 'Token',
                    required: true,
                    child: AppTextField(controller: _token, enabled: !_submitting),
                  ),
                  const SizedBox(height: 15),
                ],
                LabeledField(
                  label: t.t('auth.newPassword'),
                  required: true,
                  child: AppTextField(
                    controller: _password,
                    obscureText: true,
                    enabled: !_submitting,
                  ),
                ),
                const SizedBox(height: 15),
                LabeledField(
                  label: t.t('auth.confirmPassword'),
                  required: true,
                  child: AppTextField(
                    controller: _confirmation,
                    obscureText: true,
                    enabled: !_submitting,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _submit(),
                  ),
                ),
                const SizedBox(height: 20),
                AppButton(
                  label: _submitting
                      ? t.t('auth.resetPasswordSubmitting')
                      : t.t('auth.resetPasswordSubmit'),
                  variant: ButtonVariant.primary,
                  block: true,
                  loading: _submitting,
                  onPressed: _submit,
                ),
              ],
            ),
    );
  }
}
