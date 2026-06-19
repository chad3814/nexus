"use client";

import { formatCutoff } from "@/lib/position";
import type { Cutoff, SeriesManifest } from "@/lib/types";

interface PositionBarProps {
  current: Cutoff;
  books: SeriesManifest["books"];
  onChangePicker: () => void;
}

export function PositionBar({ current, books, onChangePicker }: PositionBarProps) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-surface border-b border-border text-sm">
      <span className="font-mono text-ink">
        THROUGH <span className="text-accent">{formatCutoff(current, books)}</span>
      </span>
      <button
        type="button"
        className="px-3 py-1 text-sm text-accent border border-border rounded bg-surface hover:bg-paper"
        onClick={onChangePicker}
      >
        Change
      </button>
    </div>
  );
}
