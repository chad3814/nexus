"use client";

import { useState } from "react";
import { FULL_SERIES } from "@/lib/position";
import type { SeriesManifest } from "@/lib/types";

interface PositionPickerProps {
  manifest: SeriesManifest;
  onChoose: (cutoff: string) => void;
}

export function PositionPicker({ manifest, onChoose }: PositionPickerProps) {
  const [bookNum, setBookNum] = useState<number>(manifest.books[0]?.number ?? 1);
  const book = manifest.books.find((b) => b.number === bookNum) ?? manifest.books[0];
  const [chapter, setChapter] = useState<string>(book?.chapters[0] ?? "");

  function handleBookChange(num: number) {
    setBookNum(num);
    const b = manifest.books.find((bk) => bk.number === num);
    setChapter(b?.chapters[0] ?? "");
  }

  function handleSubmit() {
    onChoose(`B${bookNum}·${chapter}`);
  }

  return (
    <div className="flex flex-col gap-4 p-6 bg-surface border border-border">
      <h2 className="text-lg font-mono text-ink">Where are you in {manifest.title}?</h2>
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 items-center">
          <label htmlFor="book-select" className="w-16 text-sm font-medium text-ink">Book</label>
          <select
            id="book-select"
            className="bg-surface border border-border rounded px-2 py-1 text-sm text-ink"
            value={bookNum}
            onChange={(e) => handleBookChange(Number(e.target.value))}
          >
            {manifest.books.map((b) => (
              <option key={b.number} value={b.number}>
                {b.number} · {b.title ?? `Book ${b.number}`}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 items-center">
          <label htmlFor="chapter-select" className="w-16 text-sm font-medium text-ink">Chapter</label>
          <select
            id="chapter-select"
            className="bg-surface border border-border rounded px-2 py-1 text-sm text-ink"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
          >
            {(book?.chapters ?? []).map((ch) => (
              <option key={ch} value={ch}>{ch}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="self-start px-4 py-2 bg-accent text-accent-ink rounded text-sm font-mono hover:opacity-90"
          onClick={handleSubmit}
        >
          Set position
        </button>
      </div>
      <button
        type="button"
        className="self-start text-sm text-accent underline hover:opacity-80"
        onClick={() => onChoose(FULL_SERIES)}
      >
        I&apos;ve finished — show everything
      </button>
    </div>
  );
}
