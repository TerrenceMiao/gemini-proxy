import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getRouterLogger } from '@/log/logger';
import { geminiChatService } from '@/service/chat/geminiChatService';
import { ttsService } from '@/service/tts/ttsService';
import { modelService } from '@/service/model/modelService';
import { AppError } from '@/exception/exceptions';
import { HTTP_STATUS_CODES } from '@/core/constants';

const logger = getRouterLogger();

export interface GeminiRequestBody {
  model?: string;
  contents?: any[];
  generationConfig?: any;
  safetySettings?: any[];
  tools?: any[];
  responseModalities?: string[];
  speechConfig?: any;
}

export default async function geminiRoutes(fastify: FastifyInstance) {
  // Get model information
  fastify.get('/models/:modelId', async (request: FastifyRequest<{
    Params: { modelId: string };
  }>, reply: FastifyReply) => {
    try {
      const { modelId } = request.params;
      logger.info(`Getting model info for: ${modelId}`);
      
      const model = await modelService.getModel(modelId);
      
      if (!model) {
        throw new AppError(`Model not found: ${modelId}`, HTTP_STATUS_CODES.NOT_FOUND);
      }

      return reply.send({
        name: model.name,
        version: model.version,
        displayName: model.displayName,
        description: model.description,
        inputTokenLimit: model.inputTokenLimit,
        outputTokenLimit: model.outputTokenLimit,
        supportedGenerationMethods: model.supportedGenerationMethods,
        temperature: model.temperature,
        topP: model.topP,
        topK: model.topK,
      });

    } catch (error) {
      logger.error({ err: error }, 'Failed to get model info:');
      throw error;
    }
  });

  // Generate content
  fastify.post('/models/:modelId:generateContent', async (request: FastifyRequest<{
    Params: { modelId: string; generateContent: string };
    Body: GeminiRequestBody;
  }>, reply: FastifyReply) => {
    try {
      const { modelId } = request.params;
      const body = request.body;
      
      logger.info(`Generate content request for model: ${modelId}`);
      
      // Check if this is a TTS request
      if (ttsService.isTTSRequest(body)) {
        return await handleTTSRequest(modelId, body, reply);
      }

      // Regular chat request
      const response = await geminiChatService.generateContent({
        model: modelId,
        ...body,
      });

      return reply.send(response);

    } catch (error) {
      logger.error({ err: error }, 'Failed to generate content:');
      throw error;
    }
  });

  // Stream generate content
  fastify.post('/models/:modelId:streamGenerateContent', async (request: FastifyRequest<{
    Params: { modelId: string; streamGenerateContent: string };
    Body: GeminiRequestBody;
  }>, reply: FastifyReply) => {
    try {
      const { modelId } = request.params;
      const body = request.body;
      
      logger.info(`Stream generate content request for model: ${modelId}`);
      
      // Set up streaming response
      reply.type('text/event-stream');
      reply.header('Cache-Control', 'no-cache');
      reply.header('Connection', 'keep-alive');
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Headers', 'Cache-Control');

      const streamGenerator = geminiChatService.streamGenerateContent({
        model: modelId,
        ...body,
      });

      for await (const chunk of streamGenerator) {
        reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();

    } catch (error) {
      logger.error({ err: error }, 'Failed to stream generate content:');
      reply.raw.write(`data: ${JSON.stringify({ error: (error as Error).message })}\n\n`);
      reply.raw.end();
    }
  });

  // List models
  fastify.get('/models', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('Getting models list');
      
      const models = await modelService.getModels();
      
      return reply.send({
        models: models.map(model => ({
          name: model.name,
          version: model.version,
          displayName: model.displayName,
          description: model.description,
          inputTokenLimit: model.inputTokenLimit,
          outputTokenLimit: model.outputTokenLimit,
          supportedGenerationMethods: model.supportedGenerationMethods,
        })),
      });

    } catch (error) {
      logger.error({ err: error }, 'Failed to get models list:');
      throw error;
    }
  });

  // Embed content
  fastify.post('/models/:modelId:embedContent', async (request: FastifyRequest<{
    Params: { modelId: string; embedContent: string };
    Body: { content: any };
  }>, reply: FastifyReply) => {
    try {
      const { modelId } = request.params;
      const { content: _content } = request.body;
      
      logger.info(`Embed content request for model: ${modelId}`);
      
      // TODO: Implement embedding service
      logger.warn('Embedding service not implemented yet');
      
      return reply.send({
        embedding: {
          values: [],
        },
      });

    } catch (error) {
      logger.error({ err: error }, 'Failed to embed content:');
      throw error;
    }
  });

  // Count tokens
  fastify.post('/models/:modelId:countTokens', async (request: FastifyRequest<{
    Params: { modelId: string; countTokens: string };
    Body: { contents: any[] };
  }>, reply: FastifyReply) => {
    try {
      const { modelId } = request.params;
      const { contents: _contents } = request.body;
      
      logger.info(`Count tokens request for model: ${modelId}`);
      
      // TODO: Implement token counting
      logger.warn('Token counting not implemented yet');
      
      return reply.send({
        totalTokens: 0,
      });

    } catch (error) {
      logger.error({ err: error }, 'Failed to count tokens:');
      throw error;
    }
  });
}

async function handleTTSRequest(modelId: string, body: GeminiRequestBody, reply: FastifyReply) {
  try {
    logger.info(`Handling TTS request for model: ${modelId}`);
    
    // Extract text from contents
    const text = extractTextFromContents(body.contents || []);
    
    if (!text) {
      throw new AppError('No text found in request for TTS', HTTP_STATUS_CODES.BAD_REQUEST);
    }

    // Get voice from speech config
    const voice = body.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName || ttsService.getDefaultVoice();

    const ttsResponse = await ttsService.generateSpeech({
      model: modelId,
      input: text,
      voice,
    });

    // Return TTS response in Gemini format
    return reply.send({
      candidates: [{
        content: {
          parts: [{
            inlineData: {
              mimeType: ttsResponse.contentType || 'audio/mp3',
              data: ttsResponse.audio,
            },
          }],
        },
        finishReason: 'STOP',
      }],
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to handle TTS request:');
    throw error;
  }
}

function extractTextFromContents(contents: any[]): string {
  for (const content of contents) {
    if (content.parts) {
      for (const part of content.parts) {
        if (part.text) {
          return part.text;
        }
      }
    }
  }
  return '';
}