"use client";

import { formatCutoff } from "@/lib/position";
import type { Cutoff } from "@/lib/types";

interface PositionBarProps {
  current: Cutoff;
  onChangePicker: () => void;
}

export function PositionBar({ current, onChangePicker }: PositionBarProps) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-zinc-50 border-b text-sm">
      <span className="font-medium">Reading through: {formatCutoff(current)}</span>
      <button
        type="button"
        className="px-3 py-1 text-sm border rounded hover:bg-zinc-100"
        onClick={onChangePicker}
      >
        Change
      </button>
    </div>
  );
}
