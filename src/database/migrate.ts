#!/usr/bin/env node

/**
 * Database migration utility script
 * Can be run standalone or imported as a module
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { getDatabaseLogger } from '@/log/logger';
import settings from '@/config/config';

const execAsync = promisify(exec) as (command: string) => Promise<{stdout: string; stderr: string}>;
const logger = getDatabaseLogger();

export interface MigrationOptions {
  force?: boolean;
  acceptDataLoss?: boolean;
  environment?: 'development' | 'production' | 'test';
}

function set_database_url(): void {
  const { MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE } = settings;
  const databaseUrl = `mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}`;

  logger.info(`Connecting to database mysql://${MYSQL_USER}:xxxxxxxx@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}`);

  // Set DATABASE_URL environment variable for Prisma
  process.env['DATABASE_URL'] = databaseUrl;

  if (!process.env['DATABASE_URL']) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
}

export async function runMigrations(options: MigrationOptions = {}): Promise<void> {
  const { force = false, acceptDataLoss = false, environment = process.env['NODE_ENV'] as any || 'development' } = options;

  try {
    set_database_url();

    logger.info(`Running database migrations for ${environment} environment...`);

    if (environment === 'development' || force) {
      // Use db push for development or when forced
      const pushCommand = `npx prisma db push${acceptDataLoss ? ' --accept-data-loss' : ''}`;
      logger.info(`Executing: ${pushCommand}`);
      
      const result = await execAsync(pushCommand);
      
      if (result.stderr && !result.stderr.includes('warnings')) {
        logger.warn({ err: result.stderr }, 'Prisma db push warnings:');
      }
      
      logger.info({ result: result.stdout }, 'Prisma db push completed:');
    } else {
      // Use migrate deploy for production
      logger.info('Executing: npx prisma migrate deploy');
      const result = await execAsync('npx prisma migrate deploy');
      
      if (result.stderr) {
        logger.warn({ err: result.stderr }, 'Prisma migrate warnings:');
      }
      
      logger.info({ result: result.stdout }, 'Prisma migrate deploy completed:');
    }

    // Generate Prisma client
    logger.info('Generating Prisma client...');
    const genResult = await execAsync('npx prisma generate');
    logger.info({ result: genResult.stdout }, 'Prisma client generated:');

  } catch (error: any) {
    logger.error({ err: error }, 'Migration failed:');
    throw error;
  }
}

export async function createMigration(name: string): Promise<void> {
  try {
    set_database_url();

    logger.info(`Creating new migration: ${name}`);
    const result = await execAsync(`npx prisma migrate dev --name ${name}`);
    
    if (result.stderr) {
      logger.warn({ err: result.stderr }, 'Migration creation warnings:');
    }
    
    logger.info({ result: result.stdout }, 'Migration created:');
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to create migration:');
    throw error;
  }
}

export async function resetDatabase(): Promise<void> {
  try {
    set_database_url();

    logger.warn('Resetting database - this will delete all data!');
    const result = await execAsync('npx prisma migrate reset --force');
    
    if (result.stderr) {
      logger.warn({ err: result.stderr }, 'Database reset warnings:');
    }
    
    logger.info({ result: result.stdout }, 'Database reset completed:');
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to reset database:');
    throw error;
  }
}

export async function validateSchema(): Promise<boolean> {
  try {
    set_database_url();

    logger.info('Validating Prisma schema...');
    const result = await execAsync('npx prisma validate');
    
    if (result.stderr) {
      logger.error({ err: result.stderr }, 'Schema validation errors:');
      return false;
    }
    
    logger.info({ result: result.stdout }, 'Schema validation passed:');
    return true;
  } catch (error: any) {
    logger.error({ err: error }, 'Schema validation failed:');
    return false;
  }
}

// CLI interface when run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  async function main() {
    try {
      switch (command) {
        case 'migrate':
          await runMigrations({
            environment: args.includes('--prod') ? 'production' : 'development',
            acceptDataLoss: args.includes('--accept-data-loss'),
            force: args.includes('--force')
          });
          break;
        
        case 'create':
          const migrationName = args[1];
          if (!migrationName) {
            throw new Error('Migration name is required. Usage: npm run migrate create <name>');
          }
          await createMigration(migrationName);
          break;
        
        case 'reset':
          await resetDatabase();
          break;
        
        case 'validate':
          const isValid = await validateSchema();
          process.exit(isValid ? 0 : 1);
          break;
        
        default:
          console.log(`
Usage: npm run migrate <command> [options]

Commands:
  migrate [--prod] [--accept-data-loss] [--force]  Run database migrations
  create <name>                                    Create a new migration
  reset                                            Reset database (destructive)
  validate                                         Validate Prisma schema

Options:
  --prod              Use production migration strategy
  --accept-data-loss  Accept potential data loss during migration
  --force             Force db push even in production
          `);
          process.exit(1);
      }
    } catch (error) {
      console.error('Migration command failed:', error);
      process.exit(1);
    }
  }

  main();
}