import { ExecutionState, stateReducer } from './stateReducer.js';
import { EventBus } from '../../../api/src/utils/eventBus.js';

/**
 * Execution Sandbox
 * Acts as a hard boundary for state reconstruction and agent context.
 * Prevents cross-execution contamination.
 */
export class ExecutionSandbox {
  /**
   * Reconstructs the state within an isolated context.
   */
  static async reconstructState(executionId: string): Promise<ExecutionState> {
    const events = await EventBus.getStream(executionId);
    return stateReducer(events);
  }

  /**
   * Wraps an execution turn to ensure isolation.
   * Currently, this ensures no local variable leakage between concurrent runs.
   */
  static async executeTurn<T>(
    executionId: string, 
    action: (state: ExecutionState) => Promise<T>
  ): Promise<T> {
    const state = await this.reconstructState(executionId);
    
    // In a more advanced version, this would set up thread-local storage or process-level isolation.
    // For now, it enforces the "single source of truth" by providing the freshly reduced state.
    return await action(state);
  }
}
