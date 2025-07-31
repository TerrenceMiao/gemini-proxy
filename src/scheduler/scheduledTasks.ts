import * as cron from 'node-cron';
import { getSchedulerLogger } from '@/log/logger';
import { settings } from '@/config/config';

const logger = getSchedulerLogger();

let keyCheckTask: cron.ScheduledTask | null = null;
let logCleanupTask: cron.ScheduledTask | null = null;

export function startScheduler(): void {
  if (!settings.SCHEDULER_ENABLED) {
    logger.info('Scheduler disabled by configuration');
    return;
  }

  logger.info('Starting scheduler...');

  // Key health check task (every 5 minutes by default)
  const keyCheckInterval = Math.max(settings.KEY_CHECK_INTERVAL, 60); // minimum 1 minute
  keyCheckTask = cron.schedule(`*/${Math.floor(keyCheckInterval / 60)} * * * *`, async () => {
    try {
      logger.debug('Running key health check...');
      // TODO: Implement key health check
      // await checkKeyHealth();
    } catch (error) {
      logger.error('Error in key health check task:', error);
    }
  });

  // Log cleanup task (every hour by default)
  const logCleanupInterval = Math.max(settings.LOG_CLEANUP_INTERVAL, 3600); // minimum 1 hour
  logCleanupTask = cron.schedule(`0 */${Math.floor(logCleanupInterval / 3600)} * * *`, async () => {
    try {
      logger.debug('Running log cleanup...');
      // TODO: Implement log cleanup
      // await cleanupOldLogs();
    } catch (error) {
      logger.error('Error in log cleanup task:', error);
    }
  });

  logger.info('Scheduler started successfully');
}

export function stopScheduler(): void {
  logger.info('Stopping scheduler...');

  if (keyCheckTask) {
    keyCheckTask.stop();
    keyCheckTask = null;
  }

  if (logCleanupTask) {
    logCleanupTask.stop();
    logCleanupTask = null;
  }

  logger.info('Scheduler stopped');
}

// async function checkKeyHealth(): Promise<void> {
//   // TODO: Implement key health check logic
//   logger.debug('Key health check completed');
// }

// async function cleanupOldLogs(): Promise<void> {
//   // TODO: Implement log cleanup logic
//   logger.debug('Log cleanup completed');
// }