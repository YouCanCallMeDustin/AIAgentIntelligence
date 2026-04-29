import { LeaseManager } from './leaseManager.js';
import { ExecutionSandbox } from './executionSandbox.js';
import { stateReducer } from './stateReducer.js';
import { EventBus } from '../../../api/src/utils/eventBus.js';
import { PlannerAgent } from '../agents/planner.js';
import { ExecutorAgent } from '../agents/executor.js';
import { CriticAgent } from '../agents/critic.js';
import { MemoryAgent } from '../agents/memory.js';
import { PolicyEngine } from './policyEngine.js';
import { LearningSystem } from './learningSystem.js';

function get_NODE_ID() {
  return process.env.NODE_ID || 'node-default';
}

export class AgentLoop {
  /**
   * The core iterative control loop.
   * Triggered by Critic events or initial dispatch.
   */
  static async run(executionId: string) {
    // --- DISTRIBUTED OWNERSHIP (Phase 5 Requirement) ---
    // Acquire a lease to ensure exactly one node owns this execution.
    const acquired = await LeaseManager.acquireLease(executionId, get_NODE_ID());
    
    if (!acquired) {
      console.warn(`[AgentLoop] Node ${get_NODE_ID()} failed to acquire lease for ${executionId}. Aborting iteration.`);
      return;
    }

    try {
      console.log(`[AgentLoop] Node ${get_NODE_ID()} starting iteration for ${executionId}`);

      // --- EXECUTION ISOLATION (Phase 4 Requirement) ---
      await ExecutionSandbox.executeTurn(executionId, async (state) => {
        const events = await EventBus.getStream(executionId);
        
        console.log(`[AgentLoop] Iteration start for ${executionId}. Status: ${state.status}, Events: ${events.length}`);

        if (state.terminated) {
          console.log(`[AgentLoop] Execution ${executionId} has terminated with status ${state.status}`);
          return;
        }

        if (state.status === 'QUEUED' || state.status === 'SELF_CORRECTING') {
          // --- ORDERED CONTEXT RESOLUTION (Phase 3 Requirement) ---
          
          if (!state.policy) {
            await PolicyEngine.apply(state);
            const pEvents = await EventBus.getStream(executionId);
            state = stateReducer(pEvents);
          }

          if (!state.learningContext) {
            await LearningSystem.inject(state);
            const lEvents = await EventBus.getStream(executionId);
            state = stateReducer(lEvents);
          }

          await MemoryAgent.retrieveContext(state);
          
          const finalEvents = await EventBus.getStream(executionId);
          const snapshot = stateReducer(finalEvents);
          
          // Reasoning Turn
          await PlannerAgent.reason(snapshot);
          
          const planEvents = await EventBus.getStream(executionId);
          const planState = stateReducer(planEvents);
          await CriticAgent.evaluate(planState);

        } else if (state.status === 'EXECUTING') {
          await ExecutorAgent.executeStep(state);
          
          const updatedEvents = await EventBus.getStream(executionId);
          const updatedState = stateReducer(updatedEvents);
          await CriticAgent.evaluate(updatedState);
        }
      });
      
    } catch (error) {
      console.error(`[AgentLoop] Error in iteration for ${executionId}:`, error);
      
      const events = await EventBus.getStream(executionId);
      const state = stateReducer(events);
      const lastEvent = events[events.length - 1];

      try {
        await EventBus.emit({
          executionId: state.executionId,
          intentId: state.intentId,
          agent: 'SYSTEM',
          eventType: 'execution_failed',
          payload: { error: (error as Error).message },
          stepId: state.currentStep,
          causalParentEventId: lastEvent?.id
        });
      } catch (emitError) {
        console.error(`[AgentLoop] Critical: Failed to emit failure event for ${executionId}`, emitError);
      }
    } finally {
      // Release lease if the execution is terminated or if we want to allow other nodes to take over for next loop
      // For now, we release at the end of each turn so the next loop trigger can be picked up by any node.
      await LeaseManager.releaseLease(executionId, get_NODE_ID());
    }
  }
}
