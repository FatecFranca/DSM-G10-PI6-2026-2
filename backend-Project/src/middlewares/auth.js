import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';

export const ROLES = { ADMIN: 'ADMIN', ANALYST: 'ANALYST', VIEWER: 'VIEWER' };

function extractToken(req) {
  const authorization = req.get('authorization');
  if (!authorization) return null;
  if (!authorization.toLowerCase().startsWith('bearer ')) return null;
  const token = authorization.slice(7).trim();
  return token.length > 0 ? token : null;
}

export async function authenticate(req, _res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      throw AppError.unauthorized(
        'Token ausente. Envie o header Authorization: Bearer <token>.',
        'TOKEN_MISSING',
      );
    }

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw AppError.unauthorized('Sessão expirada. Faça login novamente.', 'TOKEN_EXPIRED');
      }
      throw AppError.unauthorized('Token inválido.', 'TOKEN_INVALID');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        institutionId: true,
        active: true,
      },
    });

    if (!user) throw AppError.unauthorized('Usuário do token não existe mais.', 'USER_NOT_FOUND');
    if (!user.active) throw AppError.forbidden('Usuário desativado.', 'USER_INACTIVE');

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      next(AppError.unauthorized('Autenticação necessária.', 'UNAUTHENTICATED'));
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      next(
        AppError.forbidden(
          `Este recurso exige um dos papéis: ${allowedRoles.join(', ')}.`,
          'INSUFFICIENT_ROLE',
        ),
      );
      return;
    }
    next();
  };
}

export function institutionScope(user) {
  if (user.role === ROLES.ADMIN) return {};
  if (!user.institutionId) {
    throw AppError.forbidden(
      'Usuário sem instituição vinculada não tem acesso a dados de estudantes.',
      'NO_INSTITUTION_SCOPE',
    );
  }
  return { institutionId: user.institutionId };
}

export function assertInstitutionAccess(user, institutionId) {
  if (user.role === ROLES.ADMIN) return;
  if (user.institutionId !== institutionId) {
    throw AppError.forbidden(
      'Este recurso pertence a outra instituição.',
      'INSTITUTION_MISMATCH',
    );
  }
}
