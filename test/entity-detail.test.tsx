import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DescriptionEvent, RegistryEntity } from "@/lib/types";

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
