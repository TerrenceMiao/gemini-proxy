# Gemini Proxy

A TypeScript port of the Gemini API proxy server built with Fastify, providing load balancing, key management, and multiple API compatibility layers.

## Features

- 🚀 **High Performance**: Built with Fastify for maximum performance
- 🔄 **Load Balancing**: Round-robin key rotation with failure handling
- 🔑 **Multi-API Support**: Gemini native API, OpenAI-compatible, and Vertex AI endpoints
- 🎵 **TTS Support**: Native Gemini TTS with multi-speaker support
- 📸 **Image Generation**: Imagen-3.0 integration with multiple upload providers
- 📊 **Comprehensive Logging**: Request/error logging with auto-cleanup
- 🛡️ **Security**: Token-based authentication with role-based access
- 🐳 **Docker Ready**: Multi-stage Docker builds with health checks
- 📈 **Monitoring**: Built-in stats, health checks, and scheduler monitoring

## Quick Start

### Prerequisites

- Node.js 18+ 
- MySQL 8+ or SQLite
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd gemini-proxy

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Start development server
npm run dev
```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t gemini-proxy-ts .
docker run -d -p 8000:8000 --env-file .env gemini-proxy-ts
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Database
DATABASE_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=gemini
MYSQL_PASSWORD=password
MYSQL_DATABASE=gemini

# API Keys (comma-separated)
API_KEYS=AIzaMxxxxxxxxxxxxx,AIzaSxxxxxxxxxxxxx,AIzaTxxxxxxxxxxxxxx,AIzaBxxxxxxxxxxx
ALLOWED_TOKENS=["sk-"]
AUTH_TOKEN=sk-

VERTEX_API_KEYS=AQ.Abxxxxxxxxxxxxxxxxxxx,AQ.Acxxxxxxxxxxxxxxxxxxx

# Basic Settings
TEST_MODEL=gemini-2.5-flash
THINKING_MODELS=gemini-2.5-pro
TIME_OUT=300
MAX_RETRIES=3
```

### Dynamic Configuration

The application supports runtime configuration changes through the admin interface at `/config`.

## API Endpoints

### Gemini Native API

```bash
# Generate content
POST /v1beta/models/{model}:generateContent

# Stream generate content
POST /v1beta/models/{model}:streamGenerateContent

# List models
GET /v1beta/models

# Get model info
GET /v1beta/models/{model}
```

### OpenAI Compatible API

```bash
# Chat completions
POST /v1/chat/completions

# List models
GET /v1/models

# Text-to-speech
POST /v1/audio/speech

# Embeddings
POST /v1/embeddings
```

### Admin API

```bash
# Configuration
GET /config
PUT /config

# Statistics
GET /stats/overview
GET /stats/daily/{date}

# Health checks
GET /health
GET /health/detailed
```

## Development

### Available Scripts

```bash
# Development
npm run dev          # Start development server with auto-reload
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
npm run type-check   # Run TypeScript compiler

# Testing
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage
```

### Project Structure

```
src/
├── config/          # Configuration management
├── core/           # Core application setup
├── database/       # Database models and services
├── exception/      # Error handling
├── handler/        # Request/response handlers
├── log/            # Logging utilities
├── middleware/     # Fastify middleware
├── router/         # API routes
├── scheduler/      # Background tasks
├── service/        # Business logic services
├── static/         # Static assets
├── templates/      # View templates
└── utils/          # Utility functions
```

## Architecture

### Core Components

- **FastAPI Application**: Main web framework with async support
- **Prisma ORM**: Database operations with MySQL/SQLite support
- **Key Management**: Round-robin load balancing with failure handling
- **Service Layer**: Modular business logic (chat, TTS, files, etc.)
- **Middleware Stack**: Request logging, authentication, error handling

### Key Features

- **Dual API Compatibility**: Supports both Gemini native and OpenAI-compatible endpoints
- **Advanced TTS**: Multi-speaker voice synthesis with intelligent detection
- **File Management**: Multiple upload providers (Internal, SMMS, PicGo, Cloudflare)
- **Stream Optimization**: Enhanced streaming performance with configurable chunking
- **Health Monitoring**: Comprehensive health checks and system metrics

## Deployment

### Docker

```bash
# Production deployment
docker-compose -f docker-compose.yml up -d

# Development with hot reload
docker-compose -f docker-compose.dev.yml up -d
```

### Manual Deployment

```bash
# Build the application
npm run build

# Run database migrations
npx prisma migrate deploy

# Start the server
npm start
```

## Monitoring

### Health Checks

- `/health` - Basic health status
- `/health/detailed` - Comprehensive system health
- `/health/ready` - Readiness probe
- `/health/live` - Liveness probe

### Metrics

- `/stats/overview` - System statistics
- `/stats/daily/{date}` - Daily usage stats
- `/stats/models` - Model usage statistics

## Security

- Token-based authentication
- API key rotation and failure handling
- Request rate limiting
- Sensitive data redaction in logs
- Docker security best practices

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run `npm run lint` and `npm run test`
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
- Create an issue on GitHub
- Check the documentation in the `/docs` directory
- Review the configuration examples in `.env.example`

## Migration from Python Version

This TypeScript version maintains API compatibility with the original Python version while providing:
- Better type safety
- Improved performance
- Enhanced development experience
- Modern tooling and practices

## Full Configuration List

| Configuration Item | Description | Default Value |
| :--- | :--- | :--- |
| **Database** | | |
| `DATABASE_TYPE` | `mysql` or `sqlite` | `mysql` |
| `SQLITE_DATABASE` | Path for SQLite database file | `default_db` |
| `MYSQL_HOST` | MySQL host address | `localhost` |
| `MYSQL_SOCKET` | MySQL socket address | `/var/run/mysqld/mysqld.sock` |
| `MYSQL_PORT` | MySQL port | `3306` |
| `MYSQL_USER` | MySQL username | `your_db_user` |
| `MYSQL_PASSWORD` | MySQL password | `your_db_password` |
| `MYSQL_DATABASE` | MySQL database name | `defaultdb` |
| **API** | | |
| `API_KEYS` | **Required**, list of Gemini API keys | `[]` |
| `ALLOWED_TOKENS` | **Required**, list of access tokens | `[]` |
| `AUTH_TOKEN` | Super admin token, defaults to the first of `ALLOWED_TOKENS` | `sk-123456` |
| `ADMIN_SESSION_EXPIRE` | Admin session expiration time in seconds (5 minutes to 24 hours) | `3600` |
| `TEST_MODEL` | Model for testing key validity | `gemini-1.5-flash` |
| `IMAGE_MODELS` | Models supporting image generation | `["gemini-2.0-flash-exp"]` |
| `SEARCH_MODELS` | Models supporting web search | `["gemini-2.0-flash-exp"]` |
| `FILTERED_MODELS` | Disabled models | `[]` |
| `TOOLS_CODE_EXECUTION_ENABLED` | Enable code execution tool | `false` |
| `SHOW_SEARCH_LINK` | Display search result links in response | `true` |
| `SHOW_THINKING_PROCESS` | Display model's thinking process | `true` |
| `THINKING_MODELS` | Models supporting thinking process | `[]` |
| `THINKING_BUDGET_MAP` | Budget map for thinking function (model:budget) | `{}` |
| `URL_NORMALIZATION_ENABLED` | Enable smart URL routing | `false` |
| `URL_CONTEXT_ENABLED` | Enable URL context understanding | `false` |
| `URL_CONTEXT_MODELS` | Models supporting URL context | `[]` |
| `BASE_URL` | Gemini API base URL | `https://generativelanguage.googleapis.com/v1beta` |
| `MAX_FAILURES` | Max failures allowed per key | `3` |
| `MAX_RETRIES` | Max retries for failed API requests | `3` |
| `CHECK_INTERVAL_HOURS` | Interval (hours) to re-check disabled keys | `1` |
| `TIMEZONE` | Application timezone | `Asia/Shanghai` |
| `TIME_OUT` | Request timeout (seconds) | `300` |
| `PROXIES` | List of proxy servers | `[]` |
| **Logging & Security** | | |
| `LOG_LEVEL` | Log level: `DEBUG`, `INFO`, `WARNING`, `ERROR` | `INFO` |
| `AUTO_DELETE_ERROR_LOGS_ENABLED` | Auto-delete error logs | `true` |
| `AUTO_DELETE_ERROR_LOGS_DAYS` | Error log retention period (days) | `7` |
| `AUTO_DELETE_REQUEST_LOGS_ENABLED`| Auto-delete request logs | `false` |
| `AUTO_DELETE_REQUEST_LOGS_DAYS` | Request log retention period (days) | `30` |
| `SAFETY_SETTINGS` | Content safety thresholds (JSON string) | `[{"category": "HARM_CATEGORY_HARASSMENT", "threshold": "OFF"}, ...]` |
| **TTS** | | |
| `TTS_MODEL` | TTS model name | `gemini-2.5-flash-preview-tts` |
| `TTS_VOICE_NAME` | TTS voice name | `Zephyr` |
| `TTS_SPEED` | TTS speed | `normal` |
| **Image Generation** | | |
| `PAID_KEY` | Paid API Key for advanced features | `your-paid-api-key` |
| `CREATE_IMAGE_MODEL` | Image generation model | `imagen-3.0-generate-002` |
| `UPLOAD_PROVIDER` | Image upload provider: `smms`, `picgo`, `cloudflare_imgbed` | `smms` |
| `SMMS_SECRET_TOKEN` | SM.MS API Token | `your-smms-token` |
| `PICGO_API_KEY` | PicoGo API Key | `your-picogo-apikey` |
| `CLOUDFLARE_IMGBED_URL` | CloudFlare ImgBed upload URL | `https://xxxxxxx.pages.dev/upload` |
| `CLOUDFLARE_IMGBED_AUTH_CODE`| CloudFlare ImgBed auth key | `your-cloudflare-imgber-auth-code` |
| `CLOUDFLARE_IMGBED_UPLOAD_FOLDER`| CloudFlare ImgBed upload folder | `""` |
| **Stream Optimizer** | | |
| `STREAM_OPTIMIZER_ENABLED` | Enable stream output optimization | `false` |
| `STREAM_MIN_DELAY` | Minimum stream output delay | `0.016` |
| `STREAM_MAX_DELAY` | Maximum stream output delay | `0.024` |
| `STREAM_SHORT_TEXT_THRESHOLD`| Short text threshold | `10` |
| `STREAM_LONG_TEXT_THRESHOLD` | Long text threshold | `50` |
| `STREAM_CHUNK_SIZE` | Stream output chunk size | `5` |
| **Fake Stream** | | |
| `FAKE_STREAM_ENABLED` | Enable fake streaming | `false` |
| `FAKE_STREAM_EMPTY_DATA_INTERVAL_SECONDS` | Heartbeat interval for fake streaming (seconds) | `5` |