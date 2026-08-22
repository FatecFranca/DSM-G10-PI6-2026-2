import { Router } from 'express';

import { env } from '../../config/env.js';
import { checkDatabase } from '../../lib/prisma.js';
import { checkMdService } from '../../services/mdClient.js';

const router = Router();

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [Saúde]
 *     summary: Estado da API, do banco e do serviço de IA
 *     description: |
 *       Endpoint público. Retorna 200 quando o banco responde — a API de negócio
 *       continua útil (consultas, cadastros, painéis) mesmo se o serviço de IA
 *       estiver fora; nesse caso `mlService.reachable` vem `false` e apenas as
 *       rotas de análise ficam indisponíveis.
 *     security: []
 *     responses:
 *       200:
 *         description: API saudável
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Health' }
 *       503:
 *         description: Banco indisponível
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Health' }
 */
router.get('/', async (req, res, next) => {
  try {
    const [database, mlService] = await Promise.all([checkDatabase(), checkMdService()]);

    const healthy = database.connected;

    res.status(healthy ? 200 : 503).json({
      status: healthy ? (mlService.reachable ? 'ok' : 'degraded') : 'unavailable',
      service: 'backend-Project',
      role: 'API principal e núcleo de negócio',
      apiVersion: env.API_VERSION,
      environment: env.NODE_ENV,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      database: { connected: database.connected },
      mlService: {
        reachable: mlService.reachable,
        status: mlService.status ?? null,
        classifierReady: mlService.classifierReady ?? false,
        clusteringReady: mlService.clusteringReady ?? false,
        modelVersion: mlService.modelVersion ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
