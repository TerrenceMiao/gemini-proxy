import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getRouterLogger } from '@/log/logger';
import { geminiChatService } from '@/service/chat/geminiChatService';
import { ttsService } from '@/service/tts/ttsService';
import { modelService } from '@/service/model/modelService';
import { AppError } from '@/exception/exceptions';
import { HTTP_STATUS_CODES } from '@/core/constants';

const logger = getRouterLogger();

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string | string[];
}

export interface OpenAITTSRequest {
  model: string;
  input: string;
  voice: string;
  response_format?: string;
  speed?: number;
}

export default async function openaiRoutes(fastify: FastifyInstance) {
  // Chat completions
  fastify.post('/chat/completions', async (request: FastifyRequest<{
    Body: OpenAIChatRequest;
  }>, reply: FastifyReply) => {
    try {
      const body = request.body;
      
      logger.info(`OpenAI chat completions request for model: ${body.model}`);
      
      // Convert OpenAI format to Gemini format
      const geminiRequest = convertOpenAIToGemini(body);
      
      if (body.stream) {
        return await handleStreamingChat(geminiRequest, reply);
      }

      const response = await geminiChatService.generateContent(geminiRequest);
      
      // Convert Gemini response to OpenAI format
      const openaiResponse = convertGeminiToOpenAI(response, body.model);
      
      return reply.send(openaiResponse);

    } catch (error) {
      logger.error({ err: error }, 'Failed to process chat completions:');
      throw error;
    }
  });

  // List models
  fastify.get('/models', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('Getting OpenAI models list');
      
      const { models } = await modelService.getModels();
      
      const openaiModels = models.map(model => ({
        id: model.name.replace('models/', ''),
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'google',
        permission: [],
        root: model.name.replace('models/', ''),
        parent: null,
      }));

      return reply.send({
        object: 'list',
        data: openaiModels,
      });

    } catch (error) {
      logger.error({ err: error }, 'Failed to get OpenAI models list:');
      throw error;
    }
  });

  // Get model
  fastify.get('/models/:modelId', async (request: FastifyRequest<{
    Params: { modelId: string };
  }>, reply: FastifyReply) => {
    try {
      const { modelId } = request.params;
      logger.info(`Getting OpenAI model info for: ${modelId}`);
      
      const model = await modelService.getModel(modelId);
      
      if (!model) {
        throw new AppError(`Model not found: ${modelId}`, HTTP_STATUS_CODES.NOT_FOUND);
      }

      return reply.send({
        id: model.name.replace('models/', ''),
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'google',
        permission: [],
        root: model.name.replace('models/', ''),
        parent: null,
      });

    } catch (error) {
      logger.error({ err: error }, 'Failed to get OpenAI model info:');
      throw error;
    }
  });

  // Text-to-speech
  fastify.post('/audio/speech', async (request: FastifyRequest<{
    Body: OpenAITTSRequest;
  }>, reply: FastifyReply) => {
    try {
      const body = request.body;
      
      logger.info(`OpenAI TTS request for model: ${body.model}`);
      
      const ttsResponse = await ttsService.generateSpeech(body);
      
      // Return audio file
      reply.type(ttsResponse.contentType || 'audio/mp3');
      reply.header('Content-Length', ttsResponse.size?.toString() || '0');
      
      const audioBuffer = Buffer.from(ttsResponse.audio || '', 'base64');
      return reply.send(audioBuffer);

    } catch (error) {
      logger.error({ err: error }, 'Failed to process TTS request:');
      throw error;
    }
  });

  // Embeddings
  fastify.post('/embeddings', async (request: FastifyRequest<{
    Body: { input: string | string[]; model: string };
  }>, reply: FastifyReply) => {
    try {
      const { input, model } = request.body;
      
      logger.info(`OpenAI embeddings request for model: ${model}`);
      
      // TODO: Implement embedding service
      logger.warn('Embedding service not implemented yet');
      
      const inputs = Array.isArray(input) ? input : [input];
      
      const data = inputs.map((_text, index) => ({
        object: 'embedding',
        embedding: new Array(768).fill(0), // Placeholder
        index,
      }));

      return reply.send({
        object: 'list',
        data,
        model,
        usage: {
          prompt_tokens: inputs.join(' ').length,
          total_tokens: inputs.join(' ').length,
        },
      });

    } catch (error) {
      logger.error({ err: error }, 'Failed to process embeddings request:');
      throw error;
    }
  });
}

function convertOpenAIToGemini(request: OpenAIChatRequest): any {
  const contents = request.messages.map(message => ({
    role: message.role === 'assistant' ? 'model' : message.role,
    parts: [{ text: message.content }],
  }));

  const generationConfig: any = {};
  
  if (request.max_tokens) {
    generationConfig.maxOutputTokens = request.max_tokens;
  }
  
  if (request.temperature) {
    generationConfig.temperature = request.temperature;
  }
  
  if (request.top_p) {
    generationConfig.topP = request.top_p;
  }
  
  if (request.stop) {
    generationConfig.stopSequences = Array.isArray(request.stop) ? request.stop : [request.stop];
  }

  return {
    model: request.model,
    contents,
    generationConfig,
  };
}

function convertGeminiToOpenAI(response: any, model: string): any {
  const choices = [];
  
  if (response.candidates && response.candidates.length > 0) {
    for (let i = 0; i < response.candidates.length; i++) {
      const candidate = response.candidates[i];
      let content = '';
      
      if (candidate.content?.parts) {
        content = candidate.content.parts
          .map((part: any) => part.text || '')
          .join('');
      }
      
      choices.push({
        index: i,
        message: {
          role: 'assistant',
          content,
        },
        finish_reason: convertFinishReason(candidate.finishReason),
      });
    }
  }

  const usage = {
    prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
    completion_tokens: response.usageMetadata?.candidatesTokenCount || 0,
    total_tokens: response.usageMetadata?.totalTokenCount || 0,
  };

  return {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices,
    usage,
  };
}

function convertFinishReason(geminiReason: string): string {
  switch (geminiReason) {
    case 'STOP':
      return 'stop';
    case 'MAX_TOKENS':
      return 'length';
    case 'SAFETY':
      return 'content_filter';
    case 'RECITATION':
      return 'content_filter';
    default:
      return 'stop';
  }
}

async function handleStreamingChat(geminiRequest: any, reply: FastifyReply) {
  try {
    // Set up streaming response
    reply.type('text/event-stream');
    reply.header('Cache-Control', 'no-cache');
    reply.header('Connection', 'keep-alive');
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Headers', 'Cache-Control');

    const streamGenerator = geminiChatService.streamGenerateContent(geminiRequest, {});
    
    for await (const chunk of streamGenerator) {
      const openaiChunk = convertGeminiChunkToOpenAI(chunk, geminiRequest.model);
      reply.raw.write(`data: ${JSON.stringify(openaiChunk)}\n\n`);
    }

    reply.raw.write('data: [DONE]\n\n');
    reply.raw.end();

  } catch (error) {
    logger.error({ err: error }, 'Failed to handle streaming chat:');
    reply.raw.write(`data: ${JSON.stringify({ error: (error as Error).message })}\n\n`);
    reply.raw.end();
  }
}

function convertGeminiChunkToOpenAI(chunk: any, model: string): any {
  const choices = [];
  
  if (chunk.candidates && chunk.candidates.length > 0) {
    for (let i = 0; i < chunk.candidates.length; i++) {
      const candidate = chunk.candidates[i];
      let content = '';
      
      if (candidate.content?.parts) {
        content = candidate.content.parts
          .map((part: any) => part.text || '')
          .join('');
      }
      
      choices.push({
        index: i,
        delta: {
          content,
        },
        finish_reason: candidate.finishReason ? convertFinishReason(candidate.finishReason) : null,
      });
    }
  }

  return {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices,
  };
}