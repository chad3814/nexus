import type { AliasEvent, DescriptionEvent, Registry } from "@/lib/types";

export interface SeriesData { registry: Registry; descriptions: DescriptionEvent[]; aliases: AliasEvent[]; }
const cache = new Map<string, Promise<SeriesData>>();

export function loadSeries(id: string): Promise<SeriesData> {
  const existing = cache.get(id);
  if (existing) return existing;
  const p = (async () => {
    const [registry, descriptions, aliases] = await Promise.all([
      fetch(`/data/${id}/registry.json`).then((r) => r.json() as Promise<Registry>),
      fetch(`/data/${id}/descriptions.json`).then((r) => r.json() as Promise<DescriptionEvent[]>),
      fetch(`/data/${id}/aliases.json`).then((r) => r.json() as Promise<AliasEvent[]>),
    ]);
    return { registry, descriptions, aliases };
  })();
  cache.set(id, p);
  return p;
}
