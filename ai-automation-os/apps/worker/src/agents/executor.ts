import { EventBus } from '../../../api/src/utils/eventBus.js';
import { ExecutionState } from '../runtime/stateReducer.js';
import { ToolRegistry } from '../tools/toolRegistry.js';
import { ToolArbitrator } from '../tools/toolArbitrator.js';

export class ExecutorAgent {
  static async executeStep(state: ExecutionState) {
    if (!state.plan || !state.plan.steps) {
      throw new Error('No plan available for execution');
    }

    // Determine the next step based on toolHistory length
    const stepIndex = state.toolHistory.length;
    const nextStep = state.plan.steps[stepIndex];

    if (!nextStep) {
      // No more steps in current plan, Critic should decide if we are done
      return;
    }

    console.log(`[ExecutorAgent] Next step for ${state.executionId}: ${nextStep.tool} with args:`, JSON.stringify(nextStep.args));

    // 1. Tool Arbitration (Governance)
    const isSafe = await ToolArbitrator.validate(nextStep.tool, nextStep.args);
    if (!isSafe) {
      throw new Error(`Tool arbitration failed for ${nextStep.tool}`);
    }

    // 2. Emit Started Event
    const startedEvent = await EventBus.emit({
      executionId: state.executionId,
      intentId: state.intentId,
      agent: 'EXECUTOR',
      eventType: 'tool_execution_started',
      payload: { tool: nextStep.tool, args: nextStep.args },
      stepId: `step-${stepIndex}-start`,
      causalParentEventId: state.lastEventId
    });

    state.lastEventId = startedEvent.id;

    try {
      // 3. Execute ONE tool (Strict Constraint) via Sandbox (Phase 4 Requirement)
      const { ToolSandbox } = await import('../tools/toolSandbox.js');
      
      const result = await ToolSandbox.runTool(
        state.executionId,
        nextStep.tool,
        nextStep.args,
        () => ToolRegistry.invoke(nextStep.tool, nextStep.args)
      );

      // 4. Emit Succeeded Event
      await EventBus.emit({
        executionId: state.executionId,
        intentId: state.intentId,
        agent: 'EXECUTOR',
        eventType: 'tool_execution_succeeded',
        payload: { 
          tool: nextStep.tool, 
          args: nextStep.args, 
          result,
          stepIndex 
        },
        stepId: `step-${stepIndex}-success`,
        causalParentEventId: state.lastEventId
      });
    } catch (error) {
      // 5. Emit Failed Event
      await EventBus.emit({
        executionId: state.executionId,
        intentId: state.intentId,
        agent: 'EXECUTOR',
        eventType: 'tool_execution_failed',
        payload: { 
          tool: nextStep.tool, 
          args: nextStep.args, 
          error: (error as Error).message,
          stepIndex 
        },
        stepId: `step-${stepIndex}-fail`,
        causalParentEventId: state.lastEventId
      });
    }
  }
}
