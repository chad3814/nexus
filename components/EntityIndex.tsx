"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { EntityType, RegistryEntity, Significance, EntityTag, Cutoff } from "@/lib/types";
import { compareEntities, dirLabel, SORT_KEYS, buildChapterIndex, cutoffChapterIndex, type SortKey } from "@/lib/entity-sort";

interface EntityIndexProps {
  entities: RegistryEntity[];
  seriesId: string;
  cutoff: Cutoff;
  books: Array<{ number: number; chapters: string[] }>;
}

function matchesSearch(e: RegistryEntity, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  if (e.canonicalName.toLowerCase().includes(lower)) return true;
  return e.aliases.some((a) => a.toLowerCase().includes(lower));
}

function sigClass(sig: Significance): string {
  if (sig === "major" || sig === "supporting") {
    return "bg-accent text-accent-ink font-mono text-xs px-2 py-0.5 rounded";
  }
  return "border border-tag-border text-tag-ink font-mono text-xs px-2 py-0.5 rounded";
}

export function EntityIndex({ entities, seriesId, cutoff, books }: EntityIndexProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<EntityType | "">("");
  const [sigFilter, setSigFilter] = useState<Significance | "">("");
  const [tagFilter, setTagFilter] = useState<EntityTag | "">("");
  const [sortKey, setSortKey] = useState<SortKey>("relevance");
  const [dirPrimary, setDirPrimary] = useState(true);

  const types = useMemo(
    () => [...new Set(entities.map((e) => e.type))].sort() as EntityType[],
    [entities],
  );
  const tags = useMemo(
    () => [...new Set(entities.flatMap((e) => e.tags))].sort() as EntityTag[],
    [entities],
  );

  const chapterIndex = useMemo(() => buildChapterIndex(books), [books]);
  const cutoffIdx = useMemo(() => cutoffChapterIndex(cutoff, chapterIndex), [cutoff, chapterIndex]);

  const filtered = useMemo(() => {
    return entities
      .filter((e) => matchesSearch(e, search))
      .filter((e) => !typeFilter || e.type === typeFilter)
      .filter((e) => !sigFilter || e.significance === sigFilter)
      .filter((e) => !tagFilter || e.tags.includes(tagFilter))
      .sort((a, b) => compareEntities(a, b, sortKey, dirPrimary, { chapterIndex, cutoffIdx }));
  }, [entities, search, typeFilter, sigFilter, tagFilter, sortKey, dirPrimary, chapterIndex, cutoffIdx]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Search entities…"
          className="bg-surface border border-border rounded px-2 py-1 text-sm text-ink flex-1 min-w-40"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="bg-surface border border-border rounded px-2 py-1 text-sm text-ink"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as EntityType | "")}
        >
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          className="bg-surface border border-border rounded px-2 py-1 text-sm text-ink"
          value={sigFilter}
          onChange={(e) => setSigFilter(e.target.value as Significance | "")}
        >
          <option value="">All significance</option>
          <option value="major">major</option>
          <option value="supporting">supporting</option>
          <option value="minor">minor</option>
          <option value="mentioned">mentioned</option>
        </select>
        <select
          className="bg-surface border border-border rounded px-2 py-1 text-sm text-ink"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value as EntityTag | "")}
        >
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          aria-label="Sort"
          className="bg-surface border border-border rounded px-2 py-1 text-sm text-ink"
          value={sortKey}
          onChange={(ev) => { setSortKey(ev.target.value as SortKey); setDirPrimary(true); }}
        >
          {SORT_KEYS.map((s) => (<option key={s.key} value={s.key}>{s.label}</option>))}
        </select>
        <button
          type="button"
          aria-label="Toggle direction"
          className="bg-surface border border-border rounded px-2 py-1 text-sm text-accent"
          onClick={() => setDirPrimary((p) => !p)}
        >
          {dirLabel(sortKey, dirPrimary)}
        </button>
      </div>
      <p className="text-xs text-muted">{filtered.length} entities</p>
      <ul className="flex flex-col gap-2">
        {filtered.map((e) => (
          <li key={e.id}>
            <Link
              href={"/" + seriesId + "/entity/" + e.id + "/"}
              className="flex items-center gap-3 py-2 px-3 bg-surface border border-border shadow-[2px_3px_0_rgba(60,48,28,.12)] rounded hover:shadow-[3px_4px_0_rgba(60,48,28,.18)] transition-shadow text-sm"
            >
              <span className="font-mono text-ink flex-1">{e.canonicalName}</span>
              <span className="border border-tag-border text-tag-ink text-xs px-2 py-0.5 rounded">{e.type}</span>
              <span className={sigClass(e.significance)}>{e.significance}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
