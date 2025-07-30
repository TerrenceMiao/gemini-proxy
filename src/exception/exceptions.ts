import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getApplicationLogger } from '@/log/logger';
import { HTTP_STATUS_CODES } from '@/core/constants';

const logger = getApplicationLogger();

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, HTTP_STATUS_CODES.BAD_REQUEST);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, HTTP_STATUS_CODES.UNAUTHORIZED);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Authorization failed') {
    super(message, HTTP_STATUS_CODES.FORBIDDEN);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, HTTP_STATUS_CODES.NOT_FOUND);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, HTTP_STATUS_CODES.CONFLICT);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, HTTP_STATUS_CODES.TOO_MANY_REQUESTS);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string = 'External service error') {
    super(message, HTTP_STATUS_CODES.BAD_GATEWAY);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database error') {
    super(message, HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string = 'Configuration error') {
    super(message, HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
  }
}

export function setupExceptionHandlers(app: FastifyInstance): void {
  // Global error handler
  app.setErrorHandler(async (error: Error, request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.id;
    
    // Log the error
    logger.error(`Error ${requestId}: ${error.message}`, {
      error: error.stack,
      url: request.url,
      method: request.method,
      body: request.body,
      headers: request.headers,
    });

    // Handle known application errors
    if (error instanceof AppError) {
      await reply.status(error.statusCode).send({
        error: {
          message: error.message,
          statusCode: error.statusCode,
          timestamp: new Date().toISOString(),
          path: request.url,
          requestId,
        },
      });
      return;
    }

    // Handle Fastify validation errors
    if (error.name === 'ValidationError') {
      await reply.status(HTTP_STATUS_CODES.BAD_REQUEST).send({
        error: {
          message: 'Validation error',
          details: error.message,
          statusCode: HTTP_STATUS_CODES.BAD_REQUEST,
          timestamp: new Date().toISOString(),
          path: request.url,
          requestId,
        },
      });
      return;
    }

    // Handle other errors
    await reply.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).send({
      error: {
        message: 'Internal server error',
        statusCode: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId,
      },
    });
  });

  // Handle 404 errors
  app.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    await reply.status(HTTP_STATUS_CODES.NOT_FOUND).send({
      error: {
        message: 'Route not found',
        statusCode: HTTP_STATUS_CODES.NOT_FOUND,
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId: request.id,
      },
    });
  });

  logger.info('Exception handlers configured');
}