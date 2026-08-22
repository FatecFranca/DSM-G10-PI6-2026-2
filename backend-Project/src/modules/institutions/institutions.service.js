import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { paginated } from '../../utils/validate.js';
import { ROLES } from '../../middlewares/auth.js';

const PUBLIC_FIELDS = {
  id: true,
  name: true,
  city: true,
  state: true,
  type: true,
  email: true,
  phone: true,
  active: true,
  createdAt: true,
  updatedAt: true,
};

export async function listInstitutions({ page, limit, skip }, filters, user) {
  const where = {};

  if (user.role !== ROLES.ADMIN) {
    if (!user.institutionId) return paginated([], 0, { page, limit });
    where.id = user.institutionId;
  }

  if (filters.active !== undefined) where.active = filters.active;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { city: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [institutions, total] = await Promise.all([
    prisma.institution.findMany({
      where,
      select: {
        ...PUBLIC_FIELDS,
        _count: { select: { students: true, users: true } },
      },
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.institution.count({ where }),
  ]);

  return paginated(
    institutions.map(({ _count, ...institution }) => ({
      ...institution,
      studentCount: _count.students,
      userCount: _count.users,
    })),
    total,
    { page, limit },
  );
}

export async function getInstitution(id, user) {
  if (user.role !== ROLES.ADMIN && user.institutionId !== id) {
    throw AppError.forbidden('Esta instituição está fora do seu escopo.', 'INSTITUTION_MISMATCH');
  }

  const institution = await prisma.institution.findUnique({
    where: { id },
    select: {
      ...PUBLIC_FIELDS,
      _count: { select: { students: true, users: true, analyses: true } },
    },
  });

  if (!institution) throw AppError.notFound('Instituição não encontrada.', 'INSTITUTION_NOT_FOUND');

  const { _count, ...rest } = institution;
  return {
    ...rest,
    studentCount: _count.students,
    userCount: _count.users,
    analysisCount: _count.analyses,
  };
}

export async function createInstitution(data) {
  const existing = await prisma.institution.findUnique({ where: { name: data.name } });
  if (existing) {
    throw AppError.conflict('Já existe uma instituição com este nome.', 'INSTITUTION_NAME_IN_USE');
  }

  return prisma.institution.create({ data, select: PUBLIC_FIELDS });
}

export async function updateInstitution(id, data) {
  const institution = await prisma.institution.findUnique({ where: { id }, select: { id: true } });
  if (!institution) throw AppError.notFound('Instituição não encontrada.', 'INSTITUTION_NOT_FOUND');

  return prisma.institution.update({ where: { id }, data, select: PUBLIC_FIELDS });
}

export async function deactivateInstitution(id) {
  const institution = await prisma.institution.findUnique({
    where: { id },
    select: { id: true, _count: { select: { students: true } } },
  });
  if (!institution) throw AppError.notFound('Instituição não encontrada.', 'INSTITUTION_NOT_FOUND');

  return prisma.institution.update({
    where: { id },
    data: { active: false },
    select: PUBLIC_FIELDS,
  });
}
