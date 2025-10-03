import axios from 'axios';
import { getServiceLogger } from '@/log/logger';
import { settings } from '@/config/config';
import { getKeyManagerInstance } from '@/service/key/keyManager';
import { databaseService } from '@/database/services';
import { ExternalServiceError, AppError } from '@/exception/exceptions';
import { HTTP_STATUS_CODES } from '@/core/constants';

const logger = getServiceLogger();

export interface GeminiRequest {
  model?: string;
  messages?: any[];
  contents?: any[];
  generationConfig?: any;
  safetySettings?: any[];
  tools?: any[];
  responseModalities?: string[];
  speechConfig?: any;
  stream?: boolean;
}

export interface GeminiResponse {
  candidates?: any[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: any;
}

export class GeminiChatService {
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private keyManager: any;

  constructor() {
    this.initializeKeyManager();
  }

  async countTokens(payload: GeminiRequest): Promise<{ totalTokens: number }> {
    const startTime = Date.now();
    let currentKey: string | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < settings.MAX_RETRIES; attempt++) {
      try {
        if (!this.keyManager) {
          await this.initializeKeyManager();
        }

        currentKey = this.keyManager.getNextKey();
        if (!currentKey) {
          throw new AppError('No available API keys in GeminiChatService countTokens()', HTTP_STATUS_CODES.SERVICE_UNAVAILABLE);
        }

        const model = payload.model || settings.MODEL;
        const url = `${this.baseUrl}/models/${model}:countTokens`;
        
        // For token counting, we only need the contents
        const requestPayload = { contents: payload.contents || [] };

        const response = await axios.post<{ totalTokens: number }>(url, requestPayload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': currentKey,
            'User-Agent': settings.USER_AGENT,
          },
          timeout: settings.TIMEOUT * 1000,
        });

        const endTime = Date.now();
        const responseTime = new Date(endTime);

        // Log successful request
        if (settings.REQUEST_LOG_ENABLED) {
          await databaseService.createRequestLog({
            geminiKey: this.sanitizeKey(currentKey),
            modelName: model,
            requestType: 'count_tokens',
            requestMsg: requestPayload,
            responseMsg: response.data,
            responseTime,
          });
        }

        logger.info({
          model,
          key: this.sanitizeKey(currentKey),
          totalTokens: response.data.totalTokens,
        }, `Token count successful in ${endTime - startTime}ms`);

        return response.data;

      } catch (error: any) {
        lastError = error;
        
        if (currentKey) {
          this.keyManager.markKeyAsFailed(currentKey);
          
          // Log error
          if (settings.ERROR_LOG_ENABLED) {
            await databaseService.createErrorLog({
              geminiKey: this.sanitizeKey(currentKey),
              modelName: payload.model || settings.MODEL,
              errorType: 'gemini-count-tokens',
              errorLog: error.message,
              errorCode: error.response?.status,
              requestMsg: payload,
            });
          }
        }

        logger.error({
          error: error.message,
          status: error.response?.status,
          key: currentKey ? this.sanitizeKey(currentKey) : 'none',
        }, `Token count failed (attempt ${attempt + 1}/${settings.MAX_RETRIES}):`);

        // Don't retry on certain errors
        if (error.response?.status === HTTP_STATUS_CODES.BAD_REQUEST || 
            error.response?.status === HTTP_STATUS_CODES.UNAUTHORIZED) {
          break;
        }
      }
    }

    throw new ExternalServiceError(
      lastError?.message || 'Failed to count tokens after all retries'
    );
  }

  private async initializeKeyManager(): Promise<void> {
    this.keyManager = await getKeyManagerInstance();
  }

  async generateContent(payload: GeminiRequest): Promise<GeminiResponse> {
    const startTime = Date.now();
    let currentKey: string | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < settings.MAX_RETRIES; attempt++) {
      try {
        if (!this.keyManager) {
          await this.initializeKeyManager();
        }

        currentKey = this.keyManager.getNextKey();
        if (!currentKey) {
          throw new AppError('No available API keys in GeminiChatService generateContent()', HTTP_STATUS_CODES.SERVICE_UNAVAILABLE);
        }

        const model = payload.model || settings.MODEL;
        const url = `${this.baseUrl}/models/${model}:generateContent`;
        
        const requestPayload = this.buildPayload(payload);

        const response = await axios.post<GeminiResponse>(url, requestPayload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': currentKey,
            'User-Agent': settings.USER_AGENT,
          },
          timeout: settings.TIMEOUT * 1000,
        });

        const endTime = Date.now();
        const responseTime = new Date(endTime);

        // Log successful request
        if (settings.REQUEST_LOG_ENABLED) {
          await databaseService.createRequestLog({
            geminiKey: this.sanitizeKey(currentKey),
            modelName: model,
            requestType: 'chat',
            requestMsg: requestPayload,
            responseMsg: response.data,
            responseTime,
          });
        }

        logger.info({
          model,
          key: this.sanitizeKey(currentKey),
          tokens: response.data.usageMetadata?.totalTokenCount,
        }, `Request successful in ${endTime - startTime}ms`);

        return response.data;

      } catch (error: any) {
        lastError = error;
        
        if (currentKey) {
          this.keyManager.markKeyAsFailed(currentKey);
          
          // Log error
          if (settings.ERROR_LOG_ENABLED) {
            await databaseService.createErrorLog({
              geminiKey: this.sanitizeKey(currentKey),
              modelName: payload.model || settings.MODEL,
              errorType: error.response?.status?.toString() || 'unknown',
              errorLog: error.message,
              errorCode: error.response?.status,
              requestMsg: payload,
            });
          }
        }

        logger.error({
          error: error.message,
          status: error.response?.status,
          key: currentKey ? this.sanitizeKey(currentKey) : 'none',
        }, `Request failed (attempt ${attempt + 1}/${settings.MAX_RETRIES}):`);

        // Don't retry on certain errors
        if (error.response?.status === HTTP_STATUS_CODES.BAD_REQUEST || 
            error.response?.status === HTTP_STATUS_CODES.UNAUTHORIZED) {
          break;
        }
      }
    }

    throw new ExternalServiceError(
      lastError?.message || 'Failed to generate content after all retries'
    );
  }

  async *streamGenerateContent(payload: GeminiRequest, params: any): AsyncGenerator<GeminiResponse, void, unknown> {
    const startTime = Date.now();
    let currentKey: string | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < settings.MAX_RETRIES; attempt++) {
      try {
        if (!this.keyManager) {
          await this.initializeKeyManager();
        }

        currentKey = this.keyManager.getNextKey();
        if (!currentKey) {
          throw new AppError('No available API keys in GeminiChatService streamGenerateContent()', HTTP_STATUS_CODES.SERVICE_UNAVAILABLE);
        }

        const model = payload.model || settings.MODEL;
        const url = `${this.baseUrl}/models/${model}:streamGenerateContent`;
        
        const requestPayload = this.buildPayload(payload);

        const response = await axios.post(url, requestPayload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': currentKey,
            'User-Agent': settings.USER_AGENT,
          },
          params: params,
          timeout: settings.TIMEOUT * 1000,
          responseType: 'stream',
        });

        let fullResponse = '';
        let buffer = '';
        
        for await (const chunk of response.data) {
          const chunkStr = chunk.toString();
          buffer += chunkStr;
          logger.debug(`Response chunk: ${chunkStr}`);

          // Process complete lines from buffer
          const lines = buffer.split('\n');
          // Keep the last line in buffer as it might be incomplete
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim().startsWith('data: ')) {
              const data = line.trim().substring(6);
              
              try {
                const parsed = JSON.parse(data);
                fullResponse += JSON.stringify(parsed);
                yield parsed;
              } catch (parseError) {
                logger.debug({ err: parseError, data }, 'Failed to parse streaming chunk');
              }
            }
          }
        }

        // Process any remaining data in buffer
        if (buffer.trim()) {
          const line = buffer.trim();
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            try {
              const parsed = JSON.parse(data);
              fullResponse += JSON.stringify(parsed);
              yield parsed;
            } catch (parseError) {
              logger.debug({ err: parseError, data }, 'Failed to parse final chunk');
            }
          }
        }

        logger.debug(`Response: ${fullResponse}`);

        const endTime = Date.now();
        const responseTime = new Date(endTime);

        // Log successful request
        if (settings.REQUEST_LOG_ENABLED) {
          await databaseService.createRequestLog({
            geminiKey: this.sanitizeKey(currentKey),
            modelName: model,
            requestType: 'chat_stream',
            requestMsg: requestPayload,
            responseMsg: { stream: true, response: fullResponse },
            responseTime,
          });
        }

        logger.info({
          model,
          key: this.sanitizeKey(currentKey),
        }, `Streaming request successful in ${endTime - startTime}ms`);

        return;

      } catch (error: any) {
        lastError = error;
        
        if (currentKey) {
          this.keyManager.markKeyAsFailed(currentKey);
          
          // Log error
          if (settings.ERROR_LOG_ENABLED) {
            await databaseService.createErrorLog({
              geminiKey: this.sanitizeKey(currentKey),
              modelName: payload.model || settings.MODEL,
              errorType: error.response?.status?.toString() || 'unknown',
              errorLog: error.message,
              errorCode: error.response?.status,
              requestMsg: payload,
            });
          }
        }

        logger.error({
          error: error.message,
          status: error.response?.status,
          key: currentKey ? this.sanitizeKey(currentKey) : 'none',
        }, `Streaming request failed (attempt ${attempt + 1}/${settings.MAX_RETRIES}):`);

        // Don't retry on certain errors
        if (error.response?.status === HTTP_STATUS_CODES.BAD_REQUEST || 
            error.response?.status === HTTP_STATUS_CODES.UNAUTHORIZED) {
          break;
        }
      }
    }

    throw new ExternalServiceError(
      lastError?.message || 'Failed to generate streaming content after all retries'
    );
  }

  async embedContent(payload: GeminiRequest & { content?: any }): Promise<{ embedding: { values: number[] } }> {
    const startTime = Date.now();
    let currentKey: string | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < settings.MAX_RETRIES; attempt++) {
      try {
        if (!this.keyManager) {
          await this.initializeKeyManager();
        }

        currentKey = this.keyManager.getNextKey();
        if (!currentKey) {
          throw new AppError('No available API keys in GeminiChatService embedContent()', HTTP_STATUS_CODES.SERVICE_UNAVAILABLE);
        }

        const model = payload.model || settings.MODEL;
        const url = `${this.baseUrl}/models/${model}:embedContent`;

        // Build request body: prefer provided content; otherwise derive from contents/messages
        let content = payload.content;
        if (!content) {
          // Try to derive content from contents/messages
          if (payload.contents && payload.contents.length > 0) {
            // Use the first text part if available
            const first = payload.contents.find(c => Array.isArray(c.parts) && c.parts.some((p: any) => p.text));
            const text = first ? first.parts.find((p: any) => p.text)?.text : undefined;
            if (text) {
              content = { parts: [{ text }] };
            }
          } else if (payload.messages && payload.messages.length > 0) {
            const msg = payload.messages.find(m => typeof m.content === 'string' && m.content.length > 0);
            if (msg) {
              content = { parts: [{ text: msg.content }] };
            }
          }
        }

        if (!content) {
          throw new AppError('No content provided for embeddings', HTTP_STATUS_CODES.BAD_REQUEST);
        }

        const requestPayload = { content };

        const response = await axios.post<{ embedding: { values: number[] } }>(url, requestPayload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': currentKey,
            'User-Agent': settings.USER_AGENT,
          },
          timeout: settings.TIMEOUT * 1000,
        });

        const endTime = Date.now();
        const responseTime = new Date(endTime);

        // Log successful request
        if (settings.REQUEST_LOG_ENABLED) {
          await databaseService.createRequestLog({
            geminiKey: this.sanitizeKey(currentKey),
            modelName: model,
            requestType: 'embedding',
            requestMsg: requestPayload,
            responseMsg: response.data,
            responseTime,
          });
        }

        logger.info({
          model,
          key: this.sanitizeKey(currentKey),
          dim: response.data.embedding?.values?.length,
        }, `Embedding successful in ${endTime - startTime}ms`);

        return response.data;

      } catch (error: any) {
        lastError = error;

        if (currentKey) {
          this.keyManager.markKeyAsFailed(currentKey);

          if (settings.ERROR_LOG_ENABLED) {
            await databaseService.createErrorLog({
              geminiKey: this.sanitizeKey(currentKey),
              modelName: payload.model || settings.MODEL,
              errorType: error.response?.status?.toString() || 'unknown',
              errorLog: error.message,
              errorCode: error.response?.status,
              requestMsg: payload,
            });
          }
        }

        logger.error({
          error: error.message,
          status: error.response?.status,
          key: currentKey ? this.sanitizeKey(currentKey) : 'none',
        }, `Embedding request failed (attempt ${attempt + 1}/${settings.MAX_RETRIES}):`);

        if (error.response?.status === HTTP_STATUS_CODES.BAD_REQUEST ||
            error.response?.status === HTTP_STATUS_CODES.UNAUTHORIZED) {
          break;
        }
      }
    }

    throw new ExternalServiceError(
      lastError?.message || 'Failed to embed content after all retries'
    );
  }

  private buildPayload(payload: GeminiRequest): any {
    const result: any = {};

    // Add contents or messages
    if (payload.contents) {
      result.contents = payload.contents;
    } else if (payload.messages) {
      result.contents = this.convertMessagesToContents(payload.messages);
    }

    // Add generation config
    if (payload.generationConfig) {
      result.generationConfig = payload.generationConfig;
    }

    // Add safety settings
    result.safetySettings = payload.safetySettings || settings.SAFETY_SETTINGS;

    // Add tools if specified
    if (payload.tools) {
      result.tools = payload.tools;
    }

    // Add response modalities for TTS
    if (payload.responseModalities) {
      result.responseModalities = payload.responseModalities;
    }

    // Add speech config for TTS
    if (payload.speechConfig) {
      result.speechConfig = payload.speechConfig;
    }

    return result;
  }

  private convertMessagesToContents(messages: any[]): any[] {
    return messages.map(message => ({
      role: message.role === 'assistant' ? 'model' : message.role,
      parts: [{ text: message.content }],
    }));
  }

  private sanitizeKey(key: string): string {
    if (key.length <= 8) return key;
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  }
}

export const geminiChatService = new GeminiChatService();