"use client";

import { useRef, useEffect, useState } from "react";
import { useGameStore } from "@/stores/game-store";
import type { PlacedTile, Tile } from "@domino/shared";
import { DominoTile, isDoubleTile } from "./domino-tile";
import { calculateGridLayout } from "./grid-layout-engine";
// Re-export for tests
export { isDoubleTile };

// Re-export types from grid-layout-engine (same interface as layout-engine)
export type { TilePosition, LayoutResult } from "./grid-layout-engine";
// Re-export old engine's function for backward compat with old tests
export { calculateLayout as calculateSerpentineLayout } from "./layout-engine";

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/** Display a pip value: 0 renders blank, otherwise the number itself. */
export function formatPipValue(value: number): string {
  return value === 0 ? "" : String(value);
}

/** Tailwind color class for a given player index (0–3). */
export function playerColorClass(playerIndex: number): string {
  const colors = ["bg-blue-500", "bg-red-500", "bg-emerald-500", "bg-amber-500"];
  return colors[playerIndex] ?? "bg-domino-500";
}

/** Map a player id (e.g. "p0", "p1") to its index. */
export function playerIdToIndex(playerId: string): number {
  const match = playerId.match(/\d+$/);
  return match ? Number.parseInt(match[0], 10) : 0;
}

/** Build a display-order array: left-tiles-reversed → center → right-tiles. */
export function buildDisplayOrder(tiles: PlacedTile[]): {
  display: PlacedTile[];
  centerIdx: number;
} {
  if (tiles.length === 0) return { display: [], centerIdx: -1 };
  const [first, ...rest] = tiles;
  const lefts = rest.filter((t) => t.side === "left").reverse();
  const rights = rest.filter((t) => t.side === "right");
  const display = [...lefts, first, ...rights];
  return { display, centerIdx: lefts.length };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GameBoard() {
  const boardTiles = useGameStore((s) => s.game.board.tiles);
  const leftEnd = useGameStore((s) => s.game.board.leftEnd);
  const rightEnd = useGameStore((s) => s.game.board.rightEnd);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);

  // ResizeObserver with 100ms debounce (R7)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    let timeout: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver((entries) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      }, 100);
    });
    observer.observe(el);
    return () => {
      clearTimeout(timeout);
      observer.disconnect();
    };
  }, []);

  if (boardTiles.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5">
        <p className="text-sm text-domino-400 italic">
          Waiting for first move…
        </p>
      </div>
    );
  }

  const { display, centerIdx } = buildDisplayOrder(boardTiles);
  const { positions, boardHeight } = calculateGridLayout(display, centerIdx, containerWidth);

  // Dynamic container height: visual bounding box + padding on both sides
  const containerHeight = Math.max(boardHeight + 16, 120);

  return (
    <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-4">
      {/* End labels */}
      <div className="mb-3 flex items-center justify-between px-1 text-xs text-domino-400">
        <span>
          ◀ Left: <span className="font-mono text-domino-200">{leftEnd ?? "—"}</span>
        </span>
        <span className="text-[10px] text-domino-500">{boardTiles.length} tiles</span>
        <span>
          Right: <span className="font-mono text-domino-200">{rightEnd ?? "—"}</span> ▶
        </span>
      </div>

      {/* Serpentine board — absolute positioned tiles */}
      <div
        ref={containerRef}
        className="relative overflow-hidden"
        style={{ height: containerHeight }}
      >
        {display.map((placed, i) => {
          const pos = positions[i];
          if (!pos) return null;
          const isFirst = placed.tile.id === boardTiles[0]?.tile.id;
          return (
            <BoardTile
              key={placed.tile.id}
              placed={placed}
              position={pos}
              isFirst={isFirst}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: single tile on the board
// ---------------------------------------------------------------------------

function BoardTile({
  placed,
  position,
  isFirst,
}: {
  placed: PlacedTile;
  position: import("./grid-layout-engine").TilePosition;
  isFirst: boolean;
}) {
  const { tile, playerId } = placed;
  const pIdx = playerIdToIndex(playerId);

  // Use the layout engine's flipped value so the canonical connecting value
  // (tile.bottom) appears on the inward side of the serpentine arm.
  const displayTile: Tile = position.flipped
    ? { top: tile.bottom, bottom: tile.top, id: tile.id }
    : tile;

  return (
    <div
      className="absolute transition-all duration-300 ease-out"
      style={{
        left: `calc(50% + ${position.x}px)`,
        top: `calc(50% + ${position.y}px)`,
        transform: "translate(-50%, -50%)",
      }}
      title={`Player ${pIdx + 1}`}
    >
      <DominoTile
        tile={displayTile}
        size="md"
        orientation={position.orientation}
      />
    </div>
  );
}
