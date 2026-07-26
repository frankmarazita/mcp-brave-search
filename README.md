# mcp-brave search

An MCP server that proxies Brave's Search API over SSE, so any MCP client that
speaks the SSE transport can run Brave web searches.

## Tools

- `brave_web_search` — general web search with pagination.

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

Queued requests are spaced by the per-second interval multiplied by
`BRAVE_RATE_LIMIT_MARGIN`, which defaults to 1.25. Brave enforces its limit on
arrival in fixed one-second buckets, so pacing at exactly the allowance lets
network jitter put two requests in the same bucket. Rate-limited responses are
retried with backoff, honouring `Retry-After` when Brave sends it.

## Docker

```bash
bun run docker_build
bun run docker_run
```
