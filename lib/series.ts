import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Registry, SeriesManifest } from "@/lib/types";

const dataDir = join(process.cwd(), "public", "data");

export function readSeriesManifest(): SeriesManifest[] {
  return JSON.parse(readFileSync(join(dataDir, "series.json"), "utf8")) as SeriesManifest[];
}

export function readEntityIds(seriesId: string): string[] {
  const reg = JSON.parse(readFileSync(join(dataDir, seriesId, "registry.json"), "utf8")) as Registry;
  return reg.entities.map((e) => e.id);
}
