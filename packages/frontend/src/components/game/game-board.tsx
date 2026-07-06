"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useGameStore } from "@/stores/game-store";
import type { PlacedTile, Tile } from "@domino/shared";
import { DominoTile, isDoubleTile } from "./domino-tile";
import { calculateGridLayout } from "./grid-layout-engine";
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

        if (isDragging) {
          const newPan = clampPan(
            panX + deltaX,
            panY + deltaY,
            containerRef.current?.clientWidth ?? 600,
            containerRef.current?.clientHeight ?? 400,
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
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  }, []);

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

        if (isDragging) {
          const newPan = clampPan(
            panX + deltaX,
            panY + deltaY,
            containerRef.current?.clientWidth ?? 600,
            containerRef.current?.clientHeight ?? 400,
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
  const { positions } = calculateGridLayout(display, centerIdx, containerWidth);

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

      {/* Serpentine board — absolute positioned tiles (fills remaining space) */}
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
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            width: 0,
            height: 0,
          }}
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
