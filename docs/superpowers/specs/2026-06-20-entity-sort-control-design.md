# Entity index sort control — design

**Date:** 2026-06-20
**Status:** Approved (design)
**Repo:** `nexus` (client-side only — no data/dossier change)
**Issue:** chad3814/nexus#1
**Related:** `docs/superpowers/specs/2026-06-18-nexus-website-design.md`

## Problem

The entity index sorts by significance-rank then name, with no user control. Significance is
gated/versioned and noisy, so the ordering is surprising and re-shuffles with reading position
(nexus#1). Give the reader an explicit, togglable sort.

## Decision

Add a **Sort** control to the filter row: a sort-key dropdown + an adaptive direction toggle.
Four keys, each with two directions (8 orderings):

| Key | Direction toggle | Ordering |
|---|---|---|
| **Relevance** *(default)* | Most ↔ Least | significance-rank then name (today's order = "Most first") |
| **Alphabetical** | A→Z ↔ Z→A | canonical name |
| **Prominence** | Most ↔ Fewest | appearance count, then name |
| **Distance** | Recent ↔ First | shortest chapter-distance from the cutoff, **always nearest-first**; the toggle selects which appearance to measure |

**Default:** `relevance` / primary ("Most first") — byte-identical to today's order, so nothing
changes until the reader picks a sort.

**Distance semantics:** for cutoff `B3·C17`, **Recent** measures each entity's *latest*
appearance ≤ cutoff (entities in C17 first, then C16, C15…); **First** measures each entity's
*earliest* appearance (entities first-introduced in C17 first, then C16…). Both sort ascending
by chapter-distance with name as tiebreak. At "Everything" the cutoff chapter is the series end.

## Architecture

### `lib/entity-sort.ts` (new, pure, tested)

- `type SortKey = "relevance" | "alphabetical" | "prominence" | "distance"`.
- `SORT_KEYS` / direction labels: a map from `(key)` → `{ primary: string; secondary: string }`
  for the toggle (`relevance → {Most first, Least first}`, `alphabetical → {A→Z, Z→A}`,
  `prominence → {Most first, Fewest first}`, `distance → {Recent, First}`).
- `buildChapterIndex(books: Array<{ number: number; chapters: string[] }>): Map<string, number>` —
  flatten books (ascending `number`) into a global ordered list of `B<n>·<label>` keys → index.
- `chapterKeyOf(anchor: string): string` — the `B<n>·<label>` prefix of an anchor.
- `cutoffChapterIndex(cutoff: Cutoff, chapterIndex: Map<string,number>): number` — the index of
  the cutoff's `B<n>·<label>`; for `FULL_SERIES`, the max index (series end).
- `compareEntities(a, b, key, dirPrimary, ctx): number` where
  `ctx = { chapterIndex: Map<string,number>; cutoffIdx: number }`. `dirPrimary` is a single
  boolean; for relevance/alphabetical/prominence it flips ascending/descending, for distance it
  selects Recent (latest appearance) vs First (earliest). Semantics:
  - **relevance:** `SIG_RANK[a]-SIG_RANK[b]` then `name.localeCompare`; reversed when `!dirPrimary`.
  - **alphabetical:** `name.localeCompare`; reversed when `!dirPrimary`.
  - **prominence:** `b.appearances.length - a.appearances.length` then name; reversed when `!dirPrimary`.
  - **distance:** for each entity compute its chapter index — Recent (`dirPrimary`) = max
    `chapterKeyOf` index over its appearances; First (`!dirPrimary`) = min — then
    `distance = cutoffIdx - entityIdx` (≥ 0); sort ascending by distance, name tiebreak. An
    appearance whose chapter isn't in the index sorts last.

`SIG_RANK` moves into this module (currently inline in `EntityIndex`).

### `components/EntityIndex.tsx`

- New props: `cutoff: Cutoff` and `books: Array<{ number: number; chapters: string[] }>`.
- State: `sortKey` (default `"relevance"`) and `dirPrimary` (default `true`). Switching the key
  resets `dirPrimary` to `true` (each key's sensible default).
- `useMemo`: `chapterIndex = buildChapterIndex(books)`, `cutoffIdx = cutoffChapterIndex(cutoff, chapterIndex)`,
  and the sorted/filtered list via `compareEntities`.
- UI: in the existing filter row, a **Sort** `<select>` (the 4 keys) + a direction **toggle
  button** whose label is the current `(key, dirPrimary)` from the labels map; clicking flips
  `dirPrimary`. Filters (search/type/significance/tag) unchanged.

### `components/SeriesView.tsx`

- Pass `cutoff={cutoff}` and `books={manifest.books}` to `<EntityIndex>` (both already in scope;
  `cutoff` is non-null past the picker guard).

## Testing

- **`lib/entity-sort` unit:** `compareEntities` for all 4 keys × both directions, including
  Distance Recent vs First against a fixed `cutoff` + `books` fixture (assert nearest-first and
  that Recent vs First pick different appearances); `buildChapterIndex`/`chapterKeyOf`/
  `cutoffChapterIndex` (incl. `FULL_SERIES` → end). Relevance/primary reproduces today's order.
- **`EntityIndex` component:** default render matches current order; changing the Sort dropdown
  and toggling direction reorders the list (e.g. Alphabetical Z→A, Distance Recent).
- Existing unit + e2e stay green; nexus-only, no data change.

## Non-goals

- Persisting the chosen sort (resets per visit).
- Changing filters, significance data, or any gating logic.
- Server/data changes.
