import { prisma } from '../../lib/prisma.js';
import { assertInstitutionAccess, institutionScope } from '../../middlewares/auth.js';
import { AppError } from '../../utils/AppError.js';
import { paginated } from '../../utils/validate.js';
import { rankOf } from '../analyses/priority.js';

export const FOLLOWUP_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED',
};

const FIELDS = {
  id: true,
  studentId: true,
  analysisId: true,
  title: true,
  notes: true,
  status: true,
  priority: true,
  dueDate: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
};

function scopeToStudent(user) {
  const scope = institutionScope(user);
  return Object.keys(scope).length === 0 ? {} : { student: { is: scope } };
}

export async function listFollowUps({ page, limit, skip }, filters, user) {
  const where = { ...scopeToStudent(user) };

  if (filters.studentId) where.studentId = filters.studentId;
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.assignedToId) where.assignedToId = filters.assignedToId;
  if (filters.mine) where.assignedToId = user.id;
  if (filters.overdue) {
    where.dueDate = { lt: new Date() };
    where.status = { in: [FOLLOWUP_STATUS.OPEN, FOLLOWUP_STATUS.IN_PROGRESS] };
  }

  const [followUps, total] = await Promise.all([
    prisma.followUp.findMany({
      where,
      select: {
        ...FIELDS,
        student: { select: { id: true, code: true, name: true, lastClassification: true } },
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: [{ priorityRank: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.followUp.count({ where }),
  ]);

  return paginated(followUps, total, { page, limit });
}

async function loadStudentInScope(studentId, user) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, institutionId: true },
  });
  if (!student) throw AppError.notFound('Estudante não encontrado.', 'STUDENT_NOT_FOUND');
  assertInstitutionAccess(user, student.institutionId);
  return student;
}

export async function createFollowUp(data, user) {
  await loadStudentInScope(data.studentId, user);

  if (data.analysisId) {
    const analysis = await prisma.analysis.findUnique({
      where: { id: data.analysisId },
      select: { id: true, studentId: true },
    });
    if (!analysis) throw AppError.notFound('Análise não encontrada.', 'ANALYSIS_NOT_FOUND');
    if (analysis.studentId !== data.studentId) {
      throw AppError.unprocessable('A análise informada pertence a outro estudante.', [
        { field: 'analysisId', message: 'Análise de outro estudante.' },
      ]);
    }
  }

  if (data.assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: data.assignedToId },
      select: { id: true, active: true },
    });
    if (!assignee || !assignee.active) {
      throw AppError.unprocessable('Responsável informado não existe ou está desativado.', [
        { field: 'assignedToId', message: 'Usuário inválido.' },
      ]);
    }
  }

  const priority = data.priority ?? 'MEDIUM';

  return prisma.followUp.create({
    data: {
      studentId: data.studentId,
      analysisId: data.analysisId ?? null,
      title: data.title,
      notes: data.notes ?? null,
      priority,
      priorityRank: rankOf(priority),
      status: data.status ?? FOLLOWUP_STATUS.OPEN,
      assignedToId: data.assignedToId ?? null,
      dueDate: data.dueDate ?? null,
      createdById: user.id,
    },
    select: FIELDS,
  });
}

export async function updateFollowUp(id, data, user) {
  const existing = await prisma.followUp.findUnique({
    where: { id },
    select: { id: true, status: true, student: { select: { institutionId: true } } },
  });
  if (!existing) throw AppError.notFound('Acompanhamento não encontrado.', 'FOLLOWUP_NOT_FOUND');
  assertInstitutionAccess(user, existing.student.institutionId);

  const closing = [FOLLOWUP_STATUS.DONE, FOLLOWUP_STATUS.CANCELLED];
  let resolvedAt;
  if (data.status && closing.includes(data.status) && !closing.includes(existing.status)) {
    resolvedAt = new Date();
  } else if (data.status && !closing.includes(data.status)) {
    resolvedAt = null;
  }

  return prisma.followUp.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.priority !== undefined && {
        priority: data.priority,
        priorityRank: rankOf(data.priority),
      }),
      ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
      ...(resolvedAt !== undefined && { resolvedAt }),
    },
    select: FIELDS,
  });
}

export async function getFollowUp(id, user) {
  const followUp = await prisma.followUp.findUnique({
    where: { id },
    select: {
      ...FIELDS,
      student: {
        select: { id: true, code: true, name: true, institutionId: true, lastClassification: true },
      },
      analysis: {
        select: { id: true, classification: true, confidence: true, priority: true, createdAt: true },
      },
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (!followUp) throw AppError.notFound('Acompanhamento não encontrado.', 'FOLLOWUP_NOT_FOUND');
  assertInstitutionAccess(user, followUp.student.institutionId);
  return followUp;
}
