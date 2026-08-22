import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function notFoundHandler(req, _res, next) {
  next(
    AppError.notFound(
      `Rota não encontrada: ${req.method} ${req.originalUrl}`,
      'ROUTE_NOT_FOUND',
    ),
  );
}

export function errorHandler(error, req, res, next) {
  const isKnown = error instanceof AppError;

  const isBodyParseError =
    error?.type === 'entity.parse.failed' || error instanceof SyntaxError && 'body' in error;

  const statusCode = isKnown ? error.statusCode : isBodyParseError ? 400 : 500;
  const code = isKnown ? error.code : isBodyParseError ? 'INVALID_JSON' : 'INTERNAL_ERROR';
  const message = isKnown || isBodyParseError
    ? error.message
    : 'Erro interno inesperado ao processar a requisição.';

  if (statusCode >= 500) {
    console.error(`[erro] ${req.method} ${req.originalUrl} -> ${code}:`, error);
  }

  const payload = { error: code, message };
  if (isKnown && error.details !== undefined) payload.details = error.details;
  if (!env.isProduction && statusCode >= 500) payload.stack = error.stack;

  res.status(statusCode).json(payload);
}

export default errorHandler;
