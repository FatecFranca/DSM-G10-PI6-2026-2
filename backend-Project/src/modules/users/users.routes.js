import { Router } from 'express';

import { authenticate, authorize, ROLES } from '../../middlewares/auth.js';
import { parsePagination, validate, validateObjectId } from '../../utils/validate.js';
import {
  createUser,
  deactivateUser,
  getUser,
  listUsers,
  resetUserPassword,
  updateUser,
} from './users.service.js';

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags: [Administração]
 *     summary: Lista usuários
 *     parameters:
 *       - { in: query, name: page,  schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *       - { in: query, name: role,  schema: { type: string, enum: [ADMIN, ANALYST, VIEWER] } }
 *       - { in: query, name: institutionId, schema: { type: string } }
 *       - { in: query, name: active, schema: { type: boolean } }
 *       - { in: query, name: search, schema: { type: string }, description: Nome ou e-mail }
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
 *                     data: { type: array, items: { $ref: '#/components/schemas/User' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      role: req.query.role,
      institutionId: req.query.institutionId,
      search: req.query.search,
      active: req.query.active === undefined ? undefined : req.query.active === 'true',
    };
    res.json(await listUsers(parsePagination(req.query), filters));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/users:
 *   post:
 *     tags: [Administração]
 *     summary: Cria um usuário
 *     description: |
 *       A senha é armazenada apenas como hash bcrypt. Papéis ANALYST e VIEWER
 *       exigem `institutionId`, porque operam no escopo de uma instituição.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name:          { type: string, minLength: 3 }
 *               email:         { type: string, format: email }
 *               password:      { type: string, format: password, minLength: 8 }
 *               role:          { type: string, enum: [ADMIN, ANALYST, VIEWER] }
 *               institutionId: { type: string, nullable: true }
 *               active:        { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: Usuário criado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post('/', async (req, res, next) => {
  try {
    const data = validate(req.body, {
      name: { type: 'string', required: true, min: 3, max: 120 },
      email: { type: 'email', required: true },
      password: { type: 'password', required: true, min: 8 },
      role: { type: 'enum', required: true, values: Object.values(ROLES) },
      institutionId: { type: 'objectId' },
      active: { type: 'boolean', default: true },
    });
    res.status(201).json(await createUser(data));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     tags: [Administração]
 *     summary: Detalha um usuário
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200:
 *         description: Usuário
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', async (req, res, next) => {
  try {
    res.json(await getUser(validateObjectId(req.params.id)));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/users/{id}:
 *   patch:
 *     tags: [Administração]
 *     summary: Atualiza um usuário
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:          { type: string }
 *               email:         { type: string, format: email }
 *               role:          { type: string, enum: [ADMIN, ANALYST, VIEWER] }
 *               institutionId: { type: string }
 *               active:        { type: boolean }
 *     responses:
 *       200:
 *         description: Usuário atualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       400:
 *         description: "Operação bloqueada (ex.: alterar o próprio papel)"
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const data = validate(req.body, {
      name: { type: 'string', min: 3, max: 120 },
      email: { type: 'email' },
      role: { type: 'enum', values: Object.values(ROLES) },
      institutionId: { type: 'objectId' },
      active: { type: 'boolean' },
    });
    res.json(await updateUser(validateObjectId(req.params.id), data, req.user));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/users/{id}/password:
 *   post:
 *     tags: [Administração]
 *     summary: Redefine a senha de um usuário
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPassword]
 *             properties:
 *               newPassword: { type: string, format: password, minLength: 8 }
 *     responses:
 *       200: { description: Senha redefinida }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.post('/:id/password', async (req, res, next) => {
  try {
    const { newPassword } = validate(req.body, {
      newPassword: { type: 'password', required: true, min: 8 },
    });
    res.json(await resetUserPassword(validateObjectId(req.params.id), newPassword));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/users/{id}:
 *   delete:
 *     tags: [Administração]
 *     summary: Desativa um usuário
 *     description: |
 *       Desativa em vez de excluir: o usuário aparece como autor de análises e
 *       acompanhamentos, e apagar o registro deixaria esse histórico órfão.
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200:
 *         description: Usuário desativado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.delete('/:id', async (req, res, next) => {
  try {
    res.json(await deactivateUser(validateObjectId(req.params.id), req.user));
  } catch (error) {
    next(error);
  }
});

export default router;
