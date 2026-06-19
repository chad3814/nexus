import { Suspense } from "react";
import { readSeriesManifest } from "@/lib/series";
import SeriesView from "@/components/SeriesView";

interface Props {
  params: Promise<{ series: string }>;
}

export function generateStaticParams() {
  return readSeriesManifest().map((s) => ({ series: s.id }));
}

export default async function SeriesPage({ params }: Props) {
  const { series: seriesId } = await params;
  const all = readSeriesManifest();
  const manifest = all.find((s) => s.id === seriesId);
  if (!manifest) return <div>Series not found</div>;

  return (
    <Suspense>
      <SeriesView seriesId={seriesId} manifest={manifest} />
    </Suspense>
  );
}
