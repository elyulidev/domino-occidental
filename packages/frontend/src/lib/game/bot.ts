import type { BoardState, Side, Tile } from "@domino/shared";
import { canPlay } from "@domino/shared/src/game";

// ---------------------------------------------------------------------------
// Bot AI — finds the best valid move for a given hand and board
// ---------------------------------------------------------------------------

/**
 * Finds a valid move for a bot player.
 *
 * Strategy (Level 1 — simple):
 * 1. If the board is empty, play the first valid tile (prefer doubles).
 * 2. Search the hand for valid tiles on either side.
 * 3. Prefer doubles (they block more).
 * 4. Otherwise, play the first valid tile found.
 *
 * @returns The chosen tile ID and side, or `null` if the bot must pass
 */
export function findBotMove(
  hand: Tile[],
  board: BoardState,
): { tileId: string; side: Side } | null {
  if (hand.length === 0) return null;

  // Board is empty — play any tile, prefer doubles
  if (board.leftEnd === null && board.rightEnd === null) {
    // Prefer doubles first
    for (const tile of hand) {
      if (tile.top === tile.bottom) {
        return { tileId: tile.id, side: "right" };
      }
    }
    return { tileId: hand[0].id, side: "right" };
  }

  // Non-empty board: collect all valid moves
  const validMoves: Array<{ tileId: string; side: Side; tile: Tile }> = [];

  for (const tile of hand) {
    if (canPlay(tile, "left", board)) {
      validMoves.push({ tileId: tile.id, side: "left", tile });
    }
    if (canPlay(tile, "right", board)) {
      validMoves.push({ tileId: tile.id, side: "right", tile });
    }
  }

  if (validMoves.length === 0) return null;

  // Sorting heuristic: prefer doubles, then higher pip tiles
  validMoves.sort((a, b) => {
    const aScore =
      (a.tile.top + a.tile.bottom) * 10 + (a.tile.top === a.tile.bottom ? 100 : 0);
    const bScore =
      (b.tile.top + b.tile.bottom) * 10 + (b.tile.top === b.tile.bottom ? 100 : 0);
    return bScore - aScore; // descending: highest score first
  });

  return { tileId: validMoves[0].tileId, side: validMoves[0].side };
}
