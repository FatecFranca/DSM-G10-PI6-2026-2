import 'enums.dart';

/// Especificação de um atributo aceito pelo modelo.
///
/// Vem de `GET /api/students/feature-contract`, que repassa o contrato do
/// `backend-MD` (gerado em `ML/artifacts/feature_spec.json`). **O app não
/// mantém uma segunda lista das 36 colunas** — se o modelo for retreinado com
/// outro conjunto de atributos, o formulário acompanha sozinho.
class FeatureSpec {
  const FeatureSpec({
    required this.name,
    required this.label,
    required this.kind,
    required this.dtype,
    required this.min,
    required this.max,
    required this.hardMin,
    required this.hardMax,
    required this.mean,
    required this.required,
  });

  final String name;
  final String label;

  /// `numeric` | `binary` | `categorical`.
  final String kind;

  /// `int` | `float`.
  final String dtype;

  /// Faixa observada no treino (usada como dica e como aviso de extrapolação).
  final double min;
  final double max;

  /// Limite rígido aceito pela validação do Back-End.
  final double hardMin;
  final double hardMax;

  final double mean;
  final bool required;

  bool get isInt => dtype == 'int';
  bool get isBinary => kind == 'binary';

  factory FeatureSpec.fromJson(Map<String, dynamic> json) => FeatureSpec(
        name: Json.str(json['name']),
        label: Json.str(json['label']),
        kind: Json.str(json['kind'], 'numeric'),
        dtype: Json.str(json['dtype'], 'float'),
        min: Json.dbl(json['min']),
        max: Json.dbl(json['max']),
        hardMin: Json.dbl(json['hardMin']),
        hardMax: Json.dbl(json['hardMax']),
        mean: Json.dbl(json['mean']),
        required: Json.boolOf(json['required'], true),
      );
}

class FeatureContract {
  const FeatureContract({
    required this.featureCount,
    required this.featureOrder,
    required this.features,
    required this.classes,
    required this.modelVersion,
  });

  final int featureCount;
  final List<String> featureOrder;
  final List<FeatureSpec> features;
  final List<String> classes;
  final String? modelVersion;

  factory FeatureContract.fromJson(Map<String, dynamic> json) => FeatureContract(
        featureCount: Json.intOf(json['featureCount']),
        featureOrder: Json.strings(json['featureOrder']),
        features: Json.list(json['features']).map(FeatureSpec.fromJson).toList(),
        classes: Json.strings(json['classes']),
        modelVersion: Json.strOrNull(json['modelVersion']),
      );
}

/// Quantos dos atributos exigidos já estão cadastrados para um estudante.
class FeaturesStatus {
  const FeaturesStatus({
    required this.complete,
    required this.filled,
    required this.total,
    required this.missing,
  });

  final bool complete;
  final int filled;
  final int total;
  final List<String> missing;

  static FeaturesStatus? fromJson(Object? value) {
    final json = Json.mapOrNull(value);
    if (json == null) return null;
    return FeaturesStatus(
      complete: Json.boolOf(json['complete']),
      filled: Json.intOf(json['filled']),
      total: Json.intOf(json['total']),
      missing: Json.strings(json['missing']),
    );
  }
}

/// Atributo enviado fora da faixa observada no treino: o modelo extrapolou e a
/// confiança ali é menos confiável.
class OutOfRangeWarning {
  const OutOfRangeWarning({
    required this.feature,
    required this.label,
    required this.value,
    required this.rangeMin,
    required this.rangeMax,
  });

  final String feature;
  final String? label;
  final double value;
  final double rangeMin;
  final double rangeMax;

  factory OutOfRangeWarning.fromJson(Map<String, dynamic> json) {
    final range = json['trainedRange'];
    final bounds = range is List ? range : const [];
    return OutOfRangeWarning(
      feature: Json.str(json['feature']),
      label: Json.strOrNull(json['label']),
      value: Json.dbl(json['value']),
      rangeMin: bounds.isNotEmpty ? Json.dbl(bounds[0]) : 0,
      rangeMax: bounds.length > 1 ? Json.dbl(bounds[1]) : 0,
    );
  }
}
