import { PrismaClient } from '@prisma/client';
import { getDatabaseLogger } from '@/log/logger';

const logger = getDatabaseLogger();
const prisma = new PrismaClient();

export class DatabaseService {
  // Settings operations
  async getSetting(key: string): Promise<string | null> {
    try {
      const setting = await prisma.settings.findUnique({
        where: { key },
      });
      return setting?.value || null;
    } catch (error) {
      logger.error(`Failed to get setting ${key}:`, error);
      return null;
    }
  }

  async setSetting(key: string, value: string, description?: string): Promise<void> {
    try {
      await prisma.settings.upsert({
        where: { key },
        update: { value, description },
        create: { key, value, description },
      });
    } catch (error) {
      logger.error(`Failed to set setting ${key}:`, error);
      throw error;
    }
  }

  async getAllSettings(): Promise<Record<string, string>> {
    try {
      const settings = await prisma.settings.findMany();
      return settings.reduce((acc, setting) => {
        if (setting.value) {
          acc[setting.key] = setting.value;
        }
        return acc;
      }, {} as Record<string, string>);
    } catch (error) {
      logger.error('Failed to get all settings:', error);
      return {};
    }
  }

  // Error log operations
  async createErrorLog(data: {
    geminiKey?: string;
    modelName?: string;
    errorType?: string;
    errorLog?: string;
    errorCode?: number;
    requestMsg?: any;
  }): Promise<void> {
    try {
      await prisma.errorLog.create({
        data: {
          geminiKey: data.geminiKey,
          modelName: data.modelName,
          errorType: data.errorType,
          errorLog: data.errorLog,
          errorCode: data.errorCode,
          requestMsg: data.requestMsg,
        },
      });
    } catch (error) {
      logger.error('Failed to create error log:', error);
      throw error;
    }
  }

  async getErrorLogs(limit: number = 50, offset: number = 0): Promise<any[]> {
    try {
      return await prisma.errorLog.findMany({
        take: limit,
        skip: offset,
        orderBy: { requestTime: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to get error logs:', error);
      return [];
    }
  }

  async deleteOldErrorLogs(retentionDays: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await prisma.errorLog.deleteMany({
        where: {
          requestTime: {
            lt: cutoffDate,
          },
        },
      });

      return result.count;
    } catch (error) {
      logger.error('Failed to delete old error logs:', error);
      return 0;
    }
  }

  // Request log operations
  async createRequestLog(data: {
    geminiKey?: string;
    modelName?: string;
    requestType?: string;
    requestMsg?: any;
    responseMsg?: any;
    responseTime?: Date;
  }): Promise<void> {
    try {
      await prisma.requestLog.create({
        data: {
          geminiKey: data.geminiKey,
          modelName: data.modelName,
          requestType: data.requestType,
          requestMsg: data.requestMsg,
          responseMsg: data.responseMsg,
          responseTime: data.responseTime || new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to create request log:', error);
      throw error;
    }
  }

  async getRequestLogs(limit: number = 50, offset: number = 0): Promise<any[]> {
    try {
      return await prisma.requestLog.findMany({
        take: limit,
        skip: offset,
        orderBy: { requestTime: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to get request logs:', error);
      return [];
    }
  }

  async deleteOldRequestLogs(retentionDays: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await prisma.requestLog.deleteMany({
        where: {
          requestTime: {
            lt: cutoffDate,
          },
        },
      });

      return result.count;
    } catch (error) {
      logger.error('Failed to delete old request logs:', error);
      return 0;
    }
  }

  // Stats operations
  async updateStats(date: Date, data: {
    totalRequests?: number;
    successRequests?: number;
    failedRequests?: number;
    totalTokens?: bigint;
    inputTokens?: bigint;
    outputTokens?: bigint;
  }): Promise<void> {
    try {
      await prisma.stats.upsert({
        where: { date },
        update: data,
        create: { date, ...data },
      });
    } catch (error) {
      logger.error('Failed to update stats:', error);
      throw error;
    }
  }

  async getStats(startDate: Date, endDate: Date): Promise<any[]> {
    try {
      return await prisma.stats.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { date: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to get stats:', error);
      return [];
    }
  }

  // Key status operations
  async updateKeyStatus(keyHash: string, keyType: 'API' | 'VERTEX', isActive: boolean, failCount: number = 0): Promise<void> {
    try {
      await prisma.keyStatus.upsert({
        where: { keyHash },
        update: { isActive, failCount, lastChecked: new Date() },
        create: { keyHash, keyType, isActive, failCount },
      });
    } catch (error) {
      logger.error('Failed to update key status:', error);
      throw error;
    }
  }

  async getKeyStatuses(): Promise<any[]> {
    try {
      return await prisma.keyStatus.findMany({
        orderBy: { lastChecked: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to get key statuses:', error);
      return [];
    }
  }

  // File upload operations
  async createFileUpload(data: {
    filename: string;
    originalName: string;
    mimeType: string;
    size: bigint;
    url?: string;
    provider: string;
  }): Promise<any> {
    try {
      return await prisma.fileUpload.create({
        data,
      });
    } catch (error) {
      logger.error('Failed to create file upload record:', error);
      throw error;
    }
  }

  async getFileUpload(id: number): Promise<any> {
    try {
      return await prisma.fileUpload.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error('Failed to get file upload:', error);
      return null;
    }
  }
}

export const databaseService = new DatabaseService();
export { prisma };