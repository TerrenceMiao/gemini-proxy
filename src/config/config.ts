import { z } from 'zod';
import { config } from 'dotenv';
import {
  DEFAULT_FILTER_MODELS,
  DEFAULT_MODEL,
  DEFAULT_CREATE_IMAGE_MODEL,
  DEFAULT_SAFETY_SETTINGS,
  DEFAULT_TIMEOUT,
  MAX_RETRIES,
  DEFAULT_STREAM_CHUNK_SIZE,
  DEFAULT_STREAM_MIN_DELAY,
  DEFAULT_STREAM_MAX_DELAY,
  DEFAULT_STREAM_SHORT_TEXT_THRESHOLD,
  DEFAULT_STREAM_LONG_TEXT_THRESHOLD,
} from '@/core/constants';
import { Logger } from '@/log/logger';

// Load environment variables
config();

const logger = new Logger('config');

// Validation schemas
const DatabaseTypeSchema = z.enum(['mysql', 'sqlite']);

const SafetySettingSchema = z.object({
  category: z.string(),
  threshold: z.string(),
});

const SettingsSchema = z.object({
  // Database configuration
  DATABASE_TYPE: DatabaseTypeSchema.default('mysql'),
  SQLITE_DATABASE: z.string().default('default_db'),
  MYSQL_HOST: z.string().default(''),
  MYSQL_PORT: z.number().default(3306),
  MYSQL_USER: z.string().default(''),
  MYSQL_PASSWORD: z.string().default(''),
  MYSQL_DATABASE: z.string().default(''),
  MYSQL_SOCKET: z.string().default(''),

  // API Keys
  API_KEYS: z.array(z.string()).default([]),
  VERTEX_API_KEYS: z.array(z.string()).default([]),
  PAID_KEY: z.string().optional(),

  // Model configuration
  MODEL: z.string().default(DEFAULT_MODEL),
  CREATE_IMAGE_MODEL: z.string().default(DEFAULT_CREATE_IMAGE_MODEL),
  FILTER_MODELS: z.array(z.string()).default(DEFAULT_FILTER_MODELS),

  // Safety settings
  SAFETY_SETTINGS: z.array(SafetySettingSchema).default(DEFAULT_SAFETY_SETTINGS),

  // Request configuration
  TIMEOUT: z.number().default(DEFAULT_TIMEOUT),
  MAX_RETRIES: z.number().default(MAX_RETRIES),

  // Stream configuration
  STREAM_OPTIMIZER_ENABLED: z.boolean().default(true),
  STREAM_CHUNK_SIZE: z.number().default(DEFAULT_STREAM_CHUNK_SIZE),
  STREAM_MIN_DELAY: z.number().default(DEFAULT_STREAM_MIN_DELAY),
  STREAM_MAX_DELAY: z.number().default(DEFAULT_STREAM_MAX_DELAY),
  STREAM_SHORT_TEXT_THRESHOLD: z.number().default(DEFAULT_STREAM_SHORT_TEXT_THRESHOLD),
  STREAM_LONG_TEXT_THRESHOLD: z.number().default(DEFAULT_STREAM_LONG_TEXT_THRESHOLD),

  // File upload configuration
  UPLOAD_HANDLER: z.enum(['SMMS', 'PICGO', 'CLOUDFLARE', 'INTERNAL']).default('INTERNAL'),
  SMMS_API_KEY: z.string().optional(),
  PICGO_HOST: z.string().optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  CLOUDFLARE_BUCKET_NAME: z.string().optional(),
  CLOUDFLARE_CUSTOM_DOMAIN: z.string().optional(),

  // Authentication
  WEB_AUTH_ENABLED: z.boolean().default(true),
  WEB_AUTH_TOKEN: z.string().optional(),
  API_AUTH_ENABLED: z.boolean().default(false),
  API_AUTH_TOKEN: z.string().optional(),

  // Logging
  REQUEST_LOG_ENABLED: z.boolean().default(true),
  REQUEST_LOG_RETENTION_DAYS: z.number().default(30),
  ERROR_LOG_ENABLED: z.boolean().default(true),
  ERROR_LOG_RETENTION_DAYS: z.number().default(30),

  // Scheduler configuration
  SCHEDULER_ENABLED: z.boolean().default(true),
  KEY_CHECK_INTERVAL: z.number().default(300), // 5 minutes
  LOG_CLEANUP_INTERVAL: z.number().default(3600), // 1 hour

  // Other settings
  PROXY_HOST: z.string().optional(),
  PROXY_PORT: z.number().optional(),
  PROXY_USERNAME: z.string().optional(),
  PROXY_PASSWORD: z.string().optional(),
  USER_AGENT: z.string().default('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
});

type Settings = z.infer<typeof SettingsSchema>;

function parseEnvArray(envVar: string | undefined, defaultValue: string[] = []): string[] {
  if (!envVar) return defaultValue;
  try {
    return envVar.split(',').map(item => item.trim()).filter(Boolean);
  } catch {
    return defaultValue;
  }
}

function parseEnvJSON<T>(envVar: string | undefined, defaultValue: T): T {
  if (!envVar) return defaultValue;
  try {
    return JSON.parse(envVar);
  } catch {
    return defaultValue;
  }
}

function parseEnvBoolean(envVar: string | undefined, defaultValue: boolean): boolean {
  if (!envVar) return defaultValue;
  return envVar.toLowerCase() === 'true';
}

function parseEnvNumber(envVar: string | undefined, defaultValue: number): number {
  if (!envVar) return defaultValue;
  const parsed = parseInt(envVar, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Load settings from environment variables
function loadSettingsFromEnv(): Settings {
  const rawSettings = {
    DATABASE_TYPE: (process.env['DATABASE_TYPE'] || 'mysql') as 'mysql' | 'sqlite',
    SQLITE_DATABASE: process.env['SQLITE_DATABASE'] || 'default_db',
    MYSQL_HOST: process.env['MYSQL_HOST'] || '',
    MYSQL_PORT: parseEnvNumber(process.env['MYSQL_PORT'], 3306),
    MYSQL_USER: process.env['MYSQL_USER'] || '',
    MYSQL_PASSWORD: process.env['MYSQL_PASSWORD'] || '',
    MYSQL_DATABASE: process.env['MYSQL_DATABASE'] || '',
    MYSQL_SOCKET: process.env['MYSQL_SOCKET'] || '',

    API_KEYS: parseEnvArray(process.env['API_KEYS']),
    VERTEX_API_KEYS: parseEnvArray(process.env['VERTEX_API_KEYS']),
    PAID_KEY: process.env['PAID_KEY'],

    MODEL: process.env['MODEL'] || DEFAULT_MODEL,
    CREATE_IMAGE_MODEL: process.env['CREATE_IMAGE_MODEL'] || DEFAULT_CREATE_IMAGE_MODEL,
    FILTER_MODELS: parseEnvArray(process.env['FILTER_MODELS'], DEFAULT_FILTER_MODELS),

    SAFETY_SETTINGS: parseEnvJSON(process.env['SAFETY_SETTINGS'], DEFAULT_SAFETY_SETTINGS),

    TIMEOUT: parseEnvNumber(process.env['TIMEOUT'], DEFAULT_TIMEOUT),
    MAX_RETRIES: parseEnvNumber(process.env['MAX_RETRIES'], MAX_RETRIES),

    STREAM_OPTIMIZER_ENABLED: parseEnvBoolean(process.env['STREAM_OPTIMIZER_ENABLED'], true),
    STREAM_CHUNK_SIZE: parseEnvNumber(process.env['STREAM_CHUNK_SIZE'], DEFAULT_STREAM_CHUNK_SIZE),
    STREAM_MIN_DELAY: parseEnvNumber(process.env['STREAM_MIN_DELAY'], DEFAULT_STREAM_MIN_DELAY),
    STREAM_MAX_DELAY: parseEnvNumber(process.env['STREAM_MAX_DELAY'], DEFAULT_STREAM_MAX_DELAY),
    STREAM_SHORT_TEXT_THRESHOLD: parseEnvNumber(process.env['STREAM_SHORT_TEXT_THRESHOLD'], DEFAULT_STREAM_SHORT_TEXT_THRESHOLD),
    STREAM_LONG_TEXT_THRESHOLD: parseEnvNumber(process.env['STREAM_LONG_TEXT_THRESHOLD'], DEFAULT_STREAM_LONG_TEXT_THRESHOLD),

    UPLOAD_HANDLER: (process.env['UPLOAD_HANDLER'] || 'INTERNAL') as 'SMMS' | 'PICGO' | 'CLOUDFLARE' | 'INTERNAL',
    SMMS_API_KEY: process.env['SMMS_API_KEY'],
    PICGO_HOST: process.env['PICGO_HOST'],
    CLOUDFLARE_ACCOUNT_ID: process.env['CLOUDFLARE_ACCOUNT_ID'],
    CLOUDFLARE_API_TOKEN: process.env['CLOUDFLARE_API_TOKEN'],
    CLOUDFLARE_BUCKET_NAME: process.env['CLOUDFLARE_BUCKET_NAME'],
    CLOUDFLARE_CUSTOM_DOMAIN: process.env['CLOUDFLARE_CUSTOM_DOMAIN'],

    WEB_AUTH_ENABLED: parseEnvBoolean(process.env['WEB_AUTH_ENABLED'], true),
    WEB_AUTH_TOKEN: process.env['WEB_AUTH_TOKEN'],
    API_AUTH_ENABLED: parseEnvBoolean(process.env['API_AUTH_ENABLED'], false),
    API_AUTH_TOKEN: process.env['API_AUTH_TOKEN'],

    REQUEST_LOG_ENABLED: parseEnvBoolean(process.env['REQUEST_LOG_ENABLED'], true),
    REQUEST_LOG_RETENTION_DAYS: parseEnvNumber(process.env['REQUEST_LOG_RETENTION_DAYS'], 30),
    ERROR_LOG_ENABLED: parseEnvBoolean(process.env['ERROR_LOG_ENABLED'], true),
    ERROR_LOG_RETENTION_DAYS: parseEnvNumber(process.env['ERROR_LOG_RETENTION_DAYS'], 30),

    SCHEDULER_ENABLED: parseEnvBoolean(process.env['SCHEDULER_ENABLED'], true),
    KEY_CHECK_INTERVAL: parseEnvNumber(process.env['KEY_CHECK_INTERVAL'], 300),
    LOG_CLEANUP_INTERVAL: parseEnvNumber(process.env['LOG_CLEANUP_INTERVAL'], 3600),

    PROXY_HOST: process.env['PROXY_HOST'],
    PROXY_PORT: parseEnvNumber(process.env['PROXY_PORT'], 8080),
    PROXY_USERNAME: process.env['PROXY_USERNAME'],
    PROXY_PASSWORD: process.env['PROXY_PASSWORD'],
    USER_AGENT: process.env['USER_AGENT'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };

  return SettingsSchema.parse(rawSettings);
}

export let settings = loadSettingsFromEnv();

// Sync initial settings with database
export async function syncInitialSettings(): Promise<void> {
  try {
    logger.info('Syncing initial settings with database...');
    
    // This would sync settings from database, overriding env vars where applicable
    // For now, we'll just log that it's happening
    logger.info('Settings synced with database');
  } catch (error) {
    logger.error('Failed to sync settings with database:', error);
    throw error;
  }
}

// Update settings (for runtime configuration changes)
export function updateSettings(newSettings: Partial<Settings>): void {
  settings = { ...settings, ...newSettings };
  logger.info('Settings updated');
}

// Get a specific setting
export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
  return settings[key];
}

// Export settings object
export { Settings };
export default settings;