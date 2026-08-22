import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env.js';
import { swaggerSpec } from './config/swagger.js';
import { apiKeyAuth } from './middlewares/apiKeyAuth.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import classificationRoutes from './modules/classification/classification.routes.js';
import clusteringRoutes from './modules/clustering/clustering.routes.js';
import healthRoutes from './modules/health/health.routes.js';
import modelsRoutes from './modules/models/models.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  app.use(
    cors({
      origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : false,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
    }),
  );

  app.use(express.json({ limit: '5mb' }));

  if (env.isDevelopment) {
    app.use((req, _res, next) => {
      console.log(`[req] ${req.method} ${req.originalUrl}`);
      next();
    });
  }

  app.use('/api/health', healthRoutes);

  app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'backend-MD — API de IA e Mineração de Dados',
    }),
  );

  app.get('/', (_req, res) => {
    res.json({
      service: 'backend-MD',
      role: 'Motor de IA e Mineração de Dados',
      apiVersion: env.API_VERSION,
      docs: '/api/docs',
      health: '/api/health',
    });
  });

  app.use('/api', apiKeyAuth);
  app.use('/api', classificationRoutes);
  app.use('/api/clustering', clusteringRoutes);
  app.use('/api/models', modelsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
