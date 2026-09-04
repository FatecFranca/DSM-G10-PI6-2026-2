import { prisma } from '../../lib/prisma.js';
import { assertInstitutionAccess, institutionScope, ROLES } from '../../middlewares/auth.js';
import { validateFeatures } from '../../services/featureContract.js';
import * as md from '../../services/mdClient.js';
import { AppError } from '../../utils/AppError.js';
import { paginated } from '../../utils/validate.js';
import { derivePriority, rankOf } from './priority.js';

const DISCLAIMER =
  'A classificação é uma ferramenta de apoio à análise, não uma garantia sobre o futuro do ' +
  'estudante. A confiança é a probabilidade estimada pelo modelo e não passou por calibração ' +
  'estatística.';

const ANALYSIS_FIELDS = {
  id: true,
  studentId: true,
  institutionId: true,
  classification: true,
  classId: true,
  confidence: true,
  probabilities: true,
  modelVersion: true,
  algorithm: true,
  priority: true,
  createdAt: true,
};

function present(analysis, recommendation, extra = {}) {
  return {
    id: analysis.id,
    studentId: analysis.studentId,
    analysis: {
      classification: analysis.classification,
      classId: analysis.classId,
      confidence: analysis.confidence,
      probabilities: analysis.probabilities,
    },
    recommendation,
    model: { version: analysis.modelVersion, algorithm: analysis.algorithm },
    createdAt: analysis.createdAt,
    disclaimer: DISCLAIMER,
    ...extra.rest,
  };
}

export async function analyzeStudent(studentId, user) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, institutionId: true, features: true, active: true, name: true },
  });

  if (!student) throw AppError.notFound('Estudante não encontrado.', 'STUDENT_NOT_FOUND');
  assertInstitutionAccess(user, student.institutionId);

  if (!student.active) {
    throw AppError.badRequest(
      'Estudante desativado não pode ser analisado.',
      undefined,
      'STUDENT_INACTIVE',
    );
  }
  if (!student.features) {
    throw AppError.unprocessable(
      'O estudante não possui atributos cadastrados. Complete o cadastro antes de solicitar a análise.',
      [{ field: 'features', message: 'Nenhum atributo cadastrado.' }],
      'INCOMPLETE_STUDENT_FEATURES',
    );
  }

  const { features, outOfRange } = await validateFeatures(student.features, {
    requireComplete: true,
  });

  const classification = await md.classify(features);

  const recommendation = derivePriority(classification);

  const [analysis] = await prisma.$transaction([
    prisma.analysis.create({
      data: {
        studentId: student.id,
        institutionId: student.institutionId,
        classification: classification.classification,
        classId: classification.classId,
        confidence: classification.confidence,
        probabilities: classification.probabilities ?? undefined,
        modelVersion: classification.model.version,
        algorithm: classification.model.algorithm,
        featuresSnapshot: features,
        priority: recommendation.priority,
        requestedById: user.id,
      },
      select: ANALYSIS_FIELDS,
    }),
    prisma.student.update({
      where: { id: student.id },
      data: {
        lastClassification: classification.classification,
        lastConfidence: classification.confidence,
        lastAnalysisAt: new Date(),
        lastPriority: recommendation.priority,
        lastPriorityRank: rankOf(recommendation.priority),
      },
    }),
  ]);

  return present(analysis, recommendation, {
    rest: {
      student: { id: student.id, name: student.name },
      ...(outOfRange.length > 0 && { warnings: outOfRange }),
    },
  });
}

export async function analyzeAdHoc(rawFeatures) {
  const { features, outOfRange } = await validateFeatures(rawFeatures, { requireComplete: true });

  const classification = await md.classify(features);

  const recommendation = derivePriority(classification);

  return {
    persisted: false,
    analysis: {
      classification: classification.classification,
      classId: classification.classId,
      confidence: classification.confidence,
      probabilities: classification.probabilities,
    },
    recommendation,
    model: { version: classification.model.version, algorithm: classification.model.algorithm },
    disclaimer: DISCLAIMER,
    ...(outOfRange.length > 0 && { warnings: outOfRange }),
  };
}

export async function analyzeBatch(studentIds, user) {
  const where = { id: { in: studentIds }, ...institutionScope(user) };

  const students = await prisma.student.findMany({
    where,
    select: { id: true, name: true, institutionId: true, features: true, active: true },
  });

  const found = new Set(students.map((student) => student.id));
  const skipped = studentIds
    .filter((id) => !found.has(id))
    .map((id) => ({ studentId: id, reason: 'STUDENT_NOT_FOUND_OR_OUT_OF_SCOPE' }));

  const eligible = [];
  for (const student of students) {
    if (!student.active) {
      skipped.push({ studentId: student.id, reason: 'STUDENT_INACTIVE' });
      continue;
    }
    try {
      const { features } = await validateFeatures(student.features ?? {}, { requireComplete: true });
      eligible.push({ student, features });
    } catch (error) {
      skipped.push({
        studentId: student.id,
        reason: error.code ?? 'INCOMPLETE_STUDENT_FEATURES',
        details: error.details,
      });
    }
  }

  if (eligible.length === 0) {
    throw AppError.unprocessable(
      'Nenhum estudante do lote está apto para análise.',
      skipped,
      'NO_ELIGIBLE_STUDENTS',
    );
  }

  const records = eligible.map((item) => item.features);
  const batch = await md.classifyBatch(records);

  const results = [];
  for (const [index, item] of eligible.entries()) {
    const prediction = batch.results[index];
    const recommendation = derivePriority(prediction);

    const [analysis] = await prisma.$transaction([
      prisma.analysis.create({
        data: {
          studentId: item.student.id,
          institutionId: item.student.institutionId,
          classification: prediction.classification,
          classId: prediction.classId,
          confidence: prediction.confidence,
          probabilities: prediction.probabilities ?? undefined,
          modelVersion: batch.model.version,
          algorithm: batch.model.algorithm,
          featuresSnapshot: item.features,
          priority: recommendation.priority,
          requestedById: user.id,
        },
        select: ANALYSIS_FIELDS,
      }),
      prisma.student.update({
        where: { id: item.student.id },
        data: {
          lastClassification: prediction.classification,
          lastConfidence: prediction.confidence,
          lastAnalysisAt: new Date(),
          lastPriority: recommendation.priority,
          lastPriorityRank: rankOf(recommendation.priority),
        },
      }),
    ]);

    results.push(
      present(analysis, recommendation, {
        rest: { student: { id: item.student.id, name: item.student.name } },
      }),
    );
  }

  return {
    analyzed: results.length,
    skipped,
    model: { version: batch.model.version, algorithm: batch.model.algorithm },
    results,
    disclaimer: DISCLAIMER,
  };
}

export async function listAnalyses({ page, limit, skip }, filters, user) {
  const where = { ...institutionScope(user) };

  if (filters.studentId) where.studentId = filters.studentId;
  if (filters.classification) where.classification = filters.classification;
  if (filters.priority) where.priority = filters.priority;
  if (filters.modelVersion) where.modelVersion = filters.modelVersion;
  if (filters.institutionId && user.role === ROLES.ADMIN) {
    where.institutionId = filters.institutionId;
  }
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from && { gte: filters.from }),
      ...(filters.to && { lte: filters.to }),
    };
  }

  const [analyses, total] = await Promise.all([
    prisma.analysis.findMany({
      where,
      select: {
        ...ANALYSIS_FIELDS,
        student: { select: { id: true, code: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.analysis.count({ where }),
  ]);

  return paginated(analyses, total, { page, limit });
}

export async function getAnalysis(id, user) {
  const analysis = await prisma.analysis.findUnique({
    where: { id },
    select: {
      ...ANALYSIS_FIELDS,
      featuresSnapshot: true,
      student: { select: { id: true, code: true, name: true, course: true } },
      requestedBy: { select: { id: true, name: true } },
    },
  });

  if (!analysis) throw AppError.notFound('Análise não encontrada.', 'ANALYSIS_NOT_FOUND');
  assertInstitutionAccess(user, analysis.institutionId);

  const recommendation = derivePriority(analysis);

  return {
    ...present(analysis, recommendation),
    persistedPriority: analysis.priority,
    featuresSnapshot: analysis.featuresSnapshot,
    student: analysis.student,
    requestedBy: analysis.requestedBy,
  };
}
