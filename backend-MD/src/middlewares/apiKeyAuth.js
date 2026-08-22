import crypto from 'node:crypto';

import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

function safeEqual(received, expected) {
  const a = Buffer.from(received, 'utf-8');
  const b = Buffer.from(expected, 'utf-8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function extractKey(req) {
  const headerKey = req.get('x-api-key');
  if (headerKey) return headerKey.trim();

  const authorization = req.get('authorization');
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }

  return null;
}

export function apiKeyAuth(req, _res, next) {
  if (!env.MD_API_KEY) {
    next(
      AppError.serviceUnavailable(
        'Serviço sem MD_API_KEY configurada; requisições autenticadas estão bloqueadas.',
        'API_KEY_NOT_CONFIGURED',
      ),
    );
    return;
  }

  const received = extractKey(req);

  if (!received) {
    next(
      AppError.unauthorized(
        'Chave de API ausente. Envie o header X-API-Key ou Authorization: Bearer <api_key>.',
        'API_KEY_MISSING',
      ),
    );
    return;
  }

  if (!safeEqual(received, env.MD_API_KEY)) {
    next(AppError.unauthorized('Chave de API inválida.', 'API_KEY_INVALID'));
    return;
  }

  req.service = { name: 'backend-Project', authenticatedBy: 'api-key' };
  next();
}

export default apiKeyAuth;
