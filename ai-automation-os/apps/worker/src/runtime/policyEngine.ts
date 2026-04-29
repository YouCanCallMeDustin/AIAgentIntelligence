import { EventBus } from '../../../api/src/utils/eventBus.js';
import { ExecutionState } from './stateReducer.js';

export class PolicyEngine {
  /**
   * Resolves policy for the execution and emits policy_applied event.
   * This is a pure emitter; logic is triggered by the AgentLoop.
   */
  static async apply(state: ExecutionState) {
    console.log(`[PolicyEngine] Resolving policy for ${state.executionId}`);
    
    // In a real system, this would query the DB for the organization's active policy
    // For now, we use a default "Hardened Agent" policy
    const policy = {
      id: 'default-hardened-policy',
      constraints: {
        max_retries: 3,
        allowed_tools: ['web_search', 'alternate_search', 'summarize'],
        safety_level: 'strict'
      }
    };

    await EventBus.emit({
      executionId: state.executionId,
      intentId: state.intentId,
      agent: 'POLICY',
      eventType: 'policy_applied',
      payload: { policy },
      stepId: 'system-policy-init',
      causalParentEventId: state.lastEventId
    });
  }
}
