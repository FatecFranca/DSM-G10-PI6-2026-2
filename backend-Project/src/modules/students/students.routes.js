import { Router } from 'express';

import { authenticate, authorize, ROLES } from '../../middlewares/auth.js';
import { loadFeatureContract } from '../../services/featureContract.js';
import { parsePagination, validate, validateObjectId } from '../../utils/validate.js';
import {
  createStudent,
  deactivateStudent,
  getStudent,
  listStudents,
  updateStudent,
} from './students.service.js';

const router = Router();

router.use(authenticate);

const WRITE_ROLES = [ROLES.ADMIN, ROLES.ANALYST];

/**
 * @openapi
 * /api/students/feature-contract:
 *   get:
 *     tags: [Estudantes]
 *     summary: Contrato de atributos aceito pelo modelo
 *     description: |
 *       Repassa o contrato do backend-MD: nome, rótulo legível, tipo e faixa
 *       observada no treino de cada atributo. É o que a interface deve usar para
 *       montar o formulário do estudante — em vez de manter a lista de 36 campos
 *       duplicada no front.
 *
 *       O front consome isto daqui, nunca do backend-MD diretamente.
 *     responses:
 *       200:
 *         description: Contrato de atributos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 featureCount: { type: integer, example: 36 }
 *                 featureOrder: { type: array, items: { type: string } }
 *                 features:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/FeatureSpec' }
 *                 classes: { type: array, items: { type: string } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       502: { $ref: '#/components/responses/MlServiceError' }
 *       503: { $ref: '#/components/responses/MlUnavailable' }
 */
router.get('/feature-contract', async (req, res, next) => {
  try {
    res.json(await loadFeatureContract({ force: req.query.refresh === 'true' }));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/students:
 *   get:
 *     tags: [Estudantes]
 *     summary: Lista estudantes
 *     description: |
 *       Escopo automático por instituição para ANALYST/VIEWER. `sort=priority`
 *       devolve primeiro os de prioridade alta — a ordem útil para uma fila de
 *       acompanhamento.
 *     parameters:
 *       - { in: query, name: page,  schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *       - { in: query, name: search, schema: { type: string }, description: Nome, código ou e-mail }
 *       - { in: query, name: classification, schema: { type: string, enum: [Dropout, Enrolled, Graduate] } }
 *       - { in: query, name: priority, schema: { type: string, enum: [LOW, MEDIUM, HIGH] } }
 *       - { in: query, name: institutionId, schema: { type: string }, description: Apenas para ADMIN }
 *       - { in: query, name: analyzed, schema: { type: boolean }, description: Filtra por já analisado }
 *       - { in: query, name: active, schema: { type: boolean } }
 *       - { in: query, name: sort, schema: { type: string, enum: [createdAt, name, priority, recentAnalysis] } }
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
 *                     data: { type: array, items: { $ref: '#/components/schemas/StudentSummary' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      search: req.query.search,
      classification: req.query.classification,
      priority: req.query.priority,
      institutionId: req.query.institutionId,
      sort: req.query.sort,
      analyzed: req.query.analyzed === undefined ? undefined : req.query.analyzed === 'true',
      active: req.query.active === undefined ? undefined : req.query.active === 'true',
    };
    res.json(await listStudents(parsePagination(req.query), filters, req.user));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/students/{id}:
 *   get:
 *     tags: [Estudantes]
 *     summary: Detalha um estudante
 *     description: |
 *       Inclui os atributos cadastrados, o status de preenchimento em relação ao
 *       contrato do modelo (`featuresStatus`), as 10 análises mais recentes e os
 *       acompanhamentos abertos.
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200:
 *         description: Estudante
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Student' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', async (req, res, next) => {
  try {
    res.json(await getStudent(validateObjectId(req.params.id), req.user));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/students:
 *   post:
 *     tags: [Estudantes]
 *     summary: Cadastra um estudante
 *     description: |
 *       `features` é opcional no cadastro — o estudante pode ser registrado antes
 *       de os dados acadêmicos estarem completos. A análise é que exige o conjunto
 *       completo de atributos.
 *
 *       Valores fora da faixa observada no treino não bloqueiam o cadastro, mas
 *       retornam em `warnings`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name]
 *             properties:
 *               code:           { type: string, description: Matrícula/código na instituição }
 *               name:           { type: string, minLength: 3 }
 *               email:          { type: string, format: email }
 *               course:         { type: string }
 *               enrollmentYear: { type: integer, example: 2026 }
 *               institutionId:  { type: string, description: Obrigatório para ADMIN }
 *               features:       { $ref: '#/components/schemas/StudentFeatures' }
 *     responses:
 *       201:
 *         description: Estudante criado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Student' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post('/', authorize(...WRITE_ROLES), async (req, res, next) => {
  try {
    const data = validate(req.body, {
      code: { type: 'string', required: true, min: 1, max: 40 },
      name: { type: 'string', required: true, min: 3, max: 160 },
      email: { type: 'email' },
      course: { type: 'string', max: 160 },
      enrollmentYear: { type: 'number', integer: true, min: 1900, max: 2200 },
      institutionId: { type: 'objectId' },
      features: { type: 'object' },
      active: { type: 'boolean' },
    });
    res.status(201).json(await createStudent(data, req.user));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/students/{id}:
 *   patch:
 *     tags: [Estudantes]
 *     summary: Atualiza um estudante
 *     description: |
 *       `features` é mesclado com o que já existe, não substituído: enviar apenas
 *       os atributos editados não apaga o restante do cadastro.
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:           { type: string }
 *               name:           { type: string }
 *               email:          { type: string, format: email }
 *               course:         { type: string }
 *               enrollmentYear: { type: integer }
 *               active:         { type: boolean }
 *               features:       { $ref: '#/components/schemas/StudentFeatures' }
 *     responses:
 *       200:
 *         description: Estudante atualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Student' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.patch('/:id', authorize(...WRITE_ROLES), async (req, res, next) => {
  try {
    const data = validate(req.body, {
      code: { type: 'string', min: 1, max: 40 },
      name: { type: 'string', min: 3, max: 160 },
      email: { type: 'email' },
      course: { type: 'string', max: 160 },
      enrollmentYear: { type: 'number', integer: true, min: 1900, max: 2200 },
      features: { type: 'object' },
      active: { type: 'boolean' },
    });
    res.json(await updateStudent(validateObjectId(req.params.id), data, req.user));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/students/{id}:
 *   delete:
 *     tags: [Estudantes]
 *     summary: Desativa um estudante
 *     description: |
 *       Desativa em vez de excluir: o estudante é referenciado por análises
 *       históricas e acompanhamentos.
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Estudante desativado }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.delete('/:id', authorize(...WRITE_ROLES), async (req, res, next) => {
  try {
    res.json(await deactivateStudent(validateObjectId(req.params.id), req.user));
  } catch (error) {
    next(error);
  }
});

export default router;
