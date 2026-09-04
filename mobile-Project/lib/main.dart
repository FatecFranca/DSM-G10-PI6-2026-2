import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';

import 'core/api_client.dart';
import 'core/theme.dart';
import 'router.dart';
import 'services/api_services.dart';
import 'state/auth_state.dart';
import 'state/i18n_state.dart';
import 'state/theme_state.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  for (final locale in AppLocale.values) {
    await initializeDateFormatting(locale.intlCode);
  }

  final api = Api(ApiClient());
  final i18n = I18nState();
  final theme = ThemeState();

  await Future.wait([i18n.load(), theme.load()]);

  final auth = AuthState(api);
  unawaited(auth.restore());

  runApp(
    MultiProvider(
      providers: [
        Provider<Api>.value(value: api),
        ChangeNotifierProvider<I18nState>.value(value: i18n),
        ChangeNotifierProvider<ThemeState>.value(value: theme),
        ChangeNotifierProvider<AuthState>.value(value: auth),
      ],
      child: PaeApp(auth: auth),
    ),
  );
}

class PaeApp extends StatefulWidget {
  const PaeApp({super.key, required this.auth});

  final AuthState auth;

  @override
  State<PaeApp> createState() => _PaeAppState();
}

class _PaeAppState extends State<PaeApp> {
  late final GoRouter _router = buildRouter(widget.auth);

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeState>();
    final i18n = context.watch<I18nState>();

    return MaterialApp.router(
      title: i18n.t('app.title'),
      debugShowCheckedModeBanner: false,
      routerConfig: _router,
      themeMode: theme.mode,
      theme: buildAppTheme(Brightness.light),
      darkTheme: buildAppTheme(Brightness.dark),
      locale: i18n.locale.flutterLocale,
      supportedLocales: [for (final locale in AppLocale.values) locale.flutterLocale],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    );
  }
}
