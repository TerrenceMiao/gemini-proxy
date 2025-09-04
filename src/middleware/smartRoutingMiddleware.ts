import { FastifyRequest, FastifyReply } from 'fastify';
import { getMiddlewareLogger } from '@/log/logger';

interface RequestWithRoutingData extends FastifyRequest {
  timestamp?: Date;
  isTTSRequest?: boolean;
  isImageRequest?: boolean;
}

interface GeminiRequestBody {
  responseModalities?: string[];
}

const logger = getMiddlewareLogger();

export function smartRoutingMiddleware(
  request: RequestWithRoutingData,
  _reply: FastifyReply
): void {
  // Add request ID for tracking
  if (!request.id) {
    request.id = Math.random().toString(36).substring(2, 15);
  }

  // Add timestamp
  request.timestamp = new Date();

  // Log route matching
  logger.debug({
    method: request.method,
    url: request.url,
    params: request.params,
    query: request.query,
    requestId: request.id,
  }, `Route matched: ${request.method} ${request.url}`);

  // Here you can add intelligent routing logic
  // For example, detecting TTS requests, model-specific routing, etc.
  
  // Detect TTS requests
  if (request.url.includes('generateContent') && request.body) {
    const body = request.body as GeminiRequestBody;
    if (body.responseModalities?.includes('AUDIO')) {
      request.isTTSRequest = true;
      logger.debug({ requestId: request.id }, 'TTS request detected');
    }
  }

  // Detect image generation requests
  if (request.url.includes('generateImage') || request.url.includes('image')) {
    request.isImageRequest = true;
    logger.debug({ requestId: request.id }, 'Image request detected');
  }

  // Add more intelligent routing logic as needed
}