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
          throw new AppError('No available API keys', HTTP_STATUS_CODES.SERVICE_UNAVAILABLE);
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
          throw new AppError('No available API keys', HTTP_STATUS_CODES.SERVICE_UNAVAILABLE);
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
    let retries = 0;
    const maxRetries = settings.MAX_RETRIES;
    let currentKey: string | null = null;
    let lastError: Error | null = null;
    let isSuccess = false;
    let statusCode: number;
    let finalApiKey: string | null = null;

    while (retries < maxRetries) {
      const requestDateTime = new Date();
      // const startTime = Date.now();
      
      try {
        if (!this.keyManager) {
          await this.initializeKeyManager();
        }

        currentKey = this.keyManager.getNextKey();
        if (!currentKey) {
          throw new AppError('No available API keys', HTTP_STATUS_CODES.SERVICE_UNAVAILABLE);
        }

        finalApiKey = currentKey;
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

        let buffer = '';
        
        for await (const chunk of response.data) {
          const chunkStr = chunk.toString();
          buffer += chunkStr;
          
          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('data: ')) {
              const data = trimmedLine.substring(6).trim();
              
              // Handle done signal - end the stream
              if (data === '[DONE]') {
                logger.info('Received [DONE] signal, ending stream');
                return;
              }
              
              // Skip empty data
              if (!data) {
                continue;
              }
              
              try {
                const parsed = JSON.parse(data);
                yield parsed;
              } catch (parseError) {
                logger.debug({ 
                  err: parseError, 
                  data: data.substring(0, 100) 
                }, 'Failed to parse streaming chunk');
              }
            }
          }
        }

        logger.info({
          model,
          key: this.sanitizeKey(currentKey),
        }, 'Streaming completed successfully');
        
        isSuccess = true;
        statusCode = 200;
        break;

      } catch (error: any) {
        retries++;
        isSuccess = false;
        lastError = error;
        const errorMessage = error.message;
        
        // Extract status code from error
        const statusMatch = errorMessage.match(/status code (\d+)/);
        statusCode = statusMatch ? parseInt(statusMatch[1]) : (error.response?.status || 500);

        logger.warn({
          error: errorMessage,
          status: statusCode,
          key: currentKey ? this.sanitizeKey(currentKey) : 'none',
          attempt: retries,
          maxRetries,
        }, `Streaming API call failed. Attempt ${retries} of ${maxRetries}`);

        if (currentKey) {
          this.keyManager.markKeyAsFailed(currentKey);
          
          // Log error
          if (settings.ERROR_LOG_ENABLED) {
            await databaseService.createErrorLog({
              geminiKey: this.sanitizeKey(currentKey),
              modelName: payload.model || settings.MODEL,
              errorType: 'gemini-chat-stream',
              errorLog: errorMessage,
              errorCode: statusCode,
              requestMsg: this.buildPayload(payload),
            });
          }
        }

        // Don't retry on certain errors
        if (statusCode === HTTP_STATUS_CODES.BAD_REQUEST || 
            statusCode === HTTP_STATUS_CODES.UNAUTHORIZED) {
          logger.error({
            status: statusCode,
            error: errorMessage,
          }, 'Non-retryable error encountered, stopping retries');
          break;
        }

        if (retries >= maxRetries) {
          logger.error(`Max retries (${maxRetries}) reached for streaming`);
          break;
        }

        // Get next key for retry
        const nextKey = this.keyManager.getNextKey();
        if (nextKey) {
          logger.info({
            newKey: this.sanitizeKey(nextKey),
          }, 'Switched to new API key for retry');
        } else {
          logger.error('No valid API key available for retry');
          break;
        }

      } finally {
        // const endTime = Date.now();
        // const latencyMs = endTime - startTime;
        
        // Log request
        if (settings.REQUEST_LOG_ENABLED) {
          await databaseService.createRequestLog({
            geminiKey: finalApiKey ? this.sanitizeKey(finalApiKey) : 'unknown',
            modelName: payload.model || settings.MODEL,
            requestType: 'chat_stream',
            requestMsg: this.buildPayload(payload),
            responseMsg: { stream: true, success: isSuccess },
            responseTime: requestDateTime,
          });
        }
      }
    }

    if (!isSuccess) {
      throw new ExternalServiceError(
        lastError?.message || 'Failed to generate streaming content after all retries'
      );
    }
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