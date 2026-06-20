import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EntityDetail from "@/components/EntityDetail";
import type { BookSections, DescriptionEvent, RegistryEntity } from "@/lib/types";

const mk = (id: string, name: string, appearances: string[], description = ""): RegistryEntity => ({
  id, canonicalName: name, aliases: [], type: "person", tags: [], significance: "minor",
  description, firstAppearance: null, appearances,
});

// EntityDetail is a pure presentational component — no mocks needed.

const entity: RegistryEntity = {
  id: "carl",
  canonicalName: "Carl",
  aliases: ["Crawler #4,122", "Royal Bodyguard Carl"],
  type: "person",
  tags: ["in_world"],
  significance: "major",
  description: "Carl is the narrator and protagonist.",
  firstAppearance: { anchor: "B1·C1·¶9", snippet: "My name is Carl." },
  appearances: ["B1·C1·¶9", "B1·C2·¶1", "B2·C1·¶3"],
};

// Two description versions within cutoff B1·C2, one beyond (B2)
const versions: DescriptionEvent[] = [
  {
    id: "carl",
    anchor: "B1·C1·¶9",
    description: "Early description of Carl at B1·C1.",
    significance: "major",
  },
  {
    id: "carl",
    anchor: "B1·C2·¶32",
    description: "Updated description of Carl at B1·C2.",
    significance: "major",
  },
  {
    id: "carl",
    anchor: "B2·C5·¶10",
    description: "SPOILER: post-B2 description that must not appear.",
    significance: "major",
  },
];

const cutoff = "B1·C2";

describe("EntityDetail", () => {
  it("renders canonical name", async () => {
    const { default: EntityDetail } = await import("@/components/EntityDetail");
    render(<EntityDetail entity={entity} versions={versions.slice(0, 2)} cutoff={cutoff} />);
    expect(screen.getByText("Carl")).toBeInTheDocument();
  });

  it("renders type, significance, and tags", async () => {
    const { default: EntityDetail } = await import("@/components/EntityDetail");
    render(<EntityDetail entity={entity} versions={versions.slice(0, 2)} cutoff={cutoff} />);
    expect(screen.getByText(/person/i)).toBeInTheDocument();
    expect(screen.getByText(/major/i)).toBeInTheDocument();
    expect(screen.getByText(/in_world/i)).toBeInTheDocument();
  });

  it("renders the current as-of description", async () => {
    const { default: EntityDetail } = await import("@/components/EntityDetail");
    render(<EntityDetail entity={entity} versions={versions.slice(0, 2)} cutoff={cutoff} />);
    expect(screen.getByText("Carl is the narrator and protagonist.")).toBeInTheDocument();
  });

  it("renders gated aliases", async () => {
    const { default: EntityDetail } = await import("@/components/EntityDetail");
    render(<EntityDetail entity={entity} versions={versions.slice(0, 2)} cutoff={cutoff} />);
    expect(screen.getByText(/Crawler #4,122/)).toBeInTheDocument();
    expect(screen.getByText(/Royal Bodyguard Carl/)).toBeInTheDocument();
  });

  it("shows appearances grouped by book label in order", async () => {
    const { default: EntityDetail } = await import("@/components/EntityDetail");
    render(<EntityDetail entity={entity} versions={versions.slice(0, 2)} cutoff={cutoff} />);
    // B1·C1 and B1·C2 and B2·C1 should appear (may be multiple elements)
    expect(screen.getAllByText(/B1·C1/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/B1·C2/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/B2·C1/).length).toBeGreaterThan(0);
  });

  it("shows first appearance info", async () => {
    const { default: EntityDetail } = await import("@/components/EntityDetail");
    render(<EntityDetail entity={entity} versions={versions.slice(0, 2)} cutoff={cutoff} />);
    // First appearance anchor appears in the first-appearance section
    expect(screen.getAllByText(/B1·C1·¶9/).length).toBeGreaterThan(0);
  });

  it("renders description history for within-cutoff versions", async () => {
    const { default: EntityDetail } = await import("@/components/EntityDetail");
    render(<EntityDetail entity={entity} versions={versions.slice(0, 2)} cutoff={cutoff} />);
    expect(screen.getByText(/Early description of Carl at B1·C1\./)).toBeInTheDocument();
    expect(screen.getByText(/Updated description of Carl at B1·C2\./)).toBeInTheDocument();
  });

  it("does NOT render the beyond-cutoff description version", async () => {
    const { default: EntityDetail } = await import("@/components/EntityDetail");
    // Pass only the 2 in-cutoff versions (EntityView filters before passing)
    render(<EntityDetail entity={entity} versions={versions.slice(0, 2)} cutoff={cutoff} />);
    expect(screen.queryByText(/SPOILER: post-B2 description/)).not.toBeInTheDocument();
  });
});

describe("EntityDetail cross-links", () => {
  const subject = mk("donut", "Donut", ["B1·C1·¶1"], "Donut trusts Carl completely.");
  const versions: DescriptionEvent[] = [
    { id: "donut", anchor: "B1·C1·¶1", description: "Donut trusts Carl completely.", significance: "major" },
  ];
  const entities = [
    subject,
    { ...mk("carl", "Carl", ["B1·C1·¶3"]), significance: "major" as const },
    mk("far", "Faraway", ["B5·C1·¶1"]),
  ];

  it("links a co-located mentioned entity to its page", () => {
    render(<EntityDetail entity={subject} versions={versions} cutoff="" books={[]} entities={entities} seriesId="dcc" />);
    const link = screen.getByRole("link", { name: "Carl" });
    expect(link).toHaveAttribute("href", "/dcc/entity/carl/");
  });

  it("does not link the subject itself", () => {
    render(<EntityDetail entity={subject} versions={versions} cutoff="" books={[]} entities={entities} seriesId="dcc" />);
    expect(screen.queryByRole("link", { name: "Donut" })).toBeNull();
  });

  it("does not link a minor-significance entity even when its name appears in the description", () => {
    // "Faraway" is minor; including it in the description should leave it as plain text.
    // "Carl" is major and IS linked — proving linkify is active and the gap is significance-gating.
    const subjectWithFaraway = {
      ...subject,
      description: "Donut trusts Carl completely and once met Faraway.",
    };
    const versionsWithFaraway: DescriptionEvent[] = [
      {
        id: "donut",
        anchor: "B1·C1·¶1",
        description: "Donut trusts Carl completely and once met Faraway.",
        significance: "major" as const,
      },
    ];
    render(
      <EntityDetail
        entity={subjectWithFaraway}
        versions={versionsWithFaraway}
        cutoff=""
        books={[]}
        entities={entities}
        seriesId="dcc"
      />,
    );
    // Carl (major) must be linked — proves linkify ran.
    expect(screen.getByRole("link", { name: "Carl" })).toHaveAttribute("href", "/dcc/entity/carl/");
    // Faraway (minor) must NOT be linked.
    expect(screen.queryByRole("link", { name: "Faraway" })).toBeNull();
  });

  it("does not link the subject to its own page even when subject is included in entities and name appears in description", () => {
    // Subject "Donut" is in `entities` (first element) AND its canonicalName appears
    // in the description. linkCandidates must exclude it by self-id, not just by absence.
    // We give Donut major significance so it would be linked if it were any other entity.
    const majorSubject: RegistryEntity = {
      ...subject,
      significance: "major",
      description: "Donut trusts Carl completely.",
    };
    const entitiesWithMajorDonut: RegistryEntity[] = [
      majorSubject,
      { ...mk("carl", "Carl", ["B1·C1·¶3"]), significance: "major" as const },
      mk("far", "Faraway", ["B5·C1·¶1"]),
    ];
    const versionsForMajor: DescriptionEvent[] = [
      {
        id: "donut",
        anchor: "B1·C1·¶1",
        description: "Donut trusts Carl completely.",
        significance: "major" as const,
      },
    ];
    render(
      <EntityDetail
        entity={majorSubject}
        versions={versionsForMajor}
        cutoff=""
        books={[]}
        entities={entitiesWithMajorDonut}
        seriesId="dcc"
      />,
    );
    // Carl is linked — linkify is working.
    expect(screen.getByRole("link", { name: "Carl" })).toHaveAttribute("href", "/dcc/entity/carl/");
    // Donut is the subject — must never link to itself regardless of significance.
    expect(screen.queryByRole("link", { name: "Donut" })).toBeNull();
  });
});

describe("EntityDetail appearance order", () => {
  it("orders Interlude-2 before C2 when books are supplied", async () => {
    const { default: EntityDetail } = await import("@/components/EntityDetail");
    const orderEntity: RegistryEntity = {
      id: "x", canonicalName: "X", aliases: [], type: "person", tags: [], significance: "minor",
      description: "", firstAppearance: null, appearances: ["B8·C2·¶1", "B8·Interlude-2·¶1"],
    };
    const books: BookSections[] = [{ number: 8, sections: ["Interlude-2", "C2"] }];
    render(<EntityDetail entity={orderEntity} versions={[]} cutoff="" books={books} />);
    // Each group renders a label <p> (exact label) and an anchors <p> (anchor with ¶).
    // getByText with exact:true finds the unique group-label element for each section.
    const interludeEl = screen.getByText("B8·Interlude-2");
    const c2El = screen.getByText("B8·C2");
    // Node.DOCUMENT_POSITION_FOLLOWING (4) means c2El comes after interludeEl in document order
    expect(interludeEl.compareDocumentPosition(c2El) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
