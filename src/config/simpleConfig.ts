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

// Load environment variables
config();

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

export const settings = {
  // Database configuration
  DATABASE_TYPE: (process.env.DATABASE_TYPE || 'mysql') as 'mysql' | 'sqlite',
  SQLITE_DATABASE: process.env.SQLITE_DATABASE || 'default_db',
  MYSQL_HOST: process.env.MYSQL_HOST || '',
  MYSQL_PORT: parseEnvNumber(process.env.MYSQL_PORT, 3306),
  MYSQL_USER: process.env.MYSQL_USER || '',
  MYSQL_PASSWORD: process.env.MYSQL_PASSWORD || '',
  MYSQL_DATABASE: process.env.MYSQL_DATABASE || '',
  MYSQL_SOCKET: process.env.MYSQL_SOCKET || '',

  // API Keys
  API_KEYS: parseEnvArray(process.env.API_KEYS),
  VERTEX_API_KEYS: parseEnvArray(process.env.VERTEX_API_KEYS),
  PAID_KEY: process.env.PAID_KEY || '',

  // Model configuration
  MODEL: process.env.MODEL || DEFAULT_MODEL,
  CREATE_IMAGE_MODEL: process.env.CREATE_IMAGE_MODEL || DEFAULT_CREATE_IMAGE_MODEL,
  FILTER_MODELS: parseEnvArray(process.env.FILTER_MODELS, DEFAULT_FILTER_MODELS),

  // Safety settings
  SAFETY_SETTINGS: parseEnvJSON(process.env.SAFETY_SETTINGS, DEFAULT_SAFETY_SETTINGS),

  // Request configuration
  TIMEOUT: parseEnvNumber(process.env.TIMEOUT, DEFAULT_TIMEOUT),
  MAX_RETRIES: parseEnvNumber(process.env.MAX_RETRIES, MAX_RETRIES),

  // Stream configuration
  STREAM_OPTIMIZER_ENABLED: parseEnvBoolean(process.env.STREAM_OPTIMIZER_ENABLED, true),
  STREAM_CHUNK_SIZE: parseEnvNumber(process.env.STREAM_CHUNK_SIZE, DEFAULT_STREAM_CHUNK_SIZE),
  STREAM_MIN_DELAY: parseEnvNumber(process.env.STREAM_MIN_DELAY, DEFAULT_STREAM_MIN_DELAY),
  STREAM_MAX_DELAY: parseEnvNumber(process.env.STREAM_MAX_DELAY, DEFAULT_STREAM_MAX_DELAY),
  STREAM_SHORT_TEXT_THRESHOLD: parseEnvNumber(process.env.STREAM_SHORT_TEXT_THRESHOLD, DEFAULT_STREAM_SHORT_TEXT_THRESHOLD),
  STREAM_LONG_TEXT_THRESHOLD: parseEnvNumber(process.env.STREAM_LONG_TEXT_THRESHOLD, DEFAULT_STREAM_LONG_TEXT_THRESHOLD),

  // File upload configuration
  UPLOAD_HANDLER: (process.env.UPLOAD_HANDLER || 'INTERNAL') as 'SMMS' | 'PICGO' | 'CLOUDFLARE' | 'INTERNAL',
  SMMS_API_KEY: process.env.SMMS_API_KEY || '',
  PICGO_HOST: process.env.PICGO_HOST || '',
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || '',
  CLOUDFLARE_BUCKET_NAME: process.env.CLOUDFLARE_BUCKET_NAME || '',
  CLOUDFLARE_CUSTOM_DOMAIN: process.env.CLOUDFLARE_CUSTOM_DOMAIN || '',

  // Authentication
  WEB_AUTH_ENABLED: parseEnvBoolean(process.env.WEB_AUTH_ENABLED, true),
  WEB_AUTH_TOKEN: process.env.WEB_AUTH_TOKEN || '',
  API_AUTH_ENABLED: parseEnvBoolean(process.env.API_AUTH_ENABLED, false),
  API_AUTH_TOKEN: process.env.API_AUTH_TOKEN || '',

  // Logging
  REQUEST_LOG_ENABLED: parseEnvBoolean(process.env.REQUEST_LOG_ENABLED, true),
  REQUEST_LOG_RETENTION_DAYS: parseEnvNumber(process.env.REQUEST_LOG_RETENTION_DAYS, 30),
  ERROR_LOG_ENABLED: parseEnvBoolean(process.env.ERROR_LOG_ENABLED, true),
  ERROR_LOG_RETENTION_DAYS: parseEnvNumber(process.env.ERROR_LOG_RETENTION_DAYS, 30),

  // Scheduler configuration
  SCHEDULER_ENABLED: parseEnvBoolean(process.env.SCHEDULER_ENABLED, true),
  KEY_CHECK_INTERVAL: parseEnvNumber(process.env.KEY_CHECK_INTERVAL, 300),
  LOG_CLEANUP_INTERVAL: parseEnvNumber(process.env.LOG_CLEANUP_INTERVAL, 3600),

  // Proxy configuration
  PROXY_HOST: process.env.PROXY_HOST || '',
  PROXY_PORT: parseEnvNumber(process.env.PROXY_PORT, 8080),
  PROXY_USERNAME: process.env.PROXY_USERNAME || '',
  PROXY_PASSWORD: process.env.PROXY_PASSWORD || '',

  // Other settings
  USER_AGENT: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

export async function syncInitialSettings(): Promise<void> {
  // Placeholder for database sync functionality
  console.log('Settings sync placeholder');
}

export function updateSettings(newSettings: Partial<typeof settings>): void {
  Object.assign(settings, newSettings);
}

export function getSetting<K extends keyof typeof settings>(key: K): typeof settings[K] {
  return settings[key];
}

export type Settings = typeof settings;
export default settings;