import { Router } from 'express';

import { env } from '../../config/env.js';
import { checkDatabase } from '../../lib/prisma.js';
import { getMlStatus } from '../../ml/artifacts.js';

const router = Router();

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [Saúde]
 *     summary: Estado do serviço, do banco e da camada de ML
 *     description: |
 *       Endpoint público. Retorna 200 quando o serviço está apto a classificar e
 *       503 quando a camada de ML não está pronta (modelo não treinado, por
 *       exemplo) — assim o orquestrador não envia tráfego para uma instância que
 *       ainda não consegue responder.
 *     security: []
 *     responses:
 *       200:
 *         description: Serviço saudável
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Health' }
 *       503:
 *         description: Serviço no ar, mas incapaz de classificar
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Health' }
 */
router.get('/', async (req, res, next) => {
  try {
    const [database, ml] = await Promise.all([checkDatabase(), getMlStatus()]);

    const healthy = ml.classifierReady && ml.featureSpecReady;

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      service: 'backend-MD',
      role: 'IA / Mineração de Dados',
      apiVersion: env.API_VERSION,
      environment: env.NODE_ENV,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      database: { connected: database.connected },
      ml: {
        featureSpecReady: ml.featureSpecReady,
        classifierReady: ml.classifierReady,
        modelVersion: ml.modelVersion,
        bridge: 'child_process',
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
