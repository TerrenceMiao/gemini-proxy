import { UpdateInfo } from '@/service/update/updateService';

declare module 'fastify' {
  interface FastifyInstance {
    updateInfo: UpdateInfo;
  }
}