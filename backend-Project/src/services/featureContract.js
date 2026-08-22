import { getFeatureContract } from './mdClient.js';
import { AppError } from '../utils/AppError.js';

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache = { value: null, expiresAt: 0 };

export async function loadFeatureContract({ force = false } = {}) {
  const now = Date.now();
  if (!force && cache.value && cache.expiresAt > now) return cache.value;

  const contract = await getFeatureContract();
  cache = { value: contract, expiresAt: now + CACHE_TTL_MS };
  return contract;
}

export function invalidateFeatureContract() {
  cache = { value: null, expiresAt: 0 };
}

export async function validateFeatures(features, { requireComplete = false } = {}) {
  const contract = await loadFeatureContract();

  if (!features || typeof features !== 'object' || Array.isArray(features)) {
    throw AppError.unprocessable('O campo "features" deve ser um objeto.', [
      { field: 'features', message: 'Deve ser um objeto com os atributos do estudante.' },
    ]);
  }

  const normalized = {};
  const missing = [];
  const invalid = [];
  const outOfRange = [];
  const unknown = Object.keys(features).filter(
    (key) => !contract.features.some((feature) => feature.name === key),
  );

  for (const feature of contract.features) {
    const raw = features[feature.name];

    if (raw === undefined || raw === null || raw === '') {
      missing.push(feature.name);
      continue;
    }

    const value = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(value)) {
      invalid.push({ field: `features.${feature.name}`, message: 'Deve ser um número.' });
      continue;
    }
    if (feature.dtype === 'int' && !Number.isInteger(value)) {
      invalid.push({
        field: `features.${feature.name}`,
        message: `${feature.label} deve ser um número inteiro.`,
      });
      continue;
    }

    if (value < feature.hardMin || value > feature.hardMax) {
      invalid.push({
        field: `features.${feature.name}`,
        message: `${feature.label} deve estar entre ${feature.hardMin} e ${feature.hardMax}.`,
      });
      continue;
    }

    if (value < feature.min || value > feature.max) {
      outOfRange.push({
        feature: feature.name,
        label: feature.label,
        value,
        trainedRange: [feature.min, feature.max],
      });
    }

    normalized[feature.name] = value;
  }

  if (invalid.length > 0) {
    throw AppError.unprocessable('Atributos do estudante inválidos.', invalid);
  }

  if (requireComplete && missing.length > 0) {
    throw AppError.unprocessable(
      `O estudante não possui todos os atributos exigidos pelo modelo (${missing.length} de ` +
        `${contract.featureCount} ausentes). Complete o cadastro antes de solicitar a análise.`,
      missing.map((name) => ({ field: `features.${name}`, message: 'Obrigatório para analisar.' })),
      'INCOMPLETE_STUDENT_FEATURES',
    );
  }

  return { features: normalized, missing, outOfRange, unknown, contract };
}

export async function describeCompleteness(features) {
  const contract = await loadFeatureContract();
  if (!features) {
    return { complete: false, filled: 0, total: contract.featureCount, missing: contract.featureOrder };
  }

  const missing = contract.featureOrder.filter(
    (name) => features[name] === undefined || features[name] === null,
  );

  return {
    complete: missing.length === 0,
    filled: contract.featureCount - missing.length,
    total: contract.featureCount,
    missing,
  };
}
