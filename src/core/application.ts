import Fastify, { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';

import { syncInitialSettings } from '@/config/config';
import { initializeDatabase } from '@/database/initialization';
import { setupExceptionHandlers } from '@/exception/exceptions';
import { getApplicationLogger } from '@/log/logger';
import { setupMiddlewares } from '@/middleware/middleware';
import { setupRouters } from '@/router/routes';
import { startScheduler, stopScheduler } from '@/scheduler/scheduledTasks';
import { getKeyManagerInstance } from '@/service/key/keyManager';
import { checkForUpdates } from '@/service/update/updateService';
import { getCurrentVersion } from '@/utils/helpers';

const logger = getApplicationLogger();

export const prisma = new PrismaClient();

export interface AppState {
  updateInfo: {
    updateAvailable: boolean;
    latestVersion: string | null;
    errorMessage: string | null;
    currentVersion: string;
  };
}

async function setupDatabaseAndConfig(): Promise<void> {
  try {
    await initializeDatabase();
    logger.info('Database initialized successfully');

    await syncInitialSettings();

    await getKeyManagerInstance();
    logger.info('Database, config sync, and KeyManager initialized successfully');
  } catch (error) {
    logger.error({ err: error }, 'Failed to setup database and config:');
    throw error;
  }
}

async function performUpdateCheck(app: FastifyInstance): Promise<void> {
  try {
    const { updateAvailable, latestVersion, errorMessage } = await checkForUpdates();
    const currentVersion = getCurrentVersion();

    const updateInfo = {
      updateAvailable,
      latestVersion,
      errorMessage,
      currentVersion,
    };

    // Store update info in app context
    // app.decorate('updateInfo', updateInfo);
    app.updateInfo = updateInfo;

    logger.info('Update check completed - updateInfo: ' + JSON.stringify(updateInfo));
  } catch (error) {
    logger.error({ err: error }, 'Failed to perform update check:');
  }
}

function startBackgroundScheduler(): void {
  try {
    startScheduler();
    logger.info('Scheduler started successfully');
  } catch (error) {
    logger.error({ err: error }, 'Failed to start scheduler:');
  }
}

export async function createApp(): Promise<FastifyInstance> {
  const currentVersion = getCurrentVersion();

  const app = Fastify({
    logger: {
      level: 'info',
    },
  });

  // Setup lifecycle hooks
  app.addHook('onReady', async () => {
    logger.info('Application starting up...');

    try {
      await setupDatabaseAndConfig();
      await performUpdateCheck(app);
      startBackgroundScheduler();
    } catch (error) {
      logger.error({ err: error }, 'Critical error during application startup:');
      throw error;
    }
  });

  app.addHook('onClose', async () => {
    logger.info('Application shutting down...');
    stopScheduler();
    await prisma.$disconnect();
  });

  // Register plugins
  await app.register(helmet);
  await app.register(cors);
  await app.register(multipart);

  // Initialize update info
  const initialUpdateInfo = {
    updateAvailable: false,
    latestVersion: null,
    errorMessage: 'Initializing...',
    currentVersion,
  };

  app.decorate('updateInfo', initialUpdateInfo);

  // Setup middlewares
  setupMiddlewares(app);

  // Setup exception handlers
  setupExceptionHandlers(app);

  // Setup routes
  setupRouters(app);

  return app;
}