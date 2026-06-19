"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { parseCutoff, throughOf, readPosition } from "@/lib/position";
import { loadSeries } from "@/lib/data";
import { viewAt, withinCutoff } from "@/lib/gating";
import EntityDetail from "@/components/EntityDetail";
import type { Cutoff } from "@/lib/types";
import type { SeriesData } from "@/lib/data";

interface EntityViewProps {
  seriesId: string;
  entityId: string;
}

export default function EntityView({ seriesId, entityId }: EntityViewProps) {
  const searchParams = useSearchParams();

  // Resolve cutoff: URL param takes priority, else stored position
  const cutoff: Cutoff | null =
    parseCutoff(searchParams.get("through")) ?? readPosition(seriesId);

  const [data, setData] = useState<SeriesData | null>(null);

  useEffect(() => {
    if (cutoff === null) return;
    let cancelled = false;
    loadSeries(seriesId).then((d) => {
      if (!cancelled) setData(d);
    });
    return () => { cancelled = true; };
  }, [seriesId, cutoff]);

  // No position set yet — prompt user to set one
  if (cutoff === null) {
    return (
      <main className="max-w-2xl mx-auto p-4">
        <p className="text-sm text-zinc-600 mb-3">
          You haven&apos;t set your reading position yet. Set it to view entity details without spoilers.
        </p>
        <Link
          href={"/" + seriesId + "/"}
          className="text-sm text-blue-600 hover:underline"
        >
          Set your reading position for this series →
        </Link>
      </main>
    );
  }

  const loading = data === null;

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto p-4">
        <p className="text-sm text-zinc-500">Loading…</p>
      </main>
    );
  }

  const view = viewAt(data.registry, {
    through: throughOf(cutoff),
    descriptions: data.descriptions,
    aliases: data.aliases,
  });

  const entity = view.entities.find((e) => e.id === entityId);

  // Entity not visible at this cutoff — spoiler-safe message
  if (!entity) {
    return (
      <main className="max-w-2xl mx-auto p-4">
        <p className="text-sm text-zinc-600">
          This character hasn&apos;t appeared yet at your reading position.
        </p>
        <Link
          href={"/" + seriesId + "/"}
          className="mt-3 inline-block text-sm text-blue-600 hover:underline"
        >
          ← Back to entity list
        </Link>
      </main>
    );
  }

  // Filter description versions to those ≤ cutoff
  const versions = data.descriptions.filter(
    (d) => d.id === entityId && withinCutoff(d.anchor, throughOf(cutoff)),
  );

  return (
    <main>
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <Link
          href={"/" + seriesId + "/"}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to entity list
        </Link>
      </div>
      <EntityDetail entity={entity} versions={versions} cutoff={cutoff} />
    </main>
  );
}
