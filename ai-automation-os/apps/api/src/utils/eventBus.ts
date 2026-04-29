import { prisma } from './db.js';
import { z } from 'zod';

// Phase 5: Distributed Node Identity
function get_NODE_ID() {
  return process.env.NODE_ID || 'node-default';
}
let logicalClock = 0;

export const AgentEventSchema = z.object({
  executionId: z.string(),
  intentId: z.string(),
  agent: z.enum(['PLANNER', 'EXECUTOR', 'CRITIC', 'MEMORY', 'SYSTEM', 'POLICY', 'LEARNING']),
  eventType: z.string(),
  payload: z.record(z.any()),
  stepId: z.string(),
  
  // Phase 5: Causal context (optional in schema but enforced in emit logic)
  causalParentEventId: z.string().optional(),
});

export type AgentEvent = z.infer<typeof AgentEventSchema>;

export class EventBus {
  /**
   * Strictly ordered, append-only event emission.
   * Every action in the system must pass through here.
   */
  static async emit(event: AgentEvent) {
    // 1. PHASE 5 LEASE ENFORCEMENT GUARD (CRITICAL)
    // The EventBus is the final enforcement boundary of system correctness.
    const execution = await prisma.execution.findUnique({
      where: { id: event.executionId }
    });

    if (execution && execution.ownerNodeId && execution.ownerNodeId !== get_NODE_ID()) {
      // If a lease is active and owned by another node, reject the event
      const now = new Date();
      if (execution.leaseExpiresAt && execution.leaseExpiresAt > now) {
        const errorMsg = `[EventBus] REJECTED: Node ${get_NODE_ID()} does not hold active lease for ${event.executionId} (Owned by ${execution.ownerNodeId})`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
    }

    // 2. PHASE 5 CAUSAL VALIDATION
    const events = await this.getStream(event.executionId);
    const lastEvent = events[events.length - 1];
    
    // Validate causal link if it's not the first event
    if (lastEvent && event.causalParentEventId && event.causalParentEventId !== lastEvent.id) {
      const errorMsg = `[EventBus] REJECTED: Causal parent ID mismatch for ${event.executionId}. Expected ${lastEvent.id}, got ${event.causalParentEventId}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Update logical clock
    logicalClock++;
    const currentLogicalTimestamp = logicalClock;

    // 3. Schema Validation
    const validated = AgentEventSchema.parse(event);
    
    // 4. IDEMPOTENCY GUARD
    if (validated.eventType === 'policy_applied' || validated.eventType === 'learning_context_injected') {
      const existing = events.find(e => e.eventType === validated.eventType);
      if (existing) {
        console.warn(`[EventBus] Ignoring duplicate ${validated.eventType} for ${validated.executionId}`);
        return existing;
      }
    }

    // 5. Persist to EventLog (Source of Truth)
    const savedEvent = await prisma.eventLog.create({
      data: {
        executionId: validated.executionId,
        intentId: validated.intentId,
        agent: validated.agent,
        eventType: validated.eventType,
        payload: validated.payload,
        stepId: validated.stepId,
        
        // Phase 5 fields
        nodeId: get_NODE_ID(),
        logicalTimestamp: currentLogicalTimestamp,
        causalParentEventId: event.causalParentEventId || lastEvent?.id || null,
        sequenceNum: events.length + 1 // Keep for legacy ordering fallback
      },
    });

    console.log(`[EventBus] ${validated.agent}:${validated.eventType} emitted by ${get_NODE_ID()} for ${validated.executionId} (L:${currentLogicalTimestamp})`);
    
    // 6. LOOP TRIGGER MECHANISM
    const isTriggerEvent = 
      validated.eventType === 'execution_started' || 
      (validated.agent === 'CRITIC' && (validated.payload.decision === 'CONTINUE' || validated.payload.decision === 'NEEDS_REPLAN'));

    if (isTriggerEvent) {
      const { QueueDispatcher } = await import('./queue.js');
      await QueueDispatcher.dispatch({
        executionId: validated.executionId,
        intentId: validated.intentId,
        mode: 'agentic',
        agentsEnabled: { planner: true, executor: true, critic: true, memory: true },
        reasoningLoop: true,
        agentContext: { retryCount: 0, toolHistory: [] } 
      });
      console.log(`[EventBus] Loop iteration triggered by ${validated.eventType}`);
    }
    
    return savedEvent;
  }

  /**
   * Derives current state from the event stream.
   * Mandatory for deterministic replay.
   */
  static async getStream(executionId: string) {
    // In distributed mode, we must order by logicalTimestamp first, then sequenceNum/fallback
    const events = await prisma.eventLog.findMany({
      where: { executionId },
      orderBy: [
        { logicalTimestamp: 'asc' },
        { sequenceNum: 'asc' }
      ],
    });
    
    // Sync local logical clock with the max timestamp seen in the stream
    const maxLogical = Math.max(0, ...events.map(e => e.logicalTimestamp || 0));
    logicalClock = Math.max(logicalClock, maxLogical);
    
    return events;
  }
}
