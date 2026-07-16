import type { GameStatus } from "@/lib/game/types";

export type PageView = "loading" | "abandoned" | "ready";

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
