# Cross-linked entity mentions — design

**Date:** 2026-06-19
**Status:** Approved (design)
**Repo:** `nexus` (client-side only — no `dossier`/`casefiles` change)
**Related:** `docs/superpowers/specs/2026-06-18-nexus-website-design.md`

## Goal

When an entity's description names another character, turn the first mention into a link to
that character's page — making the compendium a navigable web instead of a set of islands.
Entirely client-side at render time; no new data, no extraction/LLM pass.

## Decisions (from brainstorming)

- **Compute location:** client-side from the registry (MVP). Match the gated description against
  in-view candidate entities' aliases at render. No new data; inherently spoiler-correct.
- **Candidate scope:** entities appearing in the **same chapter (`B·C`)** as the shown
  description version. Tightest precision (kills generic-alias over-linking); every link lands
  on a populated, in-view page. "Recalled" mentions of earlier characters not in that chapter
  go unlinked (acceptable — correct-but-incomplete beats over-linking).
- **Link frequency:** first occurrence of each entity per description; later repeats stay plain.
- **Linked surfaces:** the main "as of" description only. Version-history "Case notes",
  snippets, and the dense `B·C` "Sightings" anchors stay plain (history linking is a future
  extension).

## Why it is spoiler-safe (no new gate)

Candidates are entities appearing in the same chapter as the *shown* description version, which
is already gated to the reader's position. Those entities are therefore present at that point
and their pages are populated; the description naming them is the reveal, so the link adds no
information. This stays within the existing client-rendered, gating-safe model — gated content
is still never in static HTML.

## Architecture

A pure linkifier plus thin wiring in the entity view. At render, `EntityDetail` determines the
shown description version's chapter, gathers the in-view entities appearing in that chapter
(minus the subject), and renders the description prose with the first mention of each candidate
turned into a `next/link` to its entity page.

### Components

**`lib/links.ts`** (new, pure, unit-tested):

- `chapterOf(anchor: string): string` — the `B·label` prefix of a full anchor (e.g.
  `"B3·C5·¶7" → "B3·C5"`).
- `interface LinkCandidate { id: string; names: string[] }`
- `candidatesInChapter(entities: RegistryEntity[], chapter: string, selfId: string): LinkCandidate[]`
  — in-view entities (excluding `selfId`) that have an appearance whose `chapterOf` equals
  `chapter`; `names` = `canonicalName` + `cleanAliases(canonicalName, aliases)`.
- `type Segment = { text: string } | { text: string; href: string }`
- `linkify(text: string, candidates: LinkCandidate[], seriesId: string): Segment[]` — splits the
  text into ordered segments. Matching rules (locked):
  - Build a name→id map from all candidates' `names`; sort names by length descending so the
    longest match at a position wins ("Princess Donut" over "Donut").
  - Match case-insensitively at word boundaries (`\b…\b`); regex-escape each name.
  - Link only the **first** occurrence per `id`; once an id is linked, later matches of any of
    its names render as plain text.
  - A trailing possessive `'s` stays outside the link (link the name proper).
  - `href` = `/<seriesId>/entity/<id>/` (trailing slash, matching the static export).
  - With no candidates (or no matches) the result is a single `{ text }` segment — identical
    output to today.

**`components/EntityView.tsx`** — passes `view.entities` (the gated set) and `seriesId` to
`EntityDetail`.

**`components/EntityDetail.tsx`** — gains `entities: RegistryEntity[]` and `seriesId: string`
props. It determines the shown description version's anchor (the latest of `versions` by
`cmpAnchor`; `versions` already filtered ≤ cutoff), derives its chapter via `chapterOf`, builds
candidates via `candidatesInChapter(entities, chapter, entity.id)`, and renders the description
through `linkify(...)` — mapping link segments to `next/link`. If there are no `versions`
(blob-fallback description) or no candidates, it renders the description as plain text exactly
as today.

### Data flow

shown description version → its chapter (`B·C`) → in-view entities appearing in that chapter
(minus self) → match their cleaned aliases/canonical names in the prose → link first mention of
each → `next/link` to the gated entity page.

## Scope & files

- Create: `lib/links.ts`, `test/links.test.ts`.
- Modify: `components/EntityDetail.tsx` (render description as segments; `entities` + `seriesId`
  props), `components/EntityView.tsx` (pass `view.entities` + `seriesId`).
- Reuse the existing `cleanAliases`, `cmpAnchor`, `normalizeAnchor` from `lib/gating`.
- Unchanged: "Sightings" anchors, snippets, "Case notes" history, all gating/data.

## Testing

- **`lib/links` unit:** `chapterOf` extraction; `candidatesInChapter` (chapter filter +
  self-exclusion + alias cleaning); `linkify` — longest-match wins, first-occurrence-only,
  word-boundary (no match inside a word), possessive `'s` outside the link, subject excluded,
  multiple distinct entities, and no-candidates → single plain segment.
- **`EntityDetail` component:** a co-located entity named in the description renders as a link
  to `/<series>/entity/<id>/`; a name whose entity is not in that chapter stays plain; the
  subject's own name is never linked.
- Existing **34 unit + 4 e2e** stay green; no gated content in static HTML (client-rendered).

## Non-goals

- Build-time / LLM mention extraction (possible future upgrade if alias matching is too noisy).
- Linking version-history entries, snippets, or the `B·C` "Sightings" anchors.
- "What links here" / backlinks.
- Any dossier/casefiles/data change or gating-logic change.
