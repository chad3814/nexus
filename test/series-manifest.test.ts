import { describe, expect, it } from "vitest";
import { buildSeriesManifest } from "@/lib/manifest";
import type { Registry } from "@/lib/types";

const reg: Registry = {
  booksProcessed: [1],
  entities: [{ id: "carl", canonicalName: "Carl", aliases: [], type: "person", tags: ["in_world"], significance: "major", description: "", firstAppearance: null, appearances: ["B1·Prologue·¶1", "B1·C1·¶1"] }],
};

describe("buildSeriesManifest", () => {
  it("assembles id/title/author and books from anchors (reading order)", () => {
    const m = buildSeriesManifest({ id: "dcc", title: "Dungeon Crawler Carl", author: "Matt Dinniman" }, reg);
    expect(m).toEqual({
      id: "dcc",
      title: "Dungeon Crawler Carl",
      author: "Matt Dinniman",
      books: [{ number: 1, chapters: ["Prologue", "C1"] }],
    });
  });
});
