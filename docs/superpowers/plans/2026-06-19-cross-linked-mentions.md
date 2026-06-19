# Cross-linked entity mentions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Link the first mention of any character named in an entity's description to that character's page, when they appear in the same chapter as the shown description version. Client-side at render; no new data.

**Architecture:** A pure `lib/links.ts` (chapter extraction, candidate selection, linkifier) plus thin wiring in `EntityDetail`/`EntityView`. Candidates are the in-view entities appearing in the shown description version's chapter, so linking is inherently spoiler-safe.

**Tech Stack:** Next.js (static export, client components), TypeScript strict, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-19-cross-linked-mentions-design.md`

## Global Constraints

- nexus only — no `dossier`/`casefiles`/data change, no gating-logic change.
- No `any`/`unknown`. 2-space indent; semicolons. TypeScript strict.
- Spoiler-safety unchanged: candidates are in-view entities in the shown (already-gated) chapter; links target gated pages; no gated content in static HTML (client-rendered).
- Matcher rules: longest-name-first, case-insensitive, `\b` word boundaries, **first occurrence per entity only**, possessive `'s` left outside the link, subject excluded, regex-escaped names. `href` = `/<seriesId>/entity/<id>/` (trailing slash).
- No-candidates / no-match / no-versions → render the description as plain text exactly as today.
- Existing 34 unit + 4 e2e stay green.

---

## Task 1: `lib/links.ts` — chapter, candidates, linkifier

**Files:**
- Create: `nexus/lib/links.ts`
- Test: `nexus/test/links.test.ts`

**Interfaces — Produces:**
- `chapterOf(anchor: string): string`
- `interface LinkCandidate { id: string; names: string[] }`
- `candidatesInChapter(entities: RegistryEntity[], chapter: string, selfId: string): LinkCandidate[]`
- `type Segment = { text: string } | { text: string; href: string }`
- `linkify(text: string, candidates: LinkCandidate[], seriesId: string): Segment[]`

- [ ] **Step 1: Write the failing tests** `nexus/test/links.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { candidatesInChapter, chapterOf, linkify } from "@/lib/links";
import type { RegistryEntity } from "@/lib/types";

const ent = (id: string, canonicalName: string, aliases: string[], appearances: string[]): RegistryEntity => ({
  id, canonicalName, aliases, type: "person", tags: [], significance: "minor",
  description: "", firstAppearance: null, appearances,
});

describe("chapterOf", () => {
  it("returns the B·label prefix", () => {
    expect(chapterOf("B3·C5·¶7")).toBe("B3·C5");
    expect(chapterOf("[B1·Interlude·¶2]")).toBe("B1·Interlude");
  });
});

describe("candidatesInChapter", () => {
  const entities = [
    ent("self", "Donut", [], ["B1·C1·¶1"]),
    ent("carl", "Carl", ["the cat"], ["B1·C1·¶3", "B2·C1·¶1"]),
    ent("mord", "Mordecai", [], ["B2·C4·¶1"]),
  ];
  it("returns in-chapter entities except self, with canonical + cleaned aliases", () => {
    const c = candidatesInChapter(entities, "B1·C1", "self");
    expect(c).toEqual([{ id: "carl", names: ["Carl", "the cat"] }]);
  });
  it("excludes entities not in the chapter", () => {
    expect(candidatesInChapter(entities, "B1·C1", "self").some((c) => c.id === "mord")).toBe(false);
  });
});

describe("linkify", () => {
  const cands = [
    { id: "carl", names: ["Carl"] },
    { id: "donut", names: ["Princess Donut", "Donut"] },
  ];
  it("links the first mention of each entity, longest name first", () => {
    const segs = linkify("Princess Donut nods. Donut purrs. Carl waves to Carl.", cands, "dcc");
    expect(segs).toEqual([
      { text: "Princess Donut", href: "/dcc/entity/donut/" },
      { text: " nods. Donut purrs. " },
      { text: "Carl", href: "/dcc/entity/carl/" },
      { text: " waves to Carl." },
    ]);
  });
  it("leaves a possessive 's outside the link and respects word boundaries", () => {
    const segs = linkify("Carl's friend Carlos left.", [{ id: "carl", names: ["Carl"] }], "dcc");
    expect(segs).toEqual([
      { text: "Carl", href: "/dcc/entity/carl/" },
      { text: "'s friend Carlos left." },
    ]);
  });
  it("returns a single plain segment when there are no candidates", () => {
    expect(linkify("Nobody here.", [], "dcc")).toEqual([{ text: "Nobody here." }]);
  });
});
```

- [ ] **Step 2: Run to verify failure.** `npm test -- links` → FAIL (module missing).

- [ ] **Step 3: Implement** `nexus/lib/links.ts`:

```ts
import { cleanAliases, normalizeAnchor } from "@/lib/gating";
import type { RegistryEntity } from "@/lib/types";

/** The "B·label" chapter prefix of a full anchor (e.g. "B3·C5·¶7" → "B3·C5"). */
export function chapterOf(anchor: string): string {
  const parts = normalizeAnchor(anchor).split("·");
  return `${parts[0] ?? ""}·${parts[1] ?? ""}`;
}

export interface LinkCandidate {
  id: string;
  names: string[];
}

/** In-view entities (excluding self) appearing in `chapter`, with canonical name + cleaned aliases. */
export function candidatesInChapter(
  entities: RegistryEntity[],
  chapter: string,
  selfId: string,
): LinkCandidate[] {
  const out: LinkCandidate[] = [];
  for (const e of entities) {
    if (e.id === selfId) continue;
    if (!e.appearances.some((a) => chapterOf(a) === chapter)) continue;
    out.push({ id: e.id, names: [e.canonicalName, ...cleanAliases(e.canonicalName, e.aliases)] });
  }
  return out;
}

export type Segment = { text: string } | { text: string; href: string };

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Split `text` into segments, linking the first mention of each candidate entity. */
export function linkify(text: string, candidates: LinkCandidate[], seriesId: string): Segment[] {
  const pairs: Array<{ name: string; id: string }> = [];
  for (const c of candidates) {
    for (const n of c.names) {
      if (n.trim()) pairs.push({ name: n, id: c.id });
    }
  }
  // Longest names first so the longest match at a position wins ("Princess Donut" over "Donut").
  pairs.sort((a, b) => b.name.length - a.name.length);
  if (pairs.length === 0) return [{ text }];

  const idByName = new Map(pairs.map((p) => [p.name.toLowerCase(), p.id]));
  const re = new RegExp(`\\b(${pairs.map((p) => escapeRegex(p.name)).join("|")})\\b`, "gi");

  const segments: Segment[] = [];
  const linked = new Set<string>();
  let last = 0;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    const id = idByName.get(m[0].toLowerCase());
    if (!id || linked.has(id)) continue; // unknown or already linked → leave as plain text
    linked.add(id);
    if (m.index > last) segments.push({ text: text.slice(last, m.index) });
    segments.push({ text: m[0], href: `/${seriesId}/entity/${id}/` });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
}
```

- [ ] **Step 4: Run tests.** `npm test -- links` → PASS. `npx tsc --noEmit -p tsconfig.json` → clean. `npm run lint` → clean.

- [ ] **Step 5: Commit.** `git add lib/links.ts test/links.test.ts && git commit -m "links: pure entity-mention linkifier (chapter-scoped, first-mention)"`

---

## Task 2: wire links into the entity description

**Files:**
- Modify: `nexus/components/EntityDetail.tsx`
- Modify: `nexus/components/EntityView.tsx`
- Test: `nexus/test/entity-detail.test.tsx`

**Interfaces:** Consumes `chapterOf`, `candidatesInChapter`, `linkify` (Task 1). `EntityDetail` gains `entities: RegistryEntity[]` and `seriesId: string` props.

- [ ] **Step 1: Write the failing test** — add to `nexus/test/entity-detail.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EntityDetail from "@/components/EntityDetail";
import type { DescriptionEvent, RegistryEntity } from "@/lib/types";

const mk = (id: string, name: string, appearances: string[], description = ""): RegistryEntity => ({
  id, canonicalName: name, aliases: [], type: "person", tags: [], significance: "minor",
  description, firstAppearance: null, appearances,
});

describe("EntityDetail cross-links", () => {
  const subject = mk("donut", "Donut", ["B1·C1·¶1"], "Donut trusts Carl completely.");
  const versions: DescriptionEvent[] = [
    { id: "donut", anchor: "B1·C1·¶1", description: "Donut trusts Carl completely.", significance: "major" },
  ];
  const entities = [subject, mk("carl", "Carl", ["B1·C1·¶3"]), mk("far", "Faraway", ["B5·C1·¶1"])];

  it("links a co-located mentioned entity to its page", () => {
    render(<EntityDetail entity={subject} versions={versions} cutoff="" books={[]} entities={entities} seriesId="dcc" />);
    const link = screen.getByRole("link", { name: "Carl" });
    expect(link).toHaveAttribute("href", "/dcc/entity/carl/");
  });

  it("does not link the subject itself", () => {
    render(<EntityDetail entity={subject} versions={versions} cutoff="" books={[]} entities={entities} seriesId="dcc" />);
    expect(screen.queryByRole("link", { name: "Donut" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure.** `npm test -- entity-detail` → FAIL (no `entities`/`seriesId` props; no link).

- [ ] **Step 3: Update `EntityDetail.tsx`.**
  - Add imports: `import Link from "next/link";` and `import { candidatesInChapter, chapterOf, linkify } from "@/lib/links";` and ensure `RegistryEntity` is imported from `@/lib/types`.
  - Add to `EntityDetailProps`: `entities: RegistryEntity[];` and `seriesId: string;`. Add them to the destructured params: `{ entity, versions, cutoff, books, entities, seriesId }`.
  - After `sortedVersions` is computed (it is ascending by anchor), derive the shown chapter, candidates, and segments:

```tsx
  const latestVersion = sortedVersions[sortedVersions.length - 1];
  const descChapter = latestVersion ? chapterOf(latestVersion.anchor) : "";
  const descCandidates = descChapter ? candidatesInChapter(entities, descChapter, entity.id) : [];
  const descSegments = linkify(entity.description, descCandidates, seriesId);
```

  - Replace the description render at line ~75 (`<p ...>{entity.description}</p>`) with:

```tsx
        <p className="text-sm leading-relaxed text-ink">
          {descSegments.map((s, i) =>
            "href" in s ? (
              <Link key={i} href={s.href} className="text-accent hover:underline">{s.text}</Link>
            ) : (
              <span key={i}>{s.text}</span>
            ),
          )}
        </p>
```

  (Leave the "Case notes" version-history render unchanged — plain text.)

- [ ] **Step 4: Update `EntityView.tsx`** — pass the gated entities + seriesId (line ~105):

```tsx
<EntityDetail entity={entity} versions={versions} cutoff={cutoff} books={data.registry.books} entities={view.entities} seriesId={seriesId} />
```

- [ ] **Step 5: Run tests.** `npm test -- entity-detail` → PASS. `npm test` → all pass (34 prior + new). `npm run lint` clean; `npx tsc --noEmit -p tsconfig.json` clean.

- [ ] **Step 6: Commit.** `git add components/EntityDetail.tsx components/EntityView.tsx test/entity-detail.test.tsx && git commit -m "ui: link entity mentions in descriptions to their pages"`

---

## Task 3: full gates + deploy

- [ ] **Step 1: Gates.** `npm run lint` clean; `npm test` all pass; `npm run export` succeeds; `npm run e2e` 4 pass (note if Chromium unavailable); spoiler-safety: `! grep -qi "Crawler #\|marine tech" out/dcc/entity/carl/index.html`.

- [ ] **Step 2: Spot-check the export** has a cross-link rendered nowhere in static HTML (content is client-rendered): `! grep -q "entity/.*\">.*</a>" out/dcc/entity/carl/index.html` is NOT required — instead confirm the gated description text is absent from the shell (already covered by the spoiler check). No new build output to verify beyond the gates.

- [ ] **Step 3: Deploy** (controller, with user approval): no data change, so push **nexus only**; verify on `casefiles.nexus` that a description with a co-located mention renders a working link.

---

## Self-Review

- **Spec coverage:** `chapterOf`/`candidatesInChapter`/`linkify` (T1) ✓ · client-side, no new data (T1/T2) ✓ · same-chapter candidate scope + self-exclusion (T1 `candidatesInChapter`) ✓ · first-occurrence-only + longest-match + word-boundary + possessive (T1 `linkify` + tests) ✓ · main description only, history/snippets/anchors untouched (T2 Step 3 note) ✓ · `EntityDetail`/`EntityView` wiring (T2) ✓ · fallback to plain text when no versions/candidates (T1 returns `[{text}]`; T2 guards `descChapter`) ✓ · existing tests green + spoiler-safe (T3) ✓ · nexus-only deploy (T3) ✓.
- **Placeholder scan:** none — `lib/links.ts` and all edits shown verbatim; tests assert concrete segment output.
- **Type consistency:** `LinkCandidate { id; names }`, `Segment = {text} | {text, href}`, `linkify(text, candidates, seriesId)`, and `candidatesInChapter(entities, chapter, selfId)` signatures are identical between `lib/links.ts` (T1) and the call sites in `EntityDetail` (T2); `href` format `/<seriesId>/entity/<id>/` matches the export's trailing-slash routes.
```
