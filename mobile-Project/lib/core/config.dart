import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';

/// Configuração de ambiente do aplicativo.
///
/// Equivalente ao `VITE_API_BASE_URL` do `frontend-Project`: existe **uma única**
/// URL de API, sempre apontando para o `backend-Project`. Não há — e não deve
/// haver — configuração apontando para o `backend-MD`: o app nunca fala com o
/// serviço de IA diretamente (seção 6 do `.IA/CONTEXT.md` do Front-End Web e
/// seção 7 do `.IA/CONTEXT.md` do Mobile).
///
/// Tudo que é embarcado no APK é público: **nenhum segredo aqui**.
abstract final class AppConfig {
  /// Definido em tempo de compilação:
  ///
  /// ```bash
  /// flutter run --dart-define=API_BASE_URL=http://192.168.0.10:3004/api
  /// ```
  static const String _override = String.fromEnvironment('API_BASE_URL');

  /// URL da API principal.
  ///
  /// O padrão muda por plataforma porque `localhost` significa coisas
  /// diferentes em cada uma: no emulador Android ele aponta para o próprio
  /// emulador, e a máquina que hospeda o `backend-Project` é `10.0.2.2`. Em
  /// aparelho físico nenhum dos dois serve — passe o IP da máquina na rede
  /// local via `--dart-define`.
  static String get apiBaseUrl {
    if (_override.isNotEmpty) return _stripTrailingSlash(_override);
    if (!kIsWeb && Platform.isAndroid) return 'http://10.0.2.2:3004/api';
    return 'http://localhost:3004/api';
  }

  static String _stripTrailingSlash(String url) =>
      url.endsWith('/') ? url.substring(0, url.length - 1) : url;

  /// Tempo máximo de espera por uma resposta da API principal.
  ///
  /// Precisa ser maior que o `MD_TIMEOUT_MS` do `backend-Project` (40s), porque
  /// uma análise atravessa `backend-Project` -> `backend-MD` -> processo Python.
  static const Duration requestTimeout = Duration(seconds: 45);
}
