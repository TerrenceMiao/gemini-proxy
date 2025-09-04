import { getServiceLogger } from '@/log/logger';
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
  contents: GeminiContent[];
  responseModalities: string[];
  speechConfig?: {
    voice?: string;
    speed?: number;
    pitch?: number;
    volumeGainDb?: number;
  };
}

export interface GeminiContent {
  role: string;
  parts: Array<{ text: string }>;
}

export interface GeminiTTSResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          mimeType: string;
          data: string;
        };
      }>;
    };
  }>;
}

export class TTSService {
  async generateSpeech(request: TTSRequest): Promise<TTSResponse> {
    try {
      logger.info({
        model: request.model,
        voice: request.voice,
        inputLength: request.input.length,
      }, 'Generating speech');

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
          voice: request.voice,
        } : {},
      };

      const response = await geminiChatService.generateContent(geminiRequest);

      // Extract audio data from response
      const audioData = this.extractAudioFromResponse(response);

      logger.info({
        model: request.model,
        audioSize: audioData.size,
      }, 'Speech generation completed');

      return audioData;

    } catch (error) {
      logger.error({ err: error }, 'Speech generation failed:');
      throw new ExternalServiceError('Failed to generate speech');
    }
  }

  async *generateSpeechStream(request: TTSRequest): AsyncGenerator<Buffer, void, unknown> {
    try {
      logger.info({
        model: request.model,
        voice: request.voice,
        inputLength: request.input.length,
      }, 'Generating streaming speech');

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
          voice: request.voice,
        } : {},
      };

      const streamGenerator = geminiChatService.streamGenerateContent(geminiRequest, {});

      for await (const chunk of streamGenerator) {
        const audioChunk = this.extractAudioChunkFromResponse(chunk);
        if (audioChunk) {
          yield audioChunk;
        }
      }

      logger.info({
        model: request.model,
      }, 'Streaming speech generation completed');

    } catch (error) {
      logger.error({ err: error }, 'Streaming speech generation failed:');
      throw new ExternalServiceError('Failed to generate streaming speech');
    }
  }

  private extractAudioFromResponse(response: GeminiTTSResponse): TTSResponse {
    // Extract audio data from Gemini response
    // This is a simplified implementation - actual structure may vary
    if (response.candidates?.[0]?.content) {
      const content = response.candidates[0].content;
      
      if (content.parts) {
        for (const part of content.parts) {
          if (part.inlineData?.mimeType?.startsWith('audio/')) {
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

  private extractAudioChunkFromResponse(chunk: GeminiTTSResponse): Buffer | null {
    // Extract audio chunk from streaming response
    if (chunk.candidates?.[0]?.content) {
      const content = chunk.candidates[0].content;
      
      if (content.parts) {
        for (const part of content.parts) {
          if (part.inlineData?.mimeType?.startsWith('audio/')) {
            return Buffer.from(part.inlineData.data, 'base64');
          }
        }
      }
    }

    return null;
  }

  getSupportedVoices(): string[] {
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

  validateVoice(voiceName: string): boolean {
    const supportedVoices = this.getSupportedVoices();
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

  isTTSRequest(request: { responseModalities?: string[] }): boolean {
    // Check if request is a TTS request based on response modalities
    const modalities = request.responseModalities ?? [];
    return Array.isArray(modalities) && modalities.includes('AUDIO');
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