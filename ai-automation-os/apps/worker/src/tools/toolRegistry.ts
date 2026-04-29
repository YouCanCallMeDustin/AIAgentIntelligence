export class ToolRegistry {
  static async invoke(toolName: string, args: any) {
    console.log(`[ToolRegistry] Invoking ${toolName} with`, args);
    
    // Mock tool implementations
    switch (toolName) {
      case 'web_search':
        console.log(`[ToolRegistry] web_search args:`, JSON.stringify(args));
        if (args.simulateFailure === true || args.simulateFailure === 'true') {
          console.log('[ToolRegistry] Simulating failure!');
          throw new Error('Web search service unavailable');
        }
        return { data: 'Found latest AI trends: Agentic workflows are rising.' };
      case 'alternate_search':
        return { data: 'Alternate search: AI is becoming agentic.' };
      case 'summarize':
        return { data: 'AI is moving towards autonomous agents.' };
      default:
        return { error: `Tool ${toolName} not found` };
    }
  }
}
