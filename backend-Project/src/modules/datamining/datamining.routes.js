import { Router } from 'express';

import { authenticate, authorize, ROLES } from '../../middlewares/auth.js';
import * as md from '../../services/mdClient.js';

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));

/**
 * @openapi
 * /api/datamining/model:
 *   get:
 *     tags: [Mineração de Dados]
 *     summary: Modelo em uso e seu processo de construção
 *     description: |
 *       Exclusivo do papel ADMIN.
 *
 *       Expõe, para a interface, as etapas do processo de Mineração de Dados que o
 *       modelo atravessou: algoritmo escolhido, por que foi escolhido frente aos
 *       candidatos, métricas de avaliação (incluindo matriz de confusão e relatório
 *       por classe), atributos mais influentes e a versão do dataset de treino.
 *
 *       Estes dados vivem no backend-MD e são apenas repassados — não são copiados
 *       para o banco de negócio.
 *     responses:
 *       200:
 *         description: Metadados do modelo ativo
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       502: { $ref: '#/components/responses/MlServiceError' }
 *       503: { $ref: '#/components/responses/MlUnavailable' }
 */
router.get('/model', async (req, res, next) => {
  try {
    const model = await md.getActiveModel();

    res.json({
      model: {
        version: model.modelVersion,
        algorithm: model.algorithm,
        task: model.task,
        classes: model.classes,
        trainedAt: model.trainedAt,
        supportsProbability: model.supportsProbability,
      },
      process: {
        dataUnderstanding: model.dataset,
        preparation: model.preprocessing,
        featureSelection: {
          count: model.features?.count,
          order: model.features?.order,
          importance: model.featureImportance,
          importanceMethod: model.featureImportanceMethod ?? null,
        },
        modelSelection: {
          candidates: model.candidates,
          criteria: model.selectionCriteria,
          rationale: model.selectionRationale,
        },
        evaluation: model.metrics,
      },
      environment: model.environment,
      disclaimer: model.disclaimer,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
