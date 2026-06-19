import Link from "next/link";
import type { SeriesManifest } from "@/lib/types";

interface SeriesPickerProps {
  series: SeriesManifest[];
}

export function SeriesPicker({ series }: SeriesPickerProps) {
  return (
    <ul>
      {series.map((s) => (
        <li key={s.id}>
          <Link href={"/" + s.id + "/"}>
            <span>{s.title}</span>
            <span>{s.author}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
