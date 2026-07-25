import type { LocalSearchResults, Place, WebResult } from "./brave-api";

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

export function formatPlaces(places: Place[]) {
  if (places.length === 0) return "No local results found";

  return places
    .map((place) =>
      [
        `Name: ${place.name}`,
        `Address: ${place.address || "N/A"}`,
        `Phone: ${place.phone || "N/A"}`,
        `Rating: ${place.rating ?? "N/A"} (${place.ratingCount ?? 0} reviews)`,
        `Price Range: ${place.priceRange || "N/A"}`,
        `Hours: ${place.openingHours.join(", ") || "N/A"}`,
        `Description: ${place.description || "No description available"}`,
      ].join("\n")
    )
    .join("\n---\n");
}

export function formatLocalSearchResults(results: LocalSearchResults) {
  if (results.kind === "web") {
    return `No local results found, falling back to web results:\n\n${formatWebResults(
      results.results
    )}`;
  }

  return formatPlaces(results.places);
}
