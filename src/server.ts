import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as Sentry from "@sentry/bun";
import express from "express";
import { z } from "zod";
import { webSearch, MAX_COUNT, MAX_OFFSET } from "./brave-api";
import { formatWebResults } from "./format";

async function runTool(run: () => Promise<string>): Promise<CallToolResult> {
  try {
    return { content: [{ type: "text", text: await run() }] };
  } catch (error) {
    Sentry.captureException(error);
    console.error(error);

    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

// A server instance can only be bound to a single transport, so each SSE
// connection gets its own.
function createServer() {
  const server = new McpServer({
    name: "mcp-brave-search",
    version: "1.0.0",
  });

  server.registerTool(
    "brave_web_search",
    {
      title: "Brave Web Search",
      description:
        "Performs a web search using the Brave Search API, ideal for general queries, news, articles, and online content. " +
        "Use this for broad information gathering, recent events, or when you need diverse web sources. " +
        `Supports pagination, with a maximum of ${MAX_COUNT} results per request.`,
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(400)
          .describe("Search query (max 400 chars, 50 words)"),
        count: z
          .number()
          .int()
          .min(1)
          .max(MAX_COUNT)
          .default(10)
          .describe(`Number of results (1-${MAX_COUNT}, default 10)`),
        offset: z
          .number()
          .int()
          .min(0)
          .max(MAX_OFFSET)
          .default(0)
          .describe(`Pagination offset (max ${MAX_OFFSET}, default 0)`),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ query, count, offset }) =>
      runTool(async () =>
        formatWebResults(await webSearch(query, count, offset))
      )
  );

  return server;
}

const app = express();

const sessions = new Map<
  string,
  { server: McpServer; transport: SSEServerTransport }
>();

app.get("/", (_, res) => {
  res.sendStatus(200);
});

app.get("/sse", async (_, res) => {
  const server = createServer();
  const transport = new SSEServerTransport("/messages", res);

  sessions.set(transport.sessionId, { server, transport });

  transport.onclose = () => {
    sessions.delete(transport.sessionId);
  };

  res.on("close", () => {
    sessions.delete(transport.sessionId);
    void server.close();
  });

  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const session = sessions.get(sessionId);

  if (session) {
    await session.transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("No transport found for sessionId");
  }
});

export { app };
