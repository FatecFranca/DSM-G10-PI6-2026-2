import { prisma } from '../../lib/prisma.js';
import { assertInstitutionAccess, institutionScope, ROLES } from '../../middlewares/auth.js';
import { describeCompleteness, validateFeatures } from '../../services/featureContract.js';
import { AppError } from '../../utils/AppError.js';
import { paginated } from '../../utils/validate.js';

const LIST_FIELDS = {
  id: true,
  code: true,
  name: true,
  email: true,
  course: true,
  enrollmentYear: true,
  institutionId: true,
  lastClassification: true,
  lastConfidence: true,
  lastAnalysisAt: true,
  lastPriority: true,
  active: true,
  createdAt: true,
  updatedAt: true,
};

export async function listStudents({ page, limit, skip }, filters, user) {
  const where = { ...institutionScope(user) };

  if (filters.institutionId && user.role === ROLES.ADMIN) {
    where.institutionId = filters.institutionId;
  }
  if (filters.classification) where.lastClassification = filters.classification;
  if (filters.priority) where.lastPriority = filters.priority;
  if (filters.active !== undefined) where.active = filters.active;
  if (filters.analyzed === true) where.lastAnalysisAt = { not: null };
  if (filters.analyzed === false) where.lastAnalysisAt = null;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { code: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const orderBy = (() => {
    switch (filters.sort) {
      case 'name':
        return { name: 'asc' };
      case 'priority':
        return [{ lastPriorityRank: 'desc' }, { lastConfidence: 'desc' }];
      case 'recentAnalysis':
        return { lastAnalysisAt: 'desc' };
      default:
        return { createdAt: 'desc' };
    }
  })();

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      select: { ...LIST_FIELDS, institution: { select: { id: true, name: true } } },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.student.count({ where }),
  ]);

  return paginated(students, total, { page, limit });
}

export async function getStudent(id, user, { includeAnalyses = true } = {}) {
  const student = await prisma.student.findUnique({
    where: { id },
    select: {
      ...LIST_FIELDS,
      features: true,
      createdBy: { select: { id: true, name: true } },
      institution: { select: { id: true, name: true, city: true } },
      ...(includeAnalyses && {
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            classification: true,
            confidence: true,
            priority: true,
            modelVersion: true,
            algorithm: true,
            clusterId: true,
            attentionLevel: true,
            createdAt: true,
            requestedBy: { select: { id: true, name: true } },
          },
        },
      }),
      followUps: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          createdAt: true,
          assignedTo: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!student) throw AppError.notFound('Estudante não encontrado.', 'STUDENT_NOT_FOUND');
  assertInstitutionAccess(user, student.institutionId);

  return {
    ...student,
    featuresStatus: await describeCompleteness(student.features).catch(() => null),
  };
}

function resolveInstitutionId(data, user) {
  if (user.role === ROLES.ADMIN) {
    if (!data.institutionId) {
      throw AppError.unprocessable('Informe a instituição do estudante.', [
        { field: 'institutionId', message: 'Obrigatório para usuários ADMIN.' },
      ]);
    }
    return data.institutionId;
  }

  if (data.institutionId && data.institutionId !== user.institutionId) {
    throw AppError.forbidden(
      'Não é possível cadastrar estudante em outra instituição.',
      'INSTITUTION_MISMATCH',
    );
  }
  if (!user.institutionId) {
    throw AppError.forbidden('Usuário sem instituição vinculada.', 'NO_INSTITUTION_SCOPE');
  }
  return user.institutionId;
}

export async function createStudent(data, user) {
  const institutionId = resolveInstitutionId(data, user);

  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    select: { id: true, active: true },
  });
  if (!institution) {
    throw AppError.unprocessable('Instituição informada não existe.', [
      { field: 'institutionId', message: 'Instituição não encontrada.' },
    ]);
  }
  if (!institution.active) {
    throw AppError.unprocessable('Instituição desativada não recebe novos estudantes.', [
      { field: 'institutionId', message: 'Instituição desativada.' },
    ]);
  }

  const duplicate = await prisma.student.findFirst({
    where: { institutionId, code: data.code },
    select: { id: true },
  });
  if (duplicate) {
    throw AppError.conflict(
      `Já existe um estudante com o código "${data.code}" nesta instituição.`,
      'STUDENT_CODE_IN_USE',
    );
  }

  let features;
  let outOfRange = [];
  if (data.features) {
    const validated = await validateFeatures(data.features);
    features = validated.features;
    outOfRange = validated.outOfRange;
  }

  const student = await prisma.student.create({
    data: {
      institutionId,
      code: data.code,
      name: data.name,
      email: data.email ?? null,
      course: data.course ?? null,
      enrollmentYear: data.enrollmentYear ?? null,
      features: features ?? undefined,
      createdById: user.id,
      active: data.active ?? true,
    },
    select: { ...LIST_FIELDS, features: true },
  });

  return {
    ...student,
    featuresStatus: await describeCompleteness(student.features).catch(() => null),
    ...(outOfRange.length > 0 && { warnings: outOfRange }),
  };
}

export async function updateStudent(id, data, user) {
  const existing = await prisma.student.findUnique({
    where: { id },
    select: { id: true, institutionId: true, code: true, features: true },
  });
  if (!existing) throw AppError.notFound('Estudante não encontrado.', 'STUDENT_NOT_FOUND');
  assertInstitutionAccess(user, existing.institutionId);

  if (data.code && data.code !== existing.code) {
    const duplicate = await prisma.student.findFirst({
      where: { institutionId: existing.institutionId, code: data.code, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) {
      throw AppError.conflict(
        `Já existe um estudante com o código "${data.code}" nesta instituição.`,
        'STUDENT_CODE_IN_USE',
      );
    }
  }

  let features;
  let outOfRange = [];
  if (data.features) {
    const merged = { ...(existing.features ?? {}), ...data.features };
    const validated = await validateFeatures(merged);
    features = validated.features;
    outOfRange = validated.outOfRange;
  }

  const student = await prisma.student.update({
    where: { id },
    data: {
      ...(data.code !== undefined && { code: data.code }),
      ...(data.name !== undefined && { name: data.name }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.course !== undefined && { course: data.course }),
      ...(data.enrollmentYear !== undefined && { enrollmentYear: data.enrollmentYear }),
      ...(data.active !== undefined && { active: data.active }),
      ...(features !== undefined && { features }),
    },
    select: { ...LIST_FIELDS, features: true },
  });

  return {
    ...student,
    featuresStatus: await describeCompleteness(student.features).catch(() => null),
    ...(outOfRange.length > 0 && { warnings: outOfRange }),
  };
}

export async function deactivateStudent(id, user) {
  const existing = await prisma.student.findUnique({
    where: { id },
    select: { id: true, institutionId: true },
  });
  if (!existing) throw AppError.notFound('Estudante não encontrado.', 'STUDENT_NOT_FOUND');
  assertInstitutionAccess(user, existing.institutionId);

  return prisma.student.update({ where: { id }, data: { active: false }, select: LIST_FIELDS });
}
