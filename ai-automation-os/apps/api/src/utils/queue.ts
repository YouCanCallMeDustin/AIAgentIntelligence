import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let connection: IORedis | undefined;
let executionQueue: any;

if (process.env.MOCK_QUEUE !== 'true') {
  connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  executionQueue = new Queue('agent-execution-runtime', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
    },
  });
}

export interface AgentRuntimeContract {
  intentId: string;
  executionId: string;
  mode: 'agentic';
  agentsEnabled: {
    planner: boolean;
    executor: boolean;
    critic: boolean;
    memory: boolean;
  };
  reasoningLoop: boolean;
  agentContext: {
    plan?: any;
    memorySnapshot?: any;
    retryCount: number;
    toolHistory: any[];
  };
}

export class QueueDispatcher {
  /**
   * Dispatches a new reasoning loop iteration to the worker.
   * This is the only way to trigger agent actions.
   */
  static async dispatch(contract: AgentRuntimeContract) {
    if (process.env.MOCK_QUEUE === 'true') {
      console.log(`[QueueDispatcher] MOCK: Dispatching job for ${contract.executionId}`);
      return;
    }
    return executionQueue.add(`execution-${contract.executionId}`, contract);
  }
}
