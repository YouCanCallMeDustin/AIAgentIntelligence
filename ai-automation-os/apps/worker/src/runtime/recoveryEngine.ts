import { prisma } from '../../../api/src/utils/db.js';
import { EventBus } from '../../../api/src/utils/eventBus.js';
import { stateReducer } from './stateReducer.js';
import { QueueDispatcher } from '../../../api/src/utils/queue.js';
import { LeaseManager } from './leaseManager.js';

function get_NODE_ID() {
  return process.env.NODE_ID || 'node-default';
}

/**
 * Execution Recovery Engine (Distributed)
 * Detects orphaned executions (expired leases) and reassigns them.
 */
export class RecoveryEngine {
  /**
   * Scans for executions with expired leases and attempts to recover them.
   */
  static async recoverOrphaned() {
    console.log(`[RecoveryEngine] Node ${get_NODE_ID()} scanning for orphaned executions...`);
    
    const now = new Date();
    const orphanedExecutions = await prisma.execution.findMany({
      where: {
        AND: [
          { ownerNodeId: { not: null } },
          { leaseExpiresAt: { lt: now } }
        ]
      }
    });
    
    for (const exec of orphanedExecutions) {
      console.log(`[RecoveryEngine] Found orphaned execution ${exec.id} (Owner ${exec.ownerNodeId} lease expired). Attempting failover...`);
      
      // Attempt to take over the lease
      const acquired = await LeaseManager.acquireLease(exec.id, get_NODE_ID());
      if (acquired) {
        console.log(`[RecoveryEngine] Failover successful. Node ${get_NODE_ID()} now owns ${exec.id}. Resuming...`);
        await this.resume(exec.id);
      }
    }
  }

  /**
   * Resumes a specific execution from its last checkpoint.
   */
  static async resume(executionId: string) {
    const events = await EventBus.getStream(executionId);
    const state = stateReducer(events);

    // Safety Check: We only resume from 'clean' points or if we can safely re-run the turn
    const lastEvent = events[events.length - 1];
    const isSafeCheckpoint = 
      lastEvent?.eventType === 'critic_feedback_generated' || 
      lastEvent?.eventType === 'execution_started' ||
      lastEvent?.eventType === 'plan_generated';

    if (isSafeCheckpoint) {
      await QueueDispatcher.dispatch({
        executionId: state.executionId,
        intentId: state.intentId,
        mode: 'agentic',
        agentsEnabled: { planner: true, executor: true, critic: true, memory: true },
        reasoningLoop: true,
        agentContext: { retryCount: state.retryCount, toolHistory: state.toolHistory }
      });
    } else {
      // If we died mid-action (e.g., tool_execution_started), we might need to rollback 
      // to the last Critic checkpoint to ensure we don't double-execute side effects.
      console.warn(`[RecoveryEngine] No safe checkpoint found for ${executionId}. Failover requires causal rollback.`);
    }
  }
}
