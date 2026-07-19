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
        background: `radial-gradient(circle at 32% 26%, color-mix(in srgb, ${color} 40%, white) 0%, ${color} 55%, color-mix(in srgb, ${color} 75%, black) 100%)`,
        boxShadow: [
          "inset 0 0.5px 0.5px rgba(255,255,255,0.65)",
          "inset 0 -1px 1.5px rgba(0,0,0,0.4)",
          "0 0.5px 1px rgba(0,0,0,0.4)",
        ].join(", "),
      }}
    />
  );
}

function PipFace({ value, className }: { value: number; className: string }) {
  const positions = PIP_POSITIONS[value] ?? [];
  const color = PIP_COLOR[value] ?? "#78716c";

  return (
    <div className={`relative ${className}`}>
      {positions.map((idx) => (
        <Pip key={idx} left={PIP_POS[idx][0]} top={PIP_POS[idx][1]} color={color} />
      ))}
    </div>
  );
}

function _NumeralFace({ value }: { value: number }) {
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
    vertical: { outer: "h-16 w-12 rounded-[6px]", halfDir: "flex-col", half: "h-1/2 w-full", pipArea: "h-full w-full" },
    horizontal: { outer: "h-12 w-16 rounded-[6px]", halfDir: "flex-row", half: "w-1/2 h-full", pipArea: "h-full w-full" },
  },
  md: {
    vertical: { outer: "h-[96px] w-[48px] rounded-[8px]", halfDir: "flex-col", half: "h-1/2 w-full", pipArea: "h-full w-full" },
    horizontal: { outer: "h-[48px] w-[96px] rounded-[8px]", halfDir: "flex-row", half: "w-1/2 h-full", pipArea: "h-full w-full" },
  },
};

// Layered box-shadow that gives the tile body a raised, glossy-plastic look:
// inset top highlight + inset bottom bevel + hard "edge" shadow + soft floating shadow.
// Values are intentionally high-contrast so the effect reads clearly at any tile size
// or background — subtle shadows tend to disappear visually against busy board art.
const TILE_3D_SHADOW = [
  "inset 0 1.5px 1px rgba(255,255,255,0.95)",
  "inset 0 -4px 6px rgba(0,0,0,0.22)",
  "inset 0 0 0 1px rgba(0,0,0,0.15)",
  "0 3px 0 rgba(0,0,0,0.35)",
  "0 3px 3px rgba(0,0,0,0.3)",
  "0 10px 16px rgba(0,0,0,0.45)",
].join(", ");

const TILE_3D_SHADOW_SELECTED = [
  "inset 0 1.5px 1px rgba(255,255,255,0.95)",
  "inset 0 -4px 6px rgba(0,0,0,0.22)",
  "0 0 0 2px rgba(234,179,8,0.95)",
  "0 3px 0 rgba(0,0,0,0.35)",
  "0 12px 20px rgba(234,179,8,0.45)",
].join(", ");

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
        className={`${s.outer} relative flex shrink-0 flex-col items-center justify-center overflow-hidden border border-stone-800/40`}
        style={{
          background: "linear-gradient(155deg, #6b7280 0%, #4b5563 45%, #374151 100%)",
          boxShadow: TILE_3D_SHADOW,
        }}
      >
        {/* Glossy sheen */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.08) 25%, transparent 50%)",
          }}
        />
        {/* Domino back pattern — diagonal cross */}
        <div className="relative h-8 w-8">
          <span className="absolute inset-0 rotate-45 border-2 border-stone-300/40" />
          <span className="absolute inset-0 -rotate-45 border-2 border-stone-300/40" />
          <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-stone-300/30" />
        </div>
      </div>
    );
  }

  const halfBg = "linear-gradient(155deg, #fffdf8 0%, #fbf3e3 55%, #f3e6cc 100%)";

  const TileContent = orientation === "vertical" ? (
    <div className={`relative flex h-full w-full ${s.halfDir} overflow-hidden`}>
      {/* Top half */}
      <div className={`flex items-center justify-center ${s.half}`} style={{ background: halfBg }}>
        <PipFace value={tile.top} className={s.pipArea} />
      </div>

      {/* Engraved divider */}
      <div className="relative z-10 h-[3px] w-full shrink-0 bg-stone-900/85 shadow-[inset_0_1px_1px_rgba(0,0,0,0.5)]" />
      <div className="relative z-10 h-px w-full shrink-0 bg-white/60" />

      {/* Bottom half */}
      <div className={`flex items-center justify-center ${s.half}`} style={{ background: halfBg }}>
        <PipFace value={tile.bottom} className={s.pipArea} />
      </div>

      {/* Double indicator on left/right edges */}
      {isDouble && (
        <>
          <span className="absolute left-[3px] top-1/2 h-[4px] w-[4px] -translate-y-1/2 rounded-full bg-amber-600/70 shadow-[inset_0_0.5px_0.5px_rgba(255,255,255,0.6)]" />
          <span className="absolute right-[3px] top-1/2 h-[4px] w-[4px] -translate-y-1/2 rounded-full bg-amber-600/70 shadow-[inset_0_0.5px_0.5px_rgba(255,255,255,0.6)]" />
        </>
      )}

      {/* Blocked overlay icon */}
      {blocked && (
        <span className="absolute inset-0 flex items-center justify-center bg-red-900/20 text-lg font-bold text-red-500 select-none">
          ✕
        </span>
      )}

      {/* Glossy sheen overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.12) 22%, transparent 45%)",
        }}
      />
    </div>
  ) : (
    <div className={`relative flex h-full w-full ${s.halfDir} overflow-hidden`}>
      {/* Left half (top value) */}
      <div className={`flex items-center justify-center ${s.half}`} style={{ background: halfBg }}>
        <PipFace value={tile.top} className={s.pipArea} />
      </div>

      {/* Engraved divider */}
      <div className="relative z-10 w-[3px] shrink-0 self-stretch bg-stone-900/85 shadow-[inset_1px_0_1px_rgba(0,0,0,0.5)]" />
      <div className="relative z-10 w-px shrink-0 self-stretch bg-white/60" />

      {/* Right half (bottom value) */}
      <div className={`flex items-center justify-center ${s.half}`} style={{ background: halfBg }}>
        <PipFace value={tile.bottom} className={s.pipArea} />
      </div>

      {/* Double indicator on top/bottom edges */}
      {isDouble && (
        <>
          <span className="absolute left-1/2 top-[3px] h-[4px] w-[4px] -translate-x-1/2 rounded-full bg-amber-600/70 shadow-[inset_0_0.5px_0.5px_rgba(255,255,255,0.6)]" />
          <span className="absolute bottom-[3px] left-1/2 h-[4px] w-[4px] -translate-x-1/2 rounded-full bg-amber-600/70 shadow-[inset_0_0.5px_0.5px_rgba(255,255,255,0.6)]" />
        </>
      )}

      {/* Blocked overlay icon */}
      {blocked && (
        <span className="absolute inset-0 flex items-center justify-center bg-red-900/20 text-lg font-bold text-red-500 select-none">
          ✕
        </span>
      )}

      {/* Glossy sheen overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.12) 22%, transparent 45%)",
        }}
      />
    </div>
  );

  const outerClass = [
    s.outer,
    "relative shrink-0 border transition-all",
    selected
      ? "border-gold-500/80"
      : blocked
        ? "border-red-800/50 opacity-55 cursor-not-allowed"
        : playable && !disabled
          ? "border-stone-400/70 hover:brightness-[1.03] cursor-pointer"
          : "border-stone-400/40 opacity-45 cursor-default",
    disabled || blocked ? "cursor-not-allowed" : "",
  ].join(" ");

  const outerStyle: React.CSSProperties = {
    boxShadow: selected ? TILE_3D_SHADOW_SELECTED : TILE_3D_SHADOW,
    border: selected
      ? "1px solid rgba(234,179,8,0.9)"
      : blocked
        ? "1px solid rgba(153,27,27,0.5)"
        : "1px solid rgba(0,0,0,0.35)",
    transform: selected ? "translateY(-2px)" : undefined,
  };

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
