import { getModelMetadata } from '../../ml/artifacts.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';

function toModelRecord(metadata) {
  return {
    modelVersion: metadata.model_version,
    contractVersion: metadata.contract_version,
    algorithm: metadata.algorithm,
    task: metadata.task,
    classes: metadata.classes,
    hyperparameters: metadata.hyperparameters,
    dataset: metadata.dataset,
    features: metadata.features,
    preprocessing: metadata.preprocessing,
    metrics: metadata.metrics,
    featureImportance: metadata.feature_importance ?? null,
    featureImportanceMethod: metadata.feature_importance_method ?? null,
    candidates: metadata.candidates,
    selectionRationale: metadata.selection_rationale,
    supportsProbability: Boolean(metadata.supports_probability),
    environment: metadata.environment,
    artifacts: metadata.artifacts,
    trainedAt: new Date(metadata.trained_at),
  };
}

export async function getActiveModel() {
  const metadata = await getModelMetadata();

  return {
    modelVersion: metadata.model_version,
    contractVersion: metadata.contract_version,
    algorithm: metadata.algorithm,
    task: metadata.task,
    classes: metadata.classes,
    labelMap: metadata.label_map,
    trainedAt: metadata.trained_at,
    supportsProbability: metadata.supports_probability,
    hyperparameters: metadata.hyperparameters,
    dataset: metadata.dataset,
    features: metadata.features,
    preprocessing: metadata.preprocessing,
    metrics: metadata.metrics,
    featureImportance: metadata.feature_importance,
    featureImportanceMethod: metadata.feature_importance_method,
    candidates: metadata.candidates,
    selectionRationale: metadata.selection_rationale,
    selectionCriteria: metadata.selection_criteria,
    environment: metadata.environment,
    disclaimer: metadata.disclaimer,
  };
}

export async function listModels({ limit = 50 } = {}) {
  const models = await prisma.mlModel.findMany({
    orderBy: { trainedAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 200),
    select: {
      modelVersion: true,
      algorithm: true,
      task: true,
      classes: true,
      selectionRationale: true,
      supportsProbability: true,
      trainedAt: true,
      isActive: true,
      registeredAt: true,
      metrics: true,
      dataset: true,
    },
  });

  return models.map((model) => ({
    modelVersion: model.modelVersion,
    algorithm: model.algorithm,
    task: model.task,
    classes: model.classes,
    isActive: model.isActive,
    trainedAt: model.trainedAt,
    registeredAt: model.registeredAt,
    supportsProbability: model.supportsProbability,
    selectionRationale: model.selectionRationale,
    summary: {
      testAccuracy: model.metrics?.test_accuracy,
      testF1Macro: model.metrics?.test_f1_macro,
      trainAccuracy: model.metrics?.train_accuracy,
      overfitGap: model.metrics?.overfit_gap,
      datasetSha256: model.dataset?.sha256,
      datasetRows: model.dataset?.rows_total,
    },
  }));
}

export async function getModelByVersion(modelVersion) {
  const model = await prisma.mlModel.findUnique({ where: { modelVersion } });
  if (!model) {
    throw AppError.notFound(
      `Nenhum modelo registrado com a versão "${modelVersion}".`,
      'MODEL_VERSION_NOT_FOUND',
    );
  }
  return model;
}

export async function registerCurrentArtifacts() {
  const registered = { model: null };

  const metadata = await getModelMetadata();
  const record = toModelRecord(metadata);

  await prisma.mlModel.updateMany({
    where: { isActive: true, modelVersion: { not: record.modelVersion } },
    data: { isActive: false },
  });
  registered.model = await prisma.mlModel.upsert({
    where: { modelVersion: record.modelVersion },
    create: { ...record, isActive: true },
    update: { ...record, isActive: true },
    select: { modelVersion: true, algorithm: true, trainedAt: true, isActive: true },
  });

  return registered;
}
