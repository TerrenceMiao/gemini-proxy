# Gemini Proxy - TypeScript Version

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
DATABASE_URL="mysql://user:password@localhost:3306/gemini_proxy"

# API Keys (comma-separated)
API_KEYS="your-gemini-api-key-1,your-gemini-api-key-2"
VERTEX_API_KEYS="your-vertex-api-key-1,your-vertex-api-key-2"

# Basic Settings
MODEL="gemini-1.5-flash"
TIMEOUT=120
MAX_RETRIES=3

# Authentication
WEB_AUTH_ENABLED=true
WEB_AUTH_TOKEN="your-web-auth-token"
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

See `MIGRATION.md` for detailed migration guide.