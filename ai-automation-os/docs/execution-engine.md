# Execution Engine

## Type

Hybrid:
- DAG execution
- Agent-driven decision loop

## Process

1. Load plan
2. Convert into execution graph
3. Execute node batch
4. Store state after each step
5. Pass result to next agent decision cycle

## Failure Handling

If tool fails:
- Retry with modified parameters
- Or re-plan via Planner Agent

## Key Innovation

Unlike n8n:
- Execution is NOT fixed
- Execution evolves during runtime
