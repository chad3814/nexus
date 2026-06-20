import { render, screen, within, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EntityIndex } from "@/components/EntityIndex";
import type { RegistryEntity } from "@/lib/types";

const e = (id: string, name: string, sig: RegistryEntity["significance"], apps: string[]): RegistryEntity => ({
  id, canonicalName: name, aliases: [], type: "person", tags: [], significance: sig,
  description: "", firstAppearance: null, appearances: apps,
});
const entities = [e("ann","Ann","minor",["B3·C16·¶1"]), e("carl","Carl","major",["B3·C17·¶1"]), e("zed","Zed","supporting",["B3·C15·¶1"])];
const books = [{ number: 3, chapters: ["C15","C16","C17"] }];
const names = () => screen.getAllByRole("link").map((l) => within(l).getByText(/Ann|Carl|Zed/).textContent);

describe("EntityIndex sort control", () => {
  it("defaults to relevance (significance then name) = today's order", () => {
    render(<EntityIndex entities={entities} seriesId="dcc" cutoff="B3·C17" books={books} />);
    expect(names()).toEqual(["Carl","Zed","Ann"]);
  });
  it("alphabetical sort reorders A→Z", () => {
    render(<EntityIndex entities={entities} seriesId="dcc" cutoff="B3·C17" books={books} />);
    fireEvent.change(screen.getByLabelText(/sort/i), { target: { value: "alphabetical" } });
    expect(names()).toEqual(["Ann","Carl","Zed"]);
  });
});
