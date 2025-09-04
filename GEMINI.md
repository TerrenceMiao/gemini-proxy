# Gemini Proxy

## Project Overview

This project is a high-performance Gemini API proxy server built with TypeScript and Fastify. It provides load balancing, key management, and multiple API compatibility layers (Gemini native, OpenAI-compatible, and Vertex AI). The server also supports TTS, image generation, comprehensive logging, and token-based authentication. It uses Prisma for database interactions and is Docker-ready for easy deployment.

## Building and Running

### Prerequisites

*   Node.js 18+
*   MySQL 8+ or SQLite
*   npm or yarn

### Installation and Execution

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd gemini-proxy
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    ```bash
    cp .env.example .env
    # Edit .env with your configuration
    ```

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

7.  **Build for production:**
    ```bash
    npm run build
    ```

8.  **Start the production server:**
    ```bash
    npm run start
    ```

### Docker Deployment

*   **Build and run with Docker Compose:**
    ```bash
    docker-compose up -d
    ```

*   **Build and run manually:**
    ```bash
    docker build -t gemini-proxy-ts .
    docker run -d -p 8000:8000 --env-file .env gemini-proxy-ts
    ```

## Development Conventions

*   **Linting:** Run `npm run lint` to check for linting errors.
*   **Formatting:** Run `npm run format` to format the code with Prettier.
*   **Testing:** Run `npm run test` to run the test suite.
*   **Type Checking:** Run `npm run type-check` to run the TypeScript compiler.
