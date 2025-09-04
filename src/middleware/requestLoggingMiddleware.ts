import { FastifyRequest, FastifyReply } from 'fastify';
import { getMiddlewareLogger } from '@/log/logger';
import { getClientIp, redactSensitiveData } from '@/utils/helpers';
import { settings } from '@/config/config';

interface RequestWithLoggingData extends FastifyRequest {
  startTime?: number;
  clientIp?: string | string[];
  userAgent?: string;
}

const logger = getMiddlewareLogger();

export function requestLoggingMiddleware(
  request: RequestWithLoggingData,
  _reply: FastifyReply
): void {
  if (!settings.REQUEST_LOG_ENABLED) {
    return;
  }

  const startTime = Date.now();
  const clientIp = getClientIp(request as { headers: Record<string, string | string[] | undefined>; connection?: { remoteAddress?: string }; socket?: { remoteAddress?: string }; ip?: string });
  const userAgent = request.headers['user-agent'] ?? 'unknown';
  
  // Log incoming request
  logger.info({
    method: request.method,
    url: request.url,
    clientIp,
    userAgent,
    headers: redactSensitiveData(request.headers),
    body: redactSensitiveData(request.body),
    requestId: request.id,
  }, `Incoming request: ${request.method} ${request.url}`);

  // Store start time for response logging
  (request as { startTime?: number; clientIp?: string | string[]; userAgent?: string }).startTime = startTime;
  (request as { startTime?: number; clientIp?: string | string[]; userAgent?: string }).clientIp = clientIp;
  (request as { startTime?: number; clientIp?: string | string[]; userAgent?: string }).userAgent = userAgent;
}