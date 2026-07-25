# mcp-brave search

An MCP server that proxies Brave's Search API over SSE, so any MCP client that
speaks the SSE transport can run Brave web and local searches.

## Tools

- `brave_web_search` — general web search with pagination.
- `brave_local_search` — businesses and places, falling back to a web search
  when Brave returns no locations.

## Setup

Copy `.env.example` to `.env` and add a Brave Search API key from the
[Brave API dashboard](https://api-dashboard.search.brave.com/app/keys), then:

```bash
bun install
bun start
```

The server refuses to start without an API key.

## Endpoints

| Method | Path        | Purpose                       |
| ------ | ----------- | ----------------------------- |
| GET    | `/`         | Health check                  |
| GET    | `/sse`      | Opens an MCP session          |
| POST   | `/messages` | Client messages for a session |

Point an MCP client at `/sse`, e.g. for Claude Code:

```bash
claude mcp add --transport sse brave-search http://localhost:3000/sse
```

## Configuration

Configuration is via environment variables. `BRAVE_API_KEY` is required;
everything else has a default.

Requests to Brave are queued to stay within the per-second allowance, and a
monthly request quota is tracked in memory. Both limits default to the free
tier and can be raised with `BRAVE_RATE_LIMIT_PER_SECOND` and
`BRAVE_RATE_LIMIT_PER_MONTH`. The listening port can be changed with `PORT`.

## Docker

```bash
bun run docker_build
bun run docker_run
```
