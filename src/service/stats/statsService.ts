import { getServiceLogger } from '@/log/logger';
import { databaseService } from '@/database/services';

const logger = getServiceLogger();

export interface DailyStats {
  date: string;
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  successRate: number;
  averageTokensPerRequest: number;
}

export interface StatsOverview {
  today: DailyStats;
  yesterday: DailyStats;
  last7Days: DailyStats;
  last30Days: DailyStats;
}

export interface ModelStats {
  modelName: string;
  requestCount: number;
  tokenCount: number;
  averageTokensPerRequest: number;
  successRate: number;
}

export interface KeyStats {
  keyHash: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  lastUsed: Date;
}

export class StatsService {
  async getDailyStats(date: Date): Promise<DailyStats> {
    try {
      const dateString = date.toISOString().split('T')[0] || '';
      const stats = await databaseService.getStats(date, date);
      
      if (stats.length === 0) {
        return this.createEmptyStats(dateString);
      }

      const stat = stats[0];
      const successRate = stat.totalRequests > 0 ? (stat.successRequests / stat.totalRequests) * 100 : 0;
      const averageTokensPerRequest = stat.totalRequests > 0 ? Number(stat.totalTokens) / stat.totalRequests : 0;

      return {
        date: dateString,
        totalRequests: stat.totalRequests,
        successRequests: stat.successRequests,
        failedRequests: stat.failedRequests,
        totalTokens: Number(stat.totalTokens),
        inputTokens: Number(stat.inputTokens),
        outputTokens: Number(stat.outputTokens),
        successRate: Math.round(successRate * 100) / 100,
        averageTokensPerRequest: Math.round(averageTokensPerRequest),
      };

    } catch (error) {
      logger.error('Failed to get daily stats:', error);
      return this.createEmptyStats(date.toISOString().split('T')[0] || '');
    }
  }

  async getStatsOverview(): Promise<StatsOverview> {
    try {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [todayStats, yesterdayStats, last7DaysStats, last30DaysStats] = await Promise.all([
        this.getDailyStats(today),
        this.getDailyStats(yesterday),
        this.getAggregatedStats(last7Days, today),
        this.getAggregatedStats(last30Days, today),
      ]);

      return {
        today: todayStats,
        yesterday: yesterdayStats,
        last7Days: last7DaysStats,
        last30Days: last30DaysStats,
      };

    } catch (error) {
      logger.error('Failed to get stats overview:', error);
      throw error;
    }
  }

  async getAggregatedStats(startDate: Date, endDate: Date): Promise<DailyStats> {
    try {
      const stats = await databaseService.getStats(startDate, endDate);
      
      if (stats.length === 0) {
        return this.createEmptyStats(`${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
      }

      const aggregated = stats.reduce((acc, stat) => {
        acc.totalRequests += stat.totalRequests;
        acc.successRequests += stat.successRequests;
        acc.failedRequests += stat.failedRequests;
        acc.totalTokens += Number(stat.totalTokens);
        acc.inputTokens += Number(stat.inputTokens);
        acc.outputTokens += Number(stat.outputTokens);
        return acc;
      }, {
        totalRequests: 0,
        successRequests: 0,
        failedRequests: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
      });

      const successRate = aggregated.totalRequests > 0 ? (aggregated.successRequests / aggregated.totalRequests) * 100 : 0;
      const averageTokensPerRequest = aggregated.totalRequests > 0 ? aggregated.totalTokens / aggregated.totalRequests : 0;

      return {
        date: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        totalRequests: aggregated.totalRequests,
        successRequests: aggregated.successRequests,
        failedRequests: aggregated.failedRequests,
        totalTokens: aggregated.totalTokens,
        inputTokens: aggregated.inputTokens,
        outputTokens: aggregated.outputTokens,
        successRate: Math.round(successRate * 100) / 100,
        averageTokensPerRequest: Math.round(averageTokensPerRequest),
      };

    } catch (error) {
      logger.error('Failed to get aggregated stats:', error);
      throw error;
    }
  }

  async updateDailyStats(date: Date, updates: {
    totalRequests?: number;
    successRequests?: number;
    failedRequests?: number;
    totalTokens?: number;
    inputTokens?: number;
    outputTokens?: number;
  }): Promise<void> {
    try {
      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      
      const updateData: any = {};
      if (updates.totalRequests !== undefined) updateData.totalRequests = updates.totalRequests;
      if (updates.successRequests !== undefined) updateData.successRequests = updates.successRequests;
      if (updates.failedRequests !== undefined) updateData.failedRequests = updates.failedRequests;
      if (updates.totalTokens !== undefined) updateData.totalTokens = BigInt(updates.totalTokens);
      if (updates.inputTokens !== undefined) updateData.inputTokens = BigInt(updates.inputTokens);
      if (updates.outputTokens !== undefined) updateData.outputTokens = BigInt(updates.outputTokens);
      
      await databaseService.updateStats(dateOnly, updateData);

    } catch (error) {
      logger.error('Failed to update daily stats:', error);
      throw error;
    }
  }

  async incrementRequestCount(date: Date, isSuccess: boolean, tokenCount?: number): Promise<void> {
    try {
      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      
      const updates: any = {
        totalRequests: 1,
      };

      if (isSuccess) {
        updates.successRequests = 1;
      } else {
        updates.failedRequests = 1;
      }

      if (tokenCount) {
        updates.totalTokens = tokenCount;
      }

      await this.updateDailyStats(dateOnly, updates);

    } catch (error) {
      logger.error('Failed to increment request count:', error);
      throw error;
    }
  }

  async getModelStats(_startDate: Date, _endDate: Date): Promise<ModelStats[]> {
    try {
      // This would require a more complex query to get model-specific stats
      // For now, return empty array
      logger.warn('Model stats not implemented yet');
      return [];

    } catch (error) {
      logger.error('Failed to get model stats:', error);
      return [];
    }
  }

  async getKeyStats(): Promise<KeyStats[]> {
    try {
      const keyStatuses = await databaseService.getKeyStatuses();
      
      return keyStatuses.map(status => ({
        keyHash: status.keyHash,
        requestCount: 0, // This would need to be calculated from request logs
        successCount: 0, // This would need to be calculated from request logs
        failureCount: status.failCount,
        successRate: 0, // This would need to be calculated
        lastUsed: status.lastChecked,
      }));

    } catch (error) {
      logger.error('Failed to get key stats:', error);
      return [];
    }
  }

  async getHourlyStats(_date: Date): Promise<Array<{
    hour: number;
    requests: number;
    tokens: number;
  }>> {
    try {
      // This would require hourly aggregation of request logs
      // For now, return empty array
      logger.warn('Hourly stats not implemented yet');
      return [];

    } catch (error) {
      logger.error('Failed to get hourly stats:', error);
      return [];
    }
  }

  async getTopModels(_limit: number = 10): Promise<ModelStats[]> {
    try {
      // This would require aggregation of model usage from request logs
      // For now, return empty array
      logger.warn('Top models stats not implemented yet');
      return [];

    } catch (error) {
      logger.error('Failed to get top models:', error);
      return [];
    }
  }

  private createEmptyStats(date: string): DailyStats {
    return {
      date,
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      successRate: 0,
      averageTokensPerRequest: 0,
    };
  }
}

export const statsService = new StatsService();