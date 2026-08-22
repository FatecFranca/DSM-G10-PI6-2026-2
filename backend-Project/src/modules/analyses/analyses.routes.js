import { Router } from 'express';

import { authenticate, authorize, ROLES } from '../../middlewares/auth.js';
import { parsePagination, validate, validateObjectId } from '../../utils/validate.js';
import {
  analyzeAdHoc,
  analyzeBatch,
  analyzeStudent,
  getAnalysis,
  listAnalyses,
} from './analyses.service.js';

const router = Router();

router.use(authenticate);

const RUN_ROLES = [ROLES.ADMIN, ROLES.ANALYST];

/**
 * @openapi
 * /api/analyses:
 *   get:
 *     tags: [Análises]
 *     summary: Histórico de análises
 *     description: |
 *       Dado de negócio: qual estudante foi analisado, quando e com que resultado.
 *       Os metadados técnicos do modelo (hiperparâmetros, métricas de treino) não
 *       estão aqui — ficam no backend-MD e são acessíveis por
 *       `GET /api/datamining/model`.
 *     parameters:
 *       - { in: query, name: page,  schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *       - { in: query, name: studentId, schema: { type: string } }
 *       - { in: query, name: classification, schema: { type: string, enum: [Dropout, Enrolled, Graduate] } }
 *       - { in: query, name: priority, schema: { type: string, enum: [LOW, MEDIUM, HIGH] } }
 *       - { in: query, name: modelVersion, schema: { type: string } }
 *       - { in: query, name: institutionId, schema: { type: string }, description: Apenas ADMIN }
 *       - { in: query, name: from, schema: { type: string, format: date-time } }
 *       - { in: query, name: to,   schema: { type: string, format: date-time } }
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
 *                     data: { type: array, items: { $ref: '#/components/schemas/AnalysisRecord' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      studentId: req.query.studentId,
      classification: req.query.classification,
      priority: req.query.priority,
      modelVersion: req.query.modelVersion,
      institutionId: req.query.institutionId,
      from: req.query.from ? new Date(req.query.from) : undefined,
      to: req.query.to ? new Date(req.query.to) : undefined,
    };
    res.json(await listAnalyses(parsePagination(req.query), filters, req.user));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/analyses/simulate:
 *   post:
 *     tags: [Análises]
 *     summary: Classifica um conjunto de características sem persistir
 *     description: |
 *       Executa a classificação sobre atributos enviados diretamente, sem exigir
 *       estudante cadastrado e sem gravar histórico. Serve para simular um cenário
 *       antes de decidir cadastrar alguém.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [features]
 *             properties:
 *               features: { $ref: '#/components/schemas/StudentFeatures' }
 *               includeClustering: { type: boolean, default: true }
 *     responses:
 *       200:
 *         description: Resultado da classificação
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AnalysisResult' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *       502: { $ref: '#/components/responses/MlServiceError' }
 *       503: { $ref: '#/components/responses/MlUnavailable' }
 */
router.post('/simulate', authorize(...RUN_ROLES), async (req, res, next) => {
  try {
    const { features, includeClustering } = validate(req.body, {
      features: { type: 'object', required: true },
      includeClustering: { type: 'boolean', default: true },
    });
    res.json(await analyzeAdHoc(features, { includeClustering }));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/analyses/batch:
 *   post:
 *     tags: [Análises]
 *     summary: Analisa vários estudantes de uma vez
 *     description: |
 *       Uma única ida ao serviço de IA para todo o lote. Estudantes inaptos
 *       (inativos, cadastro incompleto, fora do escopo) são devolvidos em
 *       `skipped` com o motivo — nunca ignorados em silêncio.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [studentIds]
 *             properties:
 *               studentIds:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 200
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Lote processado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 analyzed: { type: integer }
 *                 skipped:  { type: array, items: { type: object } }
 *                 results:  { type: array, items: { $ref: '#/components/schemas/AnalysisResult' } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *       502: { $ref: '#/components/responses/MlServiceError' }
 */
router.post('/batch', authorize(...RUN_ROLES), async (req, res, next) => {
  try {
    const ids = req.body?.studentIds;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(422).json({
        error: 'VALIDATION_ERROR',
        message: 'Informe "studentIds" com ao menos um identificador.',
      });
      return;
    }
    if (ids.length > 200) {
      res.status(422).json({
        error: 'BATCH_TOO_LARGE',
        message: 'O lote aceita no máximo 200 estudantes por requisição.',
      });
      return;
    }
    res.json(
      await analyzeBatch(
        ids.map((id) => validateObjectId(id, 'studentIds')),
        req.user,
        { includeClustering: req.body?.includeClustering !== false },
      ),
    );
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/analyses/student/{studentId}:
 *   post:
 *     tags: [Análises]
 *     summary: Executa a análise de um estudante cadastrado
 *     description: |
 *       Envia os atributos do estudante ao serviço de IA, deriva a prioridade de
 *       acompanhamento, grava no histórico e atualiza o resumo do estudante.
 *
 *       Exige cadastro completo de atributos. Se o agrupamento não estiver
 *       disponível no serviço de IA, a classificação é entregue mesmo assim e
 *       `cluster` volta nulo.
 *     parameters:
 *       - { in: path, name: studentId, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               includeClustering: { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: Análise registrada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AnalysisResult' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422:
 *         description: Cadastro de atributos incompleto
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *             example:
 *               error: INCOMPLETE_STUDENT_FEATURES
 *               message: O estudante não possui todos os atributos exigidos pelo modelo.
 *       502: { $ref: '#/components/responses/MlServiceError' }
 *       503: { $ref: '#/components/responses/MlUnavailable' }
 *       504: { $ref: '#/components/responses/MlTimeout' }
 */
router.post('/student/:studentId', authorize(...RUN_ROLES), async (req, res, next) => {
  try {
    const includeClustering = req.body?.includeClustering !== false;
    const result = await analyzeStudent(
      validateObjectId(req.params.studentId, 'studentId'),
      req.user,
      { includeClustering },
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/analyses/{id}:
 *   get:
 *     tags: [Análises]
 *     summary: Detalha uma análise do histórico
 *     description: |
 *       Inclui `featuresSnapshot` — a cópia dos atributos enviados no momento da
 *       análise. Sem isso, uma análise antiga não poderia ser auditada depois que
 *       o cadastro do estudante mudasse.
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200:
 *         description: Análise
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AnalysisResult' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', async (req, res, next) => {
  try {
    res.json(await getAnalysis(validateObjectId(req.params.id), req.user));
  } catch (error) {
    next(error);
  }
});

export default router;
