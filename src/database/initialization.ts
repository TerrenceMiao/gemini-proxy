import { PrismaClient } from '@prisma/client';
import { getDatabaseLogger } from '@/log/logger';
import settings from '@/config/config';

const logger = getDatabaseLogger();

let prisma: PrismaClient | null = null;

export async function initializeDatabase(): Promise<void> {
  try {
    const { MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE } = settings;
    const databaseUrl = `mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}`;

    logger.info(`Initializing database connection to mysql://${MYSQL_USER}:xxxxxxxx@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}`);
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

    // Run migrations if needed
    // This would typically be done via prisma migrate or prisma db push
    logger.info('Database initialization completed');
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
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
    logger.error('Failed to disconnect from database:', error);
    throw error;
  }
}

export { prisma };