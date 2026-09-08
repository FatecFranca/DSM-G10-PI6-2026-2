import { getModelMetadata } from '../../ml/artifacts.js';
import { runPythonScript } from '../../ml/pythonRunner.js';
import { validateRecords } from '../../ml/validation.js';

export const CONFIDENCE_DISCLAIMER =
  'Resultado estatístico destinado a apoiar a decisão. O campo confidence é a probabilidade ' +
  'estimada para a classe escolhida. O pipeline não aplica etapa de calibração posterior; a ' +
  'aderência entre probabilidade e frequência observada é aferida a cada treino e publicada ' +
  'em GET /api/models/active, no campo metrics.test_calibration_ece.';

function describeModel(metadata) {
  return {
    version: metadata.model_version,
    algorithm: metadata.algorithm,
    contractVersion: metadata.contract_version,
    supportsProbability: metadata.supports_probability,
    trainedAt: metadata.trained_at,
    classes: metadata.classes,
  };
}

function toResult(entry) {
  return {
    index: entry.index,
    classification: entry.classification,
    classId: entry.class_id,
    confidence: entry.confidence,
    probabilities: entry.probabilities,
  };
}

export async function classifyOne(body) {
  const { records, warnings } = await validateRecords(body, { allowBatch: false });
  const [metadata, prediction] = await Promise.all([
    getModelMetadata(),
    runPythonScript('predict.py', { records }),
  ]);

  const [first] = prediction.results;
  const response = {
    ...toResult(first),
    model: describeModel(metadata),
    disclaimer: CONFIDENCE_DISCLAIMER,
  };
  delete response.index;

  if (warnings.length > 0) response.warnings = warnings[0].outOfRange;
  return response;
}

export async function classifyBatch(body) {
  const { records, warnings } = await validateRecords(body, { allowBatch: true });
  const [metadata, prediction] = await Promise.all([
    getModelMetadata(),
    runPythonScript('predict.py', { records }),
  ]);

  const response = {
    model: describeModel(metadata),
    count: prediction.results.length,
    results: prediction.results.map(toResult),
    disclaimer: CONFIDENCE_DISCLAIMER,
  };

  if (warnings.length > 0) response.warnings = warnings;
  return response;
}

export async function getFeatureContract() {
  const [{ getFeatureSpec }, metadata] = await Promise.all([
    import('../../ml/artifacts.js'),
    getModelMetadata().catch(() => null),
  ]);
  const spec = await getFeatureSpec();

  return {
    featureCount: spec.feature_count,
    featureOrder: spec.feature_order,
    features: spec.features,
    classes: metadata?.classes ?? ['Dropout', 'Enrolled', 'Graduate'],
    modelVersion: metadata?.model_version ?? null,
  };
}
