import { FastifyRequest, FastifyReply } from 'fastify';
import { getMiddlewareLogger } from '@/log/logger';
import { settings } from '@/config/config';

const logger = getMiddlewareLogger();

export async function responseLoggingMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!settings.REQUEST_LOG_ENABLED) {
    return;
  }

  const startTime = (request as any).startTime;
  const clientIp = (request as any).clientIp;
  const userAgent = (request as any).userAgent;

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