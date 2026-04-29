import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifySse from 'fastify-sse-v2';
import { prisma } from './utils/db.js';
import { apiRoutes } from './routes/api.js';

const server = Fastify({
  logger: true,
});

// Register Plugins
server.register(cors);
server.register(jwt, {
  secret: process.env.JWT_SECRET || 'agentic-secret-key-change-me',
});
server.register(fastifySse);

// Register Routes
server.register(apiRoutes, { prefix: '/api' });

// Health Check
server.get('/health', async () => {
  return { status: 'ok', runtime: 'Agentic Execution Runtime' };
});

// Start Server
const start = async () => {
  try {
    await server.listen({ port: 3001, host: '0.0.0.0' });
    console.log('🚀 Agentic Workflow Orchestrator (API) running on port 3001');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
