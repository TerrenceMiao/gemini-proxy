import { getServiceLogger } from '@/log/logger';
import { databaseService } from '@/database/services';
import { settings } from '@/config/config';

const logger = getServiceLogger();

export interface ErrorLogEntry {
  id: number;
  geminiKey: string | null;
  modelName: string | null;
  errorType: string | null;
  errorLog: string | null;
  errorCode: number | null;
  requestMsg: any;
  requestTime: Date;
}

export interface ErrorLogFilter {
  startDate?: Date;
  endDate?: Date;
  errorType?: string;
  modelName?: string;
  errorCode?: number;
}

export interface ErrorLogStats {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByModel: Record<string, number>;
  errorsByCode: Record<number, number>;
  recentErrors: ErrorLogEntry[];
}

export class ErrorLogService {
  async createErrorLog(data: {
    geminiKey?: string;
    modelName?: string;
    errorType?: string;
    errorLog?: string;
    errorCode?: number;
    requestMsg?: any;
  }): Promise<void> {
    try {
      if (!settings.ERROR_LOG_ENABLED) {
        return;
      }

      await databaseService.createErrorLog(data);

      logger.debug('Error log created', {
        errorType: data.errorType,
        errorCode: data.errorCode,
        modelName: data.modelName,
      });

    } catch (error) {
      logger.error('Failed to create error log:', error);
    }
  }

  async getErrorLogs(
    limit: number = 50,
    offset: number = 0,
    filter?: ErrorLogFilter
  ): Promise<ErrorLogEntry[]> {
    try {
      const logs = await databaseService.getErrorLogs(limit, offset);
      
      // Apply filters if provided
      let filteredLogs = logs;
      
      if (filter) {
        filteredLogs = logs.filter(log => {
          if (filter.startDate && log.requestTime < filter.startDate) return false;
          if (filter.endDate && log.requestTime > filter.endDate) return false;
          if (filter.errorType && log.errorType !== filter.errorType) return false;
          if (filter.modelName && log.modelName !== filter.modelName) return false;
          if (filter.errorCode && log.errorCode !== filter.errorCode) return false;
          return true;
        });
      }

      return filteredLogs.map(log => ({
        id: log.id,
        geminiKey: log.geminiKey,
        modelName: log.modelName,
        errorType: log.errorType,
        errorLog: log.errorLog,
        errorCode: log.errorCode,
        requestMsg: log.requestMsg,
        requestTime: log.requestTime,
      }));

    } catch (error) {
      logger.error('Failed to get error logs:', error);
      return [];
    }
  }

  async getErrorLogStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<ErrorLogStats> {
    try {
      const filter: ErrorLogFilter = {};
      if (startDate) filter.startDate = startDate;
      if (endDate) filter.endDate = endDate;

      const logs = await this.getErrorLogs(1000, 0, filter);
      
      const stats: ErrorLogStats = {
        totalErrors: logs.length,
        errorsByType: {},
        errorsByModel: {},
        errorsByCode: {},
        recentErrors: logs.slice(0, 10),
      };

      // Aggregate statistics
      for (const log of logs) {
        // Count by error type
        if (log.errorType) {
          stats.errorsByType[log.errorType] = (stats.errorsByType[log.errorType] || 0) + 1;
        }

        // Count by model
        if (log.modelName) {
          stats.errorsByModel[log.modelName] = (stats.errorsByModel[log.modelName] || 0) + 1;
        }

        // Count by error code
        if (log.errorCode) {
          stats.errorsByCode[log.errorCode] = (stats.errorsByCode[log.errorCode] || 0) + 1;
        }
      }

      return stats;

    } catch (error) {
      logger.error('Failed to get error log stats:', error);
      return {
        totalErrors: 0,
        errorsByType: {},
        errorsByModel: {},
        errorsByCode: {},
        recentErrors: [],
      };
    }
  }

  async getErrorLogById(id: number): Promise<ErrorLogEntry | null> {
    try {
      const logs = await databaseService.getErrorLogs(1, 0);
      const log = logs.find(l => l.id === id);
      
      if (!log) {
        return null;
      }

      return {
        id: log.id,
        geminiKey: log.geminiKey,
        modelName: log.modelName,
        errorType: log.errorType,
        errorLog: log.errorLog,
        errorCode: log.errorCode,
        requestMsg: log.requestMsg,
        requestTime: log.requestTime,
      };

    } catch (error) {
      logger.error('Failed to get error log by ID:', error);
      return null;
    }
  }

  async deleteOldErrorLogs(retentionDays?: number): Promise<number> {
    try {
      const days = retentionDays || settings.ERROR_LOG_RETENTION_DAYS;
      const deletedCount = await databaseService.deleteOldErrorLogs(days);
      
      if (deletedCount > 0) {
        logger.info(`Deleted ${deletedCount} old error logs (older than ${days} days)`);
      }

      return deletedCount;

    } catch (error) {
      logger.error('Failed to delete old error logs:', error);
      return 0;
    }
  }

  async getErrorsByTimeRange(
    startDate: Date,
    endDate: Date,
    groupBy: 'hour' | 'day' = 'day'
  ): Promise<Array<{
    time: string;
    count: number;
  }>> {
    try {
      const logs = await this.getErrorLogs(1000, 0, { startDate, endDate });
      
      const grouped: Record<string, number> = {};
      
      for (const log of logs) {
        let timeKey: string;
        
        if (groupBy === 'hour') {
          timeKey = log.requestTime.toISOString().substring(0, 13) + ':00:00Z';
        } else {
          timeKey = log.requestTime.toISOString().substring(0, 10);
        }
        
        grouped[timeKey] = (grouped[timeKey] || 0) + 1;
      }

      return Object.entries(grouped)
        .map(([time, count]) => ({ time, count }))
        .sort((a, b) => a.time.localeCompare(b.time));

    } catch (error) {
      logger.error('Failed to get errors by time range:', error);
      return [];
    }
  }

  async getTopErrors(limit: number = 10): Promise<Array<{
    errorType: string;
    count: number;
    percentage: number;
  }>> {
    try {
      const stats = await this.getErrorLogStats();
      const total = stats.totalErrors;
      
      if (total === 0) {
        return [];
      }

      return Object.entries(stats.errorsByType)
        .map(([errorType, count]) => ({
          errorType,
          count,
          percentage: Math.round((count / total) * 100 * 100) / 100,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

    } catch (error) {
      logger.error('Failed to get top errors:', error);
      return [];
    }
  }

  async getErrorTrends(days: number = 7): Promise<Array<{
    date: string;
    count: number;
    change: number;
  }>> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
      
      const dailyErrors = await this.getErrorsByTimeRange(startDate, endDate, 'day');
      
      const trends = dailyErrors.map((current, index) => {
        const previous = dailyErrors[index - 1];
        const change = previous ? current.count - previous.count : 0;
        
        return {
          date: current.time,
          count: current.count,
          change,
        };
      });

      return trends;

    } catch (error) {
      logger.error('Failed to get error trends:', error);
      return [];
    }
  }

  async clearAllErrorLogs(): Promise<number> {
    try {
      // This would need to be implemented in the database service
      logger.warn('Clear all error logs not implemented yet');
      return 0;

    } catch (error) {
      logger.error('Failed to clear all error logs:', error);
      return 0;
    }
  }
}

export const errorLogService = new ErrorLogService();