"use client";

import type { PlacedTile, Tile } from "@domino/shared";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useGameStore } from "@/stores/game-store";
import { DominoTile } from "./domino-tile";
import { calculateGridLayout } from "./grid-layout-engine";
import {
  calculatePanDelta,
  calculatePinchZoom,
  calculateTouchDistance,
  calculateZoomAtCursor,
  clampPan,
  isClick,
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
} from "./pan-zoom-utils";
import { PlayerAvatar } from "./player-avatar";
import {
  animateTileFromAvatar,
  calculateAvatarOrigin,
  calculateTileTarget,
  prefersReducedMotion as reducedMotionCheck,
} from "./tile-animation";

// Re-export types from grid-layout-engine (same interface as layout-engine)
export type { LayoutResult, TilePosition } from "./grid-layout-engine";
// Re-export for tests


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
export function playerIdToIndex(
  playerId: string,
  players: Array<{ id: string }>,
): number {
  const idx = players.findIndex((p) => p.id === playerId);
  return idx >= 0 ? idx : 0;
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
  const players = useGameStore((s) => s.game.players);
  const avatarUrls = useGameStore((s) => s.game.avatarUrls);
  const playerIndex = useGameStore((s) => s.game.playerIndex);
  const currentTurn = useGameStore((s) => s.game.turn.currentTurn);
  const disconnectedSince = useGameStore((s) => s.game.disconnectedSince);

  const containerRef = useRef<HTMLDivElement>(null);
  const boardWrapperRef = useRef<HTMLDivElement>(null);
  const prevTileCountRef = useRef(boardTiles.length);
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

  // Auto-center the board when tiles first appear (transition from empty → non-empty).
  // This ensures the first tile is visible instead of hidden at the origin corner.
  const prevTileCount = useRef(0);

  useEffect(() => {
    if (boardTiles.length > 0 && prevTileCount.current === 0) {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        setPan({ x: rect.width / 2, y: rect.height / 2 });
      }
    }
    prevTileCount.current = boardTiles.length;
  }, [boardTiles.length]);

  // Tile play animation: detect new tile and animate from origin to grid position
  // - Local player (me): origin = hand area (bottom of screen)
  // - Remote player: origin = their avatar position on the board perimeter
  // useLayoutEffect runs BEFORE paint, preventing flash-of-final-position
  useLayoutEffect(() => {
    const prevCount = prevTileCountRef.current;
    const newCount = boardTiles.length;
    if (newCount <= prevCount) {
      prevTileCountRef.current = newCount;
      return;
    }

    // New tile(s) added — animate the most recent one
    const newTile = boardTiles[newCount - 1];
    if (!newTile) {
      prevTileCountRef.current = newCount;
      return;
    }

    const pIdx = playerIdToIndex(newTile.playerId,players);
    const containerEl = containerRef.current;
    if (!containerEl) {
      prevTileCountRef.current = newCount;
      return;
    }
    if (reducedMotionCheck()) {
      prevTileCountRef.current = newCount;
      return;
    }

    // Find the tile's position from the layout
    const { display, centerIdx } = buildDisplayOrder(boardTiles);
    const layout = calculateGridLayout(display, centerIdx, containerWidth);
    // Find the new tile's index in display order (not play order)
    const displayIdx = display.findIndex((d) => d.tile.id === newTile.tile.id);
    const tilePos = displayIdx >= 0 ? layout.positions[displayIdx] : undefined;
    if (!tilePos) {
      prevTileCountRef.current = newCount;
      return;
    }

    const containerRect = containerEl.getBoundingClientRect();
    const target = calculateTileTarget(tilePos.x, tilePos.y);

    // Determine animation origin based on who played
    const isLocalPlay = pIdx === playerIndex;
    let originEl: HTMLElement | null = null;

    if (isLocalPlay) {
      // Local player: animate from the hand area (bottom of screen)
      originEl = containerEl.closest("[data-hand-area]") as HTMLElement | null
        ?? document.querySelector("[data-hand-area]") as HTMLElement | null;
    } else {
      // Remote player: animate from their avatar on the board perimeter
      // data-seat uses relative position (0=bottom, 1=right, 2=top, 3=left)
      const relativeSeat = (pIdx - playerIndex + 4) % 4;
      // Avatars live in a sibling layer (boardWrapperRef), not inside the
      // overflow-hidden board surface (containerRef), so query from there.
      originEl = boardWrapperRef.current?.querySelector(
        `[data-seat="${relativeSeat}"]`,
      ) as HTMLElement | null;
    }

    if (!originEl) {
      prevTileCountRef.current = newCount;
      return;
    }

    const originRect = originEl.getBoundingClientRect();
    const origin = calculateAvatarOrigin(originRect, containerRect, pan, zoom);

    // Find the tile DOM element and animate it
    const tileElements = containerEl.querySelectorAll("[data-tile-id]");
    const tileEl = Array.from(tileElements).find(
      (el) => el.getAttribute("data-tile-id") === newTile.tile.id,
    ) as HTMLElement | undefined;

    if (tileEl) {
      animateTileFromAvatar(tileEl, origin, target, 800);
    }

    prevTileCountRef.current = newCount;
  }, [boardTiles, containerWidth, pan, zoom, playerIndex,players]);

  if (boardTiles.length === 0) {
    return (
      <div className="flex h-full flex-col rounded-2xl border border-domino-700/50 bg-domino-900/60 p-4">
        {/* Empty state with avatars */}
        <div className="flex h-full items-center justify-center relative">
          <p className="text-sm text-domino-400 italic">
            Waiting for first move…
          </p>

          {/* Player avatars — visible even when board is empty */}
          {[0, 1, 2, 3].map((playerIdx) => {
            const seatIndex = ((playerIdx - playerIndex + 4) % 4) as 0 | 1 | 2 | 3;
            const pairLabel = playerIdx % 2 === 0 ? "Pair 0" : "Pair 1";
            return (
              <PlayerAvatar
                key={players[playerIdx]?.id ?? playerIdx}
                avatarUrl={avatarUrls[playerIdx] ?? ""}
                playerName={players[playerIdx]?.name ?? `P${playerIdx + 1}`}
                isActive={currentTurn === playerIdx}
                isConnected={players[playerIdx]?.isConnected ?? true}
                disconnectedSince={disconnectedSince.get(players[playerIdx]?.id ?? "") ?? null}
                seatIndex={seatIndex}
                handSize={players[playerIdx]?.handSize}
                pairLabel={pairLabel}
              data-seat={seatIndex}
              />
            );
          })}
        </div>
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

      {/* Board area — two layers: pannable surface + avatar overlay */}
      <div ref={boardWrapperRef} className="relative min-h-0 flex-1">
        {/* Pannable/zoomable board surface (overflow hidden clips tiles) */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: game board maneja pan/zoom nativos del canvas */}
        <div
          ref={containerRef}
          className="absolute inset-0 overflow-hidden"
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
                  players={players}
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

        {/* Avatar overlay — separate layer so tooltips aren't clipped by overflow-hidden */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          {[0, 1, 2, 3].map((playerIdx) => {
            const seatIndex = ((playerIdx - playerIndex + 4) % 4) as 0 | 1 | 2 | 3;
            const pairLabel = playerIdx % 2 === 0 ? "Pair 0" : "Pair 1";
            return (
              <PlayerAvatar
                key={players[playerIdx]?.id ?? playerIdx}
                avatarUrl={avatarUrls[playerIdx] ?? ""}
                playerName={players[playerIdx]?.name ?? `P${playerIdx + 1}`}
                isActive={currentTurn === playerIdx}
                isConnected={players[playerIdx]?.isConnected ?? true}
                disconnectedSince={disconnectedSince.get(players[playerIdx]?.id ?? "") ?? null}
                seatIndex={seatIndex}
                handSize={players[playerIdx]?.handSize}
                pairLabel={pairLabel}
                data-seat={seatIndex}
                className="pointer-events-auto"
              />
            );
          })}
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
  isFirst: _isFirst,
  players,
}: {
  placed: PlacedTile;
  position: import("./grid-layout-engine").TilePosition;
  isFirst: boolean;
  players?: Array<{ id: string; name?: string }>;
}) {
  const { tile, playerId } = placed;
  const pIdx = playerIdToIndex(playerId, players || []);
  const playerName = players?.[pIdx]?.name ?? `Player ${pIdx + 1}`;

  // Use the layout engine's flipped value so the canonical connecting value
  // (tile.bottom) appears on the inward side of the serpentine arm.
  const displayTile: Tile = position.flipped
    ? { top: tile.bottom, bottom: tile.top, id: tile.id }
    : tile;

  return (
    <div
      className="absolute transition-all duration-300 ease-out"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translate(-50%, -50%)",
      }}
      title={playerName}
      data-tile-id={tile.id}
    >
      <DominoTile
        tile={displayTile}
        size="md"
        orientation={position.orientation}
      />
    </div>
  );
}
