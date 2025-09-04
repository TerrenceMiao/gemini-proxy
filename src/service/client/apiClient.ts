import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { getServiceLogger } from '@/log/logger';
import { settings } from '@/config/config';
import { ExternalServiceError } from '@/exception/exceptions';

const logger = getServiceLogger();

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  proxy?: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
}

export class ApiClient {
  private client: AxiosInstance;
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = config;
    this.client = this.createAxiosInstance();
  }

  private createAxiosInstance(): AxiosInstance {
    const axiosConfig: AxiosRequestConfig = {
      baseURL: this.config.baseURL,
      timeout: this.config.timeout ?? settings.TIMEOUT * 1000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': settings.USER_AGENT,
        ...this.config.headers,
      },
    };

    // Add proxy configuration if available
    if (settings.PROXY_HOST && settings.PROXY_PORT) {
      axiosConfig.proxy = {
        host: settings.PROXY_HOST,
        port: settings.PROXY_PORT,
        ...(settings.PROXY_USERNAME && settings.PROXY_PASSWORD && {
          auth: {
            username: settings.PROXY_USERNAME,
            password: settings.PROXY_PASSWORD,
          },
        }),
      };
    }

    const instance = axios.create(axiosConfig);

    // Request interceptor
    instance.interceptors.request.use(
      (config) => {
        logger.debug({
          method: config.method,
          url: config.url,
          headers: this.sanitizeHeaders(config.headers),
        }, `Making request to ${config.url}`);
        return config;
      },
      (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown request error';
        logger.error({ err: errorMessage }, 'Request interceptor error:');
        return Promise.reject(new Error(errorMessage));
      }
    );

    // Response interceptor
    instance.interceptors.response.use(
      (response) => {
        logger.debug({
          status: response.status,
          statusText: response.statusText,
        }, `Response received from ${response.config.url}`);
        return response;
      },
      (error: unknown) => {
        // Use type-safe property access with optional chaining
        const errorObj = error as Record<string, unknown>;
        
        logger.error({
          message: typeof errorObj['message'] === 'string' ? errorObj['message'] : 'Unknown error',
          status: typeof errorObj['response'] === 'object' && errorObj['response'] !== null 
            ? (errorObj['response'] as Record<string, unknown>)['status']
            : undefined,
          statusText: typeof errorObj['response'] === 'object' && errorObj['response'] !== null 
            ? (errorObj['response'] as Record<string, unknown>)['statusText']
            : undefined,
          url: typeof errorObj['config'] === 'object' && errorObj['config'] !== null 
            ? (errorObj['config'] as Record<string, unknown>)['url']
            : undefined,
        }, 'Response interceptor error:');
        
        const errorMessage = typeof errorObj['message'] === 'string' ? errorObj['message'] : 'Unknown response error';
        return Promise.reject(new Error(errorMessage));
      }
    );

    return instance;
  }

  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    try {
      return await this.client.get<T>(url, config);
    } catch (error) {
      this.handleError(error, 'GET', url);
      throw error;
    }
  }

  async post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    try {
      return await this.client.post<T>(url, data, config);
    } catch (error) {
      this.handleError(error, 'POST', url);
      throw error;
    }
  }

  async put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    try {
      return await this.client.put<T>(url, data, config);
    } catch (error) {
      this.handleError(error, 'PUT', url);
      throw error;
    }
  }

  async patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    try {
      return await this.client.patch<T>(url, data, config);
    } catch (error) {
      this.handleError(error, 'PATCH', url);
      throw error;
    }
  }

  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    try {
      return await this.client.delete<T>(url, config);
    } catch (error) {
      this.handleError(error, 'DELETE', url);
      throw error;
    }
  }

  async stream(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    try {
      return await this.client.get(url, {
        ...config,
        responseType: 'stream',
      });
    } catch (error) {
      this.handleError(error, 'STREAM', url);
      throw error;
    }
  }

  private handleError(error: unknown, method: string, url: string): void {
    interface AxiosErrorType {
      message?: string;
      response?: {
        status?: number;
        statusText?: string;
        data?: unknown;
      };
      request?: unknown;
    }
    
    const axiosError = error as AxiosErrorType;
    const errorInfo = {
      method,
      url,
      message: axiosError.message ?? 'Unknown error',
      status: axiosError.response?.status,
      statusText: axiosError.response?.statusText,
      data: axiosError.response?.data,
    };

    logger.error(errorInfo, `API request failed: ${method} ${url}`);

    // Transform axios errors to our custom errors
    if (axiosError.response) {
      // Server responded with error status
      throw new ExternalServiceError(
        `API request failed: ${axiosError.response.status} ${axiosError.response.statusText}`
      );
    } else if (axiosError.request) {
      // Request was made but no response received
      throw new ExternalServiceError('No response received from API');
    } else {
      // Something else happened
      throw new ExternalServiceError(`Request setup error: ${axiosError.message ?? 'Unknown error'}`);
    }
  }

  private sanitizeHeaders(headers: unknown): Record<string, unknown> {
    if (!headers || typeof headers !== 'object') return {};
    
    const sanitized = { ...headers } as Record<string, unknown>;
    
    // Remove sensitive headers for logging
    const sensitiveHeaders = ['authorization', 'x-goog-api-key', 'x-api-key'];
    
    // Check headers in a case-insensitive way
    Object.keys(sanitized).forEach(header => {
      if (sensitiveHeaders.some(sensitive => header.toLowerCase() === sensitive.toLowerCase())) {
        const value = sanitized[header];
        if (typeof value === 'string' && value.length > 8) {
          sanitized[header] = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
        } else {
          sanitized[header] = value;
        }
      }
    });
    
    return sanitized;
  }

  // Update configuration
  updateConfig(newConfig: Partial<ApiClientConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.client = this.createAxiosInstance();
  }

  // Get current configuration
  getConfig(): ApiClientConfig {
    return { ...this.config };
  }
}

// Factory function to create API clients
export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}

// Default Gemini API client
export const geminiApiClient = createApiClient({
  baseURL: 'https://generativelanguage.googleapis.com/v1beta',
  timeout: settings.TIMEOUT * 1000,
});

// Default OpenAI API client
export const openaiApiClient = createApiClient({
  baseURL: 'https://api.openai.com/v1',
  timeout: settings.TIMEOUT * 1000,
});

// Default Vertex AI client
export const vertexApiClient = createApiClient({
  baseURL: 'https://aiplatform.googleapis.com/v1beta1',
  timeout: settings.TIMEOUT * 1000,
});