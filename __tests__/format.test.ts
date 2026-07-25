import { describe, expect, test } from "bun:test";
import {
  formatLocalSearchResults,
  formatPlaces,
  formatWebResults,
} from "../src/format";

describe("formatWebResults", () => {
  test("formats each result as a labelled block", () => {
    expect(
      formatWebResults([
        { title: "Bun", description: "A JS runtime", url: "https://bun.sh" },
        { title: "Zig", description: "A language", url: "https://ziglang.org" },
      ])
    ).toBe(
      [
        "Title: Bun",
        "Description: A JS runtime",
        "URL: https://bun.sh",
        "",
        "Title: Zig",
        "Description: A language",
        "URL: https://ziglang.org",
      ].join("\n")
    );
  });

  test("reports when there are no results", () => {
    expect(formatWebResults([])).toBe("No web results found");
  });
});

describe("formatPlaces", () => {
  test("formats a fully populated place", () => {
    expect(
      formatPlaces([
        {
          name: "Pellegrini's",
          address: "66 Bourke St, Melbourne, VIC, 3000",
          phone: "+61 3 9662 1885",
          rating: 4.5,
          ratingCount: 1200,
          priceRange: "$$",
          openingHours: ["Mon-Sat 08:00-23:30"],
          description: "Espresso bar",
        },
      ])
    ).toBe(
      [
        "Name: Pellegrini's",
        "Address: 66 Bourke St, Melbourne, VIC, 3000",
        "Phone: +61 3 9662 1885",
        "Rating: 4.5 (1200 reviews)",
        "Price Range: $$",
        "Hours: Mon-Sat 08:00-23:30",
        "Description: Espresso bar",
      ].join("\n")
    );
  });

  test("falls back to placeholders for missing fields", () => {
    const formatted = formatPlaces([
      { name: "Unknown", address: "", openingHours: [] },
    ]);

    expect(formatted).toContain("Address: N/A");
    expect(formatted).toContain("Phone: N/A");
    expect(formatted).toContain("Rating: N/A (0 reviews)");
    expect(formatted).toContain("Price Range: N/A");
    expect(formatted).toContain("Hours: N/A");
    expect(formatted).toContain("Description: No description available");
  });

  test("separates multiple places", () => {
    expect(
      formatPlaces([
        { name: "A", address: "1 Test St", openingHours: [] },
        { name: "B", address: "2 Test St", openingHours: [] },
      ])
    ).toContain("\n---\n");
  });

  test("reports when there are no places", () => {
    expect(formatPlaces([])).toBe("No local results found");
  });
});

describe("formatLocalSearchResults", () => {
  test("formats places directly", () => {
    expect(
      formatLocalSearchResults({
        kind: "local",
        places: [{ name: "A", address: "1 Test St", openingHours: [] }],
      })
    ).toStartWith("Name: A");
  });

  test("explains the web search fallback", () => {
    const formatted = formatLocalSearchResults({
      kind: "web",
      results: [
        { title: "Bun", description: "A JS runtime", url: "https://bun.sh" },
      ],
    });

    expect(formatted).toStartWith("No local results found, falling back to");
    expect(formatted).toContain("Title: Bun");
  });
});
