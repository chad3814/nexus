# nexus — "Case file" visual theme — design

**Date:** 2026-06-19
**Status:** Approved (design)
**Repo:** `nexus`

## Goal

Give `nexus` a cohesive visual identity — a "case file / dossier" theme matching the
`dossier` → `casefiles` → `nexus` lineage — and fix the accessibility defect where secondary
text (`text-zinc-300/400/500`) is unreadable light-grey on a white background. Restyle only:
no layout restructuring, no logic or markup-structure changes, no new features.

## Decisions

- **Direction B — "Case file":** warm paper surfaces, ink text, a redacted-stamp red accent,
  monospace headings/IDs, serif body prose.
- **Light-only:** remove the current half-baked `@media (prefers-color-scheme: dark)` override
  from `globals.css`. (A "dark dossier" variant is a possible future add, out of scope here.)
- **Serif body:** add one web font via `next/font/google` (Source Serif 4) for description
  prose; keep Geist Mono (already loaded) for headings, entity names, anchors, labels, badges.

## Palette (CSS custom properties / Tailwind v4 `@theme` tokens)

| Token | Value | Use |
|---|---|---|
| `--paper` | `#e7dcc4` | page background (manila) |
| `--surface` | `#f7f1e3` | cards / panels (cream) |
| `--border` | `#d2c4a6` | card & control borders |
| `--rule` | `#c8b890` | subtle/dashed separators |
| `--ink` | `#211d16` | primary text |
| `--muted` | `#6b5f49` | secondary text (replaces all `zinc-*` greys) |
| `--accent` | `#9e2b25` | stamp red — IDs/crawler-numbers, links, active state, MAJOR stamp |
| `--accent-ink` | `#fbf4e6` | text on accent fills |
| `--tag-border` | `#b8a06a` | bordered secondary tags (type) |
| `--tag-ink` | `#6b5226` | secondary-tag text |
| card shadow | `2px 3px 0 rgba(60,48,28,.12)` | stacked-paper offset |

**Accessibility:** every text/background pairing meets WCAG AA (≥ 4.5:1). Verified for the set
above (`--muted` on `--surface` ≈ 5.3:1; `--accent` on `--surface` ≈ 7:1; `--accent-ink` on
`--accent` ≈ 8:1; `--tag-ink` on `--surface` ≈ 6.5:1). No text uses a near-background grey.

## Typography

- **Mono (Geist Mono, existing):** page/section headings, entity canonical names, `B·C·¶`
  anchors, badges/labels, the position stamp, footer.
- **Serif (Source Serif 4, new via `next/font/google`):** body/description prose, aliases line.
- Set `--font-serif` and apply it to `body`; headings/anchors/labels use the mono token.

## Per-screen treatment (classes/colors only — structure unchanged)

- **Root layout / footer:** paper background, ink text, serif body; footer in small mono on `--muted`.
- **PositionBar (header):** a file-header bar (surface + bottom border); current position rendered as a stamp — `THROUGH B3·C5` in `--accent` mono; "Change" as an accent link.
- **Series picker & PositionPicker:** framed like a form on paper — `--surface` panel, `--border`; `<select>`/buttons styled as document fields (ink text, border, accent focus ring); the primary button filled `--accent`/`--accent-ink`.
- **EntityIndex:** search + filter controls as document fields; entity rows as cream "case rows" (surface, border, offset shadow, hover lift); name in mono ink; type as a bordered tag (`--tag-*`); significance as a stamp (MAJOR/SUPPORTING filled `--accent`; minor/mentioned bordered).
- **EntityDetail:** the case file — name as a typed mono heading; a red MAJOR stamp + bordered type/tag row; "a.k.a." aliases line in `--muted`; description in serif `--ink`; a mono "Sightings" heading over the grouped `B·C·¶` appearances; the `<details>` description history styled as a "Case notes" section with a `--rule` divider.
- **EntityView "hasn't appeared yet" + no-position prompts:** muted serif on paper, accent link back.

## Scope & files

- `app/globals.css` — replace the default tokens with the palette above via `@theme`; remove the dark-mode `@media`; set `body` to serif + ink on paper.
- `app/layout.tsx` — add Source Serif via `next/font/google`; wire `--font-serif`; footer color → `--muted`.
- `components/{SeriesPicker,PositionPicker,PositionBar,EntityIndex,EntityDetail,EntityView}.tsx` and `app/page.tsx` — replace `text-zinc-*`/default surfaces with theme tokens/utility classes per the treatments above. **No changes to component logic, props, hooks, or DOM structure** beyond `className` and minimal wrapper elements for styling.

## Testing

- The existing **24 unit + 4 e2e tests assert text content and gating behavior, not colors** — they must remain green unchanged. Run `npm test`, `npm run export`, `npm run e2e` after the restyle.
- `npm run lint` clean. No `any`/`unknown`. 2-space + semicolons.
- Manual check after deploy: muted text is readable; spot-check a few entity pages + the index.

## Non-goals

- Dark mode (future "dark dossier"), layout/IA changes, new components or features, redesigning the gating UX.
