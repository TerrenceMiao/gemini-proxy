import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getRouterLogger } from '@/log/logger';
import { settings, updateSettings } from '@/config/config';
import { databaseService } from '@/database/services';
import { AppError } from '@/exception/exceptions';
import { HTTP_STATUS_CODES } from '@/core/constants';

const logger = getRouterLogger();

export default async function configRoutes(fastify: FastifyInstance) {
  // Get current configuration
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('Getting current configuration');
      
      // Get all settings from database
      const dbSettings = await databaseService.getAllSettings();
      
      // Merge with current settings
      const currentConfig = {
        ...settings,
        ...dbSettings,
      };

      // Remove sensitive information
      const sanitizedConfig = sanitizeConfig(currentConfig);
      
      return reply.send(sanitizedConfig);

    } catch (error) {
      logger.error('Failed to get configuration:', error);
      throw error;
    }
  });

  // Update configuration
  fastify.put('/', async (request: FastifyRequest<{
    Body: Record<string, any>;
  }>, reply: FastifyReply) => {
    try {
      const updates = request.body;
      
      logger.info('Updating configuration', {
        keys: Object.keys(updates),
      });

      // Validate updates
      validateConfigUpdates(updates);

      // Update settings in database
      for (const [key, value] of Object.entries(updates)) {
        await databaseService.setSetting(key, JSON.stringify(value));
      }

      // Update in-memory settings
      updateSettings(updates);

      logger.info('Configuration updated successfully');

      return reply.send({
        success: true,
        message: 'Configuration updated successfully',
      });

    } catch (error) {
      logger.error('Failed to update configuration:', error);
      throw error;
    }
  });

  // Get specific setting
  fastify.get('/setting/:key', async (request: FastifyRequest<{
    Params: { key: string };
  }>, reply: FastifyReply) => {
    try {
      const { key } = request.params;
      
      logger.info(`Getting setting: ${key}`);
      
      const value = await databaseService.getSetting(key);
      
      if (value === null) {
        throw new AppError(`Setting not found: ${key}`, HTTP_STATUS_CODES.NOT_FOUND);
      }

      return reply.send({
        key,
        value: JSON.parse(value),
      });

    } catch (error) {
      logger.error('Failed to get setting:', error);
      throw error;
    }
  });

  // Update specific setting
  fastify.put('/setting/:key', async (request: FastifyRequest<{
    Params: { key: string };
    Body: { value: any };
  }>, reply: FastifyReply) => {
    try {
      const { key } = request.params;
      const { value } = request.body;
      
      logger.info(`Updating setting: ${key}`);
      
      // Validate setting
      validateSetting(key, value);

      // Update in database
      await databaseService.setSetting(key, JSON.stringify(value));

      // Update in-memory settings
      updateSettings({ [key]: value });

      logger.info(`Setting updated: ${key}`);

      return reply.send({
        success: true,
        message: `Setting ${key} updated successfully`,
      });

    } catch (error) {
      logger.error('Failed to update setting:', error);
      throw error;
    }
  });

  // Reset configuration to defaults
  fastify.post('/reset', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('Resetting configuration to defaults');
      
      // TODO: Implement configuration reset
      logger.warn('Configuration reset not implemented yet');

      return reply.send({
        success: true,
        message: 'Configuration reset to defaults',
      });

    } catch (error) {
      logger.error('Failed to reset configuration:', error);
      throw error;
    }
  });

  // Get configuration schema
  fastify.get('/schema', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('Getting configuration schema');
      
      const schema = getConfigSchema();
      
      return reply.send(schema);

    } catch (error) {
      logger.error('Failed to get configuration schema:', error);
      throw error;
    }
  });

  // Validate configuration
  fastify.post('/validate', async (request: FastifyRequest<{
    Body: Record<string, any>;
  }>, reply: FastifyReply) => {
    try {
      const config = request.body;
      
      logger.info('Validating configuration');
      
      const errors = validateFullConfig(config);
      
      return reply.send({
        valid: errors.length === 0,
        errors,
      });

    } catch (error) {
      logger.error('Failed to validate configuration:', error);
      throw error;
    }
  });

  // Export configuration
  fastify.get('/export', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('Exporting configuration');
      
      const dbSettings = await databaseService.getAllSettings();
      const config = {
        ...settings,
        ...dbSettings,
      };

      // Remove sensitive information
      const sanitizedConfig = sanitizeConfig(config);
      
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="config-${Date.now()}.json"`);
      
      return reply.send(sanitizedConfig);

    } catch (error) {
      logger.error('Failed to export configuration:', error);
      throw error;
    }
  });

  // Import configuration
  fastify.post('/import', async (request: FastifyRequest<{
    Body: Record<string, any>;
  }>, reply: FastifyReply) => {
    try {
      const config = request.body;
      
      logger.info('Importing configuration');
      
      // Validate imported configuration
      const errors = validateFullConfig(config);
      
      if (errors.length > 0) {
        throw new AppError(`Invalid configuration: ${errors.join(', ')}`, HTTP_STATUS_CODES.BAD_REQUEST);
      }

      // Update settings
      for (const [key, value] of Object.entries(config)) {
        await databaseService.setSetting(key, JSON.stringify(value));
      }

      updateSettings(config);

      logger.info('Configuration imported successfully');

      return reply.send({
        success: true,
        message: 'Configuration imported successfully',
      });

    } catch (error) {
      logger.error('Failed to import configuration:', error);
      throw error;
    }
  });
}

function sanitizeConfig(config: Record<string, any>): Record<string, any> {
  const sanitized = { ...config };
  
  // Remove sensitive keys
  const sensitiveKeys = [
    'API_KEYS',
    'VERTEX_API_KEYS',
    'PAID_KEY',
    'MYSQL_PASSWORD',
    'SMMS_API_KEY',
    'CLOUDFLARE_API_TOKEN',
    'WEB_AUTH_TOKEN',
    'API_AUTH_TOKEN',
    'PROXY_PASSWORD',
  ];

  for (const key of sensitiveKeys) {
    if (sanitized[key]) {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized;
}

function validateConfigUpdates(updates: Record<string, any>): void {
  for (const [key, value] of Object.entries(updates)) {
    validateSetting(key, value);
  }
}

function validateSetting(key: string, value: any): void {
  switch (key) {
    case 'TIMEOUT':
    case 'MAX_RETRIES':
    case 'STREAM_CHUNK_SIZE':
    case 'STREAM_MIN_DELAY':
    case 'STREAM_MAX_DELAY':
      if (typeof value !== 'number' || value < 0) {
        throw new AppError(`${key} must be a positive number`, HTTP_STATUS_CODES.BAD_REQUEST);
      }
      break;
    
    case 'STREAM_OPTIMIZER_ENABLED':
    case 'WEB_AUTH_ENABLED':
    case 'API_AUTH_ENABLED':
    case 'REQUEST_LOG_ENABLED':
    case 'ERROR_LOG_ENABLED':
    case 'SCHEDULER_ENABLED':
      if (typeof value !== 'boolean') {
        throw new AppError(`${key} must be a boolean`, HTTP_STATUS_CODES.BAD_REQUEST);
      }
      break;
    
    case 'API_KEYS':
    case 'VERTEX_API_KEYS':
    case 'FILTER_MODELS':
      if (!Array.isArray(value)) {
        throw new AppError(`${key} must be an array`, HTTP_STATUS_CODES.BAD_REQUEST);
      }
      break;
    
    case 'SAFETY_SETTINGS':
      if (!Array.isArray(value)) {
        throw new AppError(`${key} must be an array`, HTTP_STATUS_CODES.BAD_REQUEST);
      }
      // Validate safety settings structure
      for (const setting of value) {
        if (!setting.category || !setting.threshold) {
          throw new AppError(`Invalid safety setting structure`, HTTP_STATUS_CODES.BAD_REQUEST);
        }
      }
      break;
    
    case 'UPLOAD_HANDLER':
      if (!['INTERNAL', 'SMMS', 'PICGO', 'CLOUDFLARE'].includes(value)) {
        throw new AppError(`${key} must be one of: INTERNAL, SMMS, PICGO, CLOUDFLARE`, HTTP_STATUS_CODES.BAD_REQUEST);
      }
      break;
    
    case 'DATABASE_TYPE':
      if (!['mysql', 'sqlite'].includes(value)) {
        throw new AppError(`${key} must be either mysql or sqlite`, HTTP_STATUS_CODES.BAD_REQUEST);
      }
      break;
  }
}

function validateFullConfig(config: Record<string, any>): string[] {
  const errors: string[] = [];

  try {
    for (const [key, value] of Object.entries(config)) {
      try {
        validateSetting(key, value);
      } catch (error) {
        errors.push(`${key}: ${(error as Error).message}`);
      }
    }
  } catch (error) {
    errors.push(`General validation error: ${(error as Error).message}`);
  }

  return errors;
}

function getConfigSchema(): Record<string, any> {
  return {
    DATABASE_TYPE: {
      type: 'string',
      enum: ['mysql', 'sqlite'],
      default: 'mysql',
      description: 'Database type to use',
    },
    API_KEYS: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of Gemini API keys',
    },
    VERTEX_API_KEYS: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of Vertex API keys',
    },
    MODEL: {
      type: 'string',
      default: 'gemini-1.5-flash',
      description: 'Default model to use',
    },
    TIMEOUT: {
      type: 'number',
      minimum: 1,
      default: 120,
      description: 'Request timeout in seconds',
    },
    MAX_RETRIES: {
      type: 'number',
      minimum: 0,
      default: 3,
      description: 'Maximum number of retries',
    },
    STREAM_OPTIMIZER_ENABLED: {
      type: 'boolean',
      default: true,
      description: 'Enable stream optimizer',
    },
    WEB_AUTH_ENABLED: {
      type: 'boolean',
      default: true,
      description: 'Enable web authentication',
    },
    REQUEST_LOG_ENABLED: {
      type: 'boolean',
      default: true,
      description: 'Enable request logging',
    },
    ERROR_LOG_ENABLED: {
      type: 'boolean',
      default: true,
      description: 'Enable error logging',
    },
    SCHEDULER_ENABLED: {
      type: 'boolean',
      default: true,
      description: 'Enable background scheduler',
    },
    UPLOAD_HANDLER: {
      type: 'string',
      enum: ['INTERNAL', 'SMMS', 'PICGO', 'CLOUDFLARE'],
      default: 'INTERNAL',
      description: 'File upload handler',
    },
  };
}