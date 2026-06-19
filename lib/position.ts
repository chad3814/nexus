import type { Cutoff } from "@/lib/types";

/** Sentinel meaning "show everything" (full series — no gating). */
export const FULL_SERIES = "__all__";

export function parseCutoff(s: string | null): Cutoff | null {
  if (!s) return null;
  if (s === FULL_SERIES) return FULL_SERIES;
  return /^B\d+·\S+$/.test(s) ? s : null;
}

export function formatCutoff(c: Cutoff): string {
  if (c === FULL_SERIES) return "Everything";
  const [book, label] = c.split("·");
  return `Book ${book.replace("B", "")} · ${label}`;
}

/** The value to pass to viewAt as `through`: undefined for full series, else the cutoff. */
export function throughOf(c: Cutoff): Cutoff | undefined {
  return c === FULL_SERIES ? undefined : c;
}

const key = (seriesId: string): string => `nexus.position.${seriesId}`;
export function readPosition(seriesId: string): Cutoff | null {
  if (typeof localStorage === "undefined") return null;
  return parseCutoff(localStorage.getItem(key(seriesId)));
}
export function writePosition(seriesId: string, cutoff: Cutoff): void {
  localStorage.setItem(key(seriesId), cutoff);
}
