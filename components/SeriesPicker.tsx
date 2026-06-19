import Link from "next/link";
import type { SeriesManifest } from "@/lib/types";

interface SeriesPickerProps {
  series: SeriesManifest[];
}

export function SeriesPicker({ series }: SeriesPickerProps) {
  return (
    <ul className="flex flex-col gap-3">
      {series.map((s) => (
        <li key={s.id}>
          <Link
            href={"/" + s.id + "/"}
            className="block bg-surface border border-border shadow-[2px_3px_0_rgba(60,48,28,.12)] rounded p-4 hover:shadow-[3px_4px_0_rgba(60,48,28,.18)] transition-shadow"
          >
            <span className="block font-mono text-ink text-lg">{s.title}</span>
            <span className="block text-muted text-sm">{s.author}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
