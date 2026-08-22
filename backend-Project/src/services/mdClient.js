import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

function buildUrl(pathname) {
  const base = env.MD_API_BASE_URL.endsWith('/')
    ? env.MD_API_BASE_URL
    : `${env.MD_API_BASE_URL}/`;
  return new URL(pathname.replace(/^\//, ''), base).toString();
}

function translateError(status, body) {
  const code = body?.error;
  const message = body?.message ?? 'Falha na comunicação com o serviço de IA.';

  if (status === 401 || status === 403) {
    console.error(
      `[md-client] backend-MD recusou a API Key (${code}). Verifique MD_API_KEY nos dois serviços.`,
    );
    return AppError.badGateway(
      'O serviço de IA recusou a autenticação deste servidor. Contate o administrador.',
      'ML_SERVICE_UNAUTHORIZED',
    );
  }

  if (status === 400 || status === 422) {
    return AppError.unprocessable(
      message,
      body?.details,
      code === 'INVALID_FEATURES' ? 'INVALID_STUDENT_FEATURES' : 'ML_INVALID_REQUEST',
    );
  }

  if (status === 503) {
    return AppError.serviceUnavailable(
      message,
      code === 'CLUSTERING_NOT_TRAINED' ? 'CLUSTERING_NOT_TRAINED' : 'MODEL_NOT_TRAINED',
      body?.details,
    );
  }

  if (status === 504) {
    return AppError.gatewayTimeout('O serviço de IA demorou além do limite para responder.');
  }

  return AppError.badGateway(message, 'ML_SERVICE_ERROR', body?.details);
}

async function request(pathname, { method = 'GET', body } = {}) {
  if (!env.MD_API_KEY) {
    throw AppError.serviceUnavailable(
      'Integração com o serviço de IA não configurada (MD_API_KEY ausente).',
      'ML_SERVICE_NOT_CONFIGURED',
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.MD_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(buildUrl(pathname), {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': env.MD_API_KEY,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw AppError.gatewayTimeout(
        `O serviço de IA não respondeu em ${env.MD_TIMEOUT_MS}ms.`,
      );
    }
    throw AppError.serviceUnavailable(
      `Não foi possível alcançar o serviço de IA: ${error.message}`,
      'ML_SERVICE_UNREACHABLE',
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw AppError.badGateway(
        'O serviço de IA devolveu uma resposta que não é JSON.',
        'ML_INVALID_RESPONSE',
      );
    }
  }

  if (!response.ok) throw translateError(response.status, payload);

  return payload;
}

export const getFeatureContract = () => request('features');

export const classify = (features) => request('classify', { method: 'POST', body: { features } });

export const classifyBatch = (records) =>
  request('classify/batch', { method: 'POST', body: { records } });

export const assignCluster = (features) =>
  request('clustering/assign', { method: 'POST', body: { features } });

export const assignClusterBatch = (records) =>
  request('clustering/assign', { method: 'POST', body: { records } });

export const getClusterProfiles = () => request('clustering/profiles');

export const getActiveModel = () => request('models/active');

export async function checkMdService() {
  try {
    const response = await fetch(buildUrl('health'), {
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.json().catch(() => null);
    return {
      reachable: true,
      status: body?.status ?? (response.ok ? 'ok' : 'degraded'),
      modelVersion: body?.ml?.modelVersion ?? null,
      classifierReady: Boolean(body?.ml?.classifierReady),
      clusteringReady: Boolean(body?.ml?.clusteringReady),
    };
  } catch (error) {
    return { reachable: false, error: error.message };
  }
}
