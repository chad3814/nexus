import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SeriesData } from "@/lib/data";
import type { SeriesManifest } from "@/lib/types";

// --- Mocks ---

const mockLoadSeries = vi.fn<(id: string) => Promise<SeriesData>>();
vi.mock("@/lib/data", () => ({ loadSeries: (...args: [string]) => mockLoadSeries(...args) }));

vi.mock("@/lib/position", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/position")>();
  return {
    ...actual,
    readPosition: vi.fn(() => null),
    writePosition: vi.fn(),
  };
});

const mockReplace = vi.fn();
const mockGet = vi.fn<(key: string) => string | null>(() => null);
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: mockGet }),
  useRouter: () => ({ replace: mockReplace }),
}));

// --- Fixtures ---

const manifest: SeriesManifest = {
  id: "test-series",
  title: "Test Series",
  author: "Test Author",
  books: [
    { number: 1, chapters: ["C1", "C2", "C99"] },
    { number: 2, chapters: ["C1", "C2"] },
  ],
};

const b1Entity = {
  id: "entity-b1",
  canonicalName: "Alpha Entity",
  aliases: [],
  type: "person" as const,
  tags: [] as [],
  significance: "major" as const,
  description: "First book entity",
  firstAppearance: { anchor: "B1·C1·¶1", snippet: "snippet" },
  appearances: ["B1·C1·¶1"],
};

const b2Entity = {
  id: "entity-b2",
  canonicalName: "Beta Entity",
  aliases: [],
  type: "person" as const,
  tags: [] as [],
  significance: "supporting" as const,
  description: "Second book entity",
  firstAppearance: { anchor: "B2·C1·¶1", snippet: "snippet" },
  appearances: ["B2·C1·¶1"],
};

const seriesData: SeriesData = {
  registry: {
    booksProcessed: [1, 2],
    entities: [b1Entity, b2Entity],
  },
  descriptions: [],
  aliases: [],
};

// --- Tests ---

describe("SeriesView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(null);
    mockLoadSeries.mockResolvedValue(seriesData);
  });

  it("shows picker when no saved position and no entity links", async () => {
    const { default: SeriesView } = await import("@/components/SeriesView");
    render(<SeriesView seriesId="test-series" manifest={manifest} />);

    expect(screen.getByText(/Where are you in Test Series/i)).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("after choosing B1·C99 shows only the B1 entity link", async () => {
    const { default: SeriesView } = await import("@/components/SeriesView");
    render(<SeriesView seriesId="test-series" manifest={manifest} />);

    // Select book 1
    const bookSelect = screen.getByLabelText(/book/i);
    fireEvent.change(bookSelect, { target: { value: "1" } });

    // Select chapter C99
    const chapterSelect = screen.getByLabelText(/chapter/i);
    fireEvent.change(chapterSelect, { target: { value: "C99" } });

    // Click Set position
    const submitBtn = screen.getByRole("button", { name: /set position/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Picker should disappear, entity index should appear
    await waitFor(() => {
      expect(screen.queryByText(/Where are you/i)).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getAllByRole("link").length).toBeGreaterThan(0);
    });

    // Alpha Entity (B1) should be visible
    expect(screen.getByText("Alpha Entity")).toBeInTheDocument();
    // Beta Entity (B2) should NOT be visible — it first appears in B2, cutoff is B1·C99
    expect(screen.queryByText("Beta Entity")).not.toBeInTheDocument();
  });
});
