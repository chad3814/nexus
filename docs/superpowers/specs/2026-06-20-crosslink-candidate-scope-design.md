# Cross-link candidate scope: widen to in-view major/supporting — design

**Date:** 2026-06-20
**Status:** Approved (design)
**Repo:** `nexus` (client-side only — no dossier/casefiles/data change)
**Related:** `docs/superpowers/specs/2026-06-19-cross-linked-mentions-design.md`

## Problem (root cause, debugged)

A description that names another entity could **mis-link** to the wrong one. Concrete case: The Madness's description (anchored `B7·C68·¶39`) says "…awards all its assets to the Princess Posse," but it linked **the Princess** → Princess **Donut** instead of → **Princess Posse**.

Root cause (verified):
- Cross-link candidates were scoped to entities appearing in the **same chapter** (`B·C`) as the shown description version.
- Princess Posse is named repeatedly in the raw C68 text but the appearance extraction **never tagged it in C68** (an extraction false-negative — it appears in ~69 *other* Book-7 chapters). So it wasn't a candidate.
- Donut *is* co-located in C68 (for unrelated reasons) and has the alias `the Princess`, a prefix of "the Princess Posse" → it greedily grabbed the mention.

The deeper lesson: **appearance-co-location is the wrong signal.** Descriptions are LLM-generated from everything-so-far and can name any prior entity; the appearance index is incomplete. Same-chapter scoping therefore both under-links and (worse) mis-links recalled mentions.

## Decision

- **Candidates = all in-view entities (≤ reading position) whose *gated* significance is `major` or `supporting`, excluding self.** Drop the same-chapter scoping entirely.
- The **gated** significance (latest description event ≤ cutoff, spine-ordered) is what `viewAt` already computes and what the site displays — e.g. Princess Posse reads `supporting` gated (its registry blob says `minor`, which is stale/unreliable). So Princess Posse becomes a candidate, and `linkify`'s existing longest-match picks "The Princess Posse" over "the Princess" → correct link, robust to the C68 extraction gap.
- `major + supporting` ≈ **831 of 3,823** entities at full series — a real bound that keeps the book-8 candidate pool in check (the worry behind bounding). Minor/`mentioned` entities are not link *targets*.

Spoiler-safe: candidates are in-view (≤ position). Over-linking is further damped by the existing longest-match, ambiguous-name filter, and first-occurrence-per-entity. If specific generic aliases over-link in practice, the follow-up is a targeted generic-alias guard — not a significance change.

## Implementation

- `lib/links.ts`: replace `candidatesInChapter(entities, chapter, selfId)` with
  `linkCandidates(entities: RegistryEntity[], selfId: string): LinkCandidate[]` =
  entities with `significance === "major" || "supporting"`, `id !== selfId`, mapped to
  `{ id, names: [canonicalName, ...cleanAliases(canonicalName, aliases)] }`. Remove the
  now-unused `chapterOf` (dead after this change). `LinkCandidate`, `Segment`, `linkify`
  unchanged.
- `components/EntityDetail.tsx`: drop the `latestVersion`/`descChapter`/`candidatesInChapter`
  lines; compute `const descCandidates = linkCandidates(entities, entity.id);` then
  `linkify(entity.description, descCandidates, seriesId)`. (`sortedVersions` stays — still used
  for the "Case notes" history.) Imports updated.
- `components/EntityView.tsx`: unchanged — already passes `entities={view.entities}` (gated,
  carrying gated significance) and `seriesId`.

## Testing

- `lib/links` unit: `linkCandidates` keeps only major/supporting and excludes self; `linkify`
  regression — candidates Donut (`the Princess`,`Princess`) + Princess Posse (`Princess Posse`,
  `The Princess Posse`), text "…to the Princess Posse." → links the span to **princess-posse**,
  not donut.
- `EntityDetail` component: a major/supporting in-view entity named in the description links;
  a `minor` entity named in the description does **not** link; subject never links.
- Existing unit + e2e stay green; spoiler-safety unchanged (client-rendered, in-view only).

## Non-goals

- Appearance-extraction recall (the false-negative) — separate larger effort.
- Significance re-classification, or a build-time mention list.
- Any dossier/casefiles/data change.
