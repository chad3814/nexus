# nexus — multi-series spoiler-gated compendium website — design

**Date:** 2026-06-18
**Status:** Approved (design)
**Repo:** `nexus` (new, public) — `/Users/cwalker/Projects/nexus`, `github.com/chad3814/nexus`
**Domain:** casefiles.nexus
**Related:** `dossier` (engine), `casefiles` (data umbrella)

## Overview

`nexus` is a public, static website that makes the `dossier`-generated character
compendiums browsable, with **spoiler-gated** reading-position views. A visitor picks where
they are in a series (book + chapter) and sees only what an attentive reader would know at
that point — every entity's appearances, aliases, and description bounded to that position.
It is **multi-series**: DCC is the launch series; others (e.g. the vending series) are added
later by dropping in their data.

The gating is a pure function of static data, so the site needs **no server** — it ships
static JSON and computes the gated view in the browser.

## Goals

- Browse any series' cast, gated to a chosen reading position (spoiler-safe).
- **Spoiler-safe by default:** nothing renders until the visitor sets their position.
- Multi-series from day one (structure), launching with DCC.
- Fully static deploy (Next.js `output: 'export'`); no server, no API.
- Reuse `dossier`'s gating logic — one implementation, shared.

## Non-goals

- Server-side rendering of compendium content (would put spoilers in the HTML — see
  Routing). No SSR/ISR, no API routes.
- Editing/CMS, accounts, comments, or any write path.
- SEO of spoiler content (intentionally given up; gated content is not in the HTML).
- Generating the compendium data (that's `dossier`/`casefiles`); `nexus` only presents it.

## Decisions (from brainstorming)

- **Audience:** public fan resource (open deploy).
- **Framework:** Next.js with `output: 'export'` → static bundle; **content client-rendered**
  for spoiler-safety.
- **Gating UX:** a persistent global reading-position control, **default = nothing set**
  (visitor must choose their position; an explicit "I've finished — show everything" sets the
  cutoff to the end). Per-series, persisted in `localStorage`, mirrored in the URL.
- **Multi-series:** routing, data, and reading position are all scoped by series.

## Architecture

A standalone public repo. Next.js App Router, `output: 'export'`, deployable to any static
host (GitHub Pages / Vercel / Cloudflare Pages). The browser fetches the static JSON for a
series once (on first position-set) and runs the gating engine client-side; changing the
reading position re-gates instantly with no network round-trip.

### Shared gating engine

The gating is the same logic the `dossier` CLI `view` performs, run in the browser. To share
one implementation **and** keep it browser-safe, `dossier` exposes a **pure,
dependency-free** gating module (no `node:fs`/`node:path` imports):

- `anchorSortKey` / `normalizeAnchor` / anchor comparison (moved into a pure `anchor` module).
- `viewAt(registry, { through?, descriptions?, aliases? }) → Registry` — gates a *registry*
  directly (not the delta log): for each entity whose earliest appearance ≤ `through`, keep
  appearances ≤ `through`, set the latest description/alias events ≤ `through` (the
  processed-keyed overlay), drop entities introduced after `through`. (The existing
  `materialize` operates on the delta log; `viewAt` is the registry-level equivalent the site
  needs, and the CLI `view` can adopt it too.)

`nexus` consumes this module with `dossier` as a **git submodule** (mirroring how `casefiles`
embeds `dossier`), importing the pure gating module directly. Fallback if the submodule
complicates the Next build: vendor the small pure module into `nexus` with a note that it
mirrors `dossier` (single logical source, two checkouts).

## Data

Per series, three static JSON files under `public/data/<series>/`:
`registry.json` (entities + appearances), `descriptions.json`, `aliases.json`
(~2.7 MB gzipped total for DCC). Plus a top-level **`public/data/series.json` manifest**:

```jsonc
[
  {
    "id": "dcc",
    "title": "Dungeon Crawler Carl",
    "author": "Matt Dinniman",
    "books": [
      { "number": 1, "chapters": ["Epigraph", "C1", "C2", "…", "Epilogue"] },
      { "number": 2, "chapters": ["…"] }
    ]
  }
]
```

The `books[].chapters` lists (reading-order section labels) drive the position picker and are
**derived from each series' anchors** — the distinct `B<n>·<label>` tokens across all
appearances, ordered by `anchorSortKey` — so the manifest is self-contained (no dependency on
`dossier`'s gitignored preprocess manifests).

### Data sync

Source of truth stays in `casefiles`. A `sync-data` script copies each series' three JSON
files from a local `casefiles` checkout into `public/data/<series>/` and generates
`series.json` (deriving books/chapters from anchors). `public/data/` is **gitignored** in
`nexus` (avoids duplicating ~11 MB raw); it's regenerated for builds/deploys. Adding a series
= ensure its data exists in `casefiles`, run `sync-data`, rebuild.

## Routing & pages

Static export emits a shell per route; **content is client-rendered and gated** (so no
spoiler content lands in the HTML).

- **`/`** — series picker. Lists series from `series.json`. Static, no gated content.
- **`/[series]`** — if no position set for this series: the **reading-position picker**
  ("Where are you in *<title>*?" — Book ▾ + Chapter ▾, plus "I've finished — show
  everything"). Once set: the **entity index** for that series, gated to the cutoff —
  client-side search, filter by type / significance / tag, sorted by significance then name.
- **`/[series]/entity/[id]`** — entity detail: canonical name; gated aliases; the description
  **as of the position** (expandable to the version timeline up to that point); appearances
  ≤ cutoff grouped by book·chapter; first appearance; type / tags / significance.

`generateStaticParams` enumerates series (and `(series, entityId)` pairs) at build to emit
shells. A persistent header shows/changes the current reading position. Reading position is
per-series in `localStorage` and reflected in the URL (`?through=B3·C5`) for shareable links.
Switching series preserves each series' own saved position.

## State & gating flow

1. Visitor opens `/[series]` with no saved position → picker; nothing else renders.
2. On choosing a position (or "show everything"), the app fetches that series' three JSON
   files once, caches them in memory, and renders the index via `viewAt(registry, {through,
   descriptions, aliases})`.
3. Changing the position re-runs `viewAt` (memoized per cutoff) — instant, no fetch.
4. Position persists in `localStorage` (keyed by series) and URL.

## Testing

- **Unit (pure `viewAt`):** gating at several cutoffs — index inclusion (entity hidden until
  its earliest appearance ≤ cutoff), appearance filtering, latest-≤-cutoff description/alias
  selection, "show everything." (Most of this is shared with `dossier`'s existing tests; the
  registry-level `viewAt` gets its own.)
- **Component:** the position picker (sets state, persists), index filtering/search.
- **E2E (one Playwright smoke):** open a series → no content until position set → set a
  position → index populates → open an entity → descriptions/aliases/appearances are bounded
  to the cutoff → "show everything" reveals full series.

## Copyright posture

A public, browsable derivative of an in-copyright series carries takedown risk even though
the short quote snippets are fair use. Recorded as an accepted risk. Mitigations: a clear
footer disclaimer ("Unofficial fan project. *Dungeon Crawler Carl* © Matt Dinniman.") and no
full-text reproduction (only the existing short snippets and derived descriptions).

## Open items

- Create `github.com/chad3814/nexus` (public) and push — at implementation time, with
  explicit go-ahead.
- Hosting target (GitHub Pages vs Vercel vs Cloudflare Pages) — decide during implementation;
  all work with a static export.
- Visual design/layout details (index density, entity-page layout) — refine during
  implementation; a visual companion can help if useful.
