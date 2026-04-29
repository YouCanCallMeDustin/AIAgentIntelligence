import { FastifyInstance } from 'fastify';
import { IntentController } from '../controllers/intentController.js';
import { ExecutionController } from '../controllers/executionController.js';
import { StreamController } from '../controllers/streamController.js';

export async function apiRoutes(fastify: FastifyInstance) {
  // Intent CRUD
  fastify.post('/intents', IntentController.create);
  fastify.get('/intents', IntentController.list);

  // Execution Control Loop
  fastify.post('/executions/trigger', ExecutionController.trigger);

  // Reasoning Stream (Mission Control)
  fastify.get('/executions/:executionId/stream', StreamController.stream);

  // Observability & Replay
  fastify.get('/executions/:executionId/trace', ExecutionController.trace);
}
