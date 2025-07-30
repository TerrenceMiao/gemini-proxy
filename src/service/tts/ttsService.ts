import { getServiceLogger } from '@/log/logger';
import { settings } from '@/config/config';
import { geminiChatService } from '@/service/chat/geminiChatService';
import { ExternalServiceError } from '@/exception/exceptions';

const logger = getServiceLogger();

export interface TTSRequest {
  model: string;
  input: string;
  voice?: string;
  response_format?: string;
  speed?: number;
}

export interface TTSResponse {
  audio?: string; // Base64 encoded audio
  contentType?: string;
  size?: number;
}

export interface GeminiTTSRequest {
  model: string;
  contents: any[];
  responseModalities: string[];
  speechConfig?: {
    voiceConfig?: {
      prebuiltVoiceConfig?: {
        voiceName: string;
      };
    };
  };
}

export class TTSService {
  async generateSpeech(request: TTSRequest): Promise<TTSResponse> {
    try {
      logger.info('Generating speech', {
        model: request.model,
        voice: request.voice,
        inputLength: request.input.length,
      });

      // Convert OpenAI-style TTS request to Gemini format
      const geminiRequest: GeminiTTSRequest = {
        model: request.model,
        contents: [
          {
            role: 'user',
            parts: [{ text: request.input }],
          },
        ],
        responseModalities: ['AUDIO'],
        speechConfig: request.voice ? {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: request.voice,
            },
          },
        } : undefined,
      };

      const response = await geminiChatService.generateContent(geminiRequest);

      // Extract audio data from response
      const audioData = this.extractAudioFromResponse(response);

      logger.info('Speech generation completed', {
        model: request.model,
        audioSize: audioData.size,
      });

      return audioData;

    } catch (error) {
      logger.error('Speech generation failed:', error);
      throw new ExternalServiceError('Failed to generate speech');
    }
  }

  async *generateSpeechStream(request: TTSRequest): AsyncGenerator<Buffer, void, unknown> {
    try {
      logger.info('Generating streaming speech', {
        model: request.model,
        voice: request.voice,
        inputLength: request.input.length,
      });

      // Convert OpenAI-style TTS request to Gemini format
      const geminiRequest: GeminiTTSRequest = {
        model: request.model,
        contents: [
          {
            role: 'user',
            parts: [{ text: request.input }],
          },
        ],
        responseModalities: ['AUDIO'],
        speechConfig: request.voice ? {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: request.voice,
            },
          },
        } : undefined,
      };

      const streamGenerator = geminiChatService.streamGenerateContent(geminiRequest);

      for await (const chunk of streamGenerator) {
        const audioChunk = this.extractAudioChunkFromResponse(chunk);
        if (audioChunk) {
          yield audioChunk;
        }
      }

      logger.info('Streaming speech generation completed', {
        model: request.model,
      });

    } catch (error) {
      logger.error('Streaming speech generation failed:', error);
      throw new ExternalServiceError('Failed to generate streaming speech');
    }
  }

  private extractAudioFromResponse(response: any): TTSResponse {
    // Extract audio data from Gemini response
    // This is a simplified implementation - actual structure may vary
    if (response.candidates && response.candidates[0] && response.candidates[0].content) {
      const content = response.candidates[0].content;
      
      if (content.parts) {
        for (const part of content.parts) {
          if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('audio/')) {
            return {
              audio: part.inlineData.data,
              contentType: part.inlineData.mimeType,
              size: part.inlineData.data ? Buffer.from(part.inlineData.data, 'base64').length : 0,
            };
          }
        }
      }
    }

    throw new ExternalServiceError('No audio data found in response');
  }

  private extractAudioChunkFromResponse(chunk: any): Buffer | null {
    // Extract audio chunk from streaming response
    if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content) {
      const content = chunk.candidates[0].content;
      
      if (content.parts) {
        for (const part of content.parts) {
          if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('audio/')) {
            return Buffer.from(part.inlineData.data, 'base64');
          }
        }
      }
    }

    return null;
  }

  async getSupportedVoices(): Promise<string[]> {
    // Return supported voice names
    // This would typically come from the API or configuration
    return [
      'Zephyr',
      'Breeze',
      'Juniper',
      'Amber',
      'Canyon',
      'Coral',
    ];
  }

  async validateVoice(voiceName: string): Promise<boolean> {
    const supportedVoices = await this.getSupportedVoices();
    return supportedVoices.includes(voiceName);
  }

  getDefaultVoice(): string {
    return 'Zephyr';
  }

  getSupportedFormats(): string[] {
    return ['mp3', 'opus', 'aac', 'flac'];
  }

  validateFormat(format: string): boolean {
    return this.getSupportedFormats().includes(format);
  }

  isTTSRequest(request: any): boolean {
    // Check if request is a TTS request based on response modalities
    return request.responseModalities && 
           Array.isArray(request.responseModalities) && 
           request.responseModalities.includes('AUDIO');
  }

  isTTSModel(modelName: string): boolean {
    // Check if model supports TTS
    const ttsPatterns = [
      'tts',
      'speech',
      'audio',
    ];
    
    return ttsPatterns.some(pattern => modelName.toLowerCase().includes(pattern));
  }
}

export const ttsService = new TTSService();