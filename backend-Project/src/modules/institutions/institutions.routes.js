import { Router } from 'express';

import { authenticate, authorize, ROLES } from '../../middlewares/auth.js';
import { parsePagination, validate, validateObjectId } from '../../utils/validate.js';
import {
  createInstitution,
  deactivateInstitution,
  getInstitution,
  listInstitutions,
  updateInstitution,
} from './institutions.service.js';

const router = Router();

router.use(authenticate);

const bodySchema = {
  name: { type: 'string', min: 3, max: 160 },
  city: { type: 'string', max: 120 },
  state: { type: 'string', max: 60 },
  type: { type: 'string', max: 60 },
  email: { type: 'email' },
  phone: { type: 'string', max: 40 },
  active: { type: 'boolean' },
};

/**
 * @openapi
 * /api/institutions:
 *   get:
 *     tags: [Administração]
 *     summary: Lista instituições
 *     description: |
 *       ADMIN vê todas. Usuários ANALYST/VIEWER veem apenas a própria instituição.
 *     parameters:
 *       - { in: query, name: page,  schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: active, schema: { type: boolean } }
 *       - { in: query, name: search, schema: { type: string } }
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
 *                     data: { type: array, items: { $ref: '#/components/schemas/Institution' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      search: req.query.search,
      active: req.query.active === undefined ? undefined : req.query.active === 'true',
    };
    res.json(await listInstitutions(parsePagination(req.query), filters, req.user));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/institutions/{id}:
 *   get:
 *     tags: [Administração]
 *     summary: Detalha uma instituição
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200:
 *         description: Instituição
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Institution' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', async (req, res, next) => {
  try {
    res.json(await getInstitution(validateObjectId(req.params.id), req.user));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/institutions:
 *   post:
 *     tags: [Administração]
 *     summary: Cria uma instituição
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:  { type: string, minLength: 3 }
 *               city:  { type: string }
 *               state: { type: string }
 *               type:  { type: string, description: "Ex.: pública, privada, ONG, entidade social" }
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *     responses:
 *       201:
 *         description: Instituição criada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Institution' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409: { $ref: '#/components/responses/Conflict' }
 */
router.post('/', authorize(ROLES.ADMIN), async (req, res, next) => {
  try {
    const data = validate(req.body, { ...bodySchema, name: { ...bodySchema.name, required: true } });
    res.status(201).json(await createInstitution(data));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/institutions/{id}:
 *   patch:
 *     tags: [Administração]
 *     summary: Atualiza uma instituição
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Institution' }
 *     responses:
 *       200:
 *         description: Instituição atualizada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Institution' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/:id', authorize(ROLES.ADMIN), async (req, res, next) => {
  try {
    res.json(
      await updateInstitution(validateObjectId(req.params.id), validate(req.body, bodySchema)),
    );
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/institutions/{id}:
 *   delete:
 *     tags: [Administração]
 *     summary: Desativa uma instituição
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Instituição desativada }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.delete('/:id', authorize(ROLES.ADMIN), async (req, res, next) => {
  try {
    res.json(await deactivateInstitution(validateObjectId(req.params.id)));
  } catch (error) {
    next(error);
  }
});

export default router;
