import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'models/enums.dart';
import 'pages/admin_institutions_page.dart';
import 'pages/admin_users_page.dart';
import 'pages/analysis_page.dart';
import 'pages/dashboard_page.dart';
import 'pages/data_mining_page.dart';
import 'pages/follow_ups_page.dart';
import 'pages/forgot_password_page.dart';
import 'pages/login_page.dart';
import 'pages/profile_page.dart';
import 'pages/student_detail_page.dart';
import 'pages/student_form_page.dart';
import 'pages/students_page.dart';
import 'state/auth_state.dart';
import 'state/i18n_state.dart';
import 'widgets/app_shell.dart';
import 'widgets/ui.dart';

/// Rotas do aplicativo, com os **mesmos caminhos** do `frontend-Project`.
///
/// Manter `/students/:id`, `/data-mining`, `/admin/users` e companhia iguais aos
/// da Web não é enfeite: é o que permite falar de uma tela por endereço entre as
/// duas plataformas.
GoRouter buildRouter(AuthState auth) {
  return GoRouter(
    initialLocation: '/',

    // O roteador reavalia o redirecionamento sempre que a sessão muda: entrar
    // leva ao painel e sair (ou um 401 vindo da API) devolve ao login, sem que
    // nenhuma tela precise navegar na mão.
    refreshListenable: auth,

    redirect: (context, state) {
      final path = state.matchedLocation;
      final isAuthRoute = path == '/login' ||
          path == '/forgot-password' ||
          path.startsWith('/reset-password');

      if (auth.loading) return null;

      if (!auth.authenticated) return isAuthRoute ? null : '/login';
      if (isAuthRoute) return '/';
      return null;
    },

    routes: [
      GoRoute(path: '/login', builder: (_, _) => const LoginPage()),
      GoRoute(path: '/forgot-password', builder: (_, _) => const ForgotPasswordPage()),
      GoRoute(
        path: '/reset-password',
        builder: (_, state) => ResetPasswordPage(
          token: state.uri.queryParameters['token'] ?? '',
        ),
      ),

      GoRoute(path: '/', builder: (_, _) => const DashboardPage()),

      GoRoute(path: '/students', builder: (_, _) => const StudentsPage()),
      GoRoute(
        path: '/students/new',
        builder: (_, _) => const _RoleGuard(
          roles: [Role.admin, Role.analyst],
          child: StudentFormPage(),
        ),
      ),
      GoRoute(
        path: '/students/:id',
        builder: (_, state) => StudentDetailPage(
          studentId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/students/:id/edit',
        builder: (_, state) => _RoleGuard(
          roles: const [Role.admin, Role.analyst],
          child: StudentFormPage(studentId: state.pathParameters['id']),
        ),
      ),

      GoRoute(path: '/analysis', builder: (_, _) => const AnalysisPage()),
      GoRoute(path: '/data-mining', builder: (_, _) => const DataMiningPage()),
      GoRoute(path: '/follow-ups', builder: (_, _) => const FollowUpsPage()),
      GoRoute(path: '/profile', builder: (_, _) => const ProfilePage()),

      GoRoute(
        path: '/admin/users',
        builder: (_, _) => const _RoleGuard(
          roles: [Role.admin],
          child: AdminUsersPage(),
        ),
      ),
      GoRoute(
        path: '/admin/institutions',
        builder: (_, _) => const _RoleGuard(
          roles: [Role.admin],
          child: AdminInstitutionsPage(),
        ),
      ),
    ],

    errorBuilder: (_, _) => const NotFoundPage(),
  );
}

/// Esconde uma tela de quem não tem papel para ela.
///
/// Isto é **experiência de uso**: a autorização real está no Back-End, que
/// recusaria a requisição de qualquer forma.
class _RoleGuard extends StatelessWidget {
  const _RoleGuard({required this.roles, required this.child});

  final List<Role> roles;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final role = context.watch<AuthState>().user?.role;

    if (role == null) return const SizedBox.shrink();
    if (roles.contains(role)) return child;

    return AppScaffold(
      title: context.i18n.t('errors.notFoundTitle'),
      child: AppAlert(
        tone: AlertTone.danger,
        message: context.i18n.t('errors.INSUFFICIENT_ROLE'),
      ),
    );
  }
}
