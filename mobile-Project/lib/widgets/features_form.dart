import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/theme.dart';
import '../models/feature_contract.dart';
import '../state/i18n_state.dart';
import 'ui.dart';

/// Formulário dos atributos do modelo — equivalente a
/// `frontend-Project/src/components/FeaturesForm.tsx`.
///
/// **Ele não conhece as 36 colunas.** É gerado a partir do contrato devolvido
/// por `GET /api/students/feature-contract`, que repassa o contrato do
/// `backend-MD`. Se o modelo for retreinado com outro conjunto de atributos, a
/// tela acompanha sozinha.

/// Campos de nota que aceitam alternância de escala.
const _gradeScaleFields = {
  'curricular_units_1st_sem_grade',
  'curricular_units_2nd_sem_grade',
  'previous_qualification_grade',
  'admission_grade',
};

/// Agrupamento visual em cinco blocos — a mesma divisão da Web. É organização
/// de tela: o modelo trata as 36 variáveis juntas, sem "blocos".
const _groups = <({String id, String titleKey, List<String> names, String? contains})>[
  (id: 'academic1', titleKey: 'students.featureGroups.academic1', names: [], contains: '1st_sem'),
  (id: 'academic2', titleKey: 'students.featureGroups.academic2', names: [], contains: '2nd_sem'),
  (
    id: 'admission',
    titleKey: 'students.featureGroups.admission',
    names: [
      'application_mode',
      'application_order',
      'course',
      'daytime_evening_attendance',
      'previous_qualification',
      'previous_qualification_grade',
      'admission_grade',
      'age_at_enrollment',
    ],
    contains: null,
  ),
  (
    id: 'social',
    titleKey: 'students.featureGroups.social',
    names: [
      'marital_status',
      'nationality',
      'international',
      'displaced',
      'educational_special_needs',
      'debtor',
      'tuition_fees_up_to_date',
      'gender',
      'scholarship_holder',
      'mothers_qualification',
      'fathers_qualification',
      'mothers_occupation',
      'fathers_occupation',
    ],
    contains: null,
  ),
  // Bloco "pega o que sobrou", como o `match: () => true` da Web.
  (id: 'macro', titleKey: 'students.featureGroups.macro', names: [], contains: null),
];

double _round2(double value) => (value * 100).round() / 100;

/// Valores iniciais: o que já estiver salvo, ou vazio.
Map<String, double?> initialFeatureValues(
  List<FeatureSpec> features,
  Map<String, double>? saved,
) {
  return {for (final feature in features) feature.name: saved?[feature.name]};
}

/// Preenche apenas o que estiver vazio com a média observada no treino.
Map<String, double?> fillWithMeans(
  List<FeatureSpec> features,
  Map<String, double?> values,
) {
  final filled = Map<String, double?>.from(values);
  for (final feature in features) {
    if (filled[feature.name] == null) {
      filled[feature.name] =
          feature.isInt ? feature.mean.roundToDouble() : _round2(feature.mean);
    }
  }
  return filled;
}

/// Descarta os vazios e devolve o mapa enviado à API.
Map<String, double> toFeaturePayload(Map<String, double?> values) {
  final payload = <String, double>{};
  values.forEach((name, value) {
    if (value != null && value.isFinite) payload[name] = value;
  });
  return payload;
}

/// Algum valor fora dos limites rígidos aceitos pelo Back-End.
bool hasOutOfBoundsValues(List<FeatureSpec> features, Map<String, double?> values) {
  return features.any((feature) {
    final value = values[feature.name];
    if (value == null) return false;
    return value < feature.hardMin || value > feature.hardMax;
  });
}

class FeaturesForm extends StatefulWidget {
  const FeaturesForm({
    super.key,
    required this.features,
    required this.values,
    required this.onChanged,
    this.onFillWithMeans,
    this.onClear,
    this.disabled = false,
    this.fieldErrors = const {},
    this.revision = 0,
  });

  final List<FeatureSpec> features;
  final Map<String, double?> values;
  final void Function(String name, double? value) onChanged;
  final VoidCallback? onFillWithMeans;
  final VoidCallback? onClear;
  final bool disabled;
  final Map<String, String> fieldErrors;

  /// Incrementado pelo pai quando os valores mudam por fora da digitação
  /// (preencher com médias, limpar, carregar um estudante). É o sinal para
  /// reescrever o texto dos campos.
  final int revision;

  @override
  State<FeaturesForm> createState() => _FeaturesFormState();
}

class _FeaturesFormState extends State<FeaturesForm> {
  final Map<String, TextEditingController> _controllers = {};

  /// `pt`: escala portuguesa do dataset (0–20 / 0–200). `br`: escala 0–10.
  String _gradeScale = 'pt';

  @override
  void initState() {
    super.initState();
    _buildControllers();
  }

  @override
  void didUpdateWidget(FeaturesForm oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.revision != widget.revision ||
        oldWidget.features.length != widget.features.length) {
      _buildControllers();
    }
  }

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  void _buildControllers() {
    for (final feature in widget.features) {
      final text = _displayText(feature);
      final existing = _controllers[feature.name];
      if (existing == null) {
        _controllers[feature.name] = TextEditingController(text: text);
      } else if (existing.text != text) {
        existing.text = text;
      }
    }
  }

  /// Fator de conversão entre a escala exibida e a escala canônica.
  ///
  /// O valor guardado é **sempre** o da escala portuguesa — é ela que vai para
  /// a validação de limites e para a análise.
  double _factor(FeatureSpec feature) =>
      _gradeScaleFields.contains(feature.name) && _gradeScale == 'br'
          ? feature.hardMax / 10
          : 1;

  String _displayText(FeatureSpec feature) {
    final value = widget.values[feature.name];
    if (value == null) return '';
    final factor = _factor(feature);
    final display = factor == 1 ? value : _round2(value / factor);
    return display == display.roundToDouble() && feature.isInt && factor == 1
        ? display.toInt().toString()
        : display.toString();
  }

  void _changeScale(String next) {
    setState(() {
      _gradeScale = next;
      for (final feature in widget.features) {
        if (!_gradeScaleFields.contains(feature.name)) continue;
        _controllers[feature.name]?.text = _displayText(feature);
      }
    });
  }

  List<({String titleKey, List<FeatureSpec> items})> get _grouped {
    final buckets = {for (final group in _groups) group.id: <FeatureSpec>[]};

    for (final feature in widget.features) {
      String target = _groups.last.id;
      for (final group in _groups) {
        final matchesContains =
            group.contains != null && feature.name.contains(group.contains!);
        final matchesName = group.names.contains(feature.name);
        if (matchesContains || matchesName) {
          target = group.id;
          break;
        }
      }
      buckets[target]!.add(feature);
    }

    return [
      for (final group in _groups)
        if (buckets[group.id]!.isNotEmpty)
          (titleKey: group.titleKey, items: buckets[group.id]!),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final t = context.i18n;
    final hasGradeFields =
        widget.features.any((feature) => _gradeScaleFields.contains(feature.name));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (hasGradeFields) ...[
          LabeledField(
            label: t.t('students.gradeScaleLabel'),
            info: FeatureInfo(
              text: t.t('students.gradeScaleHint'),
              options: const [],
              exhaustive: true,
              note: null,
            ),
            child: AppDropdown<String>(
              value: _gradeScale,
              enabled: !widget.disabled,
              onChanged: (value) => _changeScale(value ?? 'pt'),
              items: [
                (value: 'pt', label: t.t('students.gradeScalePt')),
                (value: 'br', label: t.t('students.gradeScaleBr')),
              ],
            ),
          ),
          const SizedBox(height: AppSizes.gap),
        ],
        if (widget.onFillWithMeans != null || widget.onClear != null) ...[
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (widget.onFillWithMeans != null)
                AppButton(
                  label: t.t('students.fillWithMean'),
                  small: true,
                  onPressed: widget.disabled ? null : widget.onFillWithMeans,
                ),
              if (widget.onClear != null)
                AppButton(
                  label: t.t('analysis.clearForm'),
                  small: true,
                  variant: ButtonVariant.ghost,
                  onPressed: widget.disabled ? null : widget.onClear,
                ),
            ],
          ),
          const SizedBox(height: AppSizes.gap),
        ],
        for (final group in _grouped) ...[
          SectionTitle(t.t(group.titleKey)),
          for (final feature in group.items)
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: _FeatureField(
                feature: feature,
                controller: _controllers[feature.name]!,
                value: widget.values[feature.name],
                factor: _factor(feature),
                convertsToBr: _factor(feature) != 1,
                disabled: widget.disabled,
                error: widget.fieldErrors['features.${feature.name}'],
                onChanged: widget.onChanged,
              ),
            ),
          const SizedBox(height: 6),
        ],
      ],
    );
  }
}

class _FeatureField extends StatelessWidget {
  const _FeatureField({
    required this.feature,
    required this.controller,
    required this.value,
    required this.factor,
    required this.convertsToBr,
    required this.disabled,
    required this.error,
    required this.onChanged,
  });

  final FeatureSpec feature;
  final TextEditingController controller;
  final double? value;
  final double factor;
  final bool convertsToBr;
  final bool disabled;
  final String? error;
  final void Function(String name, double? value) onChanged;

  @override
  Widget build(BuildContext context) {
    final t = context.i18n;

    // Fora da faixa observada no treino: o modelo extrapola e a confiança ali é
    // menos confiável. Fora dos limites rígidos: o Back-End recusa.
    final outOfRange = value != null && (value! < feature.min || value! > feature.max);
    final outOfBounds =
        value != null && (value! < feature.hardMin || value! > feature.hardMax);

    final boundsError = outOfBounds
        ? t.t('students.valueOutOfBounds', {
            'min': t.formatNumber(feature.hardMin / factor),
            'max': t.formatNumber(feature.hardMax / factor),
          })
        : null;

    // A Web mostra "0 ou 1" fixo em português; aqui a dica é neutra de idioma,
    // já que o app roda em três locales.
    final hint = feature.isBinary
        ? '0 / 1'
        : convertsToBr
            ? t.t('students.gradeScaleFieldHint')
            : '${t.formatNumber(feature.min)} – ${t.formatNumber(feature.max)}';

    return LabeledField(
      label: feature.label,
      hint: hint,
      error: error ?? boundsError,
      info: t.featureInfo(feature.name),
      child: AppTextField(
        controller: controller,
        enabled: !disabled,
        invalid: error != null || outOfBounds,
        outOfRange: outOfRange && !outOfBounds,
        keyboardType: TextInputType.numberWithOptions(
          decimal: !feature.isInt || convertsToBr,
          signed: feature.hardMin < 0,
        ),
        inputFormatters: [
          FilteringTextInputFormatter.allow(RegExp(r'^-?\d*[.,]?\d*')),
        ],
        onChanged: (raw) {
          final text = raw.trim().replaceAll(',', '.');
          if (text.isEmpty) {
            onChanged(feature.name, null);
            return;
          }
          final entered = double.tryParse(text);
          if (entered == null) return;
          onChanged(feature.name, factor == 1 ? entered : _round2(entered * factor));
        },
      ),
    );
  }
}
