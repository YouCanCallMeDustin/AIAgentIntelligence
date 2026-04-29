import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../utils/db.js';
import { QueueDispatcher, AgentRuntimeContract } from '../utils/queue.js';
import { EventBus } from '../utils/eventBus.js';

export class ExecutionController {
  /**
   * Initiates the closed-loop reasoning cycle.
   */
  static async trigger(request: FastifyRequest, reply: FastifyReply) {
    const { intentId } = request.body as { intentId: string };

    const intent = await prisma.intent.findUnique({
      where: { id: intentId },
    });

    if (!intent) {
      return reply.status(404).send({ error: 'Intent not found' });
    }

    // 1. Create Execution record
    const execution = await prisma.execution.create({
      data: {
        intentId: intent.id,
      },
    });

    // 2. Emit "execution_started" event (MANDATORY)
    await EventBus.emit({
      executionId: execution.id,
      intentId: intent.id,
      agent: 'SYSTEM',
      eventType: 'execution_started',
      payload: { intent: intent.intent },
      stepId: 'init-0',
    });

    // 3. Define the Agent Runtime Contract
    const contract: AgentRuntimeContract = {
      intentId: intent.id,
      executionId: execution.id,
      mode: 'agentic',
      agentsEnabled: {
        planner: true,
        executor: true,
        critic: true,
        memory: true,
      },
      reasoningLoop: true,
      agentContext: {
        retryCount: 0,
        toolHistory: [],
      },
    };

    // 4. Dispatch to Queue
    await QueueDispatcher.dispatch(contract);

    return reply.status(202).send({ 
      executionId: execution.id,
      status: 'QUEUED',
      message: 'Agentic Control Loop Initiated' 
    });
  }

  /**
   * Returns a step-by-step cognitive trace of the execution.
   */
  static async trace(request: FastifyRequest, reply: FastifyReply) {
    const { executionId } = request.params as { executionId: string };
    const { ExecutionTracer } = await import('../observability/executionTracer.js');
    const { EventBus } = await import('../utils/eventBus.js');

    const events = await EventBus.getStream(executionId);
    if (!events || events.length === 0) {
      return reply.status(404).send({ error: 'Execution trace not found' });
    }

    const trace = await ExecutionTracer.trace(events);
    return reply.send({ executionId, trace });
  }
}
