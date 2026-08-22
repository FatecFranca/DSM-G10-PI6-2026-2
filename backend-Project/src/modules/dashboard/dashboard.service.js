import { prisma } from '../../lib/prisma.js';
import { institutionScope, ROLES } from '../../middlewares/auth.js';

const CLASSES = ['Dropout', 'Enrolled', 'Graduate'];
const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];

function toDistribution(groups, key, expectedKeys) {
  const counts = new Map(expectedKeys.map((value) => [value, 0]));
  let total = 0;

  for (const group of groups) {
    const value = group[key];
    const count = group._count?._all ?? group._count ?? 0;
    counts.set(value, (counts.get(value) ?? 0) + count);
    total += count;
  }

  return {
    total,
    items: [...counts.entries()].map(([value, count]) => ({
      value,
      count,
      ratio: total > 0 ? Number((count / total).toFixed(4)) : 0,
    })),
  };
}

function resolveScope(user, institutionId) {
  const scope = institutionScope(user);
  if (institutionId && user.role === ROLES.ADMIN) return { institutionId };
  return scope;
}

export async function getDashboard(user, { institutionId, days = 180 } = {}) {
  const scope = resolveScope(user, institutionId);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [
    totalStudents,
    activeStudents,
    analyzedStudents,
    totalAnalyses,
    analysesInPeriod,
    classificationGroups,
    priorityGroups,
    followUpGroups,
    overdueFollowUps,
    recentAnalyses,
    attentionQueue,
    latestAnalysis,
  ] = await Promise.all([
    prisma.student.count({ where: scope }),
    prisma.student.count({ where: { ...scope, active: true } }),
    prisma.student.count({ where: { ...scope, lastAnalysisAt: { not: null } } }),
    prisma.analysis.count({ where: scope }),
    prisma.analysis.count({ where: { ...scope, createdAt: { gte: since } } }),

    prisma.student.groupBy({
      by: ['lastClassification'],
      where: { ...scope, lastClassification: { not: null } },
      _count: { _all: true },
    }),
    prisma.student.groupBy({
      by: ['lastPriority'],
      where: { ...scope, lastPriority: { not: null } },
      _count: { _all: true },
    }),

    prisma.followUp.groupBy({
      by: ['status'],
      where: Object.keys(scope).length === 0 ? {} : { student: { is: scope } },
      _count: { _all: true },
    }),
    prisma.followUp.count({
      where: {
        ...(Object.keys(scope).length === 0 ? {} : { student: { is: scope } }),
        dueDate: { lt: new Date() },
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    }),

    prisma.analysis.findMany({
      where: scope,
      select: {
        id: true,
        classification: true,
        confidence: true,
        priority: true,
        createdAt: true,
        student: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),

    prisma.student.findMany({
      where: { ...scope, active: true, lastPriority: 'HIGH' },
      select: {
        id: true,
        code: true,
        name: true,
        course: true,
        lastClassification: true,
        lastConfidence: true,
        lastAnalysisAt: true,
      },
      orderBy: [{ lastConfidence: 'desc' }, { lastAnalysisAt: 'desc' }],
      take: 10,
    }),

    prisma.analysis.findFirst({
      where: scope,
      select: { modelVersion: true, algorithm: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const followUpStatus = toDistribution(followUpGroups, 'status', [
    'OPEN',
    'IN_PROGRESS',
    'DONE',
    'CANCELLED',
  ]);

  return {
    scope: {
      institutionId: scope.institutionId ?? null,
      allInstitutions: !scope.institutionId,
      periodDays: days,
    },
    overview: {
      totalStudents,
      activeStudents,
      analyzedStudents,
      analysisCoverage:
        totalStudents > 0 ? Number((analyzedStudents / totalStudents).toFixed(4)) : 0,
      pendingAnalysis: totalStudents - analyzedStudents,
      totalAnalyses,
      analysesInPeriod,
    },
    classificationDistribution: toDistribution(
      classificationGroups,
      'lastClassification',
      CLASSES,
    ),
    priorityDistribution: toDistribution(priorityGroups, 'lastPriority', PRIORITIES),
    followUps: {
      byStatus: followUpStatus,
      open:
        (followUpStatus.items.find((item) => item.value === 'OPEN')?.count ?? 0) +
        (followUpStatus.items.find((item) => item.value === 'IN_PROGRESS')?.count ?? 0),
      overdue: overdueFollowUps,
    },
    attentionQueue,
    recentAnalyses,
    lastModelUsed: latestAnalysis
      ? {
          version: latestAnalysis.modelVersion,
          algorithm: latestAnalysis.algorithm,
          at: latestAnalysis.createdAt,
        }
      : null,
    disclaimer:
      'Os indicadores derivam de classificações produzidas por um modelo de apoio à decisão. ' +
      'Não representam certeza sobre o futuro dos estudantes.',
  };
}

export async function getTimeline(user, { institutionId, days = 180, granularity = 'month' } = {}) {
  const scope = resolveScope(user, institutionId);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const analyses = await prisma.analysis.findMany({
    where: { ...scope, createdAt: { gte: since } },
    select: { classification: true, priority: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const bucketKey = (date) => {
    const iso = date.toISOString();
    if (granularity === 'day') return iso.slice(0, 10);
    if (granularity === 'week') {
      const monday = new Date(date);
      const weekday = (monday.getUTCDay() + 6) % 7;
      monday.setUTCDate(monday.getUTCDate() - weekday);
      return monday.toISOString().slice(0, 10);
    }
    return iso.slice(0, 7);
  };

  const buckets = new Map();
  for (const analysis of analyses) {
    const key = bucketKey(analysis.createdAt);
    if (!buckets.has(key)) {
      buckets.set(key, {
        period: key,
        total: 0,
        Dropout: 0,
        Enrolled: 0,
        Graduate: 0,
        highPriority: 0,
      });
    }
    const bucket = buckets.get(key);
    bucket.total += 1;
    if (bucket[analysis.classification] !== undefined) bucket[analysis.classification] += 1;
    if (analysis.priority === 'HIGH') bucket.highPriority += 1;
  }

  const series = [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period));

  return {
    scope: { institutionId: scope.institutionId ?? null, periodDays: days, granularity },
    totalAnalyses: analyses.length,
    series,
  };
}

export async function getInstitutionComparison() {
  const institutions = await prisma.institution.findMany({
    where: { active: true },
    select: { id: true, name: true, city: true },
    orderBy: { name: 'asc' },
  });

  return Promise.all(
    institutions.map(async (institution) => {
      const scope = { institutionId: institution.id };
      const [students, analyzed, classificationGroups, highPriority] = await Promise.all([
        prisma.student.count({ where: scope }),
        prisma.student.count({ where: { ...scope, lastAnalysisAt: { not: null } } }),
        prisma.student.groupBy({
          by: ['lastClassification'],
          where: { ...scope, lastClassification: { not: null } },
          _count: { _all: true },
        }),
        prisma.student.count({ where: { ...scope, lastPriority: 'HIGH' } }),
      ]);

      const distribution = toDistribution(classificationGroups, 'lastClassification', CLASSES);
      const dropout = distribution.items.find((item) => item.value === 'Dropout');

      return {
        institution,
        totalStudents: students,
        analyzedStudents: analyzed,
        highPriorityStudents: highPriority,
        dropoutRatio: dropout?.ratio ?? 0,
        classificationDistribution: distribution,
      };
    }),
  );
}
