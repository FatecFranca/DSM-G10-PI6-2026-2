import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../state/api_error_text.dart';
import '../state/i18n_state.dart';
import 'ui.dart';

/// Permite que a tela peça uma recarga do [AsyncBuilder] (botão "tentar
/// novamente", puxar para atualizar, ou depois de gravar algo).
class AsyncController extends ChangeNotifier {
  void reload() => notifyListeners();
}

/// Carregamento assíncrono com os três estados da Web: carregando, erro e
/// dados — equivalente ao hook `useAsync`.
///
/// Como lá, uma resposta atrasada **não sobrescreve** a tela: cada requisição
/// recebe um número de sequência e só a mais recente é aplicada. Sem isso,
/// trocar de filtro rápido pode fazer a resposta antiga chegar por último e
/// exibir dado obsoleto.
class AsyncBuilder<T> extends StatefulWidget {
  const AsyncBuilder({
    super.key,
    required this.load,
    required this.builder,
    this.dependencies = const [],
    this.controller,
    this.loadingBuilder,
  });

  final Future<T> Function() load;
  final Widget Function(BuildContext context, T data) builder;

  /// Quando qualquer valor muda, recarrega (mesmo papel do array de
  /// dependências do `useAsync`).
  final List<Object?> dependencies;

  final AsyncController? controller;
  final WidgetBuilder? loadingBuilder;

  @override
  State<AsyncBuilder<T>> createState() => AsyncBuilderState<T>();
}

class AsyncBuilderState<T> extends State<AsyncBuilder<T>> {
  T? _data;
  Object? _error;
  bool _loading = true;
  int _sequence = 0;

  T? get data => _data;

  @override
  void initState() {
    super.initState();
    widget.controller?.addListener(reload);
    _run();
  }

  @override
  void didUpdateWidget(AsyncBuilder<T> oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (oldWidget.controller != widget.controller) {
      oldWidget.controller?.removeListener(reload);
      widget.controller?.addListener(reload);
    }

    if (!listEquals(oldWidget.dependencies, widget.dependencies)) _run();
  }

  @override
  void dispose() {
    widget.controller?.removeListener(reload);
    super.dispose();
  }

  void reload() => _run();

  Future<void> _run() async {
    final sequence = ++_sequence;
    if (mounted) setState(() => _loading = true);

    try {
      final result = await widget.load();
      if (!mounted || sequence != _sequence) return;
      setState(() {
        _data = result;
        _error = null;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || sequence != _sequence) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  /// Usado pelo "puxar para atualizar" do [AppScaffold].
  Future<void> refresh() => _run();

  @override
  Widget build(BuildContext context) {
    if (_loading && _data == null) {
      return widget.loadingBuilder?.call(context) ?? const LoadingState();
    }
    if (_error != null && _data == null) {
      return ErrorStateView(
        message: describeApiError(context.i18n, _error),
        onRetry: reload,
      );
    }
    if (_data == null) return const SizedBox.shrink();
    return widget.builder(context, _data as T);
  }
}
