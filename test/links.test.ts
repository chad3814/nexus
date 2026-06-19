import { describe, expect, it } from "vitest";
import { candidatesInChapter, chapterOf, linkify } from "@/lib/links";
import type { RegistryEntity } from "@/lib/types";

const ent = (id: string, canonicalName: string, aliases: string[], appearances: string[]): RegistryEntity => ({
  id, canonicalName, aliases, type: "person", tags: [], significance: "minor",
  description: "", firstAppearance: null, appearances,
});

describe("chapterOf", () => {
  it("returns the B·label prefix", () => {
    expect(chapterOf("B3·C5·¶7")).toBe("B3·C5");
    expect(chapterOf("[B1·Interlude·¶2]")).toBe("B1·Interlude");
  });
});

describe("candidatesInChapter", () => {
  const entities = [
    ent("self", "Donut", [], ["B1·C1·¶1"]),
    ent("carl", "Carl", ["the cat"], ["B1·C1·¶3", "B2·C1·¶1"]),
    ent("mord", "Mordecai", [], ["B2·C4·¶1"]),
  ];
  it("returns in-chapter entities except self, with canonical + cleaned aliases", () => {
    const c = candidatesInChapter(entities, "B1·C1", "self");
    expect(c).toEqual([{ id: "carl", names: ["Carl", "the cat"] }]);
  });
  it("excludes entities not in the chapter", () => {
    expect(candidatesInChapter(entities, "B1·C1", "self").some((c) => c.id === "mord")).toBe(false);
  });
});

describe("linkify", () => {
  const cands = [
    { id: "carl", names: ["Carl"] },
    { id: "donut", names: ["Princess Donut", "Donut"] },
  ];
  it("links the first mention of each entity, longest name first", () => {
    const segs = linkify("Princess Donut nods. Donut purrs. Carl waves to Carl.", cands, "dcc");
    expect(segs).toEqual([
      { text: "Princess Donut", href: "/dcc/entity/donut/" },
      { text: " nods. Donut purrs. " },
      { text: "Carl", href: "/dcc/entity/carl/" },
      { text: " waves to Carl." },
    ]);
  });
  it("leaves a possessive 's outside the link and respects word boundaries", () => {
    const segs = linkify("Carl's friend Carlos left.", [{ id: "carl", names: ["Carl"] }], "dcc");
    expect(segs).toEqual([
      { text: "Carl", href: "/dcc/entity/carl/" },
      { text: "'s friend Carlos left." },
    ]);
  });
  it("returns a single plain segment when there are no candidates", () => {
    expect(linkify("Nobody here.", [], "dcc")).toEqual([{ text: "Nobody here." }]);
  });
});
