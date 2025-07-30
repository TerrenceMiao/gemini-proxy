import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getMiddlewareLogger } from '@/log/logger';
import { requestLoggingMiddleware } from './requestLoggingMiddleware';
import { smartRoutingMiddleware } from './smartRoutingMiddleware';

const logger = getMiddlewareLogger();

export function setupMiddlewares(app: FastifyInstance): void {
  logger.info('Setting up middlewares...');

  // Request logging middleware
  app.addHook('onRequest', requestLoggingMiddleware);

  // Smart routing middleware
  app.addHook('preHandler', smartRoutingMiddleware);

  // CORS middleware (already handled by @fastify/cors plugin)
  
  // Security middleware (already handled by @fastify/helmet plugin)

  logger.info('Middlewares configured successfully');
}