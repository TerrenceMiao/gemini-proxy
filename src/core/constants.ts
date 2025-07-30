export const API_VERSION = 'v1beta';

export const DEFAULT_MODEL = 'gemini-1.5-flash';
export const DEFAULT_CREATE_IMAGE_MODEL = 'imagen-3.0-generate-001';

export const DEFAULT_TIMEOUT = 120;
export const MAX_RETRIES = 3;

export const DEFAULT_STREAM_CHUNK_SIZE = 1024;
export const DEFAULT_STREAM_MIN_DELAY = 20;
export const DEFAULT_STREAM_MAX_DELAY = 100;
export const DEFAULT_STREAM_SHORT_TEXT_THRESHOLD = 50;
export const DEFAULT_STREAM_LONG_TEXT_THRESHOLD = 200;

export const DEFAULT_FILTER_MODELS = [
  'models/gemini-1.5-flash',
  'models/gemini-1.5-pro',
  'models/gemini-1.5-pro-002',
  'models/gemini-1.5-flash-002',
  'models/gemini-1.5-flash-8b',
  'models/gemini-2.0-flash-exp',
  'models/gemini-exp-1114',
  'models/gemini-exp-1121',
  'models/gemini-exp-1206',
];

export const DEFAULT_SAFETY_SETTINGS = [
  {
    category: 'HARM_CATEGORY_HARASSMENT',
    threshold: 'BLOCK_NONE',
  },
  {
    category: 'HARM_CATEGORY_HATE_SPEECH',
    threshold: 'BLOCK_NONE',
  },
  {
    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    threshold: 'BLOCK_NONE',
  },
  {
    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    threshold: 'BLOCK_NONE',
  },
];

export const SUPPORTED_IMAGE_FORMATS = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

export const SUPPORTED_AUDIO_FORMATS = [
  'audio/mp3',
  'audio/wav',
  'audio/aac',
  'audio/flac',
  'audio/ogg',
  'audio/mpeg',
];

export const SUPPORTED_VIDEO_FORMATS = [
  'video/mp4',
  'video/avi',
  'video/mov',
  'video/wmv',
  'video/flv',
  'video/webm',
  'video/mkv',
];

export const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;