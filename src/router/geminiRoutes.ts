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
  contents?: Array<{
    role?: string;
    parts?: Array<{
      text?: string;
      inlineData?: {
        mimeType: string;
        data: string;
      };
    }>;
  }>;
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    stopSequences?: string[];
  };
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
  tools?: Array<{
    functionDeclarations?: Array<{
      name: string;
      description: string;
      parameters?: Record<string, unknown>;
    }>;
  }>;
  responseModalities?: string[];
  speechConfig?: {
    voice?: string;
    speed?: number;
    pitch?: number;
    volumeGainDb?: number;
  };
  stream?: boolean;
}



export default async function geminiRoutes(fastify: FastifyInstance) {
  await Promise.resolve(); // Add await to satisfy require-await rule
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

  // Unified endpoint for all model operations e.g.:
  //  /models/gemini-2.5-pro:streamGenerateContent?alt=sse
  //  /models/gemini-2.5-flash-lite:generateContent
  //  /models/gemini-2.5-pro:countTokens
  fastify.post('/models/*', async (request: FastifyRequest<{
    Params: { '*': string };
    Querystring: Record<string, string>;
    Body: GeminiRequestBody & { content?: unknown; contents?: unknown[] };
  }>, reply: FastifyReply) => {
    try {
      const body = request.body as GeminiRequestBody;
      
      const { modelId, operation } = parseModelRequest(request.params['*'] ?? '');
      const params = request.query ?? {};
      logger.info(`${operation} request for model: ${modelId} with query params: ` + JSON.stringify(params));
      
      switch (operation) {
        case 'generateContent':
          // Check if this is a TTS request
          if (ttsService.isTTSRequest(body)) {
            return await handleTTSRequest(modelId, body, reply);
          }

          // Regular chat request
          const response = await geminiChatService.generateContent({
            model: modelId,
            generationConfig: body.generationConfig ?? {},
            safetySettings: body.safetySettings ?? [],
            tools: body.tools ?? [],
            responseModalities: body.responseModalities ?? [],
            speechConfig: body.speechConfig ?? {},
            stream: body.stream ?? false,
            contents: (body.contents ?? []).map(content => ({
              role: content.role ?? 'user',
              parts: (content.parts ?? []).map(part => ({
                text: part.text ?? '',
                ...part
              }))
            }))
          });

          return reply.send(response);

        case 'streamGenerateContent':
          return await handleStreamGenerateContent(modelId, body, params, reply);

        case 'embedContent':
          // TODO: Implement embedding service
          logger.warn('Embedding service not implemented yet');
          
          return reply.send({
            embedding: {
              values: [],
            },
          });

        case 'countTokens':
          const tokenCount = await geminiChatService.countTokens({
            model: modelId,
            generationConfig: body.generationConfig ?? {},
            safetySettings: body.safetySettings ?? [],
            tools: body.tools ?? [],
            responseModalities: body.responseModalities ?? [],
            speechConfig: body.speechConfig ?? {},
            stream: body.stream ?? false,
            contents: (body.contents ?? []).map(content => ({
              role: content.role ?? 'user',
              parts: (content.parts ?? []).map(part => ({
                text: part.text ?? '',
                ...part
              }))
            }))
          });
          
          return reply.send(tokenCount);

        default:
          throw new AppError(`Unsupported operation: ${operation}`, HTTP_STATUS_CODES.NOT_FOUND);
      }

    } catch (error) {
      logger.error({ err: error }, `Failed to handle ${request.params['*']} request:`);
      
      // Handle streaming errors differently
      if (request.params['*'] === 'streamGenerateContent') {
        reply.raw.write(`data: ${JSON.stringify({ error: (error as Error).message })}\n\n`);
        reply.raw.end();
      } else {
        throw error;
      }
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

}

async function handleStreamGenerateContent(modelId: string, body: GeminiRequestBody, params: Record<string, string>, reply: FastifyReply) {
  const operationName = 'gemini_stream_generate_content';
  
  try {
    logger.info(`Handling Gemini streaming content generation for model: ${modelId}`);
    logger.debug(`Request: ${JSON.stringify(body, null, 2)}`);

    // Check model support
    const isSupported = await modelService.isModelSupported(modelId);
    if (!isSupported) {
      throw new AppError(`Model ${modelId} is not supported`, HTTP_STATUS_CODES.BAD_REQUEST);
    }

    // Set up streaming response headers
    reply.type('text/event-stream');
    reply.header('Cache-Control', 'no-cache');
    reply.header('Connection', 'keep-alive');
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Headers', 'Cache-Control');

    // Get the stream generator from chat service
    const streamGenerator = await geminiChatService.streamGenerateContent({
      model: modelId,
      generationConfig: body.generationConfig ?? {},
      safetySettings: body.safetySettings ?? [],
      tools: body.tools ?? [],
      responseModalities: body.responseModalities ?? [],
      speechConfig: body.speechConfig ?? {},
      stream: true, // Always true for streaming endpoint
      contents: (body.contents ?? []).map(content => ({
        role: content.role ?? 'user',
        parts: (content.parts ?? []).map(part => ({
          text: part.text ?? '',
          ...part
        }))
      }))
    }, params);

    // Stream the response
    for await (const chunk of streamGenerator) {
      reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    reply.raw.end();

  } catch (error) {
    logger.error({ err: error }, `${operationName} failed`);
    
    // Handle streaming errors by writing error to stream
    if (!reply.sent) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown streaming error';
      reply.raw.write(`data: ${JSON.stringify({ 
        error: { 
          message: errorMessage,
          type: 'streaming_error'
        }
      })}\n\n`);
      reply.raw.end();
    }
    throw error;
  }
}

async function handleTTSRequest(modelId: string, body: GeminiRequestBody, reply: FastifyReply) {
  try {
    logger.info(`Handling TTS request for model: ${modelId}`);
    
    // Extract text from contents
    const text = extractTextFromContents(body.contents ?? []);
    
    if (!text) {
      throw new AppError('No text found in request for TTS', HTTP_STATUS_CODES.BAD_REQUEST);
    }

    // Get voice from speech config
    const voice = body.speechConfig?.voice ?? 
                 ttsService.getDefaultVoice() ?? 'en-US-Neural2-F';

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
              mimeType: ttsResponse.contentType ?? 'audio/mp3',
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

function parseModelRequest(params: string): { modelId: string; operation: string } {
  const colonIndex = params.indexOf(':');
  
  if (colonIndex === -1) {
    throw new AppError('Invalid request format. Expected format: modelId:operation', HTTP_STATUS_CODES.BAD_REQUEST);
  }
  
  const modelId = params.substring(0, colonIndex);
  const operation = params.substring(colonIndex + 1);
  
  // Validate model ID format
  if (!modelId || modelId.trim() === '') {
    throw new AppError('Model ID cannot be empty', HTTP_STATUS_CODES.BAD_REQUEST);
  }
  
  // Validate operation
  const validOperations = ['generateContent', 'streamGenerateContent', 'embedContent', 'countTokens'];
  if (!validOperations.includes(operation)) {
    throw new AppError(`Unsupported operation: ${operation}. Valid operations: ${validOperations.join(', ')}`, HTTP_STATUS_CODES.BAD_REQUEST);
  }
  
  return { modelId, operation };
}

function extractTextFromContents(contents: unknown[]): string {
  for (const content of contents) {
    if (content && typeof content === 'object' && 'parts' in content) {
      const parts = (content as { parts?: unknown[] }).parts;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          if (part && typeof part === 'object' && 'text' in part) {
            const text = (part as { text?: unknown }).text;
            if (typeof text === 'string') {
              return text;
            }
          }
        }
      }
    }
  }
  return '';
}
