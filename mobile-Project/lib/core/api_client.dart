import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import 'config.dart';

/// Erro estruturado devolvido pela API principal.
///
/// Espelha `frontend-Project/src/services/api.ts`: o back-end responde sempre
/// `{ error, message, details }`, e é o `error` (código) que a interface traduz.
class ApiException implements Exception {
  ApiException(this.status, this.code, this.message, [this.details]);

  final int status;
  final String code;
  final String message;
  final Object? details;

  bool get isAuthExpired => status == 401;

  /// Lista `[{ field, message }]` de erros de validação por campo, quando houver.
  Map<String, String> get fieldIssues {
    final raw = details;
    if (raw is! List) return {};

    final issues = <String, String>{};
    for (final item in raw) {
      if (item is Map && item['field'] is String && item['message'] is String) {
        issues[item['field'] as String] = item['message'] as String;
      }
    }
    return issues;
  }

  @override
  String toString() => 'ApiException($status, $code): $message';
}

/// Guarda o token de sessão.
///
/// `flutter_secure_storage` (Keystore no Android, Keychain no iOS) e não
/// `SharedPreferences`: a seção 4 do `.IA/CONTEXT.md` é explícita em que
/// `SharedPreferences` não é apropriado para token/credencial, por não ser
/// criptografado.
class TokenStorage {
  static const _key = 'pi6.auth.token';
  // Keystore no Android, Keychain no iOS — as opcoes padrao do pacote ja
  // usam o armazenamento criptografado de cada plataforma.
  static const _storage = FlutterSecureStorage();

  Future<String?> read() async {
    try {
      return await _storage.read(key: _key);
    } catch (error) {
      debugPrint('[auth] falha ao ler o token seguro: $error');
      return null;
    }
  }

  Future<void> write(String token) async {
    try {
      await _storage.write(key: _key, value: token);
    } catch (error) {
      debugPrint('[auth] falha ao gravar o token seguro: $error');
    }
  }

  /// Remoção segura no logout (seção 9 do `.IA/CONTEXT.md`).
  Future<void> clear() async {
    try {
      await _storage.delete(key: _key);
    } catch (error) {
      debugPrint('[auth] falha ao remover o token seguro: $error');
    }
  }
}

/// Cliente HTTP central do aplicativo.
///
/// **Nenhuma tela chama `http` diretamente** — toda rede passa por aqui e pelos
/// serviços de `lib/services/`, que é o que mantém verificável a regra de não
/// espalhar URLs nem duplicar chamadas (seção 14, item 5 do `.IA/CONTEXT.md`).
class ApiClient {
  ApiClient({http.Client? client, TokenStorage? tokenStorage})
      : _client = client ?? http.Client(),
        _tokens = tokenStorage ?? TokenStorage();

  final http.Client _client;
  final TokenStorage _tokens;

  /// Notificado quando a API devolve 401 fora da tela de login: a sessão caiu e
  /// o app precisa voltar para o login (equivalente ao `onUnauthorized` da Web).
  final List<VoidCallback> _unauthorizedListeners = [];

  TokenStorage get tokens => _tokens;

  VoidCallback onUnauthorized(VoidCallback listener) {
    _unauthorizedListeners.add(listener);
    return () => _unauthorizedListeners.remove(listener);
  }

  Uri _buildUri(String path, Map<String, Object?>? query) {
    final normalized = path.startsWith('/') ? path.substring(1) : path;
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/$normalized');

    if (query == null || query.isEmpty) return uri;

    final params = <String, String>{};
    query.forEach((key, value) {
      if (value == null || value == '') return;
      params[key] = '$value';
    });

    return uri.replace(queryParameters: {...uri.queryParameters, ...params});
  }

  Future<T> _request<T>(
    String method,
    String path, {
    Object? body,
    Map<String, Object?>? query,
    bool skipAuthRedirect = false,
  }) async {
    final token = await _tokens.read();

    final headers = <String, String>{
      'Accept': 'application/json',
      if (body != null) 'Content-Type': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };

    final uri = _buildUri(path, query);
    final request = http.Request(method, uri)..headers.addAll(headers);
    if (body != null) request.body = jsonEncode(body);

    http.Response response;
    try {
      final streamed = await _client.send(request).timeout(AppConfig.requestTimeout);
      response = await http.Response.fromStream(streamed);
    } on TimeoutException {
      throw ApiException(
        0,
        'ML_SERVICE_TIMEOUT',
        'O servidor demorou além do limite para responder.',
      );
    } catch (error) {
      throw ApiException(
        0,
        'NETWORK_ERROR',
        'Não foi possível se conectar ao servidor. '
            'Verifique sua conexão ou se a API está no ar.',
      );
    }

    if (response.statusCode == 204 || response.bodyBytes.isEmpty) {
      return null as T;
    }

    final text = utf8.decode(response.bodyBytes);
    final Object? payload = _safeParse(text);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final errorBody = payload is Map<String, dynamic> ? payload : const <String, dynamic>{};

      if (response.statusCode == 401 && !skipAuthRedirect) {
        for (final listener in List<VoidCallback>.from(_unauthorizedListeners)) {
          listener();
        }
      }

      throw ApiException(
        response.statusCode,
        errorBody['error'] as String? ?? 'HTTP_${response.statusCode}',
        errorBody['message'] as String? ?? 'Não foi possível concluir a operação.',
        errorBody['details'],
      );
    }

    return payload as T;
  }

  static Object? _safeParse(String text) {
    try {
      return jsonDecode(text);
    } catch (_) {
      return null;
    }
  }

  Future<T> get<T>(String path, [Map<String, Object?>? query]) =>
      _request<T>('GET', path, query: query);

  Future<T> post<T>(String path, [Object? body, bool skipAuthRedirect = false]) =>
      _request<T>('POST', path, body: body, skipAuthRedirect: skipAuthRedirect);

  Future<T> patch<T>(String path, [Object? body]) => _request<T>('PATCH', path, body: body);

  Future<T> delete<T>(String path) => _request<T>('DELETE', path);
}
