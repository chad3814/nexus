import { readSeriesManifest } from "@/lib/series";
import { SeriesPicker } from "@/components/SeriesPicker";

export default function Home() {
  const series = readSeriesManifest();
  return (
    <main>
      <h1>Choose a series</h1>
      <SeriesPicker series={series} />
    </main>
  );
}
