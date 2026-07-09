import type { BoardState, GameEvent, MatchState, Side, Tile } from "@domino/shared";

export type GameStatus = "waiting" | "in_progress" | "finished" | "abandoned";

export interface GameEngine {
  readonly state: MatchState;
  readonly hand: Tile[];
  readonly playerIndex: number;
  /** If true, the engine delegates to a remote server (WS) — local state is optimistic. */
  readonly remote: boolean;
  playTile(tileId: string, side: Side): { events: GameEvent[]; match: MatchState };
  pass(): { events: GameEvent[]; match: MatchState };
  /** Resolve all pending bot turns synchronously. No-op for remote engines. */
  processBotTurns(): MatchState;
  destroy(): void;
}

export type BotStrategy = (hand: Tile[], board: BoardState) => { tileId: string; side: Side } | null;
