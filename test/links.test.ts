import { describe, expect, it } from "vitest";
import { linkCandidates, linkify } from "@/lib/links";
import type { RegistryEntity } from "@/lib/types";

const ent = (id: string, name: string, sig: RegistryEntity["significance"], aliases: string[]): RegistryEntity => ({
  id, canonicalName: name, aliases, type: "person", tags: [], significance: sig,
  description: "", firstAppearance: null, appearances: [],
});

describe("linkCandidates", () => {
  const entities = [
    ent("donut", "Donut", "major", ["the Princess", "Princess"]),
    ent("pp", "Princess Posse", "supporting", ["The Princess Posse"]),
    ent("noflex", "Epitome Noflex", "minor", ["the mother"]),
    ent("self", "Self", "major", []),
  ];
  it("keeps only major/supporting, excludes self", () => {
    const ids = linkCandidates(entities, "self").map((c) => c.id).sort();
    expect(ids).toEqual(["donut", "pp"]);
  });
  it("includes canonical name + cleaned aliases", () => {
    const pp = linkCandidates(entities, "self").find((c) => c.id === "pp");
    expect(pp?.names).toContain("Princess Posse");
    expect(pp?.names).toContain("The Princess Posse");
  });
});

describe("linkify mis-link regression (the Princess Posse)", () => {
  it("links the full 'the Princess Posse' to princess-posse, not Donut", () => {
    const cands = [
      { id: "donut", names: ["the Princess", "Princess"] },
      { id: "pp", names: ["Princess Posse", "The Princess Posse"] },
    ];
    const segs = linkify("It awards all its assets to the Princess Posse.", cands, "dcc");
    const link = segs.find((s) => "href" in s);
    expect(link).toEqual({ text: "the Princess Posse", href: "/dcc/entity/pp/" });
    expect(segs.some((s) => "href" in s && s.href.includes("/donut/"))).toBe(false);
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
  it("returns a single plain segment when candidates are present but none match", () => {
    expect(linkify("Nobody here.", [{ id: "carl", names: ["Carl"] }], "dcc")).toEqual([
      { text: "Nobody here." },
    ]);
  });
  it("does not link an ambiguous name shared by two different entities", () => {
    const ambigCands = [
      { id: "sarge1", names: ["Sarge", "Sergeant Blake"] },
      { id: "sarge2", names: ["Sarge", "Sergeant Hill"] },
    ];
    expect(linkify("Sarge nods.", ambigCands, "dcc")).toEqual([{ text: "Sarge nods." }]);
  });
  it("links a non-ASCII name at a word boundary", () => {
    const segs = linkify("Then Zoé arrived.", [{ id: "z", names: ["Zoé"] }], "dcc");
    expect(segs).toEqual([
      { text: "Then " },
      { text: "Zoé", href: "/dcc/entity/z/" },
      { text: " arrived." },
    ]);
  });
});
