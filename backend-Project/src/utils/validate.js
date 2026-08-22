import { AppError } from './AppError.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

function checkString(value, rules, field, errors) {
  if (typeof value !== 'string') {
    errors.push({ field, message: 'Deve ser um texto.' });
    return undefined;
  }
  const trimmed = value.trim();
  if (rules.required && trimmed.length === 0) {
    errors.push({ field, message: 'Campo obrigatório.' });
    return undefined;
  }
  if (rules.min !== undefined && trimmed.length < rules.min) {
    errors.push({ field, message: `Deve ter ao menos ${rules.min} caracteres.` });
    return undefined;
  }
  if (rules.max !== undefined && trimmed.length > rules.max) {
    errors.push({ field, message: `Deve ter no máximo ${rules.max} caracteres.` });
    return undefined;
  }
  return trimmed;
}

function checkNumber(value, rules, field, errors) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    errors.push({ field, message: 'Deve ser um número.' });
    return undefined;
  }
  if (rules.integer && !Number.isInteger(parsed)) {
    errors.push({ field, message: 'Deve ser um número inteiro.' });
    return undefined;
  }
  if (rules.min !== undefined && parsed < rules.min) {
    errors.push({ field, message: `Deve ser maior ou igual a ${rules.min}.` });
    return undefined;
  }
  if (rules.max !== undefined && parsed > rules.max) {
    errors.push({ field, message: `Deve ser menor ou igual a ${rules.max}.` });
    return undefined;
  }
  return parsed;
}

function checkField(value, rules, field, errors) {
  switch (rules.type) {
    case 'string':
      return checkString(value, rules, field, errors);

    case 'email': {
      const text = checkString(value, rules, field, errors);
      if (text === undefined) return undefined;
      const email = text.toLowerCase();
      if (!EMAIL_PATTERN.test(email)) {
        errors.push({ field, message: 'E-mail inválido.' });
        return undefined;
      }
      return email;
    }

    case 'password': {
      const text = typeof value === 'string' ? value : '';
      if (text.length < (rules.min ?? 8)) {
        errors.push({ field, message: `A senha deve ter ao menos ${rules.min ?? 8} caracteres.` });
        return undefined;
      }
      if (text.length > 128) {
        errors.push({ field, message: 'A senha deve ter no máximo 128 caracteres.' });
        return undefined;
      }
      return text;
    }

    case 'number':
      return checkNumber(value, rules, field, errors);

    case 'boolean': {
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      errors.push({ field, message: 'Deve ser verdadeiro ou falso.' });
      return undefined;
    }

    case 'enum': {
      if (!rules.values.includes(value)) {
        errors.push({ field, message: `Deve ser um de: ${rules.values.join(', ')}.` });
        return undefined;
      }
      return value;
    }

    case 'objectId': {
      if (typeof value !== 'string' || !OBJECT_ID_PATTERN.test(value)) {
        errors.push({ field, message: 'Identificador inválido.' });
        return undefined;
      }
      return value;
    }

    case 'date': {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        errors.push({ field, message: 'Data inválida.' });
        return undefined;
      }
      return parsed;
    }

    case 'object': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        errors.push({ field, message: 'Deve ser um objeto.' });
        return undefined;
      }
      return value;
    }

    default:
      throw new Error(`Tipo de validação desconhecido: ${rules.type}`);
  }
}

export function validate(body, schema) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw AppError.badRequest('Corpo da requisição deve ser um objeto JSON.', undefined, 'INVALID_BODY');
  }

  const errors = [];
  const result = {};

  for (const [field, rules] of Object.entries(schema)) {
    const value = body[field];
    const isEmpty = value === undefined || value === null || value === '';

    if (isEmpty) {
      if (rules.required) errors.push({ field, message: 'Campo obrigatório.' });
      else if (rules.default !== undefined) result[field] = rules.default;
      continue;
    }

    const parsed = checkField(value, rules, field, errors);
    if (parsed !== undefined) result[field] = parsed;
  }

  if (errors.length > 0) {
    throw AppError.unprocessable('Dados inválidos na requisição.', errors);
  }

  return result;
}

export function validateObjectId(id, field = 'id') {
  if (typeof id !== 'string' || !OBJECT_ID_PATTERN.test(id)) {
    throw AppError.badRequest(`Identificador inválido em "${field}".`, undefined, 'INVALID_ID');
  }
  return id;
}

export function parsePagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(Number.parseInt(query.page ?? '1', 10) || 1, 1);
  const rawLimit = Number.parseInt(query.limit ?? String(defaultLimit), 10) || defaultLimit;
  const limit = Math.min(Math.max(rawLimit, 1), maxLimit);

  return { page, limit, skip: (page - 1) * limit };
}

export function paginated(items, total, { page, limit }) {
  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      hasNext: page * limit < total,
      hasPrevious: page > 1,
    },
  };
}

export default validate;
