import { FastifyRequest, FastifyReply } from 'fastify';
import { getMiddlewareLogger } from '@/log/logger';
import { getClientIp, redactSensitiveData } from '@/utils/helpers';
import { settings } from '@/config/config';

const logger = getMiddlewareLogger();

export async function requestLoggingMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  if (!settings.REQUEST_LOG_ENABLED) {
    return;
  }

  const startTime = Date.now();
  const clientIp = getClientIp(request);
  const userAgent = request.headers['user-agent'] || 'unknown';
  
  // Log incoming request
  logger.info(`Incoming request: ${request.method} ${request.url}`, {
    method: request.method,
    url: request.url,
    clientIp,
    userAgent,
    headers: redactSensitiveData(request.headers),
    body: redactSensitiveData(request.body),
    requestId: request.id,
  });

  // Store start time for response logging
  (request as any).startTime = startTime;
  (request as any).clientIp = clientIp;
  (request as any).userAgent = userAgent;
}