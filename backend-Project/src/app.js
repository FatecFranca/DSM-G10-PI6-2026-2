import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env.js';
import { swaggerSpec } from './config/swagger.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import analysesRoutes from './modules/analyses/analyses.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import dataminingRoutes from './modules/datamining/datamining.routes.js';
import followUpsRoutes from './modules/followups/followups.routes.js';
import healthRoutes from './modules/health/health.routes.js';
import institutionsRoutes from './modules/institutions/institutions.routes.js';
import studentsRoutes from './modules/students/students.routes.js';
import usersRoutes from './modules/users/users.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  if (env.isProduction) app.set('trust proxy', 1);

  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  app.use(express.json({ limit: '2mb' }));

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
      customSiteTitle: 'backend-Project — API principal',
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  app.get('/', (_req, res) => {
    res.json({
      service: 'backend-Project',
      role: 'API principal e núcleo de negócio',
      apiVersion: env.API_VERSION,
      docs: '/api/docs',
      health: '/api/health',
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/institutions', institutionsRoutes);
  app.use('/api/students', studentsRoutes);
  app.use('/api/analyses', analysesRoutes);
  app.use('/api/follow-ups', followUpsRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/datamining', dataminingRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
