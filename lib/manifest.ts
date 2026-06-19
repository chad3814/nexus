import { deriveBooks } from "@/lib/gating";
import type { Registry, SeriesManifest } from "@/lib/types";

export function buildSeriesManifest(
  meta: { id: string; title: string; author: string },
  registry: Registry,
): SeriesManifest {
  return { ...meta, books: deriveBooks(registry) };
}
