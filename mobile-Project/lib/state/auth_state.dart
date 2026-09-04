import 'package:flutter/foundation.dart';

import '../core/api_client.dart';
import '../models/user.dart';
import '../services/api_services.dart';

/// Sessão do usuário: token, perfil e permissões derivadas do papel.
///
/// Espelha o `AuthContext` da Web. O token vai para o armazenamento seguro; o
/// perfil é relido da API a cada abertura do app, então um usuário desativado
/// ou rebaixado perde acesso sem esperar o token expirar.
class AuthState extends ChangeNotifier {
  AuthState(this._api) {
    _removeUnauthorizedListener = _api.client.onUnauthorized(_onUnauthorized);
  }

  final Api _api;
  late final VoidCallback _removeUnauthorizedListener;

  User? _user;
  bool _loading = true;

  User? get user => _user;
  bool get loading => _loading;
  bool get authenticated => _user != null;
  Permissions get can => Permissions(_user?.role);

  /// Restaura a sessão na abertura do app.
  Future<void> restore() async {
    final token = await _api.client.tokens.read();
    if (token == null || token.isEmpty) {
      _user = null;
      _loading = false;
      notifyListeners();
      return;
    }

    try {
      _user = await _api.auth.me();
    } on ApiException catch (error) {
      if (error.isAuthExpired) await _api.client.tokens.clear();
      _user = null;
    } catch (_) {
      _user = null;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> login(String email, String password) async {
    final response = await _api.auth.login(email, password);
    await _api.client.tokens.write(response.token);
    _user = await _api.auth.me();
    _loading = false;
    notifyListeners();
  }

  Future<void> logout() async {
    await _api.client.tokens.clear();
    _user = null;
    _loading = false;
    notifyListeners();
  }

  /// Relê o perfil (usado depois de trocar a própria senha, por exemplo).
  Future<void> refresh() async {
    if (!authenticated) return;
    try {
      _user = await _api.auth.me();
      notifyListeners();
    } on ApiException catch (error) {
      if (error.isAuthExpired) await logout();
    }
  }

  void _onUnauthorized() {
    if (_user == null) return;
    _user = null;
    _loading = false;
    _api.client.tokens.clear();
    notifyListeners();
  }

  @override
  void dispose() {
    _removeUnauthorizedListener();
    super.dispose();
  }
}
