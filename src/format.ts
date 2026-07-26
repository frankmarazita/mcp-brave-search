import type { WebResult } from "./brave-api";

export function formatWebResults(results: WebResult[]) {
  if (results.length === 0) return "No web results found";

  return results
    .map((result) =>
      [
        `Title: ${result.title}`,
        `Description: ${result.description}`,
        `URL: ${result.url}`,
      ].join("\n")
    )
    .join("\n\n");
}
