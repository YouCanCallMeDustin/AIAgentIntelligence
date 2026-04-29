import { EventBus } from '../../../api/src/utils/eventBus.js';
import { ExecutionState } from '../runtime/stateReducer.js';

export class CriticAgent {
  /**
   * Sole termination and iteration authority.
   */
  static async evaluate(state: ExecutionState) {
    const startedEvent = await EventBus.emit({
      executionId: state.executionId,
      intentId: state.intentId,
      agent: 'CRITIC',
      eventType: 'critic_analysis_started',
      payload: { lastStep: state.currentStep },
      stepId: `${state.currentStep}-eval`,
      causalParentEventId: state.lastEventId
    });

    state.lastEventId = startedEvent.id;

    const lastToolResult = state.toolHistory[state.toolHistory.length - 1];
    let decision: 'CONTINUE' | 'NEEDS_REPLAN' | 'COMPLETED' | 'FAILED' = 'CONTINUE';
    
    // Evaluate only based on Event-Sourced history
    if (state.lastAgent === 'PLANNER') {
      // Plan just generated or updated, Critic allows execution to start
      decision = 'CONTINUE';
    } else if (lastToolResult && !lastToolResult.success) {
      decision = 'NEEDS_REPLAN';
    } else if (state.plan && state.plan.steps && state.toolHistory.length >= state.plan.steps.length) {
      decision = 'COMPLETED';
    }

    await EventBus.emit({
      executionId: state.executionId,
      intentId: state.intentId,
      agent: 'CRITIC',
      eventType: 'critic_feedback_generated',
      payload: { 
        decision, 
        feedback: decision === 'COMPLETED' ? 'Goal satisfied.' : 'Proceeding to next step.' 
      },
      stepId: `${state.currentStep}-decision`,
      causalParentEventId: state.lastEventId
    });
  }
}
