# "Case file" Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Restyle `nexus` into the light "case file" theme (paper/ink/stamp-red, mono headings, serif body) and fix the unreadable light-grey-on-white secondary text — no layout, logic, or markup-structure changes.

**Architecture:** Define theme tokens in `app/globals.css` via Tailwind v4 `@theme` (so `bg-paper`, `text-ink`, `text-muted`, `text-accent`, `border-border`, etc. become utilities); load a serif body font with `next/font/google`; then swap every `text-zinc-*` / default surface across the components for theme utilities per the spec's per-screen treatments.

**Tech Stack:** Next.js 16 (App Router, static export), Tailwind CSS v4, `next/font/google`, TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-06-19-case-file-theme-design.md`

## Global Constraints

- Light-only — remove the `@media (prefers-color-scheme: dark)` block from `globals.css`.
- TypeScript strict; no `any`/`unknown`. 2-space indent; semicolons.
- No changes to component logic, props, hooks, or DOM structure beyond `className`s and minimal styling-only wrapper elements.
- Every text/background pairing meets WCAG AA (≥ 4.5:1). No text on a near-background grey.
- Existing 24 unit + 4 e2e tests must stay green (they assert text/behavior, not color). Spoiler-safety unchanged.
- Palette tokens (verbatim): paper `#e7dcc4`, surface `#f7f1e3`, border `#d2c4a6`, rule `#c8b890`, ink `#211d16`, muted `#6b5f49`, accent `#9e2b25`, accent-ink `#fbf4e6`, tag-border `#b8a06a`, tag-ink `#6b5226`; card shadow `2px 3px 0 rgba(60,48,28,.12)`.

---

## Task 1: Theme foundation (tokens + fonts)

**Files:** Modify `app/globals.css`, `app/layout.tsx`.

**Interfaces:**
- Produces Tailwind color utilities `paper`/`surface`/`border`/`rule`/`ink`/`muted`/`accent`/`accent-ink`/`tag-border`/`tag-ink` (e.g. `bg-surface`, `text-muted`, `border-rule`, `text-accent`), plus `font-mono` and `font-serif` family utilities. Task 2 consumes these.

- [ ] **Step 1: Rewrite `app/globals.css`** (replace the whole file):

```css
@import "tailwindcss";

@theme {
  --color-paper: #e7dcc4;
  --color-surface: #f7f1e3;
  --color-border: #d2c4a6;
  --color-rule: #c8b890;
  --color-ink: #211d16;
  --color-muted: #6b5f49;
  --color-accent: #9e2b25;
  --color-accent-ink: #fbf4e6;
  --color-tag-border: #b8a06a;
  --color-tag-ink: #6b5226;
  --font-serif: var(--font-source-serif), Georgia, "Times New Roman", serif;
  --font-mono: var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace;
}

body {
  background: var(--color-paper);
  color: var(--color-ink);
  font-family: var(--font-serif);
}
```

(This removes the prior `:root` vars, the `@media (prefers-color-scheme: dark)` block, and the Arial body font.)

- [ ] **Step 2: Wire the serif font in `app/layout.tsx`.** Add the import and instance alongside the existing Geist fonts, and add its variable to the `<html>` className:

```ts
import { Source_Serif_4 } from "next/font/google";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});
```

Add `${sourceSerif.variable}` to the `<html className={...}>` template (keep `geistSans.variable` and `geistMono.variable`). Change the footer `className` from `... text-zinc-500` to `... text-muted font-mono` (keep its other classes).

- [ ] **Step 3: Verify.** Run `npm run lint` (clean), `npm test` (24 pass — unchanged), `npm run export` (succeeds; `out/` builds). Confirm no remaining dark-mode media query: `! grep -q "prefers-color-scheme" app/globals.css`.

- [ ] **Step 4: Commit.** `git add app/globals.css app/layout.tsx && git commit -m "theme: case-file tokens + serif body font (light-only)"`

---

## Task 2: Apply the theme to all screens

**Files:** Modify `app/page.tsx`, `components/SeriesPicker.tsx`, `components/PositionPicker.tsx`, `components/PositionBar.tsx`, `components/EntityIndex.tsx`, `components/EntityDetail.tsx`, `components/EntityView.tsx`.

**Interfaces:** Consumes the Task 1 utilities (`bg-paper`, `bg-surface`, `text-ink`, `text-muted`, `text-accent`, `text-accent-ink`, `bg-accent`, `border-border`, `border-rule`, `text-tag-ink`, `border-tag-border`, `font-mono`, `font-serif`).

**Token → utility cheat-sheet (apply throughout):**
- Replace EVERY `text-zinc-300|400|500|600|700` with `text-muted` (secondary text) or `text-ink` (primary text) — choose by role; never leave a `zinc-*` class.
- Card/panel surfaces: `bg-surface border border-border` + `shadow-[2px_3px_0_rgba(60,48,28,.12)]`.
- Headings, entity names, `B·C·¶` anchors, badges/labels, the position stamp: add `font-mono`.
- Body/description prose, aliases line: leave default (serif from body) — use `text-ink` / `text-muted`.
- Links / interactive accents / focus rings: `text-accent`, `focus:ring-accent` (or `focus-visible:outline-accent`).
- Form controls (`<select>`, `<input>`, buttons): `bg-surface border border-border text-ink`; primary action button `bg-accent text-accent-ink`.

**Per-screen treatment (className-only; do NOT change logic/props/DOM structure beyond styling wrappers/classes):**

- [ ] **Step 1: `app/page.tsx` + `components/SeriesPicker.tsx`** — "Choose a series" heading in `font-mono text-ink`; each series card `bg-surface border border-border` + shadow + hover; title `font-mono text-ink`, author `text-muted`.

- [ ] **Step 2: `components/PositionBar.tsx`** — header bar `bg-surface border-b border-border`; current position as a stamp: `font-mono text-accent` (e.g. wrap the `formatCutoff` output, prefix "THROUGH "); "Change" button `text-accent` link style.

- [ ] **Step 3: `components/PositionPicker.tsx`** — panel `bg-surface border border-border`; "Where are you…" heading `font-mono text-ink`; `<select>`s `bg-surface border border-border text-ink`; "Set position" primary button `bg-accent text-accent-ink`; "show everything" as a secondary `text-accent` link/button. Replace the `text-zinc-500/700`.

- [ ] **Step 4: `components/EntityIndex.tsx`** — search/filter controls as form fields (above); entity rows `bg-surface border border-border` cards with the offset shadow + hover; name `font-mono text-ink`; significance badge: `major`/`supporting` → `bg-accent text-accent-ink font-mono` stamp, `minor`/`mentioned` → `border border-tag-border text-tag-ink font-mono`; type → `border border-tag-border text-tag-ink`. Replace the `text-zinc-400/500`.

- [ ] **Step 5: `components/EntityDetail.tsx`** — name `font-mono text-ink` (large); significance stamp + type tag as in Step 4; "a.k.a." aliases line `text-muted`; description in `text-ink` (serif, inherited); "Sightings" section heading `font-mono`, grouped `B·C·¶` anchors `font-mono text-muted`; first-appearance + the `<details>` "Case notes" history separated by `border-t border-rule`, version anchors `font-mono text-accent`. Replace ALL the `text-zinc-300|400|500|600|700`.

- [ ] **Step 6: `components/EntityView.tsx`** — "hasn't appeared yet" + "set your position" prompts: `text-muted` serif on paper, back-link `text-accent`. Replace the `text-zinc-500/600`.

- [ ] **Step 7: Verify.**
  - `! grep -rn "text-zinc-\|prefers-color-scheme" app components` → no matches (no leftover greys/dark-mode).
  - `npm run lint` clean; `npm test` → 24 pass (unchanged); `npm run export` succeeds.
  - `npm run e2e` → 4 pass (text/gating assertions unaffected by styling).
  - Spoiler-safety spot-check still holds: `! grep -qi "Crawler #\|marine tech" out/dcc/entity/carl/index.html`.

- [ ] **Step 8: Commit.** `git add app components && git commit -m "theme: apply case-file styling across all screens"`

---

## Self-Review

- **Spec coverage:** tokens/palette (T1) ✓ · light-only / remove dark media (T1) ✓ · serif body + mono via next/font (T1) ✓ · per-screen treatments for layout/footer, PositionBar, pickers, EntityIndex, EntityDetail, EntityView, series picker (T2 Steps 1–6) ✓ · AA contrast (palette values from spec, all ≥AA) ✓ · tests stay green + spoiler-safety (T1/T2 verify) ✓ · no `zinc-*` left, no dark media (T2 grep gate) ✓ · non-goals respected (className-only, no logic/layout change) ✓.
- **Placeholder scan:** none — globals.css + font wiring shown verbatim; component steps give the exact token→utility mapping + per-screen treatment + a grep completion gate.
- **Type consistency:** the utility names (`bg-paper`, `bg-surface`, `text-ink`, `text-muted`, `text-accent`, `text-accent-ink`, `bg-accent`, `border-border`, `border-rule`, `text-tag-ink`, `border-tag-border`, `font-mono`, `font-serif`) are exactly the `--color-*`/`--font-*` tokens defined in Task 1's `@theme`, so they resolve to real Tailwind v4 utilities.
```
