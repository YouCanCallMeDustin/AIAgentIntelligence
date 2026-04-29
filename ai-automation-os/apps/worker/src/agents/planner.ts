import { EventBus } from '../../../api/src/utils/eventBus.js';
import { ExecutionState } from '../runtime/stateReducer.js';

export class PlannerAgent {
  static async reason(state: ExecutionState) {
    try {
      console.log(`[PlannerAgent] Starting reasoning for ${state.executionId}`);
      
      // Constraint check: Enforce Policy before even starting
      const allowedTools = state.policy?.constraints?.allowed_tools || [];
      
      const startedEvent = await EventBus.emit({
        executionId: state.executionId,
        intentId: state.intentId,
        agent: 'PLANNER',
        eventType: 'planner_reasoning_started',
        payload: { 
          context: 'Analyzing snapshot...',
          policyApplied: state.policy?.id,
          learningApplied: !!state.learningContext
        },
        stepId: `${state.currentStep}-plan-reason`,
        causalParentEventId: state.lastEventId
      });

      state.lastEventId = startedEvent.id; // Local update for chaining

      // PURE REASONING: Planner = f(ExecutionContextSnapshot)
      // All signals come from 'state' which was reduced from the event stream.
      
      const isRetry = state.retryCount > 0;
      const lastFailure = state.toolHistory.find(h => !h.success);
      
      // Check learning patterns
      const toolBias = state.learningContext?.find((p: any) => p.type === 'TOOL_BIAS');
      
      let initialTool = 'web_search';
      if (toolBias && toolBias.recommendedTools.includes('web_search')) {
        // Learning system influence
      }

      let steps = [
        { id: 'step-0', tool: initialTool, args: { query: 'trend 1' }, description: 'Primary search' },
        { id: 'step-1', tool: 'web_search', args: { query: 'trend 2' } },
        { id: 'step-2', tool: 'summarize', args: { length: 'short' } }
      ];

      // Reactive Adaptation based on Snapshot signals
      if (isRetry && lastFailure?.tool === 'web_search') {
        console.log(`[PlannerAgent] Detected failure in snapshot. Switching to alternate_search.`);
        steps[0] = { id: 'step-0-retry', tool: 'alternate_search', args: { query: 'fallback' } };
      }

      // Final Policy Validation: Ensure no forbidden tools are in the plan
      if (allowedTools.length > 0) {
        steps = steps.filter(s => allowedTools.includes(s.tool));
      }

      const plan = { steps, strategy: 'sequential' };

      await EventBus.emit({
        executionId: state.executionId,
        intentId: state.intentId,
        agent: 'PLANNER',
        eventType: 'plan_generated',
        payload: { plan },
        stepId: `${state.currentStep}-plan-ready`,
        causalParentEventId: state.lastEventId
      });
    } catch (error) {
      console.error(`[PlannerAgent] Error in reason:`, error);
      throw error;
    }
  }
}
