import { FastifyRequest, FastifyReply } from 'fastify';
import { getMiddlewareLogger } from '@/log/logger';
import { settings } from '@/config/config';

const logger = getMiddlewareLogger();

export function responseLoggingMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): void {
  if (!settings.REQUEST_LOG_ENABLED) {
    return;
  }

  const startTime = (request as { startTime?: number }).startTime;
  const clientIp = (request as { clientIp?: string }).clientIp;
  const userAgent = (request as { userAgent?: string }).userAgent;

  if (startTime) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    logger.info({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration,
      clientIp,
      userAgent,
      requestId: request.id,
    }, `Request completed: ${request.method} ${request.url}`);
  }
} 