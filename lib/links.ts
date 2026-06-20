import { cleanAliases } from "@/lib/gating";
import type { RegistryEntity } from "@/lib/types";

export interface LinkCandidate {
  id: string;
  names: string[];
}

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

  // Group each lowercase surface form → set of entity ids.
  // A name shared by two different entities is ambiguous and must not link.
  const idsForName = new Map<string, Set<string>>();
  for (const p of pairs) {
    const key = p.name.toLowerCase();
    const set = idsForName.get(key) ?? new Set<string>();
    set.add(p.id);
    idsForName.set(key, set);
  }
  const unambiguous = pairs.filter((p) => (idsForName.get(p.name.toLowerCase())?.size ?? 0) === 1);
  if (unambiguous.length === 0) return [{ text }];

  const idByName = new Map(unambiguous.map((p) => [p.name.toLowerCase(), p.id]));
  // Unicode-aware word boundaries: use \p{L}\p{N}_ to handle non-ASCII letters (e.g. "Zoé").
  const alternation = unambiguous.map((p) => escapeRegex(p.name)).join("|");
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])(${alternation})(?![\\p{L}\\p{N}_])`, "giu");

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
