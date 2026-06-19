# nexus — Multi-Series Compendium Website — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public, fully-static Next.js site that presents `dossier` character compendiums with client-side, spoiler-gated reading-position views, multi-series, launching with DCC.

**Architecture:** Next.js App Router with `output: 'export'` (static). Pages are thin server wrappers exporting `generateStaticParams` (to emit per-series and per-entity shells) that render `"use client"` components; all compendium content is fetched and gated **in the browser** (spoiler-safe — no gated content in the HTML). A vendored pure `lib/gating.ts` (`viewAt`) does the gating. Deployed to GitHub Pages at `casefiles.nexus`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript (strict), Tailwind CSS, Vitest + React Testing Library (jsdom), Playwright (one e2e smoke), npm.

## Global Constraints

- TypeScript `strict`; **never** use `any` or `unknown` types. 2-space indentation; always end statements with semicolons.
- `next.config`: `output: 'export'`, `images: { unoptimized: true }`, `trailingSlash: true`. No `basePath` (served at custom-domain root).
- No server code: no API routes, no SSR/ISR, no server actions. All compendium content renders client-side.
- **Spoiler-safety invariant:** gated content (descriptions, aliases, appearances, the entity index list) must never appear in statically-emitted HTML — only in client-rendered output after the visitor sets a position.
- Data lives under `public/data/` (gitignored); never commit it. Source of truth is `casefiles`.
- Reading position default is **nothing set** (no content until chosen).
- Footer disclaimer on every page: "Unofficial fan project. Dungeon Crawler Carl © Matt Dinniman."

---

## File Structure

| Path | Responsibility |
|---|---|
| `next.config.mjs`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs` | config |
| `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts` | test config |
| `.github/workflows/deploy.yml` | build static export + deploy to GitHub Pages |
| `public/CNAME`, `public/.nojekyll` | Pages custom domain + bypass Jekyll |
| `scripts/sync-data.mjs` | copy `casefiles/<series>/…` JSON into `public/data/`; generate `series.json` |
| `lib/types.ts` | `Registry`, `RegistryEntity`, `DescriptionEvent`, `AliasEvent`, `SeriesManifest`, `Cutoff` |
| `lib/gating.ts` | pure: `anchorSortKey`, `normalizeAnchor`, `cmpAnchor`, `withinCutoff`, `cleanAliases`, `viewAt`, `deriveBooks` |
| `lib/data.ts` | client: load + memo-cache a series' three JSON files |
| `lib/position.ts` | reading-position: `parseCutoff`, `formatCutoff`, localStorage + URL helpers |
| `lib/series.ts` | build-time helpers to read `series.json` / entity ids for `generateStaticParams` |
| `app/layout.tsx` | root layout, header slot, footer disclaimer |
| `app/page.tsx` | series picker |
| `app/[series]/page.tsx` + `SeriesView.tsx` | position picker → gated entity index |
| `app/[series]/entity/[id]/page.tsx` + `EntityView.tsx` | gated entity detail |
| `components/PositionPicker.tsx`, `PositionBar.tsx`, `EntityIndex.tsx`, `EntityDetail.tsx` | UI |
| `test/*.test.ts(x)`, `e2e/smoke.spec.ts` | tests |

---

## Task 1: Scaffold the static Next.js app

**Files:** `package.json`, `next.config.mjs`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `public/.nojekyll`, `public/CNAME`, `vitest.config.ts`, `vitest.setup.ts`.

**Interfaces:** Produces a building static export and a runnable test harness for all later tasks.

- [ ] **Step 1: Scaffold.** From `/Users/cwalker/Projects/nexus` run:

```bash
npx create-next-app@latest . --ts --app --tailwind --eslint --src-dir=false --import-alias "@/*" --no-turbopack --use-npm --yes
```

- [ ] **Step 2: Configure static export.** Replace `next.config.*` with `next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};
export default nextConfig;
```

- [ ] **Step 3: Pages config.** Create `public/.nojekyll` (empty file) and `public/CNAME` containing exactly `casefiles.nexus`.

- [ ] **Step 4: Root layout + footer.** Set `app/layout.tsx` to render `{children}` inside a `<body>` with a `<footer>` containing the disclaimer text from Global Constraints. Replace `app/page.tsx` body with a placeholder `<h1>nexus</h1>` (replaced in Task 5).

- [ ] **Step 5: Test harness.** `npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom`. Create `vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", setupFiles: ["./vitest.setup.ts"], globals: true },
  resolve: { alias: { "@": new URL(".", import.meta.url).pathname } },
});
```

`vitest.setup.ts`: `import "@testing-library/jest-dom/vitest";`. Add `"test": "vitest run"` and `"export": "next build"` to `package.json` scripts.

- [ ] **Step 6: Verify build + tests.** Run `npm run export` → Expected: completes, creates `out/index.html`. Run `npm test` → Expected: "No test files found" (exit 0) — harness works.

- [ ] **Step 7: Commit.**

```bash
git add -A && git commit -m "scaffold static Next.js app (output: export) + test harness + Pages config"
```

---

## Task 2: Types + pure gating engine (`viewAt`)

**Files:** Create `lib/types.ts`, `lib/gating.ts`, `test/gating.test.ts`.

**Interfaces:**
- Produces `viewAt(registry: Registry, opts: { through?: Cutoff; descriptions?: DescriptionEvent[]; aliases?: AliasEvent[] }): Registry`, `withinCutoff(anchor: string, cutoff?: Cutoff): boolean`, `anchorSortKey(anchor: string): [number, number, number]`, `deriveBooks(registry: Registry): Array<{ number: number; chapters: string[] }>`. Types in `lib/types.ts`.
- These mirror `dossier`'s `src/log.ts`/`src/registry.ts` logic (registry-level), vendored here for a clean browser build.

- [ ] **Step 1: Types.** `lib/types.ts`:

```ts
export type Significance = "major" | "supporting" | "minor" | "mentioned";
export type EntityType = "person" | "creature" | "faction" | "ai_system" | "place" | "other";
export type EntityTag = "in_world" | "real_world_ref" | "media_ref" | "item_object";
export interface Appearance { anchor: string; snippet: string; }
export interface RegistryEntity {
  id: string;
  canonicalName: string;
  aliases: string[];
  type: EntityType;
  tags: EntityTag[];
  significance: Significance;
  description: string;
  firstAppearance: Appearance | null;
  appearances: string[];
}
export interface Registry { booksProcessed: number[]; entities: RegistryEntity[]; }
export interface DescriptionEvent { id: string; anchor: string; description: string; significance: Significance; }
export interface AliasEvent { id: string; anchor: string; alias: string; }
export type Cutoff = string;
export interface SeriesManifest {
  id: string;
  title: string;
  author: string;
  books: Array<{ number: number; chapters: string[] }>;
}
```

- [ ] **Step 2: Failing test.** `test/gating.test.ts`:

```ts
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
```

- [ ] **Step 2b: Run → FAIL** (`@/lib/gating` not found). `npx vitest run test/gating.test.ts`.

- [ ] **Step 3: Implement `lib/gating.ts`.**

```ts
import type { AliasEvent, Cutoff, DescriptionEvent, Registry, RegistryEntity } from "@/lib/types";

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[‘’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/** Strip surrounding brackets/whitespace, yielding a clean `B1·C3·¶5`. */
export function normalizeAnchor(anchor: string): string {
  const m = anchor.match(/B\d+·[^\s[\]]+·¶\d+/);
  return m ? m[0] : anchor.replace(/[[\]\s]/g, "");
}

/** Reading-order sort key: [book, sectionOrder, paragraph]. */
export function anchorSortKey(anchor: string): [number, number, number] {
  const parts = normalizeAnchor(anchor).split("·");
  const book = Number.parseInt((parts[0] ?? "").replace(/\D/g, ""), 10) || 0;
  const label = parts[1] ?? "";
  const para = Number.parseInt((parts[2] ?? "").replace(/\D/g, ""), 10) || 0;
  let order: number;
  if (/^C\d+$/i.test(label)) order = Number.parseInt(label.slice(1), 10);
  else if (/^Part\d+$/i.test(label)) order = -1;
  else {
    const special: Record<string, number> = { epigraph: -4, prologue: -3, interlude: -2, epilogue: 9000 };
    order = special[label.toLowerCase()] ??
      (/^Sec\d+/i.test(label) ? 10000 + (Number.parseInt(label.replace(/\D/g, ""), 10) || 0) : 8000);
  }
  return [book, order, para];
}

export function cmpAnchor(a: string, b: string): number {
  const ka = anchorSortKey(a);
  const kb = anchorSortKey(b);
  return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
}

/** Inclusive: a chapter cutoff ("B2·C4") includes the whole chapter; no cutoff ⇒ always true. */
export function withinCutoff(anchor: string, cutoff?: Cutoff): boolean {
  if (!cutoff) return true;
  const a = anchorSortKey(anchor);
  const k = anchorSortKey(cutoff);
  const cutoffPara = cutoff.includes("¶") ? k[2] : Number.POSITIVE_INFINITY;
  if (a[0] !== k[0]) return a[0] < k[0];
  if (a[1] !== k[1]) return a[1] < k[1];
  return a[2] <= cutoffPara;
}

export function cleanAliases(canonicalName: string, aliases: string[]): string[] {
  const canon = normalizeName(canonicalName);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of aliases) {
    const n = normalizeName(a);
    if (!n || n === canon || seen.has(n)) continue;
    seen.add(n);
    out.push(a);
  }
  return out;
}

function sortAnchors(anchors: string[]): string[] {
  return [...anchors].map(normalizeAnchor).sort(cmpAnchor);
}

/**
 * Gate a registry to a reading position. Returns a new Registry containing only entities whose
 * earliest appearance ≤ `through`, each with appearances ≤ `through`, and — when description/
 * alias event streams are supplied — the processed-keyed overlay: an entity with ≥1 event in a
 * stream shows only events ≤ cutoff (description: latest; aliases: all ≤ cutoff), else keeps its
 * blob value. Pure; safe for the browser.
 */
export function viewAt(
  registry: Registry,
  opts: { through?: Cutoff; descriptions?: DescriptionEvent[]; aliases?: AliasEvent[] } = {},
): Registry {
  const { through, descriptions, aliases } = opts;

  const descLatest = new Map<string, DescriptionEvent>();
  const descProcessed = new Set<string>();
  for (const ev of descriptions ?? []) {
    descProcessed.add(ev.id);
    if (!withinCutoff(ev.anchor, through)) continue;
    const cur = descLatest.get(ev.id);
    if (!cur || cmpAnchor(ev.anchor, cur.anchor) > 0) descLatest.set(ev.id, ev);
  }
  const aliasCollect = new Map<string, string[]>();
  const aliasProcessed = new Set<string>();
  for (const ev of aliases ?? []) {
    aliasProcessed.add(ev.id);
    if (!withinCutoff(ev.anchor, through)) continue;
    (aliasCollect.get(ev.id) ?? aliasCollect.set(ev.id, []).get(ev.id)!).push(ev.alias);
  }

  const entities: RegistryEntity[] = [];
  for (const e of registry.entities) {
    const kept = sortAnchors(e.appearances.filter((a) => withinCutoff(a, through)));
    if (kept.length === 0) continue; // earliest appearance is after the cutoff → not introduced yet
    const next: RegistryEntity = { ...e, appearances: kept };
    if (descProcessed.has(e.id)) {
      const ev = descLatest.get(e.id);
      next.description = ev ? ev.description : "";
      if (ev) next.significance = ev.significance;
    }
    if (aliasProcessed.has(e.id)) {
      next.aliases = cleanAliases(e.canonicalName, aliasCollect.get(e.id) ?? []);
    }
    entities.push(next);
  }
  entities.sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));
  const booksProcessed = [...new Set(entities.flatMap((e) => e.appearances).map((a) => anchorSortKey(a)[0]))].sort((x, y) => x - y);
  return { booksProcessed, entities };
}

/** Per-book ordered chapter labels, derived from the registry's appearance anchors. */
export function deriveBooks(registry: Registry): Array<{ number: number; chapters: string[] }> {
  const byBook = new Map<number, Set<string>>();
  for (const e of registry.entities) {
    for (const raw of e.appearances) {
      const a = normalizeAnchor(raw);
      const parts = a.split("·");
      const book = Number.parseInt((parts[0] ?? "").replace(/\D/g, ""), 10) || 0;
      const label = parts[1] ?? "";
      if (!book || !label) continue;
      (byBook.get(book) ?? byBook.set(book, new Set()).get(book)!).add(label);
    }
  }
  return [...byBook.keys()].sort((a, b) => a - b).map((number) => ({
    number,
    chapters: [...byBook.get(number)!].sort((x, y) => cmpAnchor(`B${number}·${x}·¶1`, `B${number}·${y}·¶1`)),
  }));
}
```

- [ ] **Step 4: Run → PASS.** `npx vitest run test/gating.test.ts`. Then `npm run lint` (clean — no `any`).
- [ ] **Step 5: Commit.** `git add lib test && git commit -m "lib: types + pure viewAt gating engine (vendored from dossier)"`

---

## Task 3: `sync-data` script + `series.json` derivation

**Files:** Create `scripts/sync-data.mjs`, `test/series-manifest.test.ts`; add `lib/manifest.ts` (pure `buildSeriesManifest`).

**Interfaces:** Consumes `viewAt`/`deriveBooks` indirectly via `lib/gating`. Produces `buildSeriesManifest(series, registry): SeriesManifest`. The script writes `public/data/<series>/{registry,descriptions,aliases}.json` + `public/data/series.json`.

- [ ] **Step 1: Failing test** for the pure manifest builder. `test/series-manifest.test.ts`:

```ts
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
```

- [ ] **Step 2: Run → FAIL.** `npx vitest run test/series-manifest.test.ts`.

- [ ] **Step 3: Implement `lib/manifest.ts`.**

```ts
import { deriveBooks } from "@/lib/gating";
import type { Registry, SeriesManifest } from "@/lib/types";

export function buildSeriesManifest(
  meta: { id: string; title: string; author: string },
  registry: Registry,
): SeriesManifest {
  return { ...meta, books: deriveBooks(registry) };
}
```

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Implement `scripts/sync-data.mjs`.** Reads from a `casefiles` checkout (default sibling `../casefiles`, overridable via `CASEFILES_DIR`). For each configured series, copies its three JSON files and builds the manifest. Uses a small inline `SERIES` table (the only per-series config):

```js
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSeriesManifest } from "../lib/manifest.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const casefiles = process.env.CASEFILES_DIR ?? join(root, "..", "casefiles");

// Per-series config: where each series' files live under casefiles, + display metadata.
const SERIES = [
  { id: "dcc", title: "Dungeon Crawler Carl", author: "Matt Dinniman",
    registry: "dcc/output/registry.json", descriptions: "dcc/log/descriptions.json", aliases: "dcc/log/aliases.json" },
];

const manifests = [];
for (const s of SERIES) {
  const src = (p) => join(casefiles, p);
  for (const f of [s.registry, s.descriptions, s.aliases]) {
    if (!existsSync(src(f))) throw new Error(`sync-data: missing ${src(f)} (set CASEFILES_DIR?)`);
  }
  const outDir = join(root, "public", "data", s.id);
  mkdirSync(outDir, { recursive: true });
  cpSync(src(s.registry), join(outDir, "registry.json"));
  cpSync(src(s.descriptions), join(outDir, "descriptions.json"));
  cpSync(src(s.aliases), join(outDir, "aliases.json"));
  const registry = JSON.parse(readFileSync(src(s.registry), "utf8"));
  manifests.push(buildSeriesManifest({ id: s.id, title: s.title, author: s.author }, registry));
  console.log(`synced ${s.id}: ${registry.entities.length} entities`);
}
mkdirSync(join(root, "public", "data"), { recursive: true });
writeFileSync(join(root, "public", "data", "series.json"), JSON.stringify(manifests, null, 2));
console.log(`wrote series.json (${manifests.length} series)`);
```

Add `"sync-data": "tsx scripts/sync-data.mjs"` to `package.json` scripts and `npm i -D tsx`. (`.mjs` importing a `.ts` runs under `tsx`.)

- [ ] **Step 6: Run for real.** `npm run sync-data` → Expected: `synced dcc: 3824 entities` + `wrote series.json (1 series)`; `public/data/dcc/*.json` and `public/data/series.json` exist.

- [ ] **Step 7: Commit.** `git add scripts lib/manifest.ts test/series-manifest.test.ts package.json package-lock.json && git commit -m "data: sync-data script + series.json manifest derivation"`

---

## Task 4: Client data loading + reading-position state

**Files:** Create `lib/data.ts`, `lib/position.ts`, `test/position.test.ts`.

**Interfaces:**
- Produces `loadSeries(id): Promise<{ registry; descriptions; aliases }>` (fetches `/data/<id>/*.json`, memo-cached).
- Produces `parseCutoff(s): Cutoff | null`, `formatCutoff(c): string`, `FULL_SERIES` sentinel, and `readPosition(seriesId)` / `writePosition(seriesId, cutoff)` (localStorage).

- [ ] **Step 1: Failing test.** `test/position.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { FULL_SERIES, formatCutoff, parseCutoff, readPosition, writePosition } from "@/lib/position";

describe("cutoff parse/format", () => {
  it("round-trips a B·C cutoff", () => {
    expect(parseCutoff("B3·C5")).toBe("B3·C5");
    expect(formatCutoff("B3·C5")).toBe("Book 3 · C5");
  });
  it("treats FULL_SERIES as no cutoff (undefined through)", () => {
    expect(formatCutoff(FULL_SERIES)).toBe("Everything");
  });
  it("rejects malformed input", () => {
    expect(parseCutoff("garbage")).toBeNull();
  });
});

describe("localStorage position (per series)", () => {
  beforeEach(() => localStorage.clear());
  it("writes and reads per series", () => {
    writePosition("dcc", "B2·C4");
    expect(readPosition("dcc")).toBe("B2·C4");
    expect(readPosition("vending")).toBeNull();
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `lib/position.ts`.**

```ts
import type { Cutoff } from "@/lib/types";

/** Sentinel meaning "show everything" (full series — no gating). */
export const FULL_SERIES = "__all__";

export function parseCutoff(s: string | null): Cutoff | null {
  if (!s) return null;
  if (s === FULL_SERIES) return FULL_SERIES;
  return /^B\d+·\S+$/.test(s) ? s : null;
}

export function formatCutoff(c: Cutoff): string {
  if (c === FULL_SERIES) return "Everything";
  const [book, label] = c.split("·");
  return `Book ${book.replace("B", "")} · ${label}`;
}

/** The value to pass to viewAt as `through`: undefined for full series, else the cutoff. */
export function throughOf(c: Cutoff): Cutoff | undefined {
  return c === FULL_SERIES ? undefined : c;
}

const key = (seriesId: string): string => `nexus.position.${seriesId}`;
export function readPosition(seriesId: string): Cutoff | null {
  if (typeof localStorage === "undefined") return null;
  return parseCutoff(localStorage.getItem(key(seriesId)));
}
export function writePosition(seriesId: string, cutoff: Cutoff): void {
  localStorage.setItem(key(seriesId), cutoff);
}
```

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Implement `lib/data.ts`** (no test — thin fetch wrapper, covered by e2e):

```ts
import type { AliasEvent, DescriptionEvent, Registry } from "@/lib/types";

export interface SeriesData { registry: Registry; descriptions: DescriptionEvent[]; aliases: AliasEvent[]; }
const cache = new Map<string, Promise<SeriesData>>();

export function loadSeries(id: string): Promise<SeriesData> {
  const existing = cache.get(id);
  if (existing) return existing;
  const p = (async () => {
    const [registry, descriptions, aliases] = await Promise.all([
      fetch(`/data/${id}/registry.json`).then((r) => r.json() as Promise<Registry>),
      fetch(`/data/${id}/descriptions.json`).then((r) => r.json() as Promise<DescriptionEvent[]>),
      fetch(`/data/${id}/aliases.json`).then((r) => r.json() as Promise<AliasEvent[]>),
    ]);
    return { registry, descriptions, aliases };
  })();
  cache.set(id, p);
  return p;
}
```

- [ ] **Step 6: Commit.** `git add lib/data.ts lib/position.ts test/position.test.ts && git commit -m "lib: client data loading + per-series reading-position state"`

---

## Task 5: Series picker (`/`) + build-time series helpers

**Files:** Create `lib/series.ts`; replace `app/page.tsx`; create `components/SeriesPicker.tsx`, `test/series-picker.test.tsx`.

**Interfaces:** Consumes `series.json`. Produces `readSeriesManifest(): SeriesManifest[]` (build-time fs read) and `readEntityIds(seriesId): string[]` for `generateStaticParams`.

- [ ] **Step 1: `lib/series.ts`** (build-time only; uses `node:fs`, never imported by client components):

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Registry, SeriesManifest } from "@/lib/types";

const dataDir = join(process.cwd(), "public", "data");
export function readSeriesManifest(): SeriesManifest[] {
  return JSON.parse(readFileSync(join(dataDir, "series.json"), "utf8")) as SeriesManifest[];
}
export function readEntityIds(seriesId: string): string[] {
  const reg = JSON.parse(readFileSync(join(dataDir, seriesId, "registry.json"), "utf8")) as Registry;
  return reg.entities.map((e) => e.id);
}
```

- [ ] **Step 2: Failing component test.** `test/series-picker.test.tsx` renders `<SeriesPicker series={[{id:"dcc",title:"Dungeon Crawler Carl",author:"Matt Dinniman",books:[]}]} />` and asserts a link to `/dcc/` with the title text. `npx vitest run test/series-picker.test.tsx` → FAIL.

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SeriesPicker } from "@/components/SeriesPicker";

describe("SeriesPicker", () => {
  it("lists each series linking to its route", () => {
    render(<SeriesPicker series={[{ id: "dcc", title: "Dungeon Crawler Carl", author: "Matt Dinniman", books: [] }]} />);
    const link = screen.getByRole("link", { name: /Dungeon Crawler Carl/ });
    expect(link).toHaveAttribute("href", "/dcc/");
  });
});
```

- [ ] **Step 3: Implement `components/SeriesPicker.tsx`** (presentational, no client state): maps series to `<Link href={'/' + s.id + '/'}>` cards showing title + author.

- [ ] **Step 4: `app/page.tsx`** (server component): `const series = readSeriesManifest();` → `<SeriesPicker series={series} />`. Heading "Choose a series."

- [ ] **Step 5: Run → PASS**; `npm run export` → Expected: `out/index.html` lists DCC.
- [ ] **Step 6: Commit.** `git add lib/series.ts app/page.tsx components/SeriesPicker.tsx test/series-picker.test.tsx && git commit -m "feat: series picker landing page"`

---

## Task 6: Series view — position picker → gated entity index (`/[series]`)

**Files:** Create `app/[series]/page.tsx`, `components/SeriesView.tsx`, `components/PositionPicker.tsx`, `components/PositionBar.tsx`, `components/EntityIndex.tsx`; tests `test/series-view.test.tsx`.

**Interfaces:** Consumes `loadSeries`, `viewAt`, `throughOf`, `readPosition`/`writePosition`, `SeriesManifest`. The page passes `seriesId` + that series' `SeriesManifest` (from `series.json`) to the client `SeriesView`.

- [ ] **Step 1: `app/[series]/page.tsx`** (server): exports `generateStaticParams` from `readSeriesManifest().map((s) => ({ series: s.id }))`; reads the manifest, finds the matching series, and renders `<SeriesView seriesId={params.series} manifest={manifest} />`. Wrap in `<Suspense>` (required because `SeriesView` uses `useSearchParams`).

- [ ] **Step 2: Failing test.** `test/series-view.test.tsx`: render `SeriesView` with a stubbed `loadSeries` (vi.mock) returning a 2-entity registry where one entity first-appears in B2; with no saved position it shows the picker (assert "Where are you" text, no entity links); after selecting B1·C99 it shows only the B1 entity. (Mock `next/navigation` `useSearchParams`/`useRouter`.) → FAIL.

- [ ] **Step 3: Implement `components/PositionPicker.tsx`** (`"use client"`): given `manifest.books`, renders a Book `<select>` and a Chapter `<select>` (chapters of the chosen book) + an "I've finished — show everything" button. On submit calls `onChoose(cutoff)` with `B<n>·<label>` or `FULL_SERIES`.

- [ ] **Step 4: Implement `components/EntityIndex.tsx`** (`"use client"`): props `entities: RegistryEntity[]`, `seriesId`. Client-side search box (filters by canonicalName/alias substring), filter selects (type, significance, tag), and a list of `<Link href={'/' + seriesId + '/entity/' + e.id + '/'}>` rows showing name · type · significance. Sorted by significance rank then name.

- [ ] **Step 5: Implement `components/PositionBar.tsx`** (`"use client"`): sticky header showing `formatCutoff(current)` with a "Change" button that reopens the picker.

- [ ] **Step 6: Implement `components/SeriesView.tsx`** (`"use client"`): the orchestrator.
  - On mount: `const [cutoff, setCutoff] = useState<Cutoff | null>(parseCutoff(searchParams.get("through")) ?? readPosition(seriesId));`
  - If `cutoff === null` → render `<PositionPicker manifest={manifest} onChoose={choose} />` and nothing else.
  - `choose(c)`: `writePosition(seriesId, c)`, update URL (`router.replace('?through=' + encodeURIComponent(c))`), `setCutoff(c)`.
  - When `cutoff` set: `useEffect` loads `loadSeries(seriesId)` into state; while loading show a spinner. Then `const view = useMemo(() => viewAt(data.registry, { through: throughOf(cutoff), descriptions: data.descriptions, aliases: data.aliases }), [data, cutoff]);` and render `<PositionBar .../>` + `<EntityIndex entities={view.entities} seriesId={seriesId} />`.

- [ ] **Step 7: Run → PASS**; `npm run export` (Expected: emits `out/dcc/index.html` shell, no entity content in it — grep to confirm spoiler-safety: `! grep -q "Crawler #4,122" out/dcc/index.html`).
- [ ] **Step 8: Commit.** `git add app/\[series\] components test/series-view.test.tsx && git commit -m "feat: per-series position picker + gated entity index"`

---

## Task 7: Entity detail (`/[series]/entity/[id]`)

**Files:** Create `app/[series]/entity/[id]/page.tsx`, `components/EntityView.tsx`, `components/EntityDetail.tsx`; test `test/entity-detail.test.tsx`.

**Interfaces:** Consumes `loadSeries`, `viewAt`, the version event streams (for the timeline), position helpers.

- [ ] **Step 1: `app/[series]/entity/[id]/page.tsx`** (server): exports `generateStaticParams` = `readSeriesManifest().flatMap((s) => readEntityIds(s.id).map((id) => ({ series: s.id, id })))`. Renders `<EntityView seriesId={params.series} entityId={params.id} manifest={manifest} />` inside `<Suspense>`.

- [ ] **Step 2: Failing test.** `test/entity-detail.test.tsx`: render `EntityDetail` (presentational) with a gated entity + its description-version list through a cutoff; assert it shows the canonical name, the as-of description, gated aliases, and grouped appearances; and that a version with anchor beyond the cutoff is absent. → FAIL.

- [ ] **Step 3: Implement `components/EntityDetail.tsx`** (presentational): props `{ entity: RegistryEntity; versions: DescriptionEvent[]; cutoff: Cutoff }`. Renders name, type/tags/significance, current `entity.description`, `entity.aliases` (gated), appearances grouped by `B·label` (reuse `anchorSortKey` ordering), first appearance, and a collapsible "description history" listing `versions` (those ≤ cutoff) with their anchors.

- [ ] **Step 4: Implement `components/EntityView.tsx`** (`"use client"`): resolves cutoff like `SeriesView` (URL → localStorage); if none, prompt to set position (link back to `/[series]/`). Loads series data; computes `const view = viewAt(...)`; finds the entity by id. **Beyond-cutoff handling:** if the entity isn't in `view.entities` (its earliest appearance is after the cutoff), render "This character hasn't appeared yet at your reading position." (no details — spoiler-safe). Else pass the entity + its `descriptions.filter((d) => d.id === id && withinCutoff(d.anchor, throughOf(cutoff)))` to `EntityDetail`.

- [ ] **Step 5: Run → PASS**; `npm run export` (Expected: emits `out/dcc/entity/carl/index.html` shell; confirm no description text in shell).
- [ ] **Step 6: Commit.** `git add app components test/entity-detail.test.tsx && git commit -m "feat: gated entity detail page with description history"`

---

## Task 8: GitHub Pages deploy workflow + e2e smoke + final verification

**Files:** Create `.github/workflows/deploy.yml`, `playwright.config.ts`, `e2e/smoke.spec.ts`.

- [ ] **Step 1: Deploy workflow.** Create `.github/workflows/deploy.yml`. The data is NOT in the repo; CI clones the private `casefiles` read-only via an SSH deploy key (private key stored as the nexus repo secret `CASEFILES_DEPLOY_KEY`), runs `sync-data`, builds the static export, and deploys `out/` to Pages. The clone is shallow + non-recursive (only `casefiles`' own data files are needed; its `dossier` submodule is not):

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.CASEFILES_DEPLOY_KEY }}
      - name: Clone casefiles data (read-only deploy key)
        run: git clone --depth 1 git@github.com:chad3814/casefiles.git ../casefiles
      - name: Sync data
        run: npm run sync-data
        env:
          CASEFILES_DIR: ../casefiles
      - run: npm run export
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: out
      - id: deploy
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Playwright smoke.** `npm i -D @playwright/test && npx playwright install --with-deps chromium`. `playwright.config.ts`: `webServer` runs `npx serve out -l 4321` after `npm run sync-data && npm run export`, `baseURL: http://localhost:4321`. `e2e/smoke.spec.ts`:
  - visit `/dcc/` → expect "Where are you" visible, expect no link to `/dcc/entity/`.
  - choose Book 1 / C1 → expect entity links appear; expect Carl present.
  - open Carl → expect a description; expect the page does NOT contain `Crawler #4,122` (gated out at B1·C1).
  - change position to "Everything" → reopen Carl → expect `Crawler #4,122` present.

- [ ] **Step 3: Run e2e.** `npx playwright test` → PASS. Add `"e2e": "playwright test"` to scripts.

- [ ] **Step 4: Full gate.** `npm run lint && npm test && npm run export && npm run e2e` → all green.

- [ ] **Step 5: Commit.** `git add .github playwright.config.ts e2e package.json package-lock.json && git commit -m "ci: GitHub Pages deploy workflow + Playwright smoke"`

---

## Task 9: Create GitHub repo + push + enable Pages (requires explicit go-ahead)

- [ ] **Step 1:** With the user's explicit approval: `gh repo create chad3814/nexus --public --source=. --remote=origin --push` (or push to the pre-set `origin`). 
- [ ] **Step 2:** Configure repo: Settings → Pages → Source "GitHub Actions"; add `CASEFILES_DEPLOY_KEY` secret (read-only deploy key for `casefiles`); set the custom domain `casefiles.nexus` (the `CNAME` file handles this) and the DNS `CNAME`/`A` records at the domain registrar.
- [ ] **Step 3:** Confirm the Actions deploy succeeds and `https://casefiles.nexus` serves the site.

---

## Self-Review

- **Spec coverage:** static Next export (T1) ✓ · pure `viewAt` gating + browser-safe (T2) ✓ · per-series data + `series.json` from anchors (T3) ✓ · client load + per-series position, default-nothing (T4, T6) ✓ · series picker (T5) ✓ · position picker + gated index, search/filter (T6) ✓ · entity detail + timeline + beyond-cutoff handling (T7) ✓ · spoiler-safety (no gated content in HTML — verified via grep in T6/T7 + e2e) ✓ · GitHub Pages + custom domain + Actions (T8, T9) ✓ · copyright footer (T1) ✓ · testing unit+component+e2e (throughout) ✓ · multi-series structure (routing/data/position all keyed by series; launch DCC-only) ✓.
- **Placeholder scan:** No TBD/TODO. One area flagged for an implementation decision, not left vague: **CI data access** (Task 8 Step 1) — casefiles is private, so CI clones it via a deploy-key secret; the concrete mechanism is specified.
- **Type consistency:** `viewAt(registry, { through?, descriptions?, aliases? })`, `Cutoff`, `FULL_SERIES`/`throughOf`, `SeriesManifest`, `loadSeries`, `readSeriesManifest`/`readEntityIds`, `buildSeriesManifest` used consistently across tasks. `lib/series.ts` (node:fs) is build-time only and never imported by `"use client"` components (which use `loadSeries` fetch instead) — preserving the static-export/browser split.
