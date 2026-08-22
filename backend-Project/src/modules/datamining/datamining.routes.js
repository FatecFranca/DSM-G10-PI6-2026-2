import { Router } from 'express';

import { prisma } from '../../lib/prisma.js';
import { authenticate, institutionScope, ROLES } from '../../middlewares/auth.js';
import * as md from '../../services/mdClient.js';

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * /api/datamining/profiles:
 *   get:
 *     tags: [Mineração de Dados]
 *     summary: Perfis de estudantes descobertos pelo agrupamento
 *     description: |
 *       Repassa os grupos encontrados pelo aprendizado não supervisionado, com
 *       tamanho, proporção, distribuição histórica das classes no grupo, nível de
 *       atenção e médias dos atributos descritivos.
 *
 *       Análise complementar à classificação, não predição individual.
 *     responses:
 *       200:
 *         description: Perfis descobertos
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ClusterProfiles' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       502: { $ref: '#/components/responses/MlServiceError' }
 *       503: { $ref: '#/components/responses/MlUnavailable' }
 */
router.get('/profiles', async (req, res, next) => {
  try {
    res.json(await md.getClusterProfiles());
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/datamining/model:
 *   get:
 *     tags: [Mineração de Dados]
 *     summary: Modelo em uso e seu processo de construção
 *     description: |
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

/**
 * @openapi
 * /api/datamining/cluster-distribution:
 *   get:
 *     tags: [Mineração de Dados]
 *     summary: Distribuição dos estudantes analisados entre os perfis
 *     description: |
 *       Cruza os perfis descobertos pelo agrupamento (backend-MD) com os
 *       estudantes efetivamente analisados nesta base (backend-Project) — é o que
 *       permite responder "quantos dos nossos estudantes caem em cada perfil".
 *
 *       Só considera análises que incluíram agrupamento.
 *     responses:
 *       200:
 *         description: Distribuição por perfil
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       502: { $ref: '#/components/responses/MlServiceError' }
 */
router.get('/cluster-distribution', async (req, res, next) => {
  try {
    const scope =
      req.query.institutionId && req.user.role === ROLES.ADMIN
        ? { institutionId: req.query.institutionId }
        : institutionScope(req.user);

    const [profiles, groups] = await Promise.all([
      md.getClusterProfiles(),
      prisma.analysis.groupBy({
        by: ['clusterId'],
        where: { ...scope, clusterId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const counts = new Map(groups.map((group) => [group.clusterId, group._count._all]));
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);

    res.json({
      clustering: profiles.clustering,
      totalAnalysesWithCluster: total,
      distribution: profiles.profiles.map((profile) => ({
        clusterId: profile.clusterId,
        attentionLevel: profile.attentionLevel,
        dropoutRatio: profile.dropoutRatio,
        trainingSize: profile.size,
        trainingRatio: profile.ratio,
        localCount: counts.get(profile.clusterId) ?? 0,
        localRatio:
          total > 0 ? Number(((counts.get(profile.clusterId) ?? 0) / total).toFixed(4)) : 0,
        featureMeans: profile.featureMeans,
      })),
      disclaimer: profiles.disclaimer,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
