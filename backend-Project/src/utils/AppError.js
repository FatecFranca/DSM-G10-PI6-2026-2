export class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message, details, code = 'BAD_REQUEST') {
    return new AppError(400, code, message, details);
  }

  static unauthorized(message = 'Autenticação necessária.', code = 'UNAUTHORIZED') {
    return new AppError(401, code, message);
  }

  static forbidden(message = 'Permissão insuficiente para este recurso.', code = 'FORBIDDEN') {
    return new AppError(403, code, message);
  }

  static notFound(message = 'Recurso não encontrado.', code = 'NOT_FOUND') {
    return new AppError(404, code, message);
  }

  static conflict(message, code = 'CONFLICT', details) {
    return new AppError(409, code, message, details);
  }

  static unprocessable(message, details, code = 'VALIDATION_ERROR') {
    return new AppError(422, code, message, details);
  }

  static internal(message = 'Erro interno inesperado.', code = 'INTERNAL_ERROR', details) {
    return new AppError(500, code, message, details);
  }

  static badGateway(message, code = 'ML_SERVICE_ERROR', details) {
    return new AppError(502, code, message, details);
  }

  static serviceUnavailable(message, code = 'SERVICE_UNAVAILABLE', details) {
    return new AppError(503, code, message, details);
  }

  static gatewayTimeout(message, code = 'ML_SERVICE_TIMEOUT') {
    return new AppError(504, code, message);
  }
}

export default AppError;
