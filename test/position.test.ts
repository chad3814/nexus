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

describe("localStorage position (per series)", () => {
  beforeEach(() => localStorage.clear());
  it("writes and reads per series", () => {
    writePosition("dcc", "B2·C4");
    expect(readPosition("dcc")).toBe("B2·C4");
    expect(readPosition("vending")).toBeNull();
  });
});
