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
      
      if (result.stderr) {
        if (result.stderr.includes('warning')) {
          logger.warn({ warn: result.stderr }, 'Prisma db push warnings:');
        } else if (result.stderr.includes('error')) {
          logger.error({ err: result.stderr }, 'Prisma db push errors:');
        } else {
          logger.info({ result: result.stderr }, 'Prisma db push messages:');
        }
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
    
  } catch (error: unknown) {
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
      { env: 'API_KEYS', key: 'API_KEYS' },
      { env: 'ALLOWED_TOKENS', key: 'ALLOWED_TOKENS' },
      { env: 'AUTH_TOKEN', key: 'AUTH_TOKEN' },
      { env: 'VERTEX_API_KEYS', key: 'VERTEX_API_KEYS' },
      { env: 'VERTEX_EXPRESS_BASE_URL', key: 'VERTEX_EXPRESS_BASE_URL' },
      { env: 'TEST_MODEL', key: 'TEST_MODEL' },
      { env: 'THINKING_MODELS', key: 'THINKING_MODELS' },
      { env: 'THINKING_BUDGET_MAP', key: 'THINKING_BUDGET_MAP' },
      { env: 'IMAGE_MODELS', key: 'IMAGE_MODELS' },
      { env: 'SEARCH_MODELS', key: 'SEARCH_MODELS' },
      { env: 'FILTERED_MODELS', key: 'FILTERED_MODELS' },
      { env: 'TOOLS_CODE_EXECUTION_ENABLED', key: 'TOOLS_CODE_EXECUTION_ENABLED' },
      { env: 'SHOW_SEARCH_LINK', key: 'SHOW_SEARCH_LINK' },
      { env: 'SHOW_THINKING_PROCESS', key: 'SHOW_THINKING_PROCESS' },
      { env: 'BASE_URL', key: 'BASE_URL' },
      { env: 'MAX_FAILURES', key: 'MAX_FAILURES' },
      { env: 'MAX_RETRIES', key: 'MAX_RETRIES' },
      { env: 'CHECK_INTERVAL_HOURS', key: 'CHECK_INTERVAL_HOURS' },
      { env: 'TIMEZONE', key: 'TIMEZONE' },
      { env: 'TIME_OUT', key: 'TIMEOUT' },
      { env: 'PROXIES', key: 'PROXIES' },
      { env: 'PROXIES_USE_CONSISTENCY_HASH_BY_API_KEY', key: 'PROXIES_USE_CONSISTENCY_HASH_BY_API_KEY' },
      { env: 'PAID_KEY', key: 'PAID_KEY' },
      { env: 'CREATE_IMAGE_MODEL', key: 'CREATE_IMAGE_MODEL' },
      { env: 'UPLOAD_PROVIDER', key: 'UPLOAD_PROVIDER' },
      { env: 'SMMS_SECRET_TOKEN', key: 'SMMS_SECRET_TOKEN' },
      { env: 'PICGO_API_KEY', key: 'PICGO_API_KEY' },
      { env: 'CLOUDFLARE_IMGBED_URL', key: 'CLOUDFLARE_IMGBED_URL' },
      { env: 'CLOUDFLARE_IMGBED_AUTH_CODE', key: 'CLOUDFLARE_IMGBED_AUTH_CODE' },
      { env: 'STREAM_OPTIMIZER_ENABLED', key: 'STREAM_OPTIMIZER_ENABLED' },
      { env: 'STREAM_MIN_DELAY', key: 'STREAM_MIN_DELAY' },
      { env: 'STREAM_MAX_DELAY', key: 'STREAM_MAX_DELAY' },
      { env: 'STREAM_SHORT_TEXT_THRESHOLD', key: 'STREAM_SHORT_TEXT_THRESHOLD' },
      { env: 'STREAM_LONG_TEXT_THRESHOLD', key: 'STREAM_LONG_TEXT_THRESHOLD' },
      { env: 'STREAM_CHUNK_SIZE', key: 'STREAM_CHUNK_SIZE' },
      { env: 'LOG_LEVEL', key: 'LOG_LEVEL' },
      { env: 'AUTO_DELETE_ERROR_LOGS_ENABLED', key: 'AUTO_DELETE_ERROR_LOGS_ENABLED' },
      { env: 'AUTO_DELETE_ERROR_LOGS_DAYS', key: 'AUTO_DELETE_ERROR_LOGS_DAYS' },
      { env: 'AUTO_DELETE_REQUEST_LOGS_ENABLED', key: 'AUTO_DELETE_REQUEST_LOGS_ENABLED' },
      { env: 'AUTO_DELETE_REQUEST_LOGS_DAYS', key: 'AUTO_DELETE_REQUEST_LOGS_DAYS' },
      { env: 'FAKE_STREAM_ENABLED', key: 'FAKE_STREAM_ENABLED' },
      { env: 'FAKE_STREAM_EMPTY_DATA_INTERVAL_SECONDS', key: 'FAKE_STREAM_EMPTY_DATA_INTERVAL_SECONDS' },
      { env: 'SAFETY_SETTINGS', key: 'SAFETY_SETTINGS' },
      { env: 'URL_NORMALIZATION_ENABLED', key: 'URL_NORMALIZATION_ENABLED' },
      { env: 'TTS_MODEL', key: 'TTS_MODEL' },
      { env: 'TTS_VOICE_NAME', key: 'TTS_VOICE_NAME' },
      { env: 'TTS_SPEED', key: 'TTS_SPEED' },
      { env: 'PORT', key: 'PORT' }
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