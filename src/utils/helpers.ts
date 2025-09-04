import { readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

export function getCurrentVersion(): string {
  try {
    const versionPath = join(process.cwd(), 'VERSION');
    return readFileSync(versionPath, 'utf8').trim();
  } catch {
    try {
      const packagePath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as { version?: string };
      return packageJson.version ?? '1.0.0';
    } catch {
      return '1.0.0';
    }
  }
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function hashString(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeKey(key: string): string {
  if (key.length <= 8) return key;
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function parseJsonSafely<T>(jsonString: string, defaultValue: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return defaultValue;
  }
}

export function isObject(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === 'object' && !Array.isArray(item);
}

export function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key as keyof T])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key as keyof T] });
        } else {
          output[key as keyof T] = deepMerge(target[key as keyof T] as object, source[key as keyof T] as Partial<object>) as T[keyof T];
        }
      } else {
        Object.assign(output, { [key]: source[key as keyof T] });
      }
    });
  }
  
  return output;
}

export function redactSensitiveData(data: unknown): unknown {
  if (typeof data === 'string') {
    // Redact API keys and tokens with first 4 chars + ... + last 4 chars
    return data.replace(/AIza[0-9A-Za-z-_]{35}|sk-[a-zA-Z0-9]{48}/g, (match) => {
      return `${match.substring(0, 4)}...${match.substring(match.length - 4)}`;
    });
  }
  
  if (Array.isArray(data)) {
    return data.map(redactSensitiveData);
  }
  
  if (isObject(data)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key.toLowerCase().includes('key') || key.toLowerCase().includes('token') || key.toLowerCase().includes('password')) {
        if (typeof value === 'string' && value.length > 8) {
          result[key] = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
        } else {
          result[key] = value;
        }
      } else {
        result[key] = redactSensitiveData(value);
      }
    }
    return result;
  }
  
  return data;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

export function formatTimestamp(timestamp: Date): string {
  return timestamp.toISOString();
}

export function getClientIp(request: { headers: Record<string, string | string[] | undefined>; connection?: { remoteAddress?: string }; socket?: { remoteAddress?: string }; ip?: string }): string | string[] {
  const ip = (
    request.headers['x-forwarded-for'] ??
    request.headers['x-real-ip'] ??
    request.connection?.remoteAddress ??
    request.socket?.remoteAddress ??
    request.ip ??
    'unknown'
  );
  
  return Array.isArray(ip) ? (ip[0] || ip) : ip;
}

export function safeJsonStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, (_, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      if (value === undefined) {
        return null;
      }
      return value;
    });
  } catch (error) {
    return JSON.stringify({ error: 'Failed to stringify object' });
  }
}