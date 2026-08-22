import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function notFoundHandler(req, _res, next) {
  next(AppError.notFound(`Rota não encontrada: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
}

function translatePrismaError(error) {
  switch (error.code) {
    case 'P2002': {
      const fields = error.meta?.target;
      const label = Array.isArray(fields) ? fields.join(', ') : (fields ?? 'campo único');
      return AppError.conflict(
        `Já existe um registro com o mesmo valor em: ${label}.`,
        'DUPLICATE_VALUE',
        { fields },
      );
    }
    case 'P2025':
      return AppError.notFound('Registro não encontrado.', 'RECORD_NOT_FOUND');
    case 'P2003':
    case 'P2014':
      return AppError.conflict(
        'A operação viola um vínculo entre registros.',
        'RELATION_CONSTRAINT',
      );
    case 'P2023':
      return AppError.badRequest('Identificador em formato inválido.', undefined, 'INVALID_ID');
    default:
      return null;
  }
}

export function errorHandler(error, req, res, next) {
  let resolved = error;

  if (!(error instanceof AppError)) {
    const isBodyParseError =
      error?.type === 'entity.parse.failed' || (error instanceof SyntaxError && 'body' in error);

    if (isBodyParseError) {
      resolved = AppError.badRequest('JSON inválido no corpo da requisição.', undefined, 'INVALID_JSON');
    } else if (error?.code?.startsWith?.('P2')) {
      resolved = translatePrismaError(error) ?? error;
    }
  }

  const isKnown = resolved instanceof AppError;
  const statusCode = isKnown ? resolved.statusCode : 500;
  const code = isKnown ? resolved.code : 'INTERNAL_ERROR';
  const message = isKnown ? resolved.message : 'Erro interno inesperado ao processar a requisição.';

  if (statusCode >= 500) {
    console.error(
      `[erro] ${req.method} ${req.originalUrl} (usuário: ${req.user?.id ?? 'anônimo'}) -> ${code}:`,
      error,
    );
  }

  const payload = { error: code, message };
  if (isKnown && resolved.details !== undefined) payload.details = resolved.details;
  if (!env.isProduction && statusCode >= 500) payload.stack = error.stack;

  res.status(statusCode).json(payload);
}

export default errorHandler;
