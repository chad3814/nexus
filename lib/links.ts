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
