import { PrismaClient } from '@prisma/client';
import { getDatabaseLogger } from '@/log/logger';
import settings from '@/config/config';
import { exec } from 'child_process';
import { promisify } from 'util';

const logger = getDatabaseLogger();
const execAsync = promisify(exec);

let prisma: PrismaClient | null = null;

export async function initializeDatabase(): Promise<void> {
  try {
    const { MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE } = settings;
    const databaseUrl = `mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}`;

    logger.info(`Initializing database connection to mysql://${MYSQL_USER}:xxxxxxxx@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}`);
    
    // Set DATABASE_URL environment variable for Prisma
    process.env['DATABASE_URL'] = databaseUrl;
    
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl
        }
      }
    });

    // Test database connection
    await prisma.$connect();
    logger.info('Database connection established');

    // Run database migrations/push
    await runDatabaseMigrations();
    
    // Sync initial settings after migrations
    await syncInitialSettings();
    
    logger.info('Database initialization completed');
  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize database:');
    throw error;
  }
}

async function runDatabaseMigrations(): Promise<void> {
  try {
    logger.info('Starting database migrations...');
    
    // Check if we're in development or production
    const isDevelopment = process.env['NODE_ENV'] === 'development';
    
    if (isDevelopment) {
      // In development, use prisma db push for faster iteration
      logger.info('Running prisma db push for development environment...');
      const result = await execAsync('npx prisma db push --accept-data-loss');
      
      if (result.stderr && !result.stderr.includes('warnings')) {
        logger.warn({ err: result.stderr }, 'Prisma db push warnings:');
      }
      
      logger.info({ result: result.stdout }, 'Prisma db push completed:');
    } else {
      // In production, use prisma migrate deploy
      logger.info('Running prisma migrate deploy for production environment...');
      const result = await execAsync('npx prisma migrate deploy');
      
      if (result.stderr) {
        logger.warn({ err: result.stderr }, 'Prisma migrate warnings:');
      }
      
      logger.info({ result: result.stdout }, 'Prisma migrate deploy completed:');
    }
    
    // Generate Prisma client if needed
    logger.info('Generating Prisma client...');
    const genResult = await execAsync('npx prisma generate');
    logger.info({ result: genResult.stdout }, 'Prisma client generated:');
    
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to run database migrations:');
    
    // If migration fails, try to continue with db push as fallback
    try {
      logger.info('Migration failed, attempting fallback with db push...');
      const { stdout, stderr } = await execAsync('npx prisma db push --accept-data-loss');
      
      if (stderr && !stderr.includes('warnings')) {
        logger.warn({ err: stderr }, 'Prisma db push fallback warnings:');
      }
      
      logger.info({ result: stdout }, 'Prisma db push fallback completed:');
    } catch (fallbackError) {
      logger.error({ err: fallbackError }, 'Database migration fallback also failed');
      throw fallbackError;
    }
  }
}

async function syncInitialSettings(): Promise<void> {
  if (!prisma) {
    logger.error('Prisma client not initialized');
    return;
  }

  try {
    logger.info('Starting initial settings synchronization...');

    // Default settings that should be initialized
    const defaultSettings = [
      { key: 'API_VERSION', value: 'v1beta', description: 'API version for Gemini' },
      { key: 'DEFAULT_MODEL', value: 'gemini-2.0-flash-exp', description: 'Default model for requests' },
      { key: 'MAX_RETRIES', value: '3', description: 'Maximum number of retries for failed requests' },
      { key: 'TIMEOUT', value: '30000', description: 'Request timeout in milliseconds' },
      { key: 'LOG_LEVEL', value: 'INFO', description: 'Application log level' },
      { key: 'STREAM_OPTIMIZER_ENABLED', value: 'false', description: 'Enable stream optimization' },
      { key: 'FILES_CLEANUP_ENABLED', value: 'true', description: 'Enable automatic file cleanup' },
      { key: 'FILES_CLEANUP_INTERVAL_HOURS', value: '1', description: 'File cleanup interval in hours' },
      { key: 'AUTO_DELETE_ERROR_LOGS_ENABLED', value: 'true', description: 'Enable automatic error log deletion' },
      { key: 'AUTO_DELETE_ERROR_LOGS_DAYS', value: '7', description: 'Days to keep error logs' },
      { key: 'AUTO_DELETE_REQUEST_LOGS_ENABLED', value: 'false', description: 'Enable automatic request log deletion' },
      { key: 'AUTO_DELETE_REQUEST_LOGS_DAYS', value: '30', description: 'Days to keep request logs' }
    ];

    // Get existing settings from database
    const existingSettings = await prisma.settings.findMany({
      select: { key: true, value: true }
    });

    const existingKeys = new Set(existingSettings.map(s => s.key));

    // Insert missing default settings
    const settingsToInsert = defaultSettings.filter(setting => !existingKeys.has(setting.key));

    if (settingsToInsert.length > 0) {
      await prisma.settings.createMany({
        data: settingsToInsert,
        skipDuplicates: true
      });
      logger.info(`Inserted ${settingsToInsert.length} default settings into database`);
    }

    // Update settings from environment variables if they exist
    const envMappings = [
      { env: 'LOG_LEVEL', key: 'LOG_LEVEL' },
      { env: 'MAX_RETRIES', key: 'MAX_RETRIES' },
      { env: 'TIMEOUT', key: 'TIMEOUT' },
      { env: 'DEFAULT_MODEL', key: 'DEFAULT_MODEL' }
    ];

    for (const mapping of envMappings) {
      const envValue = process.env[mapping.env];
      if (envValue) {
        await prisma.settings.upsert({
          where: { key: mapping.key },
          update: { value: envValue, updatedAt: new Date() },
          create: {
            key: mapping.key,
            value: envValue,
            description: `${mapping.key} from environment variable`
          }
        });
        logger.debug(`Updated setting '${mapping.key}' from environment variable`);
      }
    }

    logger.info('Initial settings synchronization completed');
  } catch (error) {
    logger.error({ err: error }, 'Failed to sync initial settings:');
    // Don't throw error here as this is not critical for app startup
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    if (prisma) {
      await prisma.$disconnect();
      logger.info('Database disconnected');
    } else {
      logger.info('No database connection to disconnect');
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to disconnect from database:');
    throw error;
  }
}

export { prisma };