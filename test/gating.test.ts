import { describe, expect, it } from "vitest";
import { anchorSortKey, deriveBooks, viewAt, withinCutoff } from "@/lib/gating";
import type { Registry } from "@/lib/types";

const reg: Registry = {
  booksProcessed: [1, 2],
  entities: [
    { id: "carl", canonicalName: "Carl", aliases: [], type: "person", tags: ["in_world"], significance: "major", description: "blob", firstAppearance: { anchor: "B1·C1·¶1", snippet: "" }, appearances: ["B1·C1·¶1", "B2·C3·¶5"] },
    { id: "donut", canonicalName: "Princess Donut", aliases: [], type: "creature", tags: ["in_world"], significance: "major", description: "blob", firstAppearance: { anchor: "B2·C1·¶2", snippet: "" }, appearances: ["B2·C1·¶2"] },
  ],
};
const descriptions = [
  { id: "carl", anchor: "B1·C1·¶1", description: "A man.", significance: "minor" as const },
  { id: "carl", anchor: "B2·C1·¶9", description: "A crawler.", significance: "major" as const },
];
const aliases = [{ id: "carl", anchor: "B2·C1·¶9", alias: "Crawler #4,122" }];

describe("anchorSortKey", () => {
  it("parses anchors into reading order sort keys", () => {
    expect(anchorSortKey("B1·C1·¶1")).toEqual([1, 1, 1]);
    expect(anchorSortKey("B2·C3·¶5")).toEqual([2, 3, 5]);
    expect(anchorSortKey("B1·Prologue·¶1")).toEqual([1, -3, 1]);
  });
});

describe("withinCutoff", () => {
  it("gates by chapter (whole chapter inclusive) and book", () => {
    expect(withinCutoff("B2·C3·¶5", "B2·C3")).toBe(true);
    expect(withinCutoff("B2·C4·¶1", "B2·C3")).toBe(false);
    expect(withinCutoff("B3·C1·¶1", "B2·C99")).toBe(false);
  });
});

describe("viewAt", () => {
  it("drops entities introduced after the cutoff", () => {
    const v = viewAt(reg, { through: "B1·C99" });
    expect(v.entities.map((e) => e.id)).toEqual(["carl"]); // donut first appears B2
  });
  it("filters appearances and applies latest description/alias <= cutoff", () => {
    const v = viewAt(reg, { through: "B1·C99", descriptions, aliases });
    const carl = v.entities.find((e) => e.id === "carl")!;
    expect(carl.appearances).toEqual(["B1·C1·¶1"]);
    expect(carl.description).toBe("A man."); // B2 version gated out
    expect(carl.aliases).toEqual([]); // B2 alias gated out
  });
  it("at full series shows latest versions and all appearances", () => {
    const v = viewAt(reg, { descriptions, aliases });
    const carl = v.entities.find((e) => e.id === "carl")!;
    expect(carl.description).toBe("A crawler.");
    expect(carl.aliases).toContain("Crawler #4,122");
    expect(carl.appearances).toEqual(["B1·C1·¶1", "B2·C3·¶5"]);
  });
});

describe("deriveBooks", () => {
  it("derives books and ordered chapter labels from anchors", () => {
    const books = deriveBooks(reg);
    expect(books).toEqual([
      { number: 1, chapters: ["C1"] },
      { number: 2, chapters: ["C1", "C3"] },
    ]);
  });
});
