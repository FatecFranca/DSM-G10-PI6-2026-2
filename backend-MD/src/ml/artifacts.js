import fs from 'node:fs/promises';
import path from 'node:path';

import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const ARTIFACTS_DIR = path.join(env.ML_DIR, 'artifacts');

export const ARTIFACT_FILES = {
  featureSpec: path.join(ARTIFACTS_DIR, 'feature_spec.json'),
  labelMap: path.join(ARTIFACTS_DIR, 'label_map.json'),
  modelMetadata: path.join(ARTIFACTS_DIR, 'model_metadata.json'),
  clusterMetadata: path.join(ARTIFACTS_DIR, 'cluster_metadata.json'),
  model: path.join(ARTIFACTS_DIR, 'model.pkl'),
  scaler: path.join(ARTIFACTS_DIR, 'scaler.pkl'),
  clusterModel: path.join(ARTIFACTS_DIR, 'cluster_model.pkl'),
};

const cache = new Map();

async function readJsonCached(file) {
  const stats = await fs.stat(file);
  const cached = cache.get(file);
  if (cached && cached.mtimeMs === stats.mtimeMs) return cached.value;

  const value = JSON.parse(await fs.readFile(file, 'utf-8'));
  cache.set(file, { mtimeMs: stats.mtimeMs, value });
  return value;
}

const HARD_BOUND_MARGIN_RATIO = 0.15;

const GRADE_SCALE_20 = new Set(['curricular_units_1st_sem_grade', 'curricular_units_2nd_sem_grade']);
const GRADE_SCALE_200 = new Set(['previous_qualification_grade', 'admission_grade']);

const MIN_ENROLLMENT_AGE = 15;

function computeHardBounds(feature) {
  if (feature.kind !== 'numeric') {
    return { hardMin: feature.min, hardMax: feature.max };
  }

  const range = feature.max - feature.min;
  const margin = Math.max(feature.dtype === 'int' ? 1 : 0.5, range * HARD_BOUND_MARGIN_RATIO);

  let hardMin = feature.min - margin;
  let hardMax = feature.max + margin;

  if (feature.min >= 0) hardMin = Math.max(0, hardMin);
  if (GRADE_SCALE_20.has(feature.name)) hardMax = Math.min(hardMax, 20);
  if (GRADE_SCALE_200.has(feature.name)) hardMax = Math.min(hardMax, 200);
  if (feature.name === 'age_at_enrollment') hardMin = Math.max(hardMin, MIN_ENROLLMENT_AGE);

  if (feature.dtype === 'int') {
    hardMin = Math.floor(hardMin);
    hardMax = Math.ceil(hardMax);
  } else {
    hardMin = Math.round(hardMin * 100) / 100;
    hardMax = Math.round(hardMax * 100) / 100;
  }

  return { hardMin, hardMax };
}

function withHardBounds(spec) {
  return {
    ...spec,
    features: spec.features.map((feature) => ({ ...feature, ...computeHardBounds(feature) })),
  };
}

export async function artifactExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function getFeatureSpec() {
  try {
    return withHardBounds(await readJsonCached(ARTIFACT_FILES.featureSpec));
  } catch {
    throw AppError.serviceUnavailable(
      'Contrato de features indisponível: execute "npm run ml:prepare" (ML/prepare_data.py) antes de usar a API.',
      'FEATURE_SPEC_UNAVAILABLE',
    );
  }
}

export async function getModelMetadata() {
  try {
    return await readJsonCached(ARTIFACT_FILES.modelMetadata);
  } catch {
    throw AppError.serviceUnavailable(
      'Nenhum modelo treinado disponível: execute "npm run ml:train" (ML/train_model.py).',
      'MODEL_NOT_TRAINED',
    );
  }
}

export async function getClusterMetadata() {
  try {
    return await readJsonCached(ARTIFACT_FILES.clusterMetadata);
  } catch {
    throw AppError.serviceUnavailable(
      'Nenhum agrupamento treinado disponível: execute "npm run ml:cluster" (ML/train_clusters.py).',
      'CLUSTERING_NOT_TRAINED',
    );
  }
}

export async function getMlStatus() {
  const [featureSpec, model, scaler, clusterModel] = await Promise.all([
    artifactExists(ARTIFACT_FILES.featureSpec),
    artifactExists(ARTIFACT_FILES.model),
    artifactExists(ARTIFACT_FILES.scaler),
    artifactExists(ARTIFACT_FILES.clusterModel),
  ]);

  const status = {
    featureSpecReady: featureSpec,
    classifierReady: model && scaler,
    clusteringReady: clusterModel,
    modelVersion: null,
    clusterVersion: null,
  };

  if (status.classifierReady) {
    try {
      status.modelVersion = (await readJsonCached(ARTIFACT_FILES.modelMetadata)).model_version;
    } catch {
      status.classifierReady = false;
    }
  }
  if (status.clusteringReady) {
    try {
      status.clusterVersion = (await readJsonCached(ARTIFACT_FILES.clusterMetadata)).cluster_version;
    } catch {
      status.clusteringReady = false;
    }
  }

  return status;
}
