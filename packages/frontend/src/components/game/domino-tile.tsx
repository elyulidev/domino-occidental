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
  0: [],                    //
  1: [4],                   //            ●
  2: [2, 6],                //                    ●
  3: [2, 4, 6],             //                    ●
  4: [0, 2, 6, 8],          //  ●           ●
  5: [0, 2, 4, 6, 8],       //  ●           ●    ●
  6: [0, 2, 3, 5, 6, 8],    //  ●           ●    ●    ●
  7: [0, 2, 3, 4, 5, 6, 8], //  ●           ●    ●    ●  + center
  8: [0, 1, 2, 3, 5, 6, 7, 8], // ring
  9: [0, 1, 2, 3, 4, 5, 6, 7, 8], // full
};

/** Whether a tile is a double (same value top and bottom). */
export function isDoubleTile(tile: Tile): boolean {
  return tile.top === tile.bottom;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Pip({ left, top }: { left: number; top: number }) {
  return (
    <span
      className="absolute h-[7px] w-[7px] rounded-full bg-stone-800 shadow-[inset_0_1px_1px_rgba(0,0,0,0.3)]"
      style={{ left: `${left}%`, top: `${top}%`, transform: "translate(-50%, -50%)" }}
    />
  );
}

function PipFace({ value, className }: { value: number; className: string }) {
  const positions = PIP_POSITIONS[value] ?? [];

  return (
    <div className={`relative ${className}`}>
      {positions.map((idx) => (
        <Pip key={idx} left={PIP_POS[idx][0]} top={PIP_POS[idx][1]} />
      ))}
    </div>
  );
}

function NumeralFace({ value }: { value: number }) {
  return (
    <div className="flex items-center justify-center text-[26px] font-bold leading-none text-stone-800 font-serif">
      {value}
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
  onClick?: () => void;
  size?: "sm" | "md";
  /** When true, renders as a face-down tile back */
  faceDown?: boolean;
  /** Tile orientation: vertical (portrait) or horizontal (landscape). Default vertical. */
  orientation?: "vertical" | "horizontal";
}

const SIZE_MAP = {
  sm: {
    vertical: { outer: "h-16 w-12 rounded-[5px]", halfDir: "flex-col", half: "h-1/2 w-full", pipArea: "h-full w-full" },
    horizontal: { outer: "h-12 w-16 rounded-[5px]", halfDir: "flex-row", half: "w-1/2 h-full", pipArea: "h-full w-full" },
  },
  md: {
    vertical: { outer: "h-[96px] w-[48px] rounded-[7px]", halfDir: "flex-col", half: "h-1/2 w-full", pipArea: "h-full w-full" },
    horizontal: { outer: "h-[48px] w-[96px] rounded-[7px]", halfDir: "flex-row", half: "w-1/2 h-full", pipArea: "h-full w-full" },
  },
};

export function DominoTile({
  tile,
  selected = false,
  playable = true,
  disabled = false,
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
        className={`${s.outer} flex shrink-0 flex-col items-center justify-center border-2 border-stone-600 bg-gradient-to-b from-stone-400 to-stone-500 shadow-md`}
      >
        {/* Domino back pattern — diagonal cross */}
        <div className="relative h-8 w-8">
          <span className="absolute inset-0 rotate-45 border-2 border-stone-300/40" />
          <span className="absolute inset-0 -rotate-45 border-2 border-stone-300/40" />
          <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-stone-300/30" />
        </div>
      </div>
    );
  }

  const TileContent = orientation === "vertical" ? (
    <div className={`flex h-full w-full ${s.halfDir} overflow-hidden bg-gradient-to-b from-stone-100 to-amber-50 shadow-inner`}>
      {/* Top half */}
      <div className={`flex items-center justify-center ${s.half}`}>
        <PipFace value={tile.top} className={s.pipArea} />
      </div>

      {/* Horizontal divider */}
      <div className="relative z-10 h-px w-full shrink-0 bg-stone-400 shadow-[inset_0_0.5px_0_rgba(0,0,0,0.2)]" />
      <div className="relative z-10 h-[0.5px] w-full shrink-0 bg-stone-200" />

      {/* Bottom half */}
      <div className={`flex items-center justify-center ${s.half}`}>
        <PipFace value={tile.bottom} className={s.pipArea} />
      </div>

      {/* Double indicator on left/right edges */}
      {isDouble && (
        <>
          <span className="absolute left-[3px] top-1/2 h-[3px] w-[3px] -translate-y-1/2 rounded-full bg-stone-500/60" />
          <span className="absolute right-[3px] top-1/2 h-[3px] w-[3px] -translate-y-1/2 rounded-full bg-stone-500/60" />
        </>
      )}
    </div>
  ) : (
    <div className={`flex h-full w-full ${s.halfDir} overflow-hidden bg-gradient-to-b from-stone-100 to-amber-50 shadow-inner`}>
      {/* Left half (top value) */}
      <div className={`flex items-center justify-center ${s.half}`}>
        <PipFace value={tile.top} className={s.pipArea} />
      </div>

      {/* Vertical divider */}
      <div className="relative z-10 w-px shrink-0 self-stretch bg-stone-400 shadow-[inset_0.5px_0_0_rgba(0,0,0,0.2)]" />
      <div className="relative z-10 w-[0.5px] shrink-0 self-stretch bg-stone-200" />

      {/* Right half (bottom value) */}
      <div className={`flex items-center justify-center ${s.half}`}>
        <PipFace value={tile.bottom} className={s.pipArea} />
      </div>

      {/* Double indicator on top/bottom edges */}
      {isDouble && (
        <>
          <span className="absolute left-1/2 top-[3px] h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-stone-500/60" />
          <span className="absolute bottom-[3px] left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-stone-500/60" />
        </>
      )}
    </div>
  );

  const outerClass = [
    s.outer,
    "relative shrink-0 border-2 shadow-md transition-all",
    selected
      ? "border-gold-500 ring-2 ring-gold-500 ring-offset-2 ring-offset-domino-950"
      : playable && !disabled
        ? "border-stone-700 hover:border-gold-500 cursor-pointer"
        : "border-stone-600 opacity-45 cursor-default",
    disabled ? "cursor-not-allowed" : "",
  ].join(" ");

  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={outerClass}>
        {TileContent}
      </button>
    );
  }

  return <div className={outerClass}>{TileContent}</div>;
}
