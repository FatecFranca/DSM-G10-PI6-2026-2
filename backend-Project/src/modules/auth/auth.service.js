import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { env } from '../../config/env.js';
import { isMailerConfigured, sendPasswordResetEmail } from '../../lib/mailer.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';

const RESET_ELIGIBLE_ROLE = 'VIEWER';
const RESET_TOKEN_TTL_MINUTES = 30;

export const PUBLIC_USER_FIELDS = {
  id: true,
  name: true,
  email: true,
  role: true,
  institutionId: true,
  active: true,
  lastLoginAt: true,
  createdAt: true,
};

export async function hashPassword(plain) {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      institutionId: user.institutionId,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN },
  );
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });

  const invalid = AppError.unauthorized('E-mail ou senha inválidos.', 'INVALID_CREDENTIALS');
  if (!user) {
    await bcrypt.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    throw invalid;
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) throw invalid;

  if (!user.active) {
    throw AppError.forbidden('Usuário desativado. Contate o administrador.', 'USER_INACTIVE');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    token: signToken(user),
    expiresIn: env.JWT_EXPIRES_IN,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      institutionId: user.institutionId,
    },
  };
}

export async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...PUBLIC_USER_FIELDS,
      institution: { select: { id: true, name: true, city: true, state: true } },
    },
  });

  if (!user) throw AppError.notFound('Usuário não encontrado.', 'USER_NOT_FOUND');
  return user;
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('Usuário não encontrado.', 'USER_NOT_FOUND');

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) throw AppError.unauthorized('Senha atual incorreta.', 'INVALID_CREDENTIALS');

  if (currentPassword === newPassword) {
    throw AppError.badRequest(
      'A nova senha deve ser diferente da atual.',
      undefined,
      'PASSWORD_NOT_CHANGED',
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  return { changed: true };
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const GENERIC_RESET_REQUEST_RESPONSE = {
  requested: true,
  message:
    'Se o e-mail informado pertencer a uma conta elegível para recuperação, ' +
    'enviaremos um link de redefinição em instantes.',
};

export async function requestPasswordReset(email) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.role !== RESET_ELIGIBLE_ROLE || !user.active) {
    return GENERIC_RESET_REQUEST_RESPONSE;
  }

  if (!isMailerConfigured()) {
    console.error(
      '[auth] SMTP não configurado (SMTP_HOST/SMTP_USER/SMTP_PASSWORD) — ' +
        'recuperação de senha não pôde ser enviada.',
    );
    return GENERIC_RESET_REQUEST_RESPONSE;
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: hashResetToken(rawToken),
      passwordResetExpiresAt: expiresAt,
    },
  });

  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl: `${env.FRONTEND_URL}/reset-password?token=${rawToken}`,
      expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
    });
  } catch (error) {
    console.error('[auth] Falha ao enviar e-mail de recuperação de senha:', error);
  }

  return GENERIC_RESET_REQUEST_RESPONSE;
}

export async function resetPasswordWithToken({ token, newPassword }) {
  const invalidToken = AppError.badRequest(
    'Link de recuperação inválido ou expirado. Solicite um novo.',
    undefined,
    'RESET_TOKEN_INVALID',
  );

  const user = await prisma.user.findFirst({
    where: { passwordResetTokenHash: hashResetToken(token) },
  });

  if (!user || user.role !== RESET_ELIGIBLE_ROLE || !user.active) throw invalidToken;
  if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt.getTime() < Date.now()) {
    throw invalidToken;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    },
  });

  return { changed: true };
}
