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
        maxTemperature: model.maxTemperature,
        thinking: model.thinking,
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
    Body: GeminiRequestBody & { content?: any; contents?: any[] };
  }>, reply: FastifyReply) => {
    try {
      const body = request.body;
      
      const { modelId, operation } = parseModelRequest(request.params['*']);
      const params = request.query || {};
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
            ...body,
          });

          return reply.send(response);

        case 'streamGenerateContent':
          return await handleStreamGenerateContent(modelId, body, params, reply);

        case 'embedContent':
          // Embeddings
          // Validate model support
          const isSupported = await modelService.isModelSupported(modelId);

          if (!isSupported) {
            throw new AppError(`Model ${modelId} is not supported`, HTTP_STATUS_CODES.BAD_REQUEST);
          }

          // Build content payload: prefer body.content, else derive text from contents
          let content = (body as any).content;
          
          if (!content) {
            const text = extractTextFromContents(body.contents || []);
            if (!text || text.trim() === '') {
              throw new AppError('No text found in request for embeddings', HTTP_STATUS_CODES.BAD_REQUEST);
            }
            content = { parts: [{ text }] };
          }

          const embeddingResponse = await geminiChatService.embedContent({
            model: modelId,
            content,
            contents: body.contents ?? [],
          });

          return reply.send(embeddingResponse);

        case 'batchEmbedContents':
          // Batch embeddings (Gemini batchEmbedContents)
          // Validate model support
          {
            const isSupported = await modelService.isModelSupported(modelId);
            if (!isSupported) {
              throw new AppError(`Model ${modelId} is not supported`, HTTP_STATUS_CODES.BAD_REQUEST);
            }

            const requestsInput = (body as any)?.requests;
            if (!Array.isArray(requestsInput) || requestsInput.length === 0) {
              throw new AppError('requests must be a non-empty array for batchEmbedContents', HTTP_STATUS_CODES.BAD_REQUEST);
            }

            // Normalize requests: ensure model and content present; derive content from contents if provided
            const requests = requestsInput.map((r: any, idx: number) => {
              let reqContent = r?.content;
              if (!reqContent) {
                const text = extractTextFromContents(r?.contents || []);
                if (text && text.trim() !== '') {
                  reqContent = { parts: [{ text }] };
                }
              }
              if (!reqContent) {
                throw new AppError(`No text found in batch embedding request at index ${idx}`, HTTP_STATUS_CODES.BAD_REQUEST);
              }
              return {
                model: r?.model ?? modelId,
                content: reqContent,
              };
            });

            const batchResponse = await geminiChatService.batchEmbedContents({ requests });
            return reply.send(batchResponse);
          }
          
        case 'countTokens':
          const tokenCount = await geminiChatService.countTokens({
            model: modelId,
            ...body,
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
  fastify.get('/models', async (request: FastifyRequest<{
    Querystring: { pageSize?: number; pageToken?: string };
  }>, reply: FastifyReply) => {
    try {
      const { pageSize, pageToken } = request.query || {};
      logger.info('Getting models list');

      const {models, nextPageToken} = await modelService.getModels();

      // Parse and clamp pagination params
      const defaultSize = 50;
      const maxSize = 200;
      const sizeRaw = typeof pageSize === 'string' ? parseInt(pageSize as any, 10) : pageSize;
      const size = Math.min(Math.max((sizeRaw ?? defaultSize) || defaultSize, 1), maxSize);
      const start = pageToken ? Math.max(parseInt(pageToken, 10) || 0, 0) : 0;

      const end = Math.min(start + size, models.length);
      const pagedModels = models.slice(start, end);

      const response = {
        models: pagedModels.map(model => ({
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
          maxTemperature: model.maxTemperature,
          thinking: model.thinking,
        })),
        nextPageToken: nextPageToken,
      };

      return reply.send(response);

    } catch (error) {
      logger.error({ err: error }, 'Failed to get models list:');
      throw error;
    }
  });

}

async function handleStreamGenerateContent(modelId: string, body: GeminiRequestBody, params: any, reply: FastifyReply) {
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
    const streamGenerator = geminiChatService.streamGenerateContent({
      model: modelId,
      ...body,
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
      reply.raw.write(`data: ${JSON.stringify({ 
        error: { 
          message: (error as Error).message,
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
  const validOperations = ['generateContent', 'streamGenerateContent', 'embedContent', 'batchEmbedContents', 'countTokens'];
  if (!validOperations.includes(operation)) {
    throw new AppError(`Unsupported operation: ${operation}. Valid operations: ${validOperations.join(', ')}`, HTTP_STATUS_CODES.BAD_REQUEST);
  }
  
  return { modelId, operation };
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
