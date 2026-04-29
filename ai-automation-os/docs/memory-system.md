# Memory System

## Layers

### 1. Short-term Memory
- Current workflow execution state

### 2. Long-term Memory
- Past workflows
- User preferences
- Tool reliability stats

### 3. Semantic Memory
- Vector embeddings of past executions

## Storage

- PostgreSQL → structured data
- Vector DB → semantic recall

## Rule

Every execution must read + write memory.
