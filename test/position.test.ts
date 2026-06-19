import { beforeEach, describe, expect, it } from "vitest";
import { FULL_SERIES, formatCutoff, parseCutoff, readPosition, writePosition } from "@/lib/position";

describe("cutoff parse/format", () => {
  it("round-trips a B·C cutoff", () => {
    expect(parseCutoff("B3·C5")).toBe("B3·C5");
    expect(formatCutoff("B3·C5")).toBe("Book 3 · C5");
  });
  it("treats FULL_SERIES as no cutoff (undefined through)", () => {
    expect(formatCutoff(FULL_SERIES)).toBe("Everything");
  });
  it("rejects malformed input", () => {
    expect(parseCutoff("garbage")).toBeNull();
  });
});

describe("formatCutoff with titles", () => {
  const books = [{ number: 2, title: "Carl's Doomsday Scenario" }, { number: 3 }];
  it("uses the title alone when present", () => {
    expect(formatCutoff("B2·C5", books)).toBe("Carl's Doomsday Scenario · C5");
  });
  it("falls back to Book N when no title / no books", () => {
    expect(formatCutoff("B3·C5", books)).toBe("Book 3 · C5");
    expect(formatCutoff("B4·C1")).toBe("Book 4 · C1");
  });
  it("still returns Everything for full series", () => {
    expect(formatCutoff("__all__")).toBe("Everything");
  });
});

describe("localStorage position (per series)", () => {
  beforeEach(() => localStorage.clear());
  it("writes and reads per series", () => {
    writePosition("dcc", "B2·C4");
    expect(readPosition("dcc")).toBe("B2·C4");
    expect(readPosition("vending")).toBeNull();
  });
});
