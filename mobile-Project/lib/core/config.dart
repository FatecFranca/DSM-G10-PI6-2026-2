import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';

abstract final class AppConfig {
  static const String _override = String.fromEnvironment('API_BASE_URL');

  static String get apiBaseUrl {
    if (_override.isNotEmpty) return _stripTrailingSlash(_override);
    if (!kIsWeb && Platform.isAndroid) return 'http://10.0.2.2:3004/api';
    return 'http://localhost:3004/api';
  }

  static String _stripTrailingSlash(String url) =>
      url.endsWith('/') ? url.substring(0, url.length - 1) : url;

  static const Duration requestTimeout = Duration(seconds: 45);
}
