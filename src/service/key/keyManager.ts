import { getServiceLogger } from '@/log/logger';
import settings from '@/config/config';

const logger = getServiceLogger();

export class KeyManager {
  private apiKeys: string[] = [];
  private vertexKeys: string[] = [];
  private currentKeyIndex = 0;
  private failedKeys = new Set<string>();

  constructor() {
    this.apiKeys = settings.API_KEYS;
    this.vertexKeys = settings.VERTEX_API_KEYS;
    logger.info(`KeyManager initialized with ${this.apiKeys.length} API keys and ${this.vertexKeys.length} Vertex keys`);
  }

  getNextKey(): string | undefined {
    const availableKeys = this.apiKeys.filter(key => !this.failedKeys.has(key));

    if (availableKeys.length === 0) {
      logger.error(`No available API keys in KeyManager. apiKeys: ${JSON.stringify(this.apiKeys)} failedKeys: ${JSON.stringify(Array.from(this.failedKeys))}`);
      return undefined;
    }

    const key = availableKeys[this.currentKeyIndex % availableKeys.length];
    this.currentKeyIndex++;

    if (key) {
      logger.debug(`Using API key: ${this.sanitizeKey(key)}`);
    }
    return key;
  }

  getNextVertexKey(): string | undefined {
    const availableKeys = this.vertexKeys.filter(key => !this.failedKeys.has(key));

    if (availableKeys.length === 0) {
      logger.error('No available Vertex keys');
      return undefined;
    }

    const key = availableKeys[this.currentKeyIndex % availableKeys.length];
    this.currentKeyIndex++;

    if (key) {
      logger.debug(`Using Vertex key: ${this.sanitizeKey(key)}`);
    }
    return key;
  }

  markKeyAsFailed(key: string): void {
    this.failedKeys.add(key);
    logger.warn(`Key marked as failed: ${this.sanitizeKey(key)}`);
  }

  resetFailedKeys(): void {
    this.failedKeys.clear();
    logger.info('All failed keys reset');
  }

  getKeyStatus(): { total: number; available: number; failed: number } {
    const total = this.apiKeys.length + this.vertexKeys.length;
    const failed = this.failedKeys.size;
    const available = total - failed;

    return { total, available, failed };
  }

  private sanitizeKey(key: string): string {
    if (key.length <= 8) return key;
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  }
}

let keyManagerInstance: KeyManager | null = null;

export async function getKeyManagerInstance(): Promise<KeyManager> {
  if (!keyManagerInstance) {
    keyManagerInstance = new KeyManager();
  }
  return keyManagerInstance;
}