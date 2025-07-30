import { PrismaClient } from '@prisma/client';
import { getDatabaseLogger } from '@/log/logger';

const logger = getDatabaseLogger();
const prisma = new PrismaClient();

export async function initializeDatabase(): Promise<void> {
  try {
    logger.info('Initializing database...');
    
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
    await prisma.$disconnect();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error('Failed to disconnect from database:', error);
    throw error;
  }
}

export { prisma };