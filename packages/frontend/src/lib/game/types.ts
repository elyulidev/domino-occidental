import type { ActionResult, BoardState, GameEvent, MatchState, Side, Tile } from "@domino/shared";

export type GameStatus = "waiting" | "in_progress" | "finished" | "abandoned";

export interface GameEngine {
  readonly state: MatchState;
  readonly hand: Tile[];
  readonly playerIndex: number;
  /** If true, the engine delegates to a remote server (WS) — local state is optimistic. */
  readonly remote: boolean;
  playTile(tileId: string, side: Side): { events: GameEvent[]; match: MatchState };
  pass(): { events: GameEvent[]; match: MatchState };
  /** Check if the current turn has timed out and force a pass + block playable tiles. */
  checkTimeout(now: number): ActionResult | null;
  /** Resolve all pending bot turns synchronously. No-op for remote engines. */
  processBotTurns(): MatchState;
  /** Async version with visual delays between bot turns. No-op for remote engines. */
  processBotTurnsAsync?(onBotPlayed?: (events?: GameEvent[]) => void): Promise<MatchState>;
  destroy(): void;
}

export type BotStrategy = (hand: Tile[], board: BoardState) => { tileId: string; side: Side } | null;
