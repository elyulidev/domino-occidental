import type { BoardState, Side, Tile } from "@domino/shared";
import { canPlay } from "@domino/shared/src/game";

/**
 * Bot move candidate with evaluated score.
 */
interface BotMove {
  tileId: string;
  side: Side;
  tile: Tile;
}

/**
 * Chooses the best move for a bot player.
 *
 * Strategy:
 * 1. Collect ALL valid (tile, side) pairs — considers both ends of the board
 * 2. Prefer doubles (they create branching opportunities on the board)
 * 3. Among equal options, pick one at random for variety
 *
 * @param hand - The bot's current hand of tiles
 * @param board - Current board state
 * @returns A move object { tileId, side } or null (pass)
 */
export function chooseBotMove(
  hand: Tile[],
  board: BoardState,
): { tileId: string; side: Side } | null {
  // Collect all valid moves from BOTH sides
  const moves: BotMove[] = [];
  for (const tile of hand) {
    if (canPlay(tile, "left", board)) {
      moves.push({ tileId: tile.id, side: "left", tile });
    }
    if (canPlay(tile, "right", board)) {
      moves.push({ tileId: tile.id, side: "right", tile });
    }
  }

  if (moves.length === 0) return null;

  // Prefer doubles
  const doubles = moves.filter((m) => m.tile.top === m.tile.bottom);

  if (doubles.length > 0) {
    return pickRandom(doubles);
  }

  // Pick a random valid move
  return pickRandom(moves);
}

function pickRandom<T extends BotMove>(items: T[]): { tileId: string; side: Side } {
  const idx = Math.floor(Math.random() * items.length);
  return { tileId: items[idx].tileId, side: items[idx].side };
}

/**
 * Check if a move is a valid double play.
 */
export function isDoubleMove(
  move: { tileId: string },
  hand: Tile[],
): boolean {
  const tile = hand.find((t) => t.id === move.tileId);
  return tile !== undefined && tile.top === tile.bottom;
}
