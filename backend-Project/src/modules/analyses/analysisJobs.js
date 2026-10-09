import { env } from '../../config/env.js';
import { getKafka, TOPICS } from '../../lib/messaging.js';
import { prisma } from '../../lib/prisma.js';
import { ROLES } from '../../middlewares/auth.js';
import { AppError } from '../../utils/AppError.js';
import { persistBatchPrediction, selectEligibleStudents } from './analyses.service.js';

export const JOB_STATUS = { QUEUED: 'QUEUED', DONE: 'DONE', FAILED: 'FAILED' };

const JOB_FIELDS = {
  id: true,
  status: true,
  requested: true,
  analyzed: true,
  skipped: true,
  error: true,
  modelVersion: true,
  algorithm: true,
  requestedById: true,
  createdAt: true,
  completedAt: true,
};

function presentJob(job) {
  return {
    id: job.id,
    status: job.status,
    requested: job.requested,
    analyzed: job.analyzed,
    skipped: job.skipped ?? [],
    error: job.error ?? null,
    model: job.modelVersion ? { version: job.modelVersion, algorithm: job.algorithm } : null,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  };
}

export async function enqueueBatch(studentIds, user) {
  const { eligible, skipped } = await selectEligibleStudents(studentIds, user);

  const items = eligible.map(({ student, features }) => ({
    studentId: student.id,
    institutionId: student.institutionId,
    features,
  }));

  const job = await prisma.analysisJob.create({
    data: {
      status: JOB_STATUS.QUEUED,
      items,
      requested: items.length,
      skipped,
      requestedById: user.id,
    },
    select: JOB_FIELDS,
  });

  try {
    await getKafka().produce(TOPICS.analysisRequested, [
      {
        key: job.id,
        value: {
          jobId: job.id,
          records: items.map((item) => item.features),
          requestedAt: job.createdAt.toISOString(),
        },
      },
    ]);
  } catch (error) {
    console.error(`[backend-Project] falha ao publicar o job ${job.id}: ${error.message}`);
    await prisma.analysisJob.update({
      where: { id: job.id },
      data: {
        status: JOB_STATUS.FAILED,
        error: { code: 'MESSAGING_UNAVAILABLE', message: error.message },
        completedAt: new Date(),
      },
    });
    throw AppError.serviceUnavailable(
      'Não foi possível enfileirar o lote de análise. Tente novamente em instantes.',
      'MESSAGING_UNAVAILABLE',
    );
  }

  return presentJob(job);
}

export async function getJob(id, user) {
  const job = await prisma.analysisJob.findUnique({ where: { id }, select: JOB_FIELDS });

  if (!job || (job.requestedById !== user.id && user.role !== ROLES.ADMIN)) {
    throw AppError.notFound('Lote de análise não encontrado.', 'ANALYSIS_JOB_NOT_FOUND');
  }

  return presentJob(job);
}

const isRecordNotFound = (error) => error?.code === 'P2025';

async function handleAnalysisCompleted(record) {
  const message = record.value;
  if (!message?.jobId || !/^[a-f\d]{24}$/i.test(message.jobId)) {
    console.warn(
      `[backend-Project] mensagem ignorada em ${record.topic}@${record.partition}:${record.offset} — formato inválido.`,
    );
    return;
  }

  const job = await prisma.analysisJob.findUnique({
    where: { id: message.jobId },
    select: { id: true, status: true, items: true, skipped: true, requestedById: true },
  });
  if (!job) {
    console.warn(`[backend-Project] resultado para job desconhecido ${message.jobId} — ignorado.`);
    return;
  }
  if (job.status !== JOB_STATUS.QUEUED) return;

  if (message.status !== 'SUCCEEDED') {
    await prisma.analysisJob.update({
      where: { id: job.id },
      data: {
        status: JOB_STATUS.FAILED,
        error: message.error ?? { code: 'ML_SERVICE_ERROR', message: 'Falha no serviço de IA.' },
        completedAt: new Date(),
      },
    });
    console.warn(`[backend-Project] job ${job.id}: FAILED (${message.error?.code ?? 'sem código'})`);
    return;
  }

  const alreadySaved = await prisma.analysis.findMany({
    where: { jobId: job.id },
    select: { studentId: true },
  });
  const done = new Set(alreadySaved.map((analysis) => analysis.studentId));
  const skipped = [...(job.skipped ?? [])];
  const results = message.results ?? [];

  for (const [index, item] of job.items.entries()) {
    if (done.has(item.studentId)) continue;

    const prediction = results.find((result) => result.index === index) ?? results[index];
    if (!prediction) {
      skipped.push({ studentId: item.studentId, reason: 'MISSING_PREDICTION' });
      continue;
    }

    try {
      await persistBatchPrediction(item, prediction, message.model, {
        requestedById: job.requestedById ?? undefined,
        jobId: job.id,
      });
      done.add(item.studentId);
    } catch (error) {
      if (!isRecordNotFound(error)) throw error;
      skipped.push({ studentId: item.studentId, reason: 'STUDENT_NOT_FOUND_OR_OUT_OF_SCOPE' });
    }
  }

  await prisma.analysisJob.update({
    where: { id: job.id },
    data: {
      status: JOB_STATUS.DONE,
      analyzed: done.size,
      skipped,
      modelVersion: message.model?.version,
      algorithm: message.model?.algorithm,
      completedAt: new Date(),
    },
  });
  console.log(`[backend-Project] job ${job.id}: DONE (${done.size} análise(s))`);
}

export function startAnalysisJobsConsumer() {
  return getKafka().subscribe({
    group: env.KAFKA_CONSUMER_GROUP,
    topics: [TOPICS.analysisCompleted],
    name: 'backend-project',
    onMessage: handleAnalysisCompleted,
  });
}
