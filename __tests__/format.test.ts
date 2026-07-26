import { describe, expect, test } from "bun:test";
import { formatWebResults } from "../src/format";

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
