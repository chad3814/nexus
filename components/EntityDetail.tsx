"use client";

import { anchorSortKey, normalizeAnchor } from "@/lib/gating";
import type { Cutoff, DescriptionEvent, RegistryEntity } from "@/lib/types";

interface EntityDetailProps {
  entity: RegistryEntity;
  versions: DescriptionEvent[];
  cutoff: Cutoff;
}

/** Extract the "B·label" part (e.g. "B1·C3") from a full anchor. */
function bookChapter(anchor: string): string {
  const parts = normalizeAnchor(anchor).split("·");
  return `${parts[0] ?? ""}·${parts[1] ?? ""}`;
}

/** Sort comparator for anchor strings using anchorSortKey. */
function cmpAnchorStr(a: string, b: string): number {
  const ka = anchorSortKey(a);
  const kb = anchorSortKey(b);
  return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
}

export default function EntityDetail({ entity, versions, cutoff }: EntityDetailProps) {
  // Group appearances by "B·label" in reading order
  const sortedAppearances = [...entity.appearances].sort(cmpAnchorStr);

  const groupedMap = new Map<string, string[]>();
  for (const anchor of sortedAppearances) {
    const key = bookChapter(anchor);
    const existing = groupedMap.get(key);
    if (existing) {
      existing.push(anchor);
    } else {
      groupedMap.set(key, [anchor]);
    }
  }
  // Preserve insertion order (which is reading order since we sorted first)
  const groups = [...groupedMap.entries()];

  // Sort versions chronologically for display
  const sortedVersions = [...versions].sort((a, b) => cmpAnchorStr(a.anchor, b.anchor));

  return (
    <article className="max-w-2xl mx-auto p-4 flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{entity.canonicalName}</h1>
        <div className="flex flex-wrap gap-2 text-sm text-zinc-500">
          <span className="bg-zinc-100 rounded px-2 py-0.5">{entity.type}</span>
          <span className="bg-zinc-100 rounded px-2 py-0.5">{entity.significance}</span>
          {entity.tags.map((tag) => (
            <span key={tag} className="bg-zinc-100 rounded px-2 py-0.5">{tag}</span>
          ))}
        </div>
      </header>

      {/* Current description */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 mb-1">Description</h2>
        <p className="text-sm leading-relaxed">{entity.description}</p>
      </section>

      {/* Aliases */}
      {entity.aliases.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 mb-1">Also known as</h2>
          <ul className="flex flex-wrap gap-2">
            {entity.aliases.map((alias) => (
              <li key={alias} className="text-sm bg-zinc-50 border rounded px-2 py-0.5">{alias}</li>
            ))}
          </ul>
        </section>
      )}

      {/* First appearance */}
      {entity.firstAppearance && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 mb-1">First appearance</h2>
          <p className="text-sm font-mono text-zinc-600">{entity.firstAppearance.anchor}</p>
          {entity.firstAppearance.snippet && (
            <blockquote className="mt-1 text-sm italic text-zinc-500 border-l-2 border-zinc-200 pl-3">
              {entity.firstAppearance.snippet}
            </blockquote>
          )}
        </section>
      )}

      {/* Appearances grouped by book·chapter */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 mb-2">
          Appearances ({entity.appearances.length})
        </h2>
        <div className="flex flex-col gap-2">
          {groups.map(([label, anchors]) => (
            <div key={label}>
              <p className="text-xs font-semibold text-zinc-500">{label}</p>
              <p className="text-xs text-zinc-400 font-mono">{anchors.join(", ")}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Description history (collapsible) */}
      {sortedVersions.length > 0 && (
        <section>
          <details>
            <summary className="text-sm font-semibold uppercase tracking-wide text-zinc-400 cursor-pointer select-none">
              Description history ({sortedVersions.length} version{sortedVersions.length !== 1 ? "s" : ""})
            </summary>
            <ol className="mt-2 flex flex-col gap-3">
              {sortedVersions.map((v) => (
                <li key={v.anchor} className="text-sm border-l-2 border-zinc-200 pl-3">
                  <p className="text-xs font-mono text-zinc-400 mb-0.5">as of {v.anchor}</p>
                  <p className="leading-relaxed text-zinc-700">{v.description}</p>
                </li>
              ))}
            </ol>
          </details>
        </section>
      )}

      {/* Position watermark */}
      <footer className="text-xs text-zinc-300 border-t pt-2">
        Position: {cutoff === "__all__" ? "Full series" : cutoff}
      </footer>
    </article>
  );
}
