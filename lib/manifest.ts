import { deriveBooks } from "@/lib/gating";
import type { Registry, SeriesManifest } from "@/lib/types";

export function buildSeriesManifest(
  meta: { id: string; title: string; author: string },
  registry: Registry,
): SeriesManifest {
  const books = registry.books
    ? registry.books.map((b) => ({ number: b.number, chapters: b.sections }))
    : deriveBooks(registry);
  return { ...meta, books };
}
