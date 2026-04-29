# Tool System (Plugin Architecture)

## Concept

Everything in the system is a tool.

Tools are the ONLY way agents interact with external systems.

## Tool Interface

Each tool must implement:

{
  name: string,
  input_schema: object,
  execute: function,
  description: string
}

## Examples

- http_request
- send_email
- query_database
- run_code
- scrape_web
- call_ai_model

## Rule

Agents cannot directly access external APIs.
They must go through tools.
