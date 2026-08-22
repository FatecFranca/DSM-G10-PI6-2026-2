import { Router } from 'express';

import { authenticate, authorize, ROLES } from '../../middlewares/auth.js';
import { parsePagination, validate, validateObjectId } from '../../utils/validate.js';
import {
  createFollowUp,
  FOLLOWUP_STATUS,
  getFollowUp,
  listFollowUps,
  updateFollowUp,
} from './followups.service.js';

const router = Router();

router.use(authenticate);

const WRITE_ROLES = [ROLES.ADMIN, ROLES.ANALYST];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

/**
 * @openapi
 * /api/follow-ups:
 *   get:
 *     tags: [Acompanhamento]
 *     summary: Lista acompanhamentos
 *     description: |
 *       Ordenado por prioridade e vencimento — a ordem de uma fila de trabalho.
 *       `mine=true` traz apenas os atribuídos ao usuário autenticado;
 *       `overdue=true`, os vencidos e ainda abertos.
 *     parameters:
 *       - { in: query, name: page,  schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: studentId, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string, enum: [OPEN, IN_PROGRESS, DONE, CANCELLED] } }
 *       - { in: query, name: priority, schema: { type: string, enum: [LOW, MEDIUM, HIGH] } }
 *       - { in: query, name: assignedToId, schema: { type: string } }
 *       - { in: query, name: mine, schema: { type: boolean } }
 *       - { in: query, name: overdue, schema: { type: boolean } }
 *     responses:
 *       200:
 *         description: Lista paginada
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Paginated'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { $ref: '#/components/schemas/FollowUp' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      studentId: req.query.studentId,
      status: req.query.status,
      priority: req.query.priority,
      assignedToId: req.query.assignedToId,
      mine: req.query.mine === 'true',
      overdue: req.query.overdue === 'true',
    };
    res.json(await listFollowUps(parsePagination(req.query), filters, req.user));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/follow-ups:
 *   post:
 *     tags: [Acompanhamento]
 *     summary: Abre um acompanhamento
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [studentId, title]
 *             properties:
 *               studentId:    { type: string }
 *               analysisId:   { type: string, description: Análise que motivou o acompanhamento }
 *               title:        { type: string, minLength: 3 }
 *               notes:        { type: string }
 *               priority:     { type: string, enum: [LOW, MEDIUM, HIGH], default: MEDIUM }
 *               status:       { type: string, enum: [OPEN, IN_PROGRESS, DONE, CANCELLED], default: OPEN }
 *               assignedToId: { type: string }
 *               dueDate:      { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Acompanhamento criado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/FollowUp' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post('/', authorize(...WRITE_ROLES), async (req, res, next) => {
  try {
    const data = validate(req.body, {
      studentId: { type: 'objectId', required: true },
      analysisId: { type: 'objectId' },
      title: { type: 'string', required: true, min: 3, max: 200 },
      notes: { type: 'string', max: 4000 },
      priority: { type: 'enum', values: PRIORITIES, default: 'MEDIUM' },
      status: { type: 'enum', values: Object.values(FOLLOWUP_STATUS), default: 'OPEN' },
      assignedToId: { type: 'objectId' },
      dueDate: { type: 'date' },
    });
    res.status(201).json(await createFollowUp(data, req.user));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/follow-ups/{id}:
 *   get:
 *     tags: [Acompanhamento]
 *     summary: Detalha um acompanhamento
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200:
 *         description: Acompanhamento
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/FollowUp' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', async (req, res, next) => {
  try {
    res.json(await getFollowUp(validateObjectId(req.params.id), req.user));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/follow-ups/{id}:
 *   patch:
 *     tags: [Acompanhamento]
 *     summary: Atualiza um acompanhamento
 *     description: |
 *       `resolvedAt` é derivado do status pelo servidor: passar para DONE ou
 *       CANCELLED registra a data, reabrir a limpa.
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:        { type: string }
 *               notes:        { type: string }
 *               status:       { type: string, enum: [OPEN, IN_PROGRESS, DONE, CANCELLED] }
 *               priority:     { type: string, enum: [LOW, MEDIUM, HIGH] }
 *               assignedToId: { type: string }
 *               dueDate:      { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Acompanhamento atualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/FollowUp' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/:id', authorize(...WRITE_ROLES), async (req, res, next) => {
  try {
    const data = validate(req.body, {
      title: { type: 'string', min: 3, max: 200 },
      notes: { type: 'string', max: 4000 },
      status: { type: 'enum', values: Object.values(FOLLOWUP_STATUS) },
      priority: { type: 'enum', values: PRIORITIES },
      assignedToId: { type: 'objectId' },
      dueDate: { type: 'date' },
    });
    res.json(await updateFollowUp(validateObjectId(req.params.id), data, req.user));
  } catch (error) {
    next(error);
  }
});

export default router;
