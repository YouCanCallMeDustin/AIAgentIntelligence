# System Architecture

## Overview

This system is built on an Agent-Oriented Execution Model.

Instead of static nodes, we use:

- Planner Agent → builds strategy
- Executor Agent → runs tools
- Critic Agent → validates output
- Memory Agent → stores and recalls context

## Execution Flow

1. User submits goal
2. Planner Agent generates execution plan
3. Executor converts plan into tool calls
4. Tools execute in sandboxed workers
5. Critic evaluates results
6. If failure → system retries with improved plan
7. Output returned

## Key Principle

> Workflows are not predefined — they are discovered at runtime.

## Data Flow

User → API → Planner → Worker → Tools → Memory → Critic → Final Output
