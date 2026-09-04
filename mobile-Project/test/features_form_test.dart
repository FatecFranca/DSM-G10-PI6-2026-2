import 'package:flutter_test/flutter_test.dart';
import 'package:pae_mobile/models/feature_contract.dart';
import 'package:pae_mobile/widgets/features_form.dart';

FeatureSpec spec(
  String name, {
  String dtype = 'float',
  double min = 0,
  double max = 20,
  double hardMin = 0,
  double hardMax = 20,
  double mean = 10.4,
}) =>
    FeatureSpec(
      name: name,
      label: name,
      kind: 'numeric',
      dtype: dtype,
      min: min,
      max: max,
      hardMin: hardMin,
      hardMax: hardMax,
      mean: mean,
      required: true,
    );

void main() {
  final features = [
    spec('age_at_enrollment', dtype: 'int', min: 17, max: 70, hardMin: 17, hardMax: 70, mean: 23.3),
    spec('admission_grade', min: 95, max: 190, hardMin: 0, hardMax: 200, mean: 127.3),
  ];

  test('initialFeatureValues parte do que já está salvo', () {
    final values = initialFeatureValues(features, {'admission_grade': 140});

    expect(values['admission_grade'], 140);
    expect(values['age_at_enrollment'], isNull);
  });

  test('fillWithMeans preenche só os vazios e arredonda inteiro', () {
    final values = fillWithMeans(features, {'admission_grade': 140});

    expect(values['admission_grade'], 140, reason: 'não sobrescreve valor já informado');
    expect(values['age_at_enrollment'], 23, reason: 'dtype int vira inteiro');
  });

  test('fillWithMeans arredonda float em duas casas', () {
    final values = fillWithMeans([spec('taxa', mean: 1.23456)], {});
    expect(values['taxa'], 1.23);
  });

  test('toFeaturePayload descarta os vazios', () {
    final payload = toFeaturePayload({'a': 1, 'b': null, 'c': 3.5});
    expect(payload, {'a': 1.0, 'c': 3.5});
  });

  group('hasOutOfBoundsValues', () {
    test('aceita valor dentro dos limites rígidos', () {
      expect(hasOutOfBoundsValues(features, {'admission_grade': 195}), isFalse);
    });

    test('recusa valor acima do limite rígido', () {
      expect(hasOutOfBoundsValues(features, {'admission_grade': 220}), isTrue);
    });

    test('recusa valor abaixo do limite rígido', () {
      expect(hasOutOfBoundsValues(features, {'age_at_enrollment': 10}), isTrue);
    });

    test('campo vazio não é considerado fora dos limites', () {
      expect(hasOutOfBoundsValues(features, {'age_at_enrollment': null}), isFalse);
    });
  });
}
