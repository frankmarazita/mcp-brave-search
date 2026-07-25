import { z } from "zod";
import { ENV } from "./env";
import { createRateLimiter } from "./rate-limit";

const zBraveError = z.object({
  error: z.object({ detail: z.string().min(1) }),
});

const API_ENDPOINTS = {
  webSearch: "https://api.search.brave.com/res/v1/web/search",
  pois: "https://api.search.brave.com/res/v1/local/pois",
  descriptions: "https://api.search.brave.com/res/v1/local/descriptions",
};

export const MAX_COUNT = 20;
export const MAX_OFFSET = 9;

interface BraveWebResponse {
  web?: {
    results?: Array<{
      title?: string;
      description?: string;
      url?: string;
    }>;
  };
  locations?: {
    results?: Array<{
      id?: string;
      title?: string;
    }>;
  };
}

interface BravePoiResponse {
  results?: Array<{
    id: string;
    name?: string;
    address?: {
      streetAddress?: string;
      addressLocality?: string;
      addressRegion?: string;
      postalCode?: string;
    };
    phone?: string;
    rating?: {
      ratingValue?: number;
      ratingCount?: number;
    };
    openingHours?: string[];
    priceRange?: string;
  }>;
}

interface BraveDescriptionResponse {
  descriptions?: Record<string, string>;
}

export interface WebResult {
  title: string;
  description: string;
  url: string;
}

export interface Place {
  name: string;
  address: string;
  phone?: string;
  rating?: number;
  ratingCount?: number;
  priceRange?: string;
  openingHours: string[];
  description?: string;
}

export type LocalSearchResults =
  { kind: "local"; places: Place[] } | { kind: "web"; results: WebResult[] };

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
});

async function braveFetch<T>(operation: string, url: URL): Promise<T> {
  await rateLimiter.acquire();

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": ENV.BRAVE_API_KEY,
    },
  });

  if (!response.ok) {
    throw new BraveApiError(
      operation,
      response.status,
      errorDetail(response.statusText, await response.text())
    );
  }

  return (await response.json()) as T;
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

export async function localSearch(
  query: string,
  count = 5
): Promise<LocalSearchResults> {
  const url = new URL(API_ENDPOINTS.webSearch);
  url.searchParams.set("q", query);
  url.searchParams.set("search_lang", "en");
  url.searchParams.set("result_filter", "locations");
  url.searchParams.set("count", clampCount(count).toString());

  const data = await braveFetch<BraveWebResponse>("local search", url);

  const ids = (data.locations?.results ?? [])
    .map((result) => result.id)
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    return { kind: "web", results: await webSearch(query, count) };
  }

  const [pois, descriptions] = await Promise.all([
    getPois(ids),
    getDescriptions(ids),
  ]);

  return { kind: "local", places: toPlaces(pois, descriptions) };
}

async function getPois(ids: string[]) {
  const url = new URL(API_ENDPOINTS.pois);
  ids.forEach((id) => url.searchParams.append("ids", id));

  return braveFetch<BravePoiResponse>("get pois", url);
}

async function getDescriptions(ids: string[]) {
  const url = new URL(API_ENDPOINTS.descriptions);
  ids.forEach((id) => url.searchParams.append("ids", id));

  return braveFetch<BraveDescriptionResponse>("get descriptions", url);
}

function toPlaces(
  pois: BravePoiResponse,
  descriptions: BraveDescriptionResponse
): Place[] {
  return (pois.results ?? []).map((poi) => ({
    name: poi.name ?? "Unknown",
    address: [
      poi.address?.streetAddress,
      poi.address?.addressLocality,
      poi.address?.addressRegion,
      poi.address?.postalCode,
    ]
      .filter((part): part is string => Boolean(part))
      .join(", "),
    phone: poi.phone,
    rating: poi.rating?.ratingValue,
    ratingCount: poi.rating?.ratingCount,
    priceRange: poi.priceRange,
    openingHours: poi.openingHours ?? [],
    description: descriptions.descriptions?.[poi.id],
  }));
}
