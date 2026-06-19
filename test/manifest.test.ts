import { describe, expect, it } from "vitest";
import { buildSeriesManifest } from "@/lib/manifest";
import type { Registry } from "@/lib/types";

const meta = { id: "dcc", title: "DCC", author: "MD" };

describe("buildSeriesManifest", () => {
  it("uses registry.books (full structure, spine order) when present", () => {
    const reg: Registry = {
      booksProcessed: [8], entities: [],
      books: [{ number: 8, sections: ["Epigraph", "Interlude", "C1", "Interlude-2", "C2", "Epilogue"] }],
    };
    expect(buildSeriesManifest(meta, reg).books).toEqual([
      { number: 8, chapters: ["Epigraph", "Interlude", "C1", "Interlude-2", "C2", "Epilogue"] },
    ]);
  });

  it("falls back to deriveBooks when registry.books is absent", () => {
    const reg: Registry = {
      booksProcessed: [1], entities: [{
        id: "a", canonicalName: "A", aliases: [], type: "person", tags: [], significance: "minor",
        description: "", firstAppearance: null, appearances: ["B1·C1·¶1", "B1·C2·¶1"],
      }],
    };
    expect(buildSeriesManifest(meta, reg).books).toEqual([{ number: 1, chapters: ["C1", "C2"] }]);
  });

  it("carries book titles from registry.books", () => {
    const reg = { booksProcessed: [2], entities: [], books: [{ number: 2, title: "Carl's Doomsday Scenario", sections: ["C1"] }] } as Registry;
    expect(buildSeriesManifest({ id: "dcc", title: "DCC", author: "MD" }, reg).books[0]).toEqual({
      number: 2, title: "Carl's Doomsday Scenario", chapters: ["C1"],
    });
  });
});
