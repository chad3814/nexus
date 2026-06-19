import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSeriesManifest } from "../lib/manifest.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const casefiles = process.env.CASEFILES_DIR ?? join(root, "..", "casefiles");

// Per-series config: where each series' files live under casefiles, + display metadata.
const SERIES = [
  { id: "dcc", title: "Dungeon Crawler Carl", author: "Matt Dinniman",
    registry: "dcc/output/registry.json", descriptions: "dcc/log/descriptions.json", aliases: "dcc/log/aliases.json" },
];

const manifests = [];
for (const s of SERIES) {
  const src = (p) => join(casefiles, p);
  for (const f of [s.registry, s.descriptions, s.aliases]) {
    if (!existsSync(src(f))) throw new Error(`sync-data: missing ${src(f)} (set CASEFILES_DIR?)`);
  }
  const outDir = join(root, "public", "data", s.id);
  mkdirSync(outDir, { recursive: true });
  cpSync(src(s.registry), join(outDir, "registry.json"));
  cpSync(src(s.descriptions), join(outDir, "descriptions.json"));
  cpSync(src(s.aliases), join(outDir, "aliases.json"));
  const registry = JSON.parse(readFileSync(src(s.registry), "utf8"));
  manifests.push(buildSeriesManifest({ id: s.id, title: s.title, author: s.author }, registry));
  console.log(`synced ${s.id}: ${registry.entities.length} entities`);
}
mkdirSync(join(root, "public", "data"), { recursive: true });
writeFileSync(join(root, "public", "data", "series.json"), JSON.stringify(manifests, null, 2));
console.log(`wrote series.json (${manifests.length} series)`);
