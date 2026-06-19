import type { AliasEvent, Cutoff, DescriptionEvent, Registry, RegistryEntity } from "@/lib/types";

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[''']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
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
    // Fix firstAppearance to the earliest kept appearance
    const earliestKept = kept[0];
    next.firstAppearance = earliestKept
      ? {
          anchor: earliestKept,
          snippet:
            e.firstAppearance && normalizeAnchor(e.firstAppearance.anchor) === earliestKept
              ? e.firstAppearance.snippet
              : "",
        }
      : null;
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
