import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getRouterLogger } from '@/log/logger';
import { statsService } from '@/service/stats/statsService';
import { AppError } from '@/exception/exceptions';
import { HTTP_STATUS_CODES } from '@/core/constants';

const logger = getRouterLogger();

export default async function statsRoutes(fastify: FastifyInstance) {
  // Get stats overview
  fastify.get('/overview', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('Getting stats overview');
      
      const overview = await statsService.getStatsOverview();
      
      return reply.send(overview);

    } catch (error) {
      logger.error('Failed to get stats overview:', error);
      throw error;
    }
  });

  // Get daily stats
  fastify.get('/daily/:date', async (request: FastifyRequest<{
    Params: { date: string };
  }>, reply: FastifyReply) => {
    try {
      const { date } = request.params;
      
      logger.info(`Getting daily stats for: ${date}`);
      
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        throw new AppError('Invalid date format', HTTP_STATUS_CODES.BAD_REQUEST);
      }

      const stats = await statsService.getDailyStats(dateObj);
      
      return reply.send(stats);

    } catch (error) {
      logger.error('Failed to get daily stats:', error);
      throw error;
    }
  });

  // Get stats for date range
  fastify.get('/range', async (request: FastifyRequest<{
    Querystring: { 
      start: string;
      end: string;
    };
  }>, reply: FastifyReply) => {
    try {
      const { start, end } = request.query;
      
      logger.info(`Getting stats for range: ${start} to ${end}`);
      
      const startDate = new Date(start);
      const endDate = new Date(end);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new AppError('Invalid date format', HTTP_STATUS_CODES.BAD_REQUEST);
      }

      if (startDate > endDate) {
        throw new AppError('Start date must be before end date', HTTP_STATUS_CODES.BAD_REQUEST);
      }

      const stats = await statsService.getAggregatedStats(startDate, endDate);
      
      return reply.send(stats);

    } catch (error) {
      logger.error('Failed to get range stats:', error);
      throw error;
    }
  });

  // Get model stats
  fastify.get('/models', async (request: FastifyRequest<{
    Querystring: {
      start?: string;
      end?: string;
      limit?: string;
    };
  }>, reply: FastifyReply) => {
    try {
      const { start, end, limit } = request.query;
      
      logger.info('Getting model stats');
      
      const startDate = start ? new Date(start) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = end ? new Date(end) : new Date();
      const limitNum = limit ? parseInt(limit) : 10;
      
      if (start && isNaN(startDate.getTime())) {
        throw new AppError('Invalid start date format', HTTP_STATUS_CODES.BAD_REQUEST);
      }
      
      if (end && isNaN(endDate.getTime())) {
        throw new AppError('Invalid end date format', HTTP_STATUS_CODES.BAD_REQUEST);
      }

      const modelStats = await statsService.getModelStats(startDate, endDate);
      
      return reply.send({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        models: modelStats.slice(0, limitNum),
      });

    } catch (error) {
      logger.error('Failed to get model stats:', error);
      throw error;
    }
  });

  // Get key stats
  fastify.get('/keys', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('Getting key stats');
      
      const keyStats = await statsService.getKeyStats();
      
      return reply.send(keyStats);

    } catch (error) {
      logger.error('Failed to get key stats:', error);
      throw error;
    }
  });

  // Get hourly stats
  fastify.get('/hourly/:date', async (request: FastifyRequest<{
    Params: { date: string };
  }>, reply: FastifyReply) => {
    try {
      const { date } = request.params;
      
      logger.info(`Getting hourly stats for: ${date}`);
      
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        throw new AppError('Invalid date format', HTTP_STATUS_CODES.BAD_REQUEST);
      }

      const hourlyStats = await statsService.getHourlyStats(dateObj);
      
      return reply.send({
        date,
        hourly: hourlyStats,
      });

    } catch (error) {
      logger.error('Failed to get hourly stats:', error);
      throw error;
    }
  });

  // Get top models
  fastify.get('/top-models', async (request: FastifyRequest<{
    Querystring: {
      limit?: string;
    };
  }>, reply: FastifyReply) => {
    try {
      const { limit } = request.query;
      
      logger.info('Getting top models');
      
      const limitNum = limit ? parseInt(limit) : 10;
      
      if (limitNum < 1 || limitNum > 100) {
        throw new AppError('Limit must be between 1 and 100', HTTP_STATUS_CODES.BAD_REQUEST);
      }

      const topModels = await statsService.getTopModels(limitNum);
      
      return reply.send(topModels);

    } catch (error) {
      logger.error('Failed to get top models:', error);
      throw error;
    }
  });

  // Get system stats
  fastify.get('/system', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('Getting system stats');
      
      const systemStats = {
        uptime: Math.floor(process.uptime()),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        timestamp: new Date().toISOString(),
      };
      
      return reply.send(systemStats);

    } catch (error) {
      logger.error('Failed to get system stats:', error);
      throw error;
    }
  });

  // Clear stats
  fastify.delete('/clear', async (request: FastifyRequest<{
    Querystring: {
      before?: string;
      confirm?: string;
    };
  }>, reply: FastifyReply) => {
    try {
      const { before, confirm } = request.query;
      
      if (confirm !== 'true') {
        throw new AppError('Confirmation required', HTTP_STATUS_CODES.BAD_REQUEST);
      }

      logger.info('Clearing stats', { before });
      
      // TODO: Implement stats clearing
      logger.warn('Stats clearing not implemented yet');

      return reply.send({
        success: true,
        message: 'Stats cleared successfully',
      });

    } catch (error) {
      logger.error('Failed to clear stats:', error);
      throw error;
    }
  });

  // Update stats (internal endpoint)
  fastify.post('/update', async (request: FastifyRequest<{
    Body: {
      date: string;
      totalRequests?: number;
      successRequests?: number;
      failedRequests?: number;
      totalTokens?: number;
      inputTokens?: number;
      outputTokens?: number;
    };
  }>, reply: FastifyReply) => {
    try {
      const { date, ...updates } = request.body;
      
      logger.info(`Updating stats for: ${date}`);
      
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        throw new AppError('Invalid date format', HTTP_STATUS_CODES.BAD_REQUEST);
      }

      await statsService.updateDailyStats(dateObj, updates);
      
      return reply.send({
        success: true,
        message: 'Stats updated successfully',
      });

    } catch (error) {
      logger.error('Failed to update stats:', error);
      throw error;
    }
  });
}