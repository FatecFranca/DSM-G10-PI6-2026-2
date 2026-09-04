import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../state/api_error_text.dart';
import '../state/auth_state.dart';
import '../state/i18n_state.dart';
import '../widgets/app_shell.dart';
import '../widgets/ui.dart';

/// Tela de acesso.
///
/// O painel de marca da Web (`.auth__brand`, com os três destaques) não é
/// reproduzido: o próprio `global.css` o esconde abaixo de 860px e mostra a
/// marca compacta — que é o que o [AuthScaffold] faz.
class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _email = TextEditingController();
  final _password = TextEditingController();

  bool _submitting = false;
  bool _showPassword = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final t = context.i18nRead;
    setState(() {
      _error = null;
      _submitting = true;
    });

    try {
      await context.read<AuthState>().login(_email.text.trim(), _password.text);
      // A navegação é feita pelo redirect do go_router, que observa o AuthState.
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = describeApiError(t, error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;

    return AuthScaffold(
      title: t.t('auth.loginTitle'),
      subtitle: t.t('auth.loginSubtitle'),
      showLocalePicker: true,
      footer: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline, size: 14, color: colors.textSubtle),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              t.t('analysis.supportTool'),
              style: TextStyle(
                fontSize: AppSizes.fontLabel,
                height: 1.6,
                color: colors.textSubtle,
              ),
            ),
          ),
        ],
      ),
      child: Column(
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
              textInputAction: TextInputAction.next,
              enabled: !_submitting,
            ),
          ),
          const SizedBox(height: 15),
          LabeledField(
            label: t.t('auth.password'),
            required: true,
            child: AppTextField(
              controller: _password,
              obscureText: !_showPassword,
              enabled: !_submitting,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _submit(),
              suffix: IconButton(
                onPressed: () => setState(() => _showPassword = !_showPassword),
                tooltip: t.t(_showPassword ? 'auth.hidePassword' : 'auth.showPassword'),
                icon: Icon(
                  _showPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                  size: 19,
                  color: colors.textMuted,
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
          AppButton(
            label: _submitting ? t.t('auth.submitting') : t.t('auth.submit'),
            variant: ButtonVariant.primary,
            block: true,
            loading: _submitting,
            onPressed: _submit,
          ),
          const SizedBox(height: 14),
          Center(
            child: TextButton(
              onPressed: () => context.push('/forgot-password'),
              child: Text(
                t.t('auth.forgotPasswordLink'),
                style: TextStyle(fontSize: AppSizes.fontSmall, color: colors.brand),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
