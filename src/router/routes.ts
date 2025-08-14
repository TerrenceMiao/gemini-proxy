import { FastifyInstance } from 'fastify';
import { getRouterLogger } from '@/log/logger';
import geminiRoutes from './geminiRoutes';
import openaiRoutes from './openaiRoutes';
import healthRoutes from './healthRoutes';

const logger = getRouterLogger();

export function setupRouters(app: FastifyInstance): void {
  logger.info('Setting up routers...');

  // Register health routes (no prefix for standard health endpoints)
  app.register(healthRoutes);

  // Register API routes
  app.register(geminiRoutes, { prefix: '/v1beta' });
  app.register(openaiRoutes, { prefix: '/v1' });
  // app.register(errorLogRoutes, { prefix: '/error-logs' });
  // app.register(keyRoutes, { prefix: '/keys' });
  // app.register(filesRoutes, { prefix: '/files' });
  // app.register(schedulerRoutes, { prefix: '/scheduler' });
  // app.register(versionRoutes, { prefix: '/version' });
  // app.register(vertexExpressRoutes, { prefix: '/vertex' });

  logger.info('Routers configured successfully');
}
