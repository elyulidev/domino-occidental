"use client";

import type { BoardState, Tile } from "@domino/shared";
import { useCallback } from "react";
import { useGameStore } from "@/stores/game-store";
import { DominoTile } from "./domino-tile";

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/** Determine whether a tile can be played on the given side of the board. */
export function canPlayOnSide(tile: Tile, board: BoardState, side: "left" | "right"): boolean {
  if (board.tiles.length === 0) return true; // first move — any tile is valid
  const endValue = side === "left" ? board.leftEnd : board.rightEnd;
  if (endValue === null) return true;
  return tile.top === endValue || tile.bottom === endValue;
}

/** Return which sides a tile can be played on. */
export function getPlayableSides(tile: Tile, board: BoardState): Array<"left" | "right"> {
  const sides: Array<"left" | "right"> = [];
  if (canPlayOnSide(tile, board, "left")) sides.push("left");
  if (canPlayOnSide(tile, board, "right")) sides.push("right");
  return sides;
}

/** A tile is playable if it can go on at least one side. */
export function isTilePlayable(tile: Tile, board: BoardState): boolean {
  return getPlayableSides(tile, board).length > 0;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlayerHand() {
  const ownHand = useGameStore((s) => s.game.ownHand);
  const board = useGameStore((s) => s.game.board);
  const selectedTileId = useGameStore((s) => s.ui.selectedTileId);
  const currentTurn = useGameStore((s) => s.game.turn.currentTurn);
  const playerIndex = useGameStore((s) => s.game.playerIndex);
  const blockedTileIds = useGameStore((s) => s.game.blockedTileIds);
  const players = useGameStore((s) => s.game.players);
  const selectTile = useGameStore((s) => s.selectTile);
  const clearSelection = useGameStore((s) => s.clearSelection);
  const playTile = useGameStore((s) => s.playTile);
  const pass = useGameStore((s) => s.pass);

  const isMyTurn = currentTurn === playerIndex;
  const currentTurnName = players[currentTurn]?.name ?? `P${currentTurn + 1}`;
  const hasPlayableTile = ownHand.some((tile) => isTilePlayable(tile, board));

  const selectedTile = selectedTileId
    ? ownHand.find((t) => t.id === selectedTileId) ?? null
    : null;

  const playableSides = selectedTile ? getPlayableSides(selectedTile, board) : [];

  const handleTileClick = useCallback(
    (tileId: string) => {
      if (!isMyTurn) return; // only on human turn
      if (selectedTileId === tileId) {
        clearSelection();
      } else {
        selectTile(tileId);
      }
    },
    [isMyTurn, selectedTileId, selectTile, clearSelection],
  );

  const handlePlaySide = useCallback(
    (side: "left" | "right") => {
      playTile(side);
    },
    [playTile],
  );

  const handlePass = useCallback(() => {
    pass();
  }, [pass]);

  return (
    <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-4">
      {/* Flow hint */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-domino-400">
          {selectedTile
            ? "Choose a side to play"
            : "Select a tile → choose side"}
        </p>
        {!isMyTurn && (
          <p className="text-xs text-domino-400 italic">Ésperando por {currentTurnName}…</p>
        )}
      </div>

      {/* Tile grid */}
      <div className="flex flex-wrap gap-2">
        {ownHand.map((tile) => {
          const playable = isTilePlayable(tile, board);
          const selected = tile.id === selectedTileId;
          // Tile is blocked by timeout: playable but can't be used this hand
          const blocked = blockedTileIds.includes(tile.id);
          const canInteract = playable && !blocked && isMyTurn;

          return (
            <DominoTile
              key={tile.id}
              tile={tile}
              selected={selected}
              playable={playable && !blocked}
              disabled={!canInteract}
              blocked={blocked}
              onClick={() => handleTileClick(tile.id)}
            />
          );
        })}
      </div>

      {/* Side choice buttons */}
      {selectedTile && playableSides.length > 0 && (
        <div className="mt-3 flex items-center gap-3">
          {playableSides.includes("left") && (
            <button
              type="button"
              onClick={() => handlePlaySide("left")}
              className="rounded-lg border-2 border-stone-600 bg-gradient-to-b from-amber-50 to-stone-100 px-5 py-2 text-sm font-bold text-stone-800 shadow-md transition-all hover:border-gold-500 hover:shadow-lg active:scale-95"
            >
              ← Left
            </button>
          )}
          {playableSides.includes("right") && (
            <button
              type="button"
              onClick={() => handlePlaySide("right")}
              className="rounded-lg border-2 border-stone-600 bg-gradient-to-b from-amber-50 to-stone-100 px-5 py-2 text-sm font-bold text-stone-800 shadow-md transition-all hover:border-gold-500 hover:shadow-lg active:scale-95"
            >
              Right →
            </button>
          )}
        </div>
      )}

      {/* Pass button — only when no tile is playable */}
      {isMyTurn && ownHand.length > 0 && !hasPlayableTile && (
        <div className="mt-3 flex items-center gap-4">
          <button
            type="button"
            onClick={handlePass}
            className="rounded-lg border border-stone-500 bg-stone-700 px-4 py-1.5 text-xs font-semibold text-stone-200 shadow transition-all hover:bg-stone-600 hover:text-white"
          >
            Pass turn
          </button>
          <span className="text-[10px] text-stone-400">
            No playable tiles — forced pass
          </span>
        </div>
      )}

      {/* Empty hand */}
      {ownHand.length === 0 && (
        <p className="text-center text-sm text-domino-400">No tiles in hand</p>
      )}
    </div>
  );
}
