import { readSeriesManifest } from "@/lib/series";
import { SeriesPicker } from "@/components/SeriesPicker";

export default function Home() {
  const series = readSeriesManifest();
  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-mono text-ink mb-6">Choose a series</h1>
      <SeriesPicker series={series} />
    </main>
  );
}
