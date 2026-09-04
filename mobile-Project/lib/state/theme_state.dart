import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Tema claro/escuro, com a mesma preferência padrão da Web: **escuro**.
///
/// Guardado em `SharedPreferences` — é configuração simples, não dado sensível
/// (seção 4 e seção 10 do `.IA/CONTEXT.md`).
class ThemeState extends ChangeNotifier {
  static const _storageKey = 'pi6.theme';

  Brightness _brightness = Brightness.dark;

  Brightness get brightness => _brightness;
  bool get isDark => _brightness == Brightness.dark;
  ThemeMode get mode => isDark ? ThemeMode.dark : ThemeMode.light;

  Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _brightness = prefs.getString(_storageKey) == 'light' ? Brightness.light : Brightness.dark;
      notifyListeners();
    } catch (error) {
      debugPrint('[theme] não foi possível ler o tema salvo: $error');
    }
  }

  Future<void> toggle() async {
    _brightness = isDark ? Brightness.light : Brightness.dark;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_storageKey, isDark ? 'dark' : 'light');
    } catch (error) {
      debugPrint('[theme] não foi possível salvar o tema: $error');
    }
  }
}
