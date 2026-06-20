# Cross-link candidate scope — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fix cross-link mis-linking by scoping candidates to in-view entities with gated significance `major`/`supporting` (not same-chapter appearance), so a description that names any prior entity links to the right one.

**Tech Stack:** Next.js (client), TypeScript strict, Vitest + RTL. nexus only.

**Spec:** `docs/superpowers/specs/2026-06-20-crosslink-candidate-scope-design.md`

## Global Constraints

- No `any`/`unknown`. 2-space indent; semicolons. TypeScript strict. No control/NUL bytes.
- Candidates = in-view entities with `significance === "major" || "supporting"`, excluding self. Drop same-chapter scoping. `linkify` (longest-match, ambiguous-filter, first-occurrence, word boundaries) is unchanged.
- Spoiler-safety unchanged (client-rendered, in-view only). Existing unit + e2e stay green.
- nexus only — no dossier/casefiles/data change.

---

## Task 1: `lib/links.ts` — significance-based candidates

**Files:** Modify `lib/links.ts`; Modify `test/links.test.ts`.

**Interfaces — Produces:** `linkCandidates(entities: RegistryEntity[], selfId: string): LinkCandidate[]`. Removes `candidatesInChapter` and `chapterOf` (dead after this change). `LinkCandidate`, `Segment`, `linkify` unchanged.

- [ ] **Step 1: Update tests** in `test/links.test.ts` — remove the `chapterOf` and `candidatesInChapter` describe blocks; add `linkCandidates` + a mis-link regression:

```ts
import { describe, expect, it } from "vitest";
import { linkCandidates, linkify } from "@/lib/links";
import type { RegistryEntity } from "@/lib/types";

const ent = (id: string, name: string, sig: RegistryEntity["significance"], aliases: string[]): RegistryEntity => ({
  id, canonicalName: name, aliases, type: "person", tags: [], significance: sig,
  description: "", firstAppearance: null, appearances: [],
});

describe("linkCandidates", () => {
  const entities = [
    ent("donut", "Donut", "major", ["the Princess", "Princess"]),
    ent("pp", "Princess Posse", "supporting", ["The Princess Posse"]),
    ent("noflex", "Epitome Noflex", "minor", ["the mother"]),
    ent("self", "Self", "major", []),
  ];
  it("keeps only major/supporting, excludes self", () => {
    const ids = linkCandidates(entities, "self").map((c) => c.id).sort();
    expect(ids).toEqual(["donut", "pp"]);
  });
  it("includes canonical name + cleaned aliases", () => {
    const pp = linkCandidates(entities, "self").find((c) => c.id === "pp");
    expect(pp?.names).toContain("Princess Posse");
    expect(pp?.names).toContain("The Princess Posse");
  });
});

describe("linkify mis-link regression (the Princess Posse)", () => {
  it("links the full 'the Princess Posse' to princess-posse, not Donut", () => {
    const cands = [
      { id: "donut", names: ["the Princess", "Princess"] },
      { id: "pp", names: ["Princess Posse", "The Princess Posse"] },
    ];
    const segs = linkify("It awards all its assets to the Princess Posse.", cands, "dcc");
    const link = segs.find((s) => "href" in s);
    expect(link).toEqual({ text: "the Princess Posse", href: "/dcc/entity/pp/" });
    expect(segs.some((s) => "href" in s && s.href.includes("/donut/"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure.** `npm test -- links` → FAIL (`linkCandidates` missing; `chapterOf`/`candidatesInChapter` tests removed).

- [ ] **Step 3: Implement** in `lib/links.ts`:
  - Remove `chapterOf` and `candidatesInChapter`.
  - Add:

```ts
import { cleanAliases } from "@/lib/gating";
import type { RegistryEntity } from "@/lib/types";

/** In-view entities (excluding self) worth linking: gated significance major/supporting. */
export function linkCandidates(entities: RegistryEntity[], selfId: string): LinkCandidate[] {
  const out: LinkCandidate[] = [];
  for (const e of entities) {
    if (e.id === selfId) continue;
    if (e.significance !== "major" && e.significance !== "supporting") continue;
    out.push({ id: e.id, names: [e.canonicalName, ...cleanAliases(e.canonicalName, e.aliases)] });
  }
  return out;
}
```

  - Drop the now-unused `normalizeAnchor` import if `chapterOf` was its only user (keep `cleanAliases`). Verify no remaining references to `chapterOf`/`candidatesInChapter` in the file.

- [ ] **Step 4: Run tests.** `npm test -- links` → PASS. `npm test` → all pass. `npm run lint` clean; `npx tsc --noEmit -p tsconfig.json` clean. No NUL bytes: `perl -ne 'print "NUL\n" if /\x00/' lib/links.ts test/links.test.ts` silent.

- [ ] **Step 5: Commit.** `git add lib/links.ts test/links.test.ts && git commit -m "links: candidates by in-view major/supporting significance (drop same-chapter scope)"`

---

## Task 2: wire `EntityDetail`, verify, deploy

**Files:** Modify `components/EntityDetail.tsx`; Modify `test/entity-detail.test.tsx`.

**Interfaces:** Consumes `linkCandidates`, `linkify`. `EntityView.tsx` is unchanged (already passes `entities`/`seriesId`).

- [ ] **Step 1: Update the component test** `test/entity-detail.test.tsx` — the cross-link cases now key on significance, not chapter:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EntityDetail from "@/components/EntityDetail";
import type { DescriptionEvent, RegistryEntity } from "@/lib/types";

const mk = (id: string, name: string, sig: RegistryEntity["significance"], aliases: string[] = []): RegistryEntity => ({
  id, canonicalName: name, aliases, type: "person", tags: [], significance: sig,
  description: "", firstAppearance: null, appearances: [],
});

describe("EntityDetail cross-links by significance", () => {
  const subject = mk("madness", "The Madness", "supporting");
  subject.description = "It awards all its assets to the Princess Posse, opposing Donut.";
  const versions: DescriptionEvent[] = [
    { id: "madness", anchor: "B7·C68·¶39", description: subject.description, significance: "supporting" },
  ];
  const entities = [
    subject,
    mk("pp", "Princess Posse", "supporting", ["The Princess Posse"]),
    mk("donut", "Donut", "major", ["the Princess"]),
    mk("noflex", "Epitome Noflex", "minor", ["the mother"]),
  ];
  const props = { entity: subject, versions, cutoff: "", books: [], entities, seriesId: "dcc" };

  it("links a major/supporting entity named in the description", () => {
    render(<EntityDetail {...props} />);
    expect(screen.getByRole("link", { name: "the Princess Posse" })).toHaveAttribute("href", "/dcc/entity/pp/");
  });
  it("does not link the subject itself", () => {
    render(<EntityDetail {...props} />);
    expect(screen.queryByRole("link", { name: /Madness/ })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure.** `npm test -- entity-detail` → FAIL.

- [ ] **Step 3: Update `EntityDetail.tsx`:**
  - Import: `import { linkCandidates, linkify } from "@/lib/links";` (drop `candidatesInChapter`, `chapterOf`).
  - Replace the three lines (`latestVersion`/`descChapter`/`descCandidates`) with:

```tsx
  const descCandidates = linkCandidates(entities, entity.id);
  const descSegments = linkify(entity.description, descCandidates, seriesId);
```

  - Keep `sortedVersions` (still used by the "Case notes" history). Leave the `descSegments` render and everything else unchanged.

- [ ] **Step 4: Verify gates.** `npm test` (all pass — incl. new), `npm run lint` clean, `npx tsc --noEmit -p tsconfig.json` clean, `npm run export` succeeds, `npm run e2e` 4 pass, spoiler-safety: `! grep -qi "Crawler #\|marine tech" out/dcc/entity/carl/index.html`.

- [ ] **Step 5: Commit.** `git add components/EntityDetail.tsx test/entity-detail.test.tsx && git commit -m "entity detail: link mentions of in-view major/supporting entities"`

- [ ] **Step 6: Deploy** (controller, with user approval): nexus-only (no data change) — push nexus, then verify live that The Madness's description links "the Princess Posse" → `/dcc/entity/princess-posse/`.

---

## Self-Review

- **Spec coverage:** `linkCandidates` by major/supporting + exclude self (T1) ✓ · remove same-chapter `chapterOf`/`candidatesInChapter` (T1) ✓ · `linkify` unchanged, longest-match regression (T1 test) ✓ · `EntityDetail` rewire, `sortedVersions` kept for Case notes (T2) ✓ · `EntityView` unchanged ✓ · minor entity not a target / subject not linked (T2 tests) ✓ · gates + spoiler-safe + nexus-only deploy (T2) ✓.
- **Placeholder scan:** none — code + tests verbatim.
- **Type consistency:** `linkCandidates(entities, selfId)` returns `LinkCandidate[]` consumed by `linkify(text, candidates, seriesId)` in `EntityDetail`; `RegistryEntity.significance` values match the `Significance` union.
```
