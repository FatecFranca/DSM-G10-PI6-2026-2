import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../state/auth_state.dart';
import '../state/i18n_state.dart';
import '../state/theme_state.dart';

class _NavItem {
  const _NavItem(this.route, this.labelKey, this.icon, {this.exact = false});

  final String route;
  final String labelKey;
  final IconData icon;
  final bool exact;
}

const _mainItems = [
  _NavItem('/', 'nav.dashboard', Icons.dashboard_outlined, exact: true),
  _NavItem('/students', 'nav.students', Icons.people_outline),
  _NavItem('/analysis', 'nav.analysis', Icons.insights_outlined),
  _NavItem('/data-mining', 'nav.dataMining', Icons.donut_small_outlined),
  _NavItem('/follow-ups', 'nav.followUps', Icons.checklist_outlined),
];

const _adminItems = [
  _NavItem('/admin/users', 'nav.users', Icons.manage_accounts_outlined),
  _NavItem('/admin/institutions', 'nav.institutions', Icons.apartment_outlined),
];

class AppScaffold extends StatelessWidget {
  const AppScaffold({
    super.key,
    required this.title,
    this.subtitle,
    this.actions,
    this.floatingActionButton,
    this.onRefresh,
    required this.child,
  });

  final String title;
  final String? subtitle;
  final List<Widget>? actions;
  final Widget? floatingActionButton;

  final Future<void> Function()? onRefresh;

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    final content = SingleChildScrollView(
      physics: onRefresh == null
          ? null
          : const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      padding: const EdgeInsets.fromLTRB(
        AppSizes.contentPadding,
        AppSizes.contentPadding,
        AppSizes.contentPadding,
        32,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PageHeader(title: title, subtitle: subtitle, actions: actions),
          const SizedBox(height: AppSizes.gap),
          child,
        ],
      ),
    );

    return Scaffold(
      backgroundColor: colors.bg,
      appBar: const AppTopBar(),
      drawer: const AppDrawer(),
      floatingActionButton: floatingActionButton,
      body: onRefresh == null
          ? content
          : RefreshIndicator(
              onRefresh: onRefresh!,
              color: colors.brand,
              backgroundColor: colors.surface,
              child: content,
            ),
    );
  }
}

class AppTopBar extends StatelessWidget implements PreferredSizeWidget {
  const AppTopBar({super.key});

  @override
  Size get preferredSize => const Size.fromHeight(56);

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;
    final auth = context.watch<AuthState>();
    final theme = context.watch<ThemeState>();
    final user = auth.user;

    return AppBar(
      title: Row(
        children: [
          _BrandMark(size: 28, fontSize: 11),
          const SizedBox(width: 9),
          Expanded(
            child: Text(
              t.t('app.short'),
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: colors.text),
            ),
          ),
        ],
      ),
      actions: [
        IconButton(
          onPressed: () => context.read<ThemeState>().toggle(),
          icon: Icon(theme.isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined, size: 19),
          tooltip: t.t(theme.isDark ? 'common.switchToLight' : 'common.switchToDark'),
        ),
        PopupMenuButton<AppLocale>(
          tooltip: t.t('common.language'),
          initialValue: t.locale,
          color: colors.surface,
          onSelected: (locale) => context.read<I18nState>().setLocale(locale),
          itemBuilder: (_) => [
            for (final locale in AppLocale.values)
              PopupMenuItem(value: locale, child: Text(locale.label)),
          ],
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Center(
              child: Text(
                t.locale.short,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: colors.textMuted,
                ),
              ),
            ),
          ),
        ),
        if (user != null)
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: IconButton(
              onPressed: () => context.push('/profile'),
              tooltip: user.name,
              icon: CircleAvatar(
                radius: 15,
                backgroundColor: colors.brandSoft,
                child: Text(
                  user.initials,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: colors.brandDark,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class AppDrawer extends StatelessWidget {
  const AppDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.i18n;
    final auth = context.watch<AuthState>();
    final can = auth.can;
    final location = GoRouterState.of(context).uri.path;

    final visibleAdmin = [
      if (can.manageUsers) _adminItems[0],
      if (can.manageInstitutions) _adminItems[1],
    ];

    return Drawer(
      width: 268,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 18, 14, 18),
              child: Row(
                children: [
                  _BrandMark(size: 34, fontSize: 13),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          t.t('app.title'),
                          style: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                            height: 1.25,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          t.t('app.subtitle'),
                          style: const TextStyle(
                            fontSize: 10.5,
                            color: AppColors.sidebarTextMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                children: [
                  for (final item in _mainItems)
                    _DrawerLink(item: item, currentLocation: location),
                  if (visibleAdmin.isNotEmpty) ...[
                    Padding(
                      padding: const EdgeInsets.fromLTRB(10, 18, 10, 6),
                      child: Text(
                        t.t('nav.administration').toUpperCase(),
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.9,
                          color: AppColors.sidebarTextMuted,
                        ),
                      ),
                    ),
                    for (final item in visibleAdmin)
                      _DrawerLink(item: item, currentLocation: location),
                  ],
                ],
              ),
            ),
            const Divider(color: AppColors.sidebarBorder, height: 1),
            ListTile(
              dense: true,
              leading: const Icon(Icons.logout, size: 19, color: AppColors.sidebarText),
              title: Text(
                t.t('common.logout'),
                style: const TextStyle(fontSize: 14, color: AppColors.sidebarText),
              ),
              subtitle: auth.user == null
                  ? null
                  : Text(
                      '${auth.user!.name} · ${t.t('roles.${auth.user!.role.api}')}',
                      style: const TextStyle(fontSize: 11, color: AppColors.sidebarTextMuted),
                    ),
              onTap: () async {
                Navigator.of(context).pop();
                await context.read<AuthState>().logout();
              },
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: Text(
                t.t('app.programNote'),
                style: const TextStyle(fontSize: 10.5, color: AppColors.sidebarTextMuted),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DrawerLink extends StatelessWidget {
  const _DrawerLink({required this.item, required this.currentLocation});

  final _NavItem item;
  final String currentLocation;

  @override
  Widget build(BuildContext context) {
    final active = item.exact
        ? currentLocation == item.route
        : currentLocation.startsWith(item.route);

    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Material(
        color: active ? context.colors.brand : Colors.transparent,
        borderRadius: BorderRadius.circular(AppSizes.radiusSm),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppSizes.radiusSm),
          onTap: () {
            Navigator.of(context).pop();
            if (!active) context.go(item.route);
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 11),
            child: Row(
              children: [
                Icon(
                  item.icon,
                  size: 18,
                  color: active ? Colors.white : AppColors.sidebarText,
                ),
                const SizedBox(width: 10),
                Text(
                  context.i18n.t(item.labelKey),
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                    color: active ? Colors.white : AppColors.sidebarText,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _BrandMark extends StatelessWidget {
  const _BrandMark({required this.size, required this.fontSize});

  final double size;
  final double fontSize;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: context.colors.brand,
          borderRadius: BorderRadius.circular(size * 0.26),
        ),
        child: Text(
          context.i18n.t('app.short'),
          style: TextStyle(
            fontSize: fontSize,
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
      );
}

class PageHeader extends StatelessWidget {
  const PageHeader({super.key, required this.title, this.subtitle, this.actions});

  final String title;
  final String? subtitle;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(
            fontSize: AppSizes.fontPageTitle,
            fontWeight: FontWeight.w700,
            height: 1.25,
            color: colors.text,
          ),
        ),
        if (subtitle != null)
          Padding(
            padding: const EdgeInsets.only(top: 3),
            child: Text(
              subtitle!,
              style: TextStyle(fontSize: 13, color: colors.textMuted),
            ),
          ),
        if (actions?.isNotEmpty ?? false)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Wrap(spacing: 8, runSpacing: 8, children: actions!),
          ),
      ],
    );
  }
}

class AuthScaffold extends StatelessWidget {
  const AuthScaffold({
    super.key,
    required this.title,
    required this.subtitle,
    required this.child,
    this.footer,
    this.showLocalePicker = false,
  });

  final String title;
  final String subtitle;
  final Widget child;
  final Widget? footer;
  final bool showLocalePicker;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final t = context.i18n;
    final theme = context.watch<ThemeState>();

    return Scaffold(
      backgroundColor: colors.bg,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 12, 0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  IconButton(
                    onPressed: () => context.read<ThemeState>().toggle(),
                    icon: Icon(
                      theme.isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
                      size: 19,
                    ),
                    tooltip: t.t(theme.isDark ? 'common.switchToLight' : 'common.switchToDark'),
                  ),
                  if (showLocalePicker)
                    PopupMenuButton<AppLocale>(
                      tooltip: t.t('common.language'),
                      initialValue: t.locale,
                      color: colors.surface,
                      onSelected: (locale) => context.read<I18nState>().setLocale(locale),
                      itemBuilder: (_) => [
                        for (final locale in AppLocale.values)
                          PopupMenuItem(value: locale, child: Text(locale.label)),
                      ],
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                        child: Text(
                          t.locale.short,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: colors.textMuted,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 420),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            _BrandMark(size: 34, fontSize: 13),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    t.t('app.title'),
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: colors.text,
                                    ),
                                  ),
                                  Text(
                                    t.t('app.subtitle'),
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
                        const SizedBox(height: 28),
                        Text(
                          title,
                          style: TextStyle(
                            fontSize: 21,
                            fontWeight: FontWeight.w700,
                            color: colors.text,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          subtitle,
                          style: TextStyle(fontSize: 13.5, color: colors.textMuted),
                        ),
                        const SizedBox(height: 24),
                        child,
                        if (footer != null) ...[
                          const SizedBox(height: 26),
                          const Divider(height: 1),
                          const SizedBox(height: 18),
                          footer!,
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
