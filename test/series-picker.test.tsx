import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SeriesPicker } from "@/components/SeriesPicker";

describe("SeriesPicker", () => {
  it("lists each series linking to its route", () => {
    render(<SeriesPicker series={[{ id: "dcc", title: "Dungeon Crawler Carl", author: "Matt Dinniman", books: [] }]} />);
    const link = screen.getByRole("link", { name: /Dungeon Crawler Carl/ });
    expect(link).toHaveAttribute("href", "/dcc/");
  });
});
