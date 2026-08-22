import { Router } from 'express';

import { authenticate, authorize, ROLES } from '../../middlewares/auth.js';
import { getDashboard, getInstitutionComparison, getTimeline } from './dashboard.service.js';

const router = Router();

router.use(authenticate);

const parseDays = (value, fallback = 180) => {
  const days = Number.parseInt(value ?? '', 10);
  return Number.isFinite(days) ? Math.min(Math.max(days, 1), 3650) : fallback;
};

/**
 * @openapi
 * /api/dashboard:
 *   get:
 *     tags: [Painel]
 *     summary: Indicadores consolidados
 *     description: |
 *       Responde às perguntas do painel: quantos estudantes existem e quantos já
 *       foram analisados, como as três classes se distribuem, quais casos estão
 *       na fila de atenção e qual a situação dos acompanhamentos.
 *
 *       A distribuição de classes usa o ÚLTIMO resultado de cada estudante — não
 *       todas as análises —, para que reanalisar a mesma pessoa não a faça pesar
 *       várias vezes.
 *
 *       O escopo segue o papel: ANALYST/VIEWER veem apenas a própria instituição.
 *     parameters:
 *       - { in: query, name: institutionId, schema: { type: string }, description: Apenas ADMIN }
 *       - { in: query, name: days, schema: { type: integer, default: 180 }, description: Janela para contagens de período }
 *     responses:
 *       200:
 *         description: Indicadores
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Dashboard' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/', async (req, res, next) => {
  try {
    res.json(
      await getDashboard(req.user, {
        institutionId: req.query.institutionId,
        days: parseDays(req.query.days),
      }),
    );
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/dashboard/timeline:
 *   get:
 *     tags: [Painel]
 *     summary: Evolução das análises ao longo do tempo
 *     description: Série por período, com a contagem de cada classe e de casos prioritários.
 *     parameters:
 *       - { in: query, name: institutionId, schema: { type: string }, description: Apenas ADMIN }
 *       - { in: query, name: days, schema: { type: integer, default: 180 } }
 *       - { in: query, name: granularity, schema: { type: string, enum: [day, week, month], default: month } }
 *     responses:
 *       200:
 *         description: Série temporal
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalAnalyses: { type: integer }
 *                 series:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       period:       { type: string, example: '2026-08' }
 *                       total:        { type: integer }
 *                       Dropout:      { type: integer }
 *                       Enrolled:     { type: integer }
 *                       Graduate:     { type: integer }
 *                       highPriority: { type: integer }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/timeline', async (req, res, next) => {
  try {
    const granularity = ['day', 'week', 'month'].includes(req.query.granularity)
      ? req.query.granularity
      : 'month';
    res.json(
      await getTimeline(req.user, {
        institutionId: req.query.institutionId,
        days: parseDays(req.query.days),
        granularity,
      }),
    );
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/dashboard/institutions:
 *   get:
 *     tags: [Painel]
 *     summary: Comparativo entre instituições
 *     description: Visão de rede — onde a evasão está mais concentrada. Exclusivo de ADMIN.
 *     responses:
 *       200: { description: Comparativo por instituição }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/institutions', authorize(ROLES.ADMIN), async (req, res, next) => {
  try {
    res.json({ institutions: await getInstitutionComparison() });
  } catch (error) {
    next(error);
  }
});

export default router;
