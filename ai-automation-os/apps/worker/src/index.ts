import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { AgentLoop } from './runtime/agentLoop.js';
import { QueueDispatcher } from '../../api/src/utils/queue.js';
import { prisma } from '../../api/src/utils/db.js';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  'agent-execution-runtime',
  async (job) => {
    const { executionId } = job.data;
    console.log(`[Worker] Processing execution ${executionId}`);
    
    // Run the deterministic agent loop
    await AgentLoop.run(executionId);
  },
  { connection }
);

/**
 * Event-Driven Loop Trigger.
 * We listen for new events in the DB (or via a hook in EventBus)
 * to trigger the next iteration of the loop.
 */
// In a production app, this would be a Redis Pub/Sub listener.
// For this Phase 2 implementation, we'll hook into the EventBus 
// logic if possible or use a simple polling/timeout for demo.

// Actually, let's modify the EventBus in the API layer to trigger the next job!
// Wait, I can't easily modify the API layer's EventBus if I'm in the worker.
// But they share the same codebase in this monorepo.

console.log('🧠 Agentic Execution Runtime (Worker) started');
