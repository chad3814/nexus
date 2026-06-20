import { describe, expect, it } from "vitest";
import { buildChapterIndex, chapterKeyOf, compareEntities, cutoffChapterIndex } from "@/lib/entity-sort";
import type { SortKey } from "@/lib/entity-sort";
import { FULL_SERIES } from "@/lib/position";
import type { RegistryEntity } from "@/lib/types";

const e = (id: string, name: string, sig: RegistryEntity["significance"], apps: string[]): RegistryEntity => ({
  id, canonicalName: name, aliases: [], type: "person", tags: [], significance: sig,
  description: "", firstAppearance: null, appearances: apps,
});
const books = [{ number: 3, chapters: ["C15", "C16", "C17"] }];
const idx = buildChapterIndex(books);
const ctx = { chapterIndex: idx, cutoffIdx: cutoffChapterIndex("B3·C17", idx) };
const sortBy = (arr: RegistryEntity[], k: SortKey, p: boolean) => [...arr].sort((a, b) => compareEntities(a, b, k, p, ctx)).map((x) => x.id);

describe("chapter index helpers", () => {
  it("chapterKeyOf strips the paragraph", () => { expect(chapterKeyOf("B3·C17·¶5")).toBe("B3·C17"); });
  it("cutoffChapterIndex(FULL_SERIES) is the last chapter", () => { expect(cutoffChapterIndex(FULL_SERIES, idx)).toBe(idx.size - 1); });
});

describe("compareEntities", () => {
  const carl = e("carl", "Carl", "major", ["B3·C15·¶1", "B3·C17·¶1"]);
  const ann = e("ann", "Ann", "minor", ["B3·C16·¶1"]);
  const zed = e("zed", "Zed", "supporting", ["B3·C15·¶1"]);
  const all = [carl, ann, zed];
  it("relevance primary = significance then name (today's order)", () => { expect(sortBy(all, "relevance", true)).toEqual(["carl", "zed", "ann"]); });
  it("relevance secondary reverses", () => { expect(sortBy(all, "relevance", false)).toEqual(["ann", "zed", "carl"]); });
  it("alphabetical A→Z and Z→A", () => { expect(sortBy(all, "alphabetical", true)).toEqual(["ann", "carl", "zed"]); expect(sortBy(all, "alphabetical", false)).toEqual(["zed", "carl", "ann"]); });
  it("prominence most/fewest by appearance count", () => { expect(sortBy(all, "prominence", true)[0]).toBe("carl"); expect(sortBy(all, "prominence", false)[0]).toBe("ann"); });
  it("distance Recent = nearest latest-appearance to cutoff first", () => {
    // cutoff C17: carl latest C17 (dist 0), ann latest C16 (dist 1), zed latest C15 (dist 2)
    expect(sortBy(all, "distance", true)).toEqual(["carl", "ann", "zed"]);
  });
  it("distance First = nearest earliest-appearance to cutoff first", () => {
    // first appearances: carl C15 (dist 2), ann C16 (dist 1), zed C15 (dist 2) -> ann, then carl/zed by name
    expect(sortBy(all, "distance", false)).toEqual(["ann", "carl", "zed"]);
  });
});
