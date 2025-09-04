import pino from 'pino';

const isDevelopment = process.env['NODE_ENV'] === 'development';

// Create base logger configuration
const loggerConfig = {
  level: process.env['LOG_LEVEL'] ?? 'info',
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  }),
};

// Create different logger instances
export const mainLogger = pino({ ...loggerConfig, name: 'main' });
export const applicationLogger = pino({ ...loggerConfig, name: 'app' });
export const routerLogger = pino({ ...loggerConfig, name: 'router' });
export const serviceLogger = pino({ ...loggerConfig, name: 'service' });
export const middlewareLogger = pino({ ...loggerConfig, name: 'middleware' });
export const databaseLogger = pino({ ...loggerConfig, name: 'database' });
export const schedulerLogger = pino({ ...loggerConfig, name: 'scheduler' });

// Export getter functions for consistency with Python version
export const getMainLogger = () => mainLogger;
export const getApplicationLogger = () => applicationLogger;
export const getRouterLogger = () => routerLogger;
export const getServiceLogger = () => serviceLogger;
export const getMiddlewareLogger = () => middlewareLogger;
export const getDatabaseLogger = () => databaseLogger;
export const getSchedulerLogger = () => schedulerLogger;

// Setup access logging function
export function setupAccessLogging(): void {
  // This function would configure access logging for the application
  // In Fastify, this is typically handled by the built-in logger
  applicationLogger.info('Access logging configured');
}

// Logger class for compatibility with Python version
export class Logger {
  private logger: pino.Logger;

  constructor(name: string) {
    this.logger = pino({ ...loggerConfig, name });
  }

  info(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.logger.info({ args }, message);
    } else {
      this.logger.info(message);
    }
  }

  error(message: string, error?: unknown): void {
    this.logger.error(error ?? {}, message);
  }

  warn(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.logger.warn({ args }, message);
    } else {
      this.logger.warn(message);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.logger.debug({ args }, message);
    } else {
      this.logger.debug(message);
    }
  }

  critical(message: string, error?: unknown): void {
    this.logger.fatal(error ?? {}, message);
  }
}