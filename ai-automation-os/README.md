# AI Automation OS (Agentic Workflow Platform)

This is an AI-native automation system that replaces static workflow tools like n8n with autonomous multi-agent execution.

## Core Concept
Users provide goals → AI builds + executes workflows dynamically using agents.

## System Layers
- Frontend: AI Mission Control UI
- API: Workflow + orchestration gateway
- Worker: Multi-agent execution engine
- AI Layer: Planner, Executor, Critic, Memory
- Tools: Extensible plugin system

## Quick Start
1. Install dependencies
2. Run Docker (Redis + Postgres)
3. Start API + Worker + Web

## Key Differentiator
Unlike n8n:
- Workflows are generated dynamically by AI
- Execution is adaptive (self-healing)
- Memory persists across runs
- Agents collaborate in real time

## Architecture
See /docs/architecture.md
