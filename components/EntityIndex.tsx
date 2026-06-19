"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { EntityType, RegistryEntity, Significance, EntityTag } from "@/lib/types";

interface EntityIndexProps {
  entities: RegistryEntity[];
  seriesId: string;
}

const SIG_RANK: Record<Significance, number> = { major: 0, supporting: 1, minor: 2, mentioned: 3 };

function matchesSearch(e: RegistryEntity, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  if (e.canonicalName.toLowerCase().includes(lower)) return true;
  return e.aliases.some((a) => a.toLowerCase().includes(lower));
}

export function EntityIndex({ entities, seriesId }: EntityIndexProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<EntityType | "">("");
  const [sigFilter, setSigFilter] = useState<Significance | "">("");
  const [tagFilter, setTagFilter] = useState<EntityTag | "">("");

  const types = useMemo(
    () => [...new Set(entities.map((e) => e.type))].sort() as EntityType[],
    [entities],
  );
  const tags = useMemo(
    () => [...new Set(entities.flatMap((e) => e.tags))].sort() as EntityTag[],
    [entities],
  );

  const filtered = useMemo(() => {
    return entities
      .filter((e) => matchesSearch(e, search))
      .filter((e) => !typeFilter || e.type === typeFilter)
      .filter((e) => !sigFilter || e.significance === sigFilter)
      .filter((e) => !tagFilter || e.tags.includes(tagFilter))
      .sort((a, b) => {
        const sr = SIG_RANK[a.significance] - SIG_RANK[b.significance];
        if (sr !== 0) return sr;
        return a.canonicalName.localeCompare(b.canonicalName);
      });
  }, [entities, search, typeFilter, sigFilter, tagFilter]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Search entities…"
          className="border rounded px-2 py-1 text-sm flex-1 min-w-40"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border rounded px-2 py-1 text-sm"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as EntityType | "")}
        >
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          className="border rounded px-2 py-1 text-sm"
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
          className="border rounded px-2 py-1 text-sm"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value as EntityTag | "")}
        >
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <p className="text-xs text-zinc-500">{filtered.length} entities</p>
      <ul className="flex flex-col divide-y">
        {filtered.map((e) => (
          <li key={e.id}>
            <Link
              href={"/" + seriesId + "/entity/" + e.id + "/"}
              className="flex items-center gap-3 py-2 hover:bg-zinc-50 px-1 text-sm"
            >
              <span className="font-medium flex-1">{e.canonicalName}</span>
              <span className="text-zinc-400">{e.type}</span>
              <span className="text-zinc-400">{e.significance}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
