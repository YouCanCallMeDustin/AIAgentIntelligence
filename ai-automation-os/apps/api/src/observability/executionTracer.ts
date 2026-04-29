import { EventLog } from '@prisma/client';
import { stateReducer } from '../../../worker/src/runtime/stateReducer.js';

export interface TraceStep {
  agent: string;
  eventType: string;
  timestamp: Date;
  payload: any;
  stateSnapshot: any;
}

/**
 * Execution Trace System
 * Reconstructs the full cognitive graph of an execution.
 */
export class ExecutionTracer {
  /**
   * Generates a step-by-step trace of the execution's reasoning.
   */
  static async trace(events: any[]): Promise<TraceStep[]> {
    const trace: TraceStep[] = [];
    const incrementalEvents: any[] = [];

    for (const event of events) {
      incrementalEvents.push(event);
      // Reconstruct state at this point in time
      const stateSnapshot = stateReducer(incrementalEvents);

      trace.push({
        agent: event.agent,
        eventType: event.eventType,
        timestamp: event.timestamp,
        payload: event.payload,
        stateSnapshot: {
          status: stateSnapshot.status,
          currentStep: stateSnapshot.currentStep,
          retryCount: stateSnapshot.retryCount,
          toolHistoryLength: stateSnapshot.toolHistory.length,
          terminated: stateSnapshot.terminated
        }
      });
    }

    return trace;
  }
}
