export type AgentType = 'PLANNER' | 'EXECUTOR' | 'CRITIC' | 'MEMORY' | 'SYSTEM' | 'POLICY' | 'LEARNING';

export interface ExecutionState {
  executionId: string;
  intentId: string;
  currentStep: string;
  lastAgent: AgentType;
  lastEvent: string;
  plan: any | null;
  toolHistory: any[];
  retryCount: number;
  status: 'QUEUED' | 'PLANNING' | 'EXECUTING' | 'AWAITING_TOOL' | 'SELF_CORRECTING' | 'COMPLETED' | 'FAILED';
  terminated: boolean;
  policy: any | null;
  learningContext: any[] | null;
  lastEventId: string; // Phase 5: Causal context
}

/**
 * Pure function that reconstructs the current execution state from the event stream.
 * NO in-memory mutable state allowed.
 */
export function stateReducer(events: any[]): ExecutionState {
  const state: ExecutionState = {
    executionId: '',
    intentId: '',
    currentStep: 'init',
    lastAgent: 'SYSTEM',
    lastEvent: '',
    plan: null,
    toolHistory: [],
    retryCount: 0,
    status: 'QUEUED',
    terminated: false,
    policy: null,
    learningContext: null,
    lastEventId: '',
  };

  for (const event of events) {
    state.executionId = event.executionId;
    state.intentId = event.intentId;
    state.lastAgent = event.agent;
    state.lastEvent = event.eventType;
    state.currentStep = event.stepId;
    state.lastEventId = event.id; // Phase 5

    switch (event.eventType) {
      case 'execution_started':
        state.status = 'QUEUED';
        break;
      case 'planner_reasoning_started':
        state.status = 'PLANNING';
        break;
      case 'plan_generated':
        state.plan = event.payload.plan;
        state.status = 'EXECUTING';
        break;
      case 'tool_execution_started':
        state.status = 'AWAITING_TOOL';
        break;
      case 'tool_execution_succeeded':
        state.status = 'EXECUTING';
        state.toolHistory.push({ ...event.payload, success: true });
        break;
      case 'tool_execution_failed':
        state.status = 'EXECUTING'; // Move back to executing so critic can evaluate
        state.toolHistory.push({ ...event.payload, success: false });
        state.retryCount++;
        break;
      case 'memory_retrieved':
        // Memory is now an event-driven context injection
        break;
      case 'critic_feedback_generated':
        if (event.payload.decision === 'NEEDS_REPLAN') {
          state.status = 'SELF_CORRECTING';
          state.retryCount++;
        } else if (event.payload.decision === 'CONTINUE') {
          state.status = 'EXECUTING';
        } else if (event.payload.decision === 'COMPLETED') {
          state.status = 'COMPLETED';
          state.terminated = true;
        } else if (event.payload.decision === 'FAILED') {
          state.status = 'FAILED';
          state.terminated = true;
        }
        break;
      case 'policy_applied':
        state.policy = event.payload.policy;
        break;
      case 'learning_context_injected':
        state.learningContext = event.payload.patterns;
        break;
    }
  }

  return state;
}
