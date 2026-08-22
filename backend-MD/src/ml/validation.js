import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { getFeatureSpec } from './artifacts.js';

function extractRecords(body) {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== 'object') return null;

  if (Array.isArray(body.records)) return body.records;
  if (body.features && typeof body.features === 'object') return [body.features];

  return null;
}

export async function validateRecords(body, { allowBatch = true } = {}) {
  const spec = await getFeatureSpec();
  const records = extractRecords(body);

  if (!records) {
    throw AppError.badRequest(
      'Corpo inválido. Envie { "features": { ... } } para um estudante ou { "records": [ { ... } ] } para um lote.',
      undefined,
      'INVALID_BODY',
    );
  }
  if (records.length === 0) {
    throw AppError.badRequest('Nenhum registro informado.', undefined, 'EMPTY_RECORDS');
  }
  if (!allowBatch && records.length > 1) {
    throw AppError.badRequest(
      'Este endpoint aceita um único registro. Use o endpoint de lote para vários.',
      undefined,
      'BATCH_NOT_ALLOWED',
    );
  }
  if (records.length > env.ML_MAX_BATCH_SIZE) {
    throw AppError.badRequest(
      `Lote acima do limite: ${records.length} registros (máximo ${env.ML_MAX_BATCH_SIZE}).`,
      { limit: env.ML_MAX_BATCH_SIZE, received: records.length },
      'BATCH_TOO_LARGE',
    );
  }

  const problems = [];
  const warnings = [];
  const normalized = [];

  records.forEach((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      problems.push({ index, reason: 'Registro deve ser um objeto com as features do estudante.' });
      return;
    }

    const missing = [];
    const invalid = [];
    const outOfRange = [];
    const row = {};

    for (const feature of spec.features) {
      const raw = record[feature.name];

      if (raw === undefined || raw === null || raw === '') {
        missing.push(feature.name);
        continue;
      }

      const value = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(value)) {
        invalid.push({ feature: feature.name, received: raw });
        continue;
      }

      if (value < feature.hardMin || value > feature.hardMax) {
        invalid.push({
          feature: feature.name,
          received: value,
          allowedRange: [feature.hardMin, feature.hardMax],
        });
        continue;
      }

      if (value < feature.min || value > feature.max) {
        outOfRange.push({
          feature: feature.name,
          value,
          trainedRange: [feature.min, feature.max],
        });
      }

      row[feature.name] = value;
    }

    if (missing.length > 0 || invalid.length > 0) {
      const problem = { index };
      if (missing.length) problem.missingFeatures = missing;
      if (invalid.length) problem.invalidFeatures = invalid;
      problems.push(problem);
      return;
    }

    if (outOfRange.length > 0) warnings.push({ index, outOfRange });
    normalized.push(row);
  });

  if (problems.length > 0) {
    throw AppError.unprocessable(
      'Registros inválidos: todas as features do contrato são obrigatórias e devem ser numéricas. ' +
        'Consulte GET /api/features para o contrato completo.',
      { expectedFeatureCount: spec.feature_count, problems },
      'INVALID_FEATURES',
    );
  }

  return { records: normalized, warnings };
}

export default validateRecords;
