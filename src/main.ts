import { config } from 'dotenv';
import { createApp } from '@/core/application';
import { getMainLogger } from '@/log/logger';

// Load environment variables before importing app configuration
config();

async function bootstrap() {
  const logger = getMainLogger();
  
  try {
    const app = await createApp();
    
    const port = process.env.PORT ? parseInt(process.env.PORT) : 8000;
    const host = process.env.HOST || '0.0.0.0';
    
    await app.listen({ port, host });
    
    logger.info(`Server listening on ${host}:${port}`);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();