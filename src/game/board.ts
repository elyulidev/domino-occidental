import type { BoardState, PlacedTile, Side, Tile } from "./types";

/**
 * Creates an empty domino board.
 *
 * @returns A BoardState with null ends and no tiles
 */
export function createBoard(): BoardState {
  return { leftEnd: null, rightEnd: null, tiles: [] };
}

/**
 * Checks whether a tile can be placed on the specified side of the board.
 *
 * On an empty board, any tile can be placed. On a non-empty board,
 * the tile must have at least one value matching the target end.
 *
 * @param tile - The domino tile to check
 * @param side - Which side to place on
 * @param board - Current board state
 * @returns true if the tile can legally be placed on that side
 */
export function canPlay(tile: Tile, side: Side, board: BoardState): boolean {
  if (board.leftEnd === null && board.rightEnd === null) return true;

  const targetEnd = side === "left" ? board.leftEnd : board.rightEnd;
  return tile.top === targetEnd || tile.bottom === targetEnd;
}

/**
 * Places a tile on the specified side of the board, returning a NEW BoardState.
 *
 * Handles auto-flip: the tile is rotated so its matching value connects to
 * the board, exposing the other value as the new end. On an empty board,
 * both ends are set according to the placement side.
 *
 * @param tile - The domino tile to place
 * @param side - Which side to place on
 * @param playerId - ID of the player placing the tile
 * @param board - Current board state (not mutated)
 * @returns A new BoardState with the tile placed
 * @throws {Error} If the tile cannot be placed on the specified side
 */
export function place(
  tile: Tile,
  side: Side,
  playerId: string,
  board: BoardState,
): BoardState {
  // Empty board: set both ends
  if (board.leftEnd === null && board.rightEnd === null) {
    const placedTile: PlacedTile = { tile, side, playerId };
    if (side === "left") {
      return {
        leftEnd: tile.bottom,
        rightEnd: tile.top,
        tiles: [placedTile],
      };
    }
    // side === 'right': invert ends
    return {
      leftEnd: tile.top,
      rightEnd: tile.bottom,
      tiles: [placedTile],
    };
  }

  // Non-empty board: validate placement
  if (!canPlay(tile, side, board)) {
    throw new Error(
      `Tile (${tile.top},${tile.bottom}) cannot be placed on ${side} side`,
    );
  }

  // At this point both ends are guaranteed non-null (board is non-empty).
  // We narrow via explicit comparison rather than non-null assertion.
  const leftEnd = board.leftEnd;
  const rightEnd = board.rightEnd;

  if (leftEnd === null || rightEnd === null) {
    // Unreachable: canPlay returned true on non-empty board
    throw new Error("Invalid board state");
  }

  const targetEnd = side === "left" ? leftEnd : rightEnd;

  // Auto-flip: determine canonical orientation
  let newEnd: number;
  let canonicalTile: Tile;

  if (tile.top === targetEnd) {
    // Flip: swap so the matching value connects, other value becomes new end
    newEnd = tile.bottom;
    canonicalTile = { top: tile.bottom, bottom: tile.top, id: tile.id };
  } else {
    // No flip: bottom matches target, top becomes new end
    newEnd = tile.top;
    canonicalTile = tile;
  }

  // Double: end doesn't change (newEnd === targetEnd)
  const placedTile: PlacedTile = {
    tile: canonicalTile,
    side,
    playerId,
  };

  const newTiles = [...board.tiles, placedTile];

  if (side === "left") {
    return {
      leftEnd: newEnd,
      rightEnd: board.rightEnd,
      tiles: newTiles,
    };
  }

  return {
    leftEnd: board.leftEnd,
    rightEnd: newEnd,
    tiles: newTiles,
  };
}
