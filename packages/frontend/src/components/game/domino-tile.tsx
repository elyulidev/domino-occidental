"use client";

import type { Tile } from "@domino/shared";

// ---------------------------------------------------------------------------
// Pip layout — each index is [left%, top%] for a 3×3 grid
//   0       1       2
//   3       4       5
//   6       7       8
// ---------------------------------------------------------------------------

const PIP_POS: [number, number][] = [
  [17, 17], [50, 17], [83, 17],
  [17, 50], [50, 50], [83, 50],
  [17, 83], [50, 83], [83, 83],
];

const PIP_POSITIONS: Record<number, number[]> = {
  0: [],
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
  7: [0, 2, 3, 4, 5, 6, 8],
  8: [0, 1, 2, 3, 5, 6, 7, 8],
  9: [0, 1, 2, 3, 4, 5, 6, 7, 8],
};

/** Horizontal overrides for values whose standard layout doesn't fit landscape halves. */
const PIP_POSITIONS_H: Record<number, number[]> = {
  6: [0, 1, 2, 6, 7, 8],  // 2 rows × 3 instead of 2 cols × 3
  7: [0, 1, 2, 4, 6, 7, 8], // 2 rows × 3 + center
};

/** Pip color per face value — mirrors classic color-coded double-9 sets. */
const PIP_COLOR: Record<number, string> = {
  0: "#78716c",
  1: "#2563eb",
  2: "#16a34a",
  3: "#dc2626",
  4: "#7c3aed",
  5: "#d97706",
  6: "#0d9488",
  7: "#db2777",
  8: "#4338ca",
  9: "#a16207",
};

/** Whether a tile is a double (same value top and bottom). */
export function isDoubleTile(tile: Tile): boolean {
  return tile.top === tile.bottom;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Pip({ left, top, color }: { left: number; top: number; color: string }) {
  return (
    <span
      className="absolute rounded-full"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: "17%",
        height: "17%",
        transform: "translate(-50%, -50%)",
        background: color,
      }}
    />
  );
}

function PipFace({ value, className, orientation = "vertical" }: { value: number; className: string; orientation?: "vertical" | "horizontal" }) {
  const posMap = orientation === "horizontal" ? (PIP_POSITIONS_H[value] ?? PIP_POSITIONS[value]) : PIP_POSITIONS[value];
  const positions = posMap ?? [];
  const color = PIP_COLOR[value] ?? "#78716c";

  return (
    <div className={`relative ${className}`}>
      {positions.map((idx) => (
        <Pip key={idx} left={PIP_POS[idx][0]} top={PIP_POS[idx][1]} color={color} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface DominoTileProps {
  tile: Tile;
  selected?: boolean;
  playable?: boolean;
  disabled?: boolean;
  /** When true, the tile is blocked by timeout — visually dimmed with a lock indicator */
  blocked?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
  /** When true, renders as a face-down tile back */
  faceDown?: boolean;
  /** Tile orientation: vertical (portrait) or horizontal (landscape). Default vertical. */
  orientation?: "vertical" | "horizontal";
}

const SIZE_MAP = {
  sm: {
    vertical: { outer: "h-16 w-12", halfDir: "flex-col", half: "h-1/2 w-full", pipArea: "h-full w-full" },
    horizontal: { outer: "h-12 w-16", halfDir: "flex-row", half: "w-1/2 h-full", pipArea: "h-full w-full" },
  },
  md: {
    vertical: { outer: "h-[96px] w-[48px]", halfDir: "flex-col", half: "h-1/2 w-full", pipArea: "h-full w-full" },
    horizontal: { outer: "h-[48px] w-[96px]", halfDir: "flex-row", half: "w-1/2 h-full", pipArea: "h-full w-full" },
  },
};

export function DominoTile({
  tile,
  selected = false,
  playable = true,
  disabled = false,
  blocked = false,
  onClick,
  size = "md",
  faceDown = false,
  orientation = "vertical",
}: DominoTileProps) {
  const s = SIZE_MAP[size][orientation];
  const isDouble = tile.top === tile.bottom;

  if (faceDown) {
    return (
      <div
        className={`${s.outer} relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-[6px] border border-stone-300 bg-stone-200`}
      >
        <div className="relative h-8 w-8">
          <span className="absolute inset-0 rotate-45 border-2 border-stone-400/50" />
          <span className="absolute inset-0 -rotate-45 border-2 border-stone-400/50" />
          <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-stone-400/40" />
        </div>
      </div>
    );
  }

  const outerClass = [
    s.outer,
    "relative shrink-0 rounded-[6px] border transition-all",
    selected
      ? "border-amber-500 ring-2 ring-amber-400/60"
      : blocked
        ? "border-red-300 opacity-50 cursor-not-allowed"
        : playable && !disabled
          ? "border-stone-300 hover:border-stone-400 cursor-pointer"
          : "border-stone-200 opacity-40 cursor-default",
    disabled || blocked ? "cursor-not-allowed" : "",
  ].join(" ");

  const outerStyle: React.CSSProperties = {
    background: "#ffffff",
    transform: selected ? "translateY(-2px)" : undefined,
  };

  const TileContent = orientation === "vertical" ? (
    <div className={`relative flex h-full w-full ${s.halfDir} overflow-hidden rounded-[5px] bg-white`}>
      {/* Top half */}
      <div className={`flex items-center justify-center ${s.half} bg-white`}>
        <PipFace value={tile.top} className={s.pipArea} orientation={orientation} />
      </div>

      {/* Divider */}
      <div className="relative z-10 h-px w-full shrink-0 bg-stone-300" />

      {/* Bottom half */}
      <div className={`flex items-center justify-center ${s.half} bg-white`}>
        <PipFace value={tile.bottom} className={s.pipArea} orientation={orientation} />
      </div>

      {/* Double indicator */}
      {isDouble && (
        <>
          <span className="absolute left-[3px] top-1/2 h-[4px] w-[4px] -translate-y-1/2 rounded-full bg-amber-500" />
          <span className="absolute right-[3px] top-1/2 h-[4px] w-[4px] -translate-y-1/2 rounded-full bg-amber-500" />
        </>
      )}

      {/* Blocked overlay */}
      {blocked && (
        <span className="absolute inset-0 flex items-center justify-center bg-red-500/10 text-lg font-bold text-red-500 select-none">
          ✕
        </span>
      )}
    </div>
  ) : (
    <div className={`relative flex h-full w-full ${s.halfDir} overflow-hidden rounded-[5px] bg-white`}>
      {/* Left half (top value) */}
      <div className={`flex items-center justify-center ${s.half} bg-white`}>
        <PipFace value={tile.top} className={s.pipArea} orientation={orientation} />
      </div>

      {/* Divider */}
      <div className="relative z-10 w-px shrink-0 self-stretch bg-stone-300" />

      {/* Right half (bottom value) */}
      <div className={`flex items-center justify-center ${s.half} bg-white`}>
        <PipFace value={tile.bottom} className={s.pipArea} orientation={orientation} />
      </div>

      {/* Double indicator */}
      {isDouble && (
        <>
          <span className="absolute left-1/2 top-[3px] h-[4px] w-[4px] -translate-x-1/2 rounded-full bg-amber-500" />
          <span className="absolute bottom-[3px] left-1/2 h-[4px] w-[4px] -translate-x-1/2 rounded-full bg-amber-500" />
        </>
      )}

      {/* Blocked overlay */}
      {blocked && (
        <span className="absolute inset-0 flex items-center justify-center bg-red-500/10 text-lg font-bold text-red-500 select-none">
          ✕
        </span>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={outerClass}
        style={outerStyle}
      >
        {TileContent}
      </button>
    );
  }

  return (
    <div className={outerClass} style={outerStyle}>
      {TileContent}
    </div>
  );
}
