import { Router } from 'express';

import { assignClusters, getProfiles } from './clustering.service.js';

const router = Router();

/**
 * @openapi
 * /api/clustering/profiles:
 *   get:
 *     tags: [Mineração de Dados]
 *     summary: Perfis de estudantes descobertos pelo agrupamento
 *     description: |
 *       Devolve os grupos encontrados pelo aprendizado não supervisionado, com
 *       tamanho, proporção, distribuição histórica das três classes dentro do
 *       grupo, nível de atenção sugerido e as médias dos atributos descritivos.
 *
 *       Análise complementar à classificação — não é predição individual.
 *     security: [{ ApiKeyAuth: [] }]
 *     responses:
 *       200:
 *         description: Perfis descobertos
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ClusterProfiles' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       503: { $ref: '#/components/responses/MlUnavailable' }
 */
router.get('/profiles', async (req, res, next) => {
  try {
    res.json(await getProfiles());
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/clustering/assign:
 *   post:
 *     tags: [Mineração de Dados]
 *     summary: Atribui estudantes aos perfis descobertos
 *     description: |
 *       Aplica o modelo de agrupamento treinado a um ou mais estudantes e devolve
 *       o grupo mais próximo, a distância até o centro do grupo e o resumo do
 *       perfil correspondente.
 *     security: [{ ApiKeyAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               features: { $ref: '#/components/schemas/StudentFeatures' }
 *               records:
 *                 type: array
 *                 items: { $ref: '#/components/schemas/StudentFeatures' }
 *     responses:
 *       200:
 *         description: Atribuição realizada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ClusterAssignment' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *       503: { $ref: '#/components/responses/MlUnavailable' }
 *       504: { $ref: '#/components/responses/MlTimeout' }
 */
router.post('/assign', async (req, res, next) => {
  try {
    res.json(await assignClusters(req.body));
  } catch (error) {
    next(error);
  }
});

export default router;
