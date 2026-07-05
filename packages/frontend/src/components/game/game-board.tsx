"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useGameStore } from "@/stores/game-store";
import type { PlacedTile, Tile } from "@domino/shared";
import { DominoTile, isDoubleTile } from "./domino-tile";
import {
  calculatePanDelta,
  clampPan,
  calculateZoomAtCursor,
  isClick,
  calculateTouchDistance,
  calculatePinchZoom,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
} from "./pan-zoom-utils";
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
// Snake-layout helpers
// ---------------------------------------------------------------------------

/** Approximate horizontal tile width (64px tile + 8px gap) used for per-row estimation. */
const TILE_W = 72;
/** Approximate vertical tile height (88px tile + 8px gap + 8px badge). */
const TILE_H = 104;

/** Group items into rows. */
export function snakeRows<T>(items: T[], perRow: number): T[][] {
  if (perRow < 1) return [items];
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += perRow) {
    rows.push(items.slice(i, i + perRow));
  }
  return rows;
}

/** Max horizontal tiles per row. */
export function tilesPerRow(containerWidth: number): number {
  return Math.max(1, Math.floor(containerWidth / TILE_W));
}

export interface CenterRowsResult {
  rows: PlacedTile[][];
  mainRowIndex: number;
}

/**
 * Group the display array into rows keeping the center tile fixed in position.
 *
 * Left tiles that overflow go ABOVE the main row (left arm snakes up),
 * right tiles that overflow go BELOW (right arm snakes down).
 */
export function buildCenterRows(
  display: PlacedTile[],
  centerIdx: number,
  perRow: number,
): CenterRowsResult {
  if (display.length === 0) return { rows: [], mainRowIndex: -1 };

  // Fallback for narrow containers: simple snake
  if (perRow < 3) {
    return { rows: snakeRows(display, perRow), mainRowIndex: 0 };
  }

  const capacityEachSide = Math.floor((perRow - 1) / 2);

  const leftTiles = display.slice(0, centerIdx);
  const rightTiles = display.slice(centerIdx + 1);

  const leftFit = Math.min(leftTiles.length, capacityEachSide);
  const rightFit = Math.min(rightTiles.length, capacityEachSide);

  const leftOverflow = leftTiles.slice(0, leftTiles.length - leftFit);
  const rightOverflow = rightTiles.slice(rightFit);

  const rows: PlacedTile[][] = [];

  if (leftOverflow.length > 0) {
    const leftRows = snakeRows(leftOverflow, perRow);
    rows.push(...leftRows);
  }

  const mainRowIndex = rows.length; // main row starts here

  const mainLeft = leftTiles.slice(leftTiles.length - leftFit);
  const mainRight = rightTiles.slice(0, rightFit);
  rows.push([...mainLeft, display[centerIdx], ...mainRight]);

  if (rightOverflow.length > 0) {
    const rightRows = snakeRows(rightOverflow, perRow);
    rows.push(...rightRows);
  }

  return { rows, mainRowIndex };
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

  // Pan/Zoom state (local to GameBoard, not in Zustand)
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);

  // Mouse drag handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only handle left mouse button
      if (e.button !== 0) return;
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    },
    [pan.x, pan.y],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragRef.current) return;

      const { startX, startY, panX, panY } = dragRef.current;
      const { deltaX, deltaY } = calculatePanDelta(startX, startY, e.clientX, e.clientY);

      // Check if we've exceeded the click threshold
      if (!isDragging && !isClick(startX, startY, e.clientX, e.clientY)) {
        setIsDragging(true);
      }

      if (isDragging && containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        const newPan = clampPan(
          panX + deltaX,
          panY + deltaY,
          clientWidth,
          clientHeight,
          zoom,
        );
        setPan({ x: newPan.panX, y: newPan.panY });
      }
    },
    [isDragging, zoom],
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  // Wheel zoom handler
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const newZoom = calculateZoomAtCursor(
        zoom,
        e.deltaY,
        cursorX,
        cursorY,
        rect.width,
        rect.height,
      );
      setZoom(newZoom);
    },
    [zoom],
  );

  // Double-click reset handler
  const handleDoubleClick = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  // Zoom button handlers
  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
    setPan((p) => {
      const newZoom = Math.min(MAX_ZOOM, zoom + ZOOM_STEP);
      const scale = newZoom / zoom;
      return { x: p.x * scale, y: p.y * scale };
    });
  }, [zoom]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(MIN_ZOOM, zoom - ZOOM_STEP);
    const scale = newZoom / zoom;
    setZoom(newZoom);
    setPan((p) => ({ x: p.x * scale, y: p.y * scale }));
  }, [zoom]);

  // Touch state for pinch zoom
  const touchRef = useRef<{
    initialDistance: number | null;
    initialZoom: number;
  } | null>(null);

  // Touch handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        // Pinch zoom start
        const distance = calculateTouchDistance(e.touches[0], e.touches[1]);
        touchRef.current = {
          initialDistance: distance,
          initialZoom: zoom,
        };
      } else if (e.touches.length === 1) {
        // Single touch - start drag
        const touch = e.touches[0];
        dragRef.current = {
          startX: touch.clientX,
          startY: touch.clientY,
          panX: pan.x,
          panY: pan.y,
        };
      }
    },
    [pan.x, pan.y, zoom],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault(); // Prevent browser zoom/scroll

      if (e.touches.length === 2 && touchRef.current?.initialDistance) {
        // Pinch zoom
        const currentDistance = calculateTouchDistance(e.touches[0], e.touches[1]);
        const newZoom = calculatePinchZoom(
          touchRef.current.initialZoom,
          touchRef.current.initialDistance,
          currentDistance,
        );
        setZoom(newZoom);
      } else if (e.touches.length === 1 && dragRef.current) {
        // Single touch drag
        const touch = e.touches[0];
        const { startX, startY, panX, panY } = dragRef.current;
        const { deltaX, deltaY } = calculatePanDelta(startX, startY, touch.clientX, touch.clientY);

        // Check if we've exceeded the click threshold
        if (!isDragging && !isClick(startX, startY, touch.clientX, touch.clientY)) {
          setIsDragging(true);
        }

        if (isDragging && containerRef.current) {
          const { clientWidth, clientHeight } = containerRef.current;
          const newPan = clampPan(
            panX + deltaX,
            panY + deltaY,
            clientWidth,
            clientHeight,
            zoom,
          );
          setPan({ x: newPan.panX, y: newPan.panY });
        }
      }
    },
    [isDragging, zoom],
  );

  const handleTouchEnd = useCallback(() => {
    dragRef.current = null;
    touchRef.current = null;
    setIsDragging(false);
  }, []);

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
  const perRow = tilesPerRow(containerWidth);
  const { rows, mainRowIndex } = buildCenterRows(display, centerIdx, perRow);
  const hasLeftOverflow = mainRowIndex > 0;
  const hasRightOverflow = mainRowIndex < rows.length - 1;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-domino-700/50 bg-domino-900/60 p-4">
      {/* End labels */}
      <div className="mb-3 flex shrink-0 items-center justify-between px-1 text-xs text-domino-400">
        <span>
          ◀ Left: <span className="font-mono text-domino-200">{leftEnd ?? "—"}</span>
        </span>
        <span className="text-[10px] text-domino-500">{boardTiles.length} tiles</span>
        <span>
          Right: <span className="font-mono text-domino-200">{rightEnd ?? "—"}</span> ▶
        </span>
      </div>

      {/* Serpentine board — snake layout with flexbox (fills remaining space) */}
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ touchAction: "none" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pan/zoom transform wrapper */}
        <div
          className="flex h-full w-full items-center justify-center"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
          }}
        >
          {/* Snake layout — centered and flowing as flex rows */}
          <div className="flex flex-col items-center gap-0">
            {rows.map((row, ri) => {
              const isMainRow = ri === mainRowIndex;
              // Left overflow rows (above): left-to-right so the connection tile
              // sits on the right side facing the center.
              // Right overflow rows (below): left-to-right so the connection tile
              // sits on the left side facing the center.
              const align =
                ri < mainRowIndex
                  ? "justify-start"
                  : ri === mainRowIndex
                    ? "justify-center"
                    : "justify-start";

              return (
                <div key={ri} className={`flex items-center ${align} gap-0`}>
                  {row.map((placed, ti) => {
                    const isFirst = placed.tile.id === boardTiles[0]?.tile.id;
                    const isBend =
                      isMainRow &&
                      ((hasLeftOverflow && ti === 0) ||
                        (hasRightOverflow && ti === row.length - 1));
                    return (
                      <BoardTile
                        key={placed.tile.id}
                        placed={placed}
                        isFirst={isFirst}
                        isBend={isBend}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Zoom controls overlay */}
        <div className="absolute bottom-2 right-2 z-10 flex gap-1">
          <button
            type="button"
            onClick={handleZoomOut}
            className="rounded bg-domino-800/80 px-2 py-1 text-xs text-domino-200 hover:bg-domino-700"
          >
            −
          </button>
          <span className="flex items-center px-2 text-[10px] text-domino-400">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            className="rounded bg-domino-800/80 px-2 py-1 text-xs text-domino-200 hover:bg-domino-700"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: single tile on the board
// ---------------------------------------------------------------------------

function BoardTile({
  placed,
  isFirst,
  isBend = false,
}: {
  placed: PlacedTile;
  isFirst: boolean;
  isBend?: boolean;
}) {
  const { tile, playerId, side } = placed;
  const pIdx = playerIdToIndex(playerId);
  const isDouble = tile.top === tile.bottom;

  // Right-side tiles: the engine stores the connecting value in `bottom`
  // and the new end in `top`. Since horizontal display shows left=top,
  // right=bottom, we must swap so the connecting value faces the center.
  const displayTile: Tile =
    !isFirst && side === "right"
      ? { top: tile.bottom, bottom: tile.top, id: tile.id }
      : tile;

  // Orientation: doubles and first tile are always vertical.
  // Bend tiles (at snake corners) are also vertical to show the direction change.
  const orientation = isFirst || isDouble || isBend ? "vertical" : "horizontal";

  return (
    <div className="relative flex shrink-0 flex-col items-center">
      <DominoTile tile={displayTile} size="md" orientation={orientation} />

      {/* Player color badge */}
      <span
        className={`mt-1.5 inline-block h-1.5 w-6 rounded-full ${playerColorClass(pIdx)}`}
        title={`Played by Player ${pIdx + 1}`}
      />
    </div>
  );
}
