import { deriveBooks } from "@/lib/gating";
import type { Registry, SeriesManifest } from "@/lib/types";

export function buildSeriesManifest(
  meta: { id: string; title: string; author: string },
  registry: Registry,
): SeriesManifest {
  const books = registry.books
    ? registry.books.map((b) => (b.title
        ? { number: b.number, title: b.title, chapters: b.sections }
        : { number: b.number, chapters: b.sections }))
    : deriveBooks(registry);
  return { ...meta, books };
}
