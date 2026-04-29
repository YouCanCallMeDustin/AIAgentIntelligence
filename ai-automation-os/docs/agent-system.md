# Multi-Agent System Design

## Agents

### 1. Planner Agent
- Converts user goal → step-by-step execution plan
- Chooses tools dynamically

### 2. Executor Agent
- Executes tools in correct order
- Handles API calls, DB operations, code execution

### 3. Critic Agent
- Validates outputs
- Detects errors or hallucinations
- Requests retries or corrections

### 4. Memory Agent
- Stores execution history
- Retrieves semantic context via vector search

## Communication Model

Agents communicate via structured JSON messages:

{
  "role": "planner",
  "action": "create_plan",
  "data": {}
}

## Rule

No agent executes without memory + context injection.
