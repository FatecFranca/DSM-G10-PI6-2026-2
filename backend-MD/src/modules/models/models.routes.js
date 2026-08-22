import { Router } from 'express';

import {
  getActiveModel,
  getModelByVersion,
  listClusteringModels,
  listModels,
  registerCurrentArtifacts,
} from './models.service.js';

const router = Router();

/**
 * @openapi
 * /api/models/active:
 *   get:
 *     tags: [Modelos]
 *     summary: Metadados do modelo em uso pela API
 *     description: |
 *       Lido diretamente dos artefatos em disco — é a verdade sobre o modelo que
 *       responde às classificações agora, independente do estado do banco.
 *
 *       Inclui os metadados de reprodutibilidade exigidos pela seção 4, item 11:
 *       algoritmo, hiperparâmetros, versão/impressão digital do dataset de treino,
 *       ordem das features, métricas de avaliação, comparação com os candidatos
 *       e a justificativa da escolha.
 *     security: [{ ApiKeyAuth: [] }]
 *     responses:
 *       200:
 *         description: Metadados do modelo ativo
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       503: { $ref: '#/components/responses/MlUnavailable' }
 */
router.get('/active', async (req, res, next) => {
  try {
    res.json(await getActiveModel());
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/models:
 *   get:
 *     tags: [Modelos]
 *     summary: Histórico de versões de modelo registradas
 *     description: Rastreabilidade entre execuções de treino (seção 9).
 *     security: [{ ApiKeyAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, minimum: 1, maximum: 200 }
 *     responses:
 *       200: { description: Lista de versões }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', async (req, res, next) => {
  try {
    res.json({ models: await listModels({ limit: Number(req.query.limit) || 50 }) });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/models/clustering:
 *   get:
 *     tags: [Modelos]
 *     summary: Histórico de execuções de agrupamento registradas
 *     security: [{ ApiKeyAuth: [] }]
 *     responses:
 *       200: { description: Lista de versões de agrupamento }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/clustering', async (req, res, next) => {
  try {
    res.json({ models: await listClusteringModels({ limit: Number(req.query.limit) || 50 }) });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/models/register:
 *   post:
 *     tags: [Modelos]
 *     summary: Registra no banco os artefatos atualmente em disco
 *     description: |
 *       Lê ML/artifacts/model_metadata.json (e cluster_metadata.json, se existir)
 *       e grava os metadados técnicos no MongoDB, marcando a versão como ativa e
 *       desativando a anterior. Idempotente por versão.
 *
 *       Equivalente ao script `npm run ml:register`, disponibilizado como endpoint
 *       para quem treina em uma máquina e registra a partir do serviço.
 *     security: [{ ApiKeyAuth: [] }]
 *     responses:
 *       200: { description: Artefatos registrados }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       503: { $ref: '#/components/responses/MlUnavailable' }
 */
router.post('/register', async (req, res, next) => {
  try {
    res.json(await registerCurrentArtifacts());
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/models/{version}:
 *   get:
 *     tags: [Modelos]
 *     summary: Metadados completos de uma versão registrada
 *     security: [{ ApiKeyAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: version
 *         required: true
 *         schema: { type: string }
 *         example: LogisticRegression-20260817T145904
 *     responses:
 *       200: { description: Metadados da versão }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:version', async (req, res, next) => {
  try {
    res.json(await getModelByVersion(req.params.version));
  } catch (error) {
    next(error);
  }
});

export default router;
