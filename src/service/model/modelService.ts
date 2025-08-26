import { getServiceLogger } from '@/log/logger';
import { settings } from '@/config/config';
import { geminiApiClient } from '@/service/client/apiClient';
import { getKeyManagerInstance } from '@/service/key/keyManager';
import { ExternalServiceError } from '@/exception/exceptions';

const logger = getServiceLogger();

export interface ModelInfo {
  name: string;
  version: string;
  displayName: string;
  description: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  supportedGenerationMethods: string[];
  temperature: number;
  topP: number;
  topK: number;
}

export interface ModelListResponse {
  models: ModelInfo[];
}

export class ModelService {
  private cachedModels: ModelInfo[] = [];
  private cacheTimestamp: number = 0;
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes
  private keyManager: any;

  constructor() {
    this.initializeKeyManager();
  }

  private async initializeKeyManager(): Promise<void> {
    this.keyManager = await getKeyManagerInstance();
  }

  async getModels(forceRefresh: boolean = false): Promise<ModelInfo[]> {
    const now = Date.now();
    
    if (!forceRefresh && this.cachedModels.length > 0 && (now - this.cacheTimestamp) < this.cacheExpiry) {
      logger.debug('Returning cached models');
      return this.cachedModels;
    }

    try {
      logger.info('Fetching models from API');
      
      if (!this.keyManager) {
        await this.initializeKeyManager();
      }

      const apiKey = this.keyManager.getNextKey();
      if (!apiKey) {
        throw new ExternalServiceError('No available API keys in ModelService');
      }

      const response = await geminiApiClient.get<ModelListResponse>('/models', {
        headers: {
          'X-Goog-Api-Key': apiKey,
        },
      });

      const models = response.data.models || [];
      
      // Filter models based on settings
      const filteredModels = this.filterModels(models);
      
      // Cache the results
      this.cachedModels = filteredModels;
      this.cacheTimestamp = now;
      
      logger.info(`Retrieved ${filteredModels.length} models`);
      return filteredModels;

    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch models:');
      
      // If we have cached models, return them as fallback
      if (this.cachedModels.length > 0) {
        logger.warn('Using cached models as fallback');
        return this.cachedModels;
      }
      
      throw new ExternalServiceError('Failed to fetch models and no cached models available');
    }
  }

  private filterModels(models: ModelInfo[]): ModelInfo[] {
    const filterList = settings.FILTERED_MODELS;
    
    if (!filterList || filterList.length === 0) {
      return models;
    }

    // Filter models based on the filter list
    return models.filter(model => {
      const modelName = model.name.replace(/models\//, '');
      const shouldInclude = filterList.includes(modelName);
      
      if (shouldInclude) {
        logger.debug(`Filtering out model: ${model.name}`);
      }
      
      return !shouldInclude;
    });
  }

  async getModel(modelName: string): Promise<ModelInfo | null> {
    const models = await this.getModels();
    return models.find(model => model.name === modelName || model.name === `models/${modelName}`) || null;
  }

  async getModelCapabilities(modelName: string): Promise<{
    supportsTTS: boolean;
    supportsImages: boolean;
    supportsSearch: boolean;
    supportsCodeExecution: boolean;
    supportsThinking: boolean;
  }> {
    const model = await this.getModel(modelName);
    
    if (!model) {
      return {
        supportsTTS: false,
        supportsImages: false,
        supportsSearch: false,
        supportsCodeExecution: false,
        supportsThinking: false,
      };
    }

    // Determine capabilities based on model name and supported methods
    const capabilities = {
      supportsTTS: this.modelSupportsTTS(modelName),
      supportsImages: this.modelSupportsImages(modelName),
      supportsSearch: this.modelSupportsSearch(modelName),
      supportsCodeExecution: this.modelSupportsCodeExecution(modelName),
      supportsThinking: this.modelSupportsThinking(modelName),
    };

    logger.debug(capabilities, `Model capabilities for ${modelName}:`);
    return capabilities;
  }

  private modelSupportsTTS(modelName: string): boolean {
    // Check if model supports TTS based on name patterns
    const ttsPatterns = [
      'tts',
      'speech',
      'audio',
    ];
    
    return ttsPatterns.some(pattern => modelName.toLowerCase().includes(pattern));
  }

  private modelSupportsImages(modelName: string): boolean {
    // Check if model supports image generation
    const imagePatterns = [
      'vision',
      'image',
      'visual',
      'multimodal',
    ];
    
    return imagePatterns.some(pattern => modelName.toLowerCase().includes(pattern));
  }

  private modelSupportsSearch(modelName: string): boolean {
    // Check if model supports search functionality
    const searchPatterns = [
      'search',
      'web',
      'grounding',
    ];
    
    return searchPatterns.some(pattern => modelName.toLowerCase().includes(pattern));
  }

  private modelSupportsCodeExecution(modelName: string): boolean {
    // Check if model supports code execution
    const codePatterns = [
      'code',
      'execute',
      'run',
    ];
    
    return codePatterns.some(pattern => modelName.toLowerCase().includes(pattern));
  }

  private modelSupportsThinking(modelName: string): boolean {
    // Check if model supports thinking/reasoning
    const thinkingPatterns = [
      'thinking',
      'reasoning',
      'exp',
      'preview',
    ];
    
    return thinkingPatterns.some(pattern => modelName.toLowerCase().includes(pattern));
  }

  async clearCache(): Promise<void> {
    this.cachedModels = [];
    this.cacheTimestamp = 0;
    logger.info('Model cache cleared');
  }

  async validateModel(modelName: string): Promise<boolean> {
    try {
      const model = await this.getModel(modelName);
      return model !== null;
    } catch (error) {
      logger.error({ err: error }, `Failed to validate model ${modelName}:`);
      return false;
    }
  }

  async isModelSupported(modelName: string): Promise<boolean> {
    try {
      const model = await this.getModel(modelName);
      return model !== null;
    } catch (error) {
      logger.error({ err: error }, `Failed to check model support for ${modelName}:`);
      return false;
    }
  }

  getDefaultModel(): string {
    return settings.MODEL;
  }

  getDefaultImageModel(): string {
    return settings.CREATE_IMAGE_MODEL;
  }
}

export const modelService = new ModelService();