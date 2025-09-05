# Project Overview

This project is a high-performance Gemini API proxy server built with TypeScript and Fastify. It provides a unified interface for accessing Google's Gemini models, with additional features like load balancing, key management, and compatibility with the OpenAI API. The server uses Prisma for database interactions, supporting both MySQL and SQLite.

## Key Features

- **High Performance:** Built on Fastify, a high-performance Node.js web framework.
- **Load Balancing:** Implements round-robin key rotation with failure handling to ensure high availability.
- **Multi-API Support:** Offers a native Gemini API endpoint, an OpenAI-compatible endpoint, and a Vertex AI endpoint.
- **Text-to-Speech (TTS):** Includes native Gemini TTS with support for multiple speakers.
- **Image Generation:** Integrates with Imagen-3.0 and supports multiple image upload providers.
- **Comprehensive Logging:** Provides detailed request and error logging with automatic cleanup.
- **Security:** Features token-based authentication and role-based access control.
- **Dockerized:** Comes with a multi-stage Dockerfile and a Docker Compose setup for easy deployment.
- **Monitoring:** Includes built-in endpoints for statistics, health checks, and scheduler monitoring.

## Architecture

The application is structured in a modular way, with clear separation of concerns. The core components include:

- **Fastify Application:** The main web server, responsible for handling HTTP requests.
- **Prisma ORM:** The database layer, used for all database operations.
- **Key Management:** A service that manages and rotates API keys.
- **Service Layer:** Contains the business logic for the different services, such as chat, TTS, and file management.
- **Middleware Stack:** A set of middlewares for request logging, authentication, and error handling.
- **Routers:** The API endpoints, which are divided into Gemini native, OpenAI-compatible, and admin routes.

# Building and Running

## Prerequisites

- Node.js 20+
- MySQL 8+ or SQLite
- npm or yarn

## Installation and Startup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/TerrenceMiao/gemini-proxy.git
    cd gemini-proxy
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    ```bash
    cp .env.example .env
    ```
    Edit the `.env` file with your database credentials and API keys.

4.  **Generate Prisma client:**
    ```bash
    npx prisma generate
    ```

5.  **Run database migrations:**
    ```bash
    npx prisma migrate deploy
    ```

6.  **Start the development server:**
    ```bash
    npm run dev
    ```

## Docker Deployment

To build and run the application with Docker Compose, use the following command:

```bash
docker-compose up -d
```

# Development Conventions

## Code Style

The project uses Prettier for code formatting and ESLint for linting. To format the code, run:

```bash
npm run format
```

## Testing

The project uses Jest for testing. To run the tests, use the following command:

```bash
npm run test
```

**Note:** The `test` and `lint` scripts are currently disabled in `package.json`.

## Contribution Guidelines

1.  Fork the repository.
2.  Create a feature branch.
3.  Make your changes.
4.  Add tests if applicable.
5.  Run `npm run lint` and `npm run test`.
6.  Submit a pull request.
