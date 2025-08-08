import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getRouterLogger } from '@/log/logger';
import { prisma } from '@/core/application';
import { getKeyManagerInstance } from '@/service/key/keyManager';
import { getCurrentVersion } from '@/utils/helpers';

const logger = getRouterLogger();

export default async function healthRoutes(fastify: FastifyInstance) {
  // Basic health check
  fastify.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        version: getCurrentVersion(),
        environment: process.env['NODE_ENV'] || 'development',
      };

      return reply.send(health);

    } catch (error) {
      logger.error({ err: error }, 'Health check failed:');
      return reply.status(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
      });
    }
  });

  // Detailed health check
  fastify.get('/health/detailed', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const startTime = Date.now();
      
      // Check database connection
      const dbStart = Date.now();
      let dbStatus = 'healthy';
      let dbResponseTime = 0;
      
      try {
        await prisma.$queryRaw`SELECT 1`;
        dbResponseTime = Date.now() - dbStart;
      } catch (error) {
        dbStatus = 'unhealthy';
        dbResponseTime = Date.now() - dbStart;
        logger.error({ err: error }, 'Database health check failed:');
      }

      // Check API keys
      const keysStart = Date.now();
      let keysStatus = 'healthy';
      let keysResponseTime = 0;
      let availableKeys = 0;
      
      try {
        const keyManager = await getKeyManagerInstance();
        const keyStats = keyManager.getKeyStatus();
        availableKeys = keyStats.available;
        keysResponseTime = Date.now() - keysStart;
        
        if (availableKeys === 0) {
          keysStatus = 'unhealthy';
        }
      } catch (error) {
        keysStatus = 'unhealthy';
        keysResponseTime = Date.now() - keysStart;
        logger.error({ err: error }, 'Keys health check failed:');
      }

      // Memory usage
      const memoryUsage = process.memoryUsage();
      const memoryMB = {
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
      };

      const totalResponseTime = Date.now() - startTime;
      const overallStatus = dbStatus === 'healthy' && keysStatus === 'healthy' ? 'healthy' : 'unhealthy';

      const health = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        version: getCurrentVersion(),
        environment: process.env['NODE_ENV'] || 'development',
        responseTime: totalResponseTime,
        checks: {
          database: {
            status: dbStatus,
            responseTime: dbResponseTime,
          },
          keys: {
            status: keysStatus,
            responseTime: keysResponseTime,
            available: availableKeys,
          },
        },
        system: {
          memory: memoryMB,
          cpu: process.cpuUsage(),
          pid: process.pid,
          platform: process.platform,
          nodeVersion: process.version,
        },
      };

      const statusCode = overallStatus === 'healthy' ? 200 : 503;
      return reply.status(statusCode).send(health);

    } catch (error) {
      logger.error({ err: error }, 'Detailed health check failed:');
      return reply.status(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
      });
    }
  });

  // Readiness check
  fastify.get('/health/ready', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check if the application is ready to serve requests
      await prisma.$queryRaw`SELECT 1`;
      
      const keyManager = await getKeyManagerInstance();
      const keyStats = keyManager.getKeyStatus();
      
      if (keyStats.available === 0) {
        return reply.status(503).send({
          status: 'not ready',
          reason: 'No API keys available',
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error({ err: error }, 'Readiness check failed:');
      return reply.status(503).send({
        status: 'not ready',
        reason: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Liveness check
  fastify.get('/health/live', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Basic liveness check - just confirm the process is running
      return reply.send({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        pid: process.pid,
      });

    } catch (error) {
      logger.error({ err: error }, 'Liveness check failed:');
      return reply.status(503).send({
        status: 'dead',
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
      });
    }
  });
}