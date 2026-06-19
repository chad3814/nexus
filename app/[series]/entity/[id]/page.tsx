import { Suspense } from "react";
import { readSeriesManifest, readEntityIds } from "@/lib/series";
import EntityView from "@/components/EntityView";

interface Props {
  params: Promise<{ series: string; id: string }>;
}

export function generateStaticParams() {
  return readSeriesManifest().flatMap((s) =>
    readEntityIds(s.id).map((id) => ({ series: s.id, id })),
  );
}

export default async function EntityPage({ params }: Props) {
  const { series: seriesId, id: entityId } = await params;

  return (
    <Suspense>
      <EntityView seriesId={seriesId} entityId={entityId} />
    </Suspense>
  );
}
