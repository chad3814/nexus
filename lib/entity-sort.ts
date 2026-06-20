import { FULL_SERIES } from "@/lib/position";
import type { Cutoff, RegistryEntity, Significance } from "@/lib/types";

export type SortKey = "relevance" | "alphabetical" | "prominence" | "distance";

export const SIG_RANK: Record<Significance, number> = { major: 0, supporting: 1, minor: 2, mentioned: 3 };

export const SORT_KEYS: Array<{ key: SortKey; label: string }> = [
  { key: "relevance", label: "Relevance" },
  { key: "alphabetical", label: "Alphabetical" },
  { key: "prominence", label: "Prominence" },
  { key: "distance", label: "Distance" },
];

const DIR_LABELS: Record<SortKey, [string, string]> = {
  relevance: ["Most first", "Least first"],
  alphabetical: ["A→Z", "Z→A"],
  prominence: ["Most first", "Fewest first"],
  distance: ["Recent", "First"],
};

export function dirLabel(key: SortKey, primary: boolean): string {
  return DIR_LABELS[key][primary ? 0 : 1];
}

/** The "B<n>·<label>" chapter prefix of an anchor or cutoff. */
export function chapterKeyOf(anchor: string): string {
  const m = anchor.match(/B\d+·[^·\]]+/);
  return m ? m[0] : anchor;
}

export function buildChapterIndex(books: Array<{ number: number; chapters: string[] }>): Map<string, number> {
  const map = new Map<string, number>();
  let i = 0;
  for (const b of [...books].sort((x, y) => x.number - y.number)) {
    for (const ch of b.chapters) map.set(`B${b.number}·${ch}`, i++);
  }
  return map;
}

export function cutoffChapterIndex(cutoff: Cutoff, chapterIndex: Map<string, number>): number {
  if (cutoff === FULL_SERIES) return chapterIndex.size - 1;
  return chapterIndex.get(chapterKeyOf(cutoff)) ?? chapterIndex.size - 1;
}

interface SortCtx { chapterIndex: Map<string, number>; cutoffIdx: number; }

function entityChapterIdx(e: RegistryEntity, ctx: SortCtx, recent: boolean): number | null {
  let best: number | null = null;
  for (const a of e.appearances) {
    const idx = ctx.chapterIndex.get(chapterKeyOf(a));
    if (idx === undefined) continue;
    best = best === null ? idx : recent ? Math.max(best, idx) : Math.min(best, idx);
  }
  return best;
}

export function compareEntities(
  a: RegistryEntity, b: RegistryEntity, key: SortKey, dirPrimary: boolean, ctx: SortCtx,
): number {
  const byName = a.canonicalName.localeCompare(b.canonicalName);
  if (key === "distance") {
    const ia = entityChapterIdx(a, ctx, dirPrimary);
    const ib = entityChapterIdx(b, ctx, dirPrimary);
    const da = ia === null ? Number.POSITIVE_INFINITY : ctx.cutoffIdx - ia;
    const db = ib === null ? Number.POSITIVE_INFINITY : ctx.cutoffIdx - ib;
    return da - db || byName;
  }
  if (key === "alphabetical") {
    return dirPrimary ? byName : -byName;
  }
  if (key === "prominence") {
    const byCount = b.appearances.length - a.appearances.length;
    const primary = dirPrimary ? byCount : -byCount;
    return primary || byName;
  }
  // relevance
  const bySig = SIG_RANK[a.significance] - SIG_RANK[b.significance];
  const primary = dirPrimary ? bySig : -bySig;
  return primary || byName;
}
