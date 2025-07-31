import { FastifyInstance } from 'fastify';
import { getRouterLogger } from '@/log/logger';
import geminiRoutes from './geminiRoutes';
import openaiRoutes from './openaiRoutes';
import configRoutes from './configRoutes';
import statsRoutes from './statsRoutes';
import healthRoutes from './healthRoutes';

const logger = getRouterLogger();

export function setupRouters(app: FastifyInstance): void {
  logger.info('Setting up routers...');

  // Register health routes (no prefix for standard health endpoints)
  app.register(healthRoutes);

  // Register API routes
  app.register(geminiRoutes, { prefix: '/v1beta' });
  app.register(openaiRoutes, { prefix: '/v1' });
  app.register(configRoutes, { prefix: '/config' });
  app.register(statsRoutes, { prefix: '/stats' });
  // app.register(errorLogRoutes, { prefix: '/error-logs' });
  // app.register(keyRoutes, { prefix: '/keys' });
  // app.register(filesRoutes, { prefix: '/files' });
  // app.register(schedulerRoutes, { prefix: '/scheduler' });
  // app.register(versionRoutes, { prefix: '/version' });
  // app.register(vertexExpressRoutes, { prefix: '/vertex' });

  // Register page routes
  app.get('/', async (_request, reply) => {
    return reply.view('keys_status.html', { title: 'Gemini Proxy' });
  });

  app.get('/keys', async (_request, reply) => {
    return reply.view('keys_status.html', { title: 'Keys Status' });
  });

  app.get('/config', async (_request, reply) => {
    return reply.view('config_editor.html', { title: 'Configuration' });
  });

  app.get('/logs', async (_request, reply) => {
    return reply.view('error_logs.html', { title: 'Error Logs' });
  });

  logger.info('Routers configured successfully');
}