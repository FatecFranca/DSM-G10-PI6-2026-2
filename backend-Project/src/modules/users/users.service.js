import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { paginated } from '../../utils/validate.js';
import { hashPassword, PUBLIC_USER_FIELDS } from '../auth/auth.service.js';

export async function listUsers({ page, limit, skip }, filters = {}) {
  const where = {};
  if (filters.role) where.role = filters.role;
  if (filters.institutionId) where.institutionId = filters.institutionId;
  if (filters.active !== undefined) where.active = filters.active;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        ...PUBLIC_USER_FIELDS,
        institution: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return paginated(users, total, { page, limit });
}

export async function getUser(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      ...PUBLIC_USER_FIELDS,
      updatedAt: true,
      institution: { select: { id: true, name: true, city: true } },
    },
  });
  if (!user) throw AppError.notFound('Usuário não encontrado.', 'USER_NOT_FOUND');
  return user;
}

async function assertInstitutionExists(institutionId) {
  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    select: { id: true },
  });
  if (!institution) {
    throw AppError.unprocessable('Instituição informada não existe.', [
      { field: 'institutionId', message: 'Instituição não encontrada.' },
    ]);
  }
}

export async function createUser(data) {
  if (data.institutionId) await assertInstitutionExists(data.institutionId);

  if (data.role !== 'ADMIN' && !data.institutionId) {
    throw AppError.unprocessable('Usuários que não são ADMIN precisam de uma instituição.', [
      { field: 'institutionId', message: 'Obrigatório para os papéis ANALYST e VIEWER.' },
    ]);
  }

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw AppError.conflict('Já existe um usuário com este e-mail.', 'EMAIL_ALREADY_USED');
  }

  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash: await hashPassword(data.password),
      role: data.role,
      institutionId: data.institutionId ?? null,
      active: data.active ?? true,
    },
    select: PUBLIC_USER_FIELDS,
  });
}

export async function updateUser(id, data, requestingUser) {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!user) throw AppError.notFound('Usuário não encontrado.', 'USER_NOT_FOUND');

  if (data.institutionId) await assertInstitutionExists(data.institutionId);

  const isSelf = requestingUser.id === id;
  if (isSelf && data.role && data.role !== user.role) {
    throw AppError.badRequest(
      'Não é possível alterar o seu próprio papel.',
      undefined,
      'CANNOT_CHANGE_OWN_ROLE',
    );
  }
  if (isSelf && data.active === false) {
    throw AppError.badRequest(
      'Não é possível desativar a sua própria conta.',
      undefined,
      'CANNOT_DEACTIVATE_SELF',
    );
  }

  return prisma.user.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.role !== undefined && { role: data.role }),
      ...(data.institutionId !== undefined && { institutionId: data.institutionId }),
      ...(data.active !== undefined && { active: data.active }),
    },
    select: PUBLIC_USER_FIELDS,
  });
}

export async function resetUserPassword(id, newPassword) {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw AppError.notFound('Usuário não encontrado.', 'USER_NOT_FOUND');

  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  return { reset: true };
}

export async function deactivateUser(id, requestingUser) {
  if (requestingUser.id === id) {
    throw AppError.badRequest(
      'Não é possível desativar a sua própria conta.',
      undefined,
      'CANNOT_DEACTIVATE_SELF',
    );
  }

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw AppError.notFound('Usuário não encontrado.', 'USER_NOT_FOUND');

  return prisma.user.update({
    where: { id },
    data: { active: false },
    select: PUBLIC_USER_FIELDS,
  });
}
