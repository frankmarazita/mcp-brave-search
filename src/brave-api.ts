import { z } from "zod";
import { ENV } from "./env";
import { createRateLimiter, sleep } from "./rate-limit";

const zBraveError = z.object({
  error: z.object({ detail: z.string().min(1) }),
});

const API_ENDPOINTS = {
  webSearch: "https://api.search.brave.com/res/v1/web/search",
};

export const MAX_COUNT = 20;
export const MAX_OFFSET = 9;
export const MAX_RETRIES = 3;

interface BraveWebResponse {
  web?: {
    results?: Array<{
      title?: string;
      description?: string;
      url?: string;
    }>;
  };
}

export interface WebResult {
  title: string;
  description: string;
  url: string;
}

export class BraveApiError extends Error {
  constructor(
    readonly operation: string,
    readonly status: number,
    readonly detail: string
  ) {
    super(
      [`Brave API error (${operation}): ${status}`, detail]
        .filter(Boolean)
        .join(" ")
    );
    this.name = "BraveApiError";
  }
}

function errorDetail(statusText: string, body: string) {
  try {
    return zBraveError.parse(JSON.parse(body)).error.detail;
  } catch {
    return statusText || body.slice(0, 200);
  }
}

const rateLimiter = createRateLimiter({
  perSecond: ENV.BRAVE_RATE_LIMIT_PER_SECOND,
  perMonth: ENV.BRAVE_RATE_LIMIT_PER_MONTH,
  marginFactor: ENV.BRAVE_RATE_LIMIT_MARGIN,
});

export function retryAfterMs(response: Response) {
  const header = response.headers.get("retry-after");
  if (!header) return null;

  const seconds = Number(header);
  if (header.trim() !== "" && Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

function backoffMs(response: Response, attempt: number) {
  return retryAfterMs(response) ?? 2 ** attempt * 1000;
}

async function braveFetch<T>(operation: string, url: URL): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    await rateLimiter.acquire();

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": ENV.BRAVE_API_KEY,
      },
    });

    if (response.ok) return (await response.json()) as T;

    if (response.status === 429 && attempt < MAX_RETRIES) {
      await sleep(backoffMs(response, attempt));
      continue;
    }

    throw new BraveApiError(
      operation,
      response.status,
      errorDetail(response.statusText, await response.text())
    );
  }
}

function clampCount(count: number) {
  return Math.min(Math.max(Math.trunc(count), 1), MAX_COUNT);
}

export async function webSearch(
  query: string,
  count = 10,
  offset = 0
): Promise<WebResult[]> {
  const url = new URL(API_ENDPOINTS.webSearch);
  url.searchParams.set("q", query);
  url.searchParams.set("count", clampCount(count).toString());
  url.searchParams.set(
    "offset",
    Math.min(Math.max(Math.trunc(offset), 0), MAX_OFFSET).toString()
  );

  const data = await braveFetch<BraveWebResponse>("web search", url);

  return (data.web?.results ?? []).map((result) => ({
    title: result.title ?? "",
    description: result.description ?? "",
    url: result.url ?? "",
  }));
}
