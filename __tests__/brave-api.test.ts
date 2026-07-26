import { afterEach, beforeAll, describe, expect, test } from "bun:test";

process.env.BRAVE_API_KEY = "test-key";
process.env.BRAVE_RATE_LIMIT_PER_SECOND = "1000";
process.env.BRAVE_RATE_LIMIT_PER_MONTH = "100000";
process.env.BRAVE_RATE_LIMIT_MARGIN = "1";

type BraveApi = typeof import("../src/brave-api");

let api: BraveApi;

const realFetch = globalThis.fetch;

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), init);
}

function stubFetch(responses: Response[]) {
  const calls: URL[] = [];

  globalThis.fetch = (async (input: URL) => {
    calls.push(input);

    const response = responses.shift();
    if (!response) throw new Error("unexpected extra fetch call");

    return response;
  }) as typeof fetch;

  return calls;
}

beforeAll(async () => {
  api = await import("../src/brave-api");
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("retryAfterMs", () => {
  test("reads a delay given in seconds", () => {
    const response = new Response("", { headers: { "retry-after": "2" } });

    expect(api.retryAfterMs(response)).toBe(2000);
  });

  test("reads a delay given as an HTTP date", () => {
    const when = new Date(Date.now() + 5000).toUTCString();
    const response = new Response("", { headers: { "retry-after": when } });

    expect(api.retryAfterMs(response)!).toBeGreaterThan(3000);
  });

  test("returns null when the header is absent", () => {
    expect(api.retryAfterMs(new Response(""))).toBeNull();
  });

  test("never returns a negative delay for a past date", () => {
    const when = new Date(Date.now() - 60_000).toUTCString();
    const response = new Response("", { headers: { "retry-after": when } });

    expect(api.retryAfterMs(response)).toBe(0);
  });
});

describe("braveFetch retries", () => {
  test("retries a 429 and returns the eventual success", async () => {
    const calls = stubFetch([
      json({}, { status: 429, headers: { "retry-after": "0" } }),
      json({ web: { results: [{ title: "ok", description: "d", url: "u" }] } }),
    ]);

    const results = await api.webSearch("anything");

    expect(calls).toHaveLength(2);
    expect(results).toEqual([{ title: "ok", description: "d", url: "u" }]);
  });

  test("gives up after the retry budget and throws", async () => {
    const calls = stubFetch(
      Array.from({ length: api.MAX_RETRIES + 1 }, () =>
        json(
          { error: { detail: "Request rate limit exceeded for plan" } },
          { status: 429, headers: { "retry-after": "0" } }
        )
      )
    );

    await expect(api.webSearch("anything")).rejects.toThrow(
      /Request rate limit exceeded for plan/
    );
    expect(calls).toHaveLength(api.MAX_RETRIES + 1);
  });

  test("does not retry a non-429 failure", async () => {
    const calls = stubFetch([
      json({ error: { detail: "bad key" } }, { status: 401 }),
    ]);

    await expect(api.webSearch("anything")).rejects.toThrow(/401/);
    expect(calls).toHaveLength(1);
  });
});

describe("webSearch", () => {
  test("clamps count and offset to the documented maximums", async () => {
    const calls = stubFetch([json({ web: { results: [] } })]);

    await api.webSearch("anything", 500, 99);

    expect(calls[0]!.searchParams.get("count")).toBe(String(api.MAX_COUNT));
    expect(calls[0]!.searchParams.get("offset")).toBe(String(api.MAX_OFFSET));
  });

  test("returns an empty list when Brave sends no web results", async () => {
    stubFetch([json({})]);

    expect(await api.webSearch("anything")).toEqual([]);
  });
});
