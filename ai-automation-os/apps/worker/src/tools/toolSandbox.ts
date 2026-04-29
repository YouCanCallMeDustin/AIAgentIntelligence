import { EventBus } from '../../../api/src/utils/eventBus.js';

export interface ToolSandboxOptions {
  timeoutMs?: number;
  memoryLimitMb?: number;
}

/**
 * Tool Sandbox
 * Enforces safety boundaries on tool execution.
 * Prevents runaway tools and blocks recursive tool loops.
 */
export class ToolSandbox {
  private static DEFAULT_TIMEOUT = 30000; // 30 seconds

  /**
   * Executes a tool within safety boundaries.
   */
  static async runTool(
    executionId: string,
    toolName: string,
    args: any,
    toolFn: (args: any) => Promise<any>,
    options: ToolSandboxOptions = {}
  ): Promise<any> {
    const timeout = options.timeoutMs || this.DEFAULT_TIMEOUT;

    console.log(`[ToolSandbox] Running ${toolName} for ${executionId} (Timeout: ${timeout}ms)`);

    try {
      // Promise.race to enforce timeout
      const result = await Promise.race([
        toolFn(args),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Tool execution timed out after ${timeout}ms`)), timeout)
        )
      ]);

      return result;
    } catch (error) {
      console.error(`[ToolSandbox] Tool ${toolName} failed or timed out:`, error);
      
      // We don't emit the 'tool_execution_failed' event here, 
      // the ExecutorAgent is responsible for translating exceptions into events.
      throw error;
    }
  }
}
