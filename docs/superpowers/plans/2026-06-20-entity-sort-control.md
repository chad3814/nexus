# Entity index sort control — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a Sort control (4 keys × direction toggle) to the entity index; default reproduces today's order.

**Tech Stack:** Next.js (client), TypeScript strict, Vitest + RTL. nexus only.

**Spec:** `docs/superpowers/specs/2026-06-20-entity-sort-control-design.md`

## Global Constraints

- No `any`/`unknown`. 2-space indent; semicolons. TypeScript strict. No control/NUL bytes.
- Default `relevance` / `dirPrimary=true` must reproduce the current significance-then-name order exactly.
- nexus only — no data/dossier/gating change. Existing unit + e2e stay green.
- Distance: ascending chapter-distance from cutoff (nearest first); `dirPrimary` picks Recent (latest appearance) vs First (earliest). For relevance/alphabetical/prominence, `dirPrimary=false` reverses.

---

## Task 1: `lib/entity-sort.ts` — pure sort module

**Files:** Create `lib/entity-sort.ts`; Create `test/entity-sort.test.ts`.

**Interfaces — Produces:** `SortKey`, `SIG_RANK`, `SORT_KEYS`, `dirLabel`, `chapterKeyOf`, `buildChapterIndex`, `cutoffChapterIndex`, `compareEntities`.

- [ ] **Step 1: Write the failing tests** `test/entity-sort.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildChapterIndex, chapterKeyOf, compareEntities, cutoffChapterIndex } from "@/lib/entity-sort";
import { FULL_SERIES } from "@/lib/position";
import type { RegistryEntity } from "@/lib/types";

const e = (id: string, name: string, sig: RegistryEntity["significance"], apps: string[]): RegistryEntity => ({
  id, canonicalName: name, aliases: [], type: "person", tags: [], significance: sig,
  description: "", firstAppearance: null, appearances: apps,
});
const books = [{ number: 3, chapters: ["C15", "C16", "C17"] }];
const idx = buildChapterIndex(books);
const ctx = { chapterIndex: idx, cutoffIdx: cutoffChapterIndex("B3·C17", idx) };
const sortBy = (arr: RegistryEntity[], k: any, p: boolean) => [...arr].sort((a, b) => compareEntities(a, b, k, p, ctx)).map((x) => x.id);

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
```

- [ ] **Step 2: Run to verify failure.** `npm test -- entity-sort` → FAIL (module missing).

- [ ] **Step 3: Implement** `lib/entity-sort.ts`:

```ts
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
  let r: number;
  if (key === "alphabetical") r = byName;
  else if (key === "prominence") r = b.appearances.length - a.appearances.length || byName;
  else r = SIG_RANK[a.significance] - SIG_RANK[b.significance] || byName;
  return dirPrimary ? r : -r;
}
```

- [ ] **Step 4: Run tests.** `npm test -- entity-sort` → PASS. `npm test` all pass; `npm run lint` clean; `npx tsc --noEmit -p tsconfig.json` clean. No NUL: `perl -ne 'print "NUL\n" if /\x00/' lib/entity-sort.ts test/entity-sort.test.ts` silent.

- [ ] **Step 5: Commit.** `git add lib/entity-sort.ts test/entity-sort.test.ts && git commit -m "entity-sort: pure comparator (relevance/alphabetical/prominence/distance + direction)"`

---

## Task 2: wire the Sort control into `EntityIndex` + `SeriesView`, verify, deploy

**Files:** Modify `components/EntityIndex.tsx`, `components/SeriesView.tsx`; Modify/create `test/entity-index.test.tsx`.

**Interfaces:** Consumes Task 1. `EntityIndex` gains props `cutoff: Cutoff` and `books: Array<{ number: number; chapters: string[] }>`.

- [ ] **Step 1: Write the failing component test** in `nexus/test/entity-index.test.tsx`:

```tsx
import { render, screen, within, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EntityIndex } from "@/components/EntityIndex";
import type { RegistryEntity } from "@/lib/types";

const e = (id: string, name: string, sig: RegistryEntity["significance"], apps: string[]): RegistryEntity => ({
  id, canonicalName: name, aliases: [], type: "person", tags: [], significance: sig,
  description: "", firstAppearance: null, appearances: apps,
});
const entities = [e("ann","Ann","minor",["B3·C16·¶1"]), e("carl","Carl","major",["B3·C17·¶1"]), e("zed","Zed","supporting",["B3·C15·¶1"])];
const books = [{ number: 3, chapters: ["C15","C16","C17"] }];
const names = () => screen.getAllByRole("link").map((l) => within(l).getByText(/Ann|Carl|Zed/).textContent);

describe("EntityIndex sort control", () => {
  it("defaults to relevance (significance then name) = today's order", () => {
    render(<EntityIndex entities={entities} seriesId="dcc" cutoff="B3·C17" books={books} />);
    expect(names()).toEqual(["Carl","Zed","Ann"]);
  });
  it("alphabetical sort reorders A→Z", () => {
    render(<EntityIndex entities={entities} seriesId="dcc" cutoff="B3·C17" books={books} />);
    fireEvent.change(screen.getByLabelText(/sort/i), { target: { value: "alphabetical" } });
    expect(names()).toEqual(["Ann","Carl","Zed"]);
  });
});
```

(If the existing `entity-index` test renders `<EntityIndex>` without the new props, update those render calls to pass `cutoff` + `books`.)

- [ ] **Step 2: Run to verify failure.** `npm test -- entity-index` → FAIL.

- [ ] **Step 3: Update `EntityIndex.tsx`:**
  - Imports: `import { compareEntities, dirLabel, SORT_KEYS, buildChapterIndex, cutoffChapterIndex, type SortKey } from "@/lib/entity-sort";` and add `Cutoff` to the type import. Remove the local `SIG_RANK` (now in entity-sort).
  - Props: add `cutoff: Cutoff;` and `books: Array<{ number: number; chapters: string[] }>;` to `EntityIndexProps`.
  - State: `const [sortKey, setSortKey] = useState<SortKey>("relevance"); const [dirPrimary, setDirPrimary] = useState(true);`
  - Memos: `const chapterIndex = useMemo(() => buildChapterIndex(books), [books]); const cutoffIdx = useMemo(() => cutoffChapterIndex(cutoff, chapterIndex), [cutoff, chapterIndex]);`
  - Replace the `.sort(...)` in `filtered` with `.sort((a, b) => compareEntities(a, b, sortKey, dirPrimary, { chapterIndex, cutoffIdx }))`, and add `sortKey, dirPrimary, chapterIndex, cutoffIdx` to the `useMemo` deps.
  - UI: in the filter row add a labeled Sort select + a direction toggle button:

```tsx
        <select
          aria-label="Sort"
          className="bg-surface border border-border rounded px-2 py-1 text-sm text-ink"
          value={sortKey}
          onChange={(ev) => { setSortKey(ev.target.value as SortKey); setDirPrimary(true); }}
        >
          {SORT_KEYS.map((s) => (<option key={s.key} value={s.key}>{s.label}</option>))}
        </select>
        <button
          type="button"
          aria-label="Sort direction"
          className="bg-surface border border-border rounded px-2 py-1 text-sm text-accent"
          onClick={() => setDirPrimary((p) => !p)}
        >
          {dirLabel(sortKey, dirPrimary)}
        </button>
```

- [ ] **Step 4: Update `SeriesView.tsx`** — pass the new props (line ~69):

```tsx
{view && <EntityIndex entities={view.entities} seriesId={seriesId} cutoff={cutoff} books={manifest.books} />}
```

- [ ] **Step 5: Verify gates.** `npm test` (all pass incl. new), `npm run lint` clean, `npx tsc --noEmit -p tsconfig.json` clean, `npm run export` succeeds, `npm run e2e` 4 pass, spoiler-safety `! grep -qi "Crawler #\|marine tech" out/dcc/entity/carl/index.html`.

- [ ] **Step 6: Commit.** `git add components/EntityIndex.tsx components/SeriesView.tsx test/entity-index.test.tsx && git commit -m "ui: sort control on entity index (relevance/alphabetical/prominence/distance)"`

- [ ] **Step 7: Deploy** (controller, with user approval): nexus-only, push nexus; verify live the index has a Sort control and Alphabetical/Distance reorder it.

---

## Self-Review

- **Spec coverage:** 4 keys + direction (T1 `compareEntities`) ✓ · default relevance/primary = today's order (T1 + T2 tests) ✓ · Distance Recent/First nearest-first via chapter index (T1) ✓ · `FULL_SERIES` → end (T1) ✓ · Sort dropdown + adaptive toggle (T2 UI + `dirLabel`) ✓ · EntityIndex props + SeriesView wiring (T2) ✓ · filters unchanged ✓ · gates + nexus-only deploy (T2) ✓.
- **Placeholder scan:** none — full module + UI shown.
- **Type consistency:** `compareEntities(a,b,key,dirPrimary,ctx)` with `ctx={chapterIndex,cutoffIdx}`, `SortKey` union, and the `books: {number,chapters[]}` shape match across `lib/entity-sort.ts`, `EntityIndex`, and `SeriesView` (which passes `manifest.books`).
```
