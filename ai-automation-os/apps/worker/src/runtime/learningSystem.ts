import { EventBus } from '../../../api/src/utils/eventBus.js';
import { ExecutionState } from './stateReducer.js';

export class LearningSystem {
  /**
   * Analyzes historical patterns and injects them into the current stream.
   * Purely an event emitter.
   */
  static async inject(state: ExecutionState) {
    console.log(`[LearningSystem] Analyzing history for intent ${state.intentId}`);
    
    // In a real system, this would query Prisma for past CognitivePatterns
    // matching this intentId or similar contexts.
    // For now, we simulate a learned "Tool Bias" pattern.
    const patterns = [
      {
        type: 'TOOL_BIAS',
        insight: 'Past executions indicate web_search is more reliable than legacy_search for this intent.',
        recommendedTools: ['web_search']
      }
    ];

    await EventBus.emit({
      executionId: state.executionId,
      intentId: state.intentId,
      agent: 'LEARNING',
      eventType: 'learning_context_injected',
      payload: { patterns },
      stepId: 'system-learning-init',
      causalParentEventId: state.lastEventId
    });
  }
}
