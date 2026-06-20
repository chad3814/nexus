"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { parseCutoff, throughOf, readPosition, writePosition } from "@/lib/position";
import { loadSeries } from "@/lib/data";
import { viewAt } from "@/lib/gating";
import { PositionPicker } from "@/components/PositionPicker";
import { PositionBar } from "@/components/PositionBar";
import { EntityIndex } from "@/components/EntityIndex";
import type { Cutoff, SeriesManifest } from "@/lib/types";
import type { SeriesData } from "@/lib/data";

interface SeriesViewProps {
  seriesId: string;
  manifest: SeriesManifest;
}

export default function SeriesView({ seriesId, manifest }: SeriesViewProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [cutoff, setCutoff] = useState<Cutoff | null>(() =>
    parseCutoff(searchParams.get("through")) ?? readPosition(seriesId),
  );
  const [showPicker, setShowPicker] = useState(cutoff === null);
  const [data, setData] = useState<SeriesData | null>(null);

  function choose(c: string) {
    writePosition(seriesId, c);
    router.replace("?through=" + encodeURIComponent(c));
    setData(null);
    setCutoff(c);
    setShowPicker(false);
  }

  useEffect(() => {
    if (cutoff === null) return;
    let cancelled = false;
    loadSeries(seriesId).then((d) => {
      if (!cancelled) setData(d);
    });
    return () => { cancelled = true; };
  }, [seriesId, cutoff]);

  const view = useMemo(() => {
    if (!data || cutoff === null) return null;
    return viewAt(data.registry, {
      through: throughOf(cutoff),
      descriptions: data.descriptions,
      aliases: data.aliases,
    });
  }, [data, cutoff]);

  if (showPicker || cutoff === null) {
    return (
      <main className="max-w-2xl mx-auto">
        <PositionPicker manifest={manifest} onChoose={choose} />
      </main>
    );
  }

  const loading = data === null;

  return (
    <main>
      <PositionBar current={cutoff} books={manifest.books} onChangePicker={() => setShowPicker(true)} />
      {loading && <p className="p-4 text-sm text-muted">Loading…</p>}
      {view && <EntityIndex entities={view.entities} seriesId={seriesId} cutoff={cutoff} books={manifest.books} />}
    </main>
  );
}
