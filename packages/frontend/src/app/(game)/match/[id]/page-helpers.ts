import type { GameStatus } from "@/lib/game/types";

export type PageView = "loading" | "abandoned" | "ready";
export type MatchMode = "local" | "online";

/**
 * Determine which view the match page should render based on game status.
 *
 * - `undefined` or `"waiting"` → loading screen (engine not yet initialized)
 * - `"abandoned"` → abandoned screen (match ended by disconnection)
 * - `"in_progress"` or `"finished"` → ready (render the game board)
 */
export function resolvePageView(status: GameStatus | undefined): PageView {
  if (status === undefined || status === "waiting") return "loading";
  if (status === "abandoned") return "abandoned";
  return "ready";
}

/**
 * Resolve the match mode from a URL search params `mode` value.
 *
 * - `"online"` → online (WebSocket-backed engine)
 * - anything else or missing → local (dealt match)
 */
export function resolveMatchMode(mode: string | null | undefined, playerId?: string | null): MatchMode {
  // If playerId is present, WS mode is the default (connecting to an existing match)
  if (mode === "online" || (mode === null && playerId)) return "online";
  return "local";
}
