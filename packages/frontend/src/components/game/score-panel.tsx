"use client";

import { TARGET_SCORE } from "@domino/shared";
import { useGameStore } from "@/stores/game-store";

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/** Format a score for display with commas. */
export function formatScore(score: number): string {
  return score.toLocaleString();
}

/** Determine the winning pair, or null if tied / in progress. */
export function resolveLeadingPair(
  scores: [number, number],
): 0 | 1 | null {
  if (scores[0] > scores[1]) return 0;
  if (scores[1] > scores[0]) return 1;
  return null;
}

/** Determine the pair index from a player index. */
export function playerToPair(playerIndex: number): 0 | 1 {
  return playerIndex % 2 === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScorePanel() {
  const scores = useGameStore((s) => s.game.scores);
  const roundNumber = useGameStore((s) => s.game.turn.roundNumber);
  const lastHandWinner = useGameStore((s) => s.game.turn.lastHandWinner);
  const players = useGameStore((s) => s.game.players);

  const pair0Score = scores[0];
  const pair1Score = scores[1];
  const leading = resolveLeadingPair(scores);

  // Pair labels: P0+P2 = Pair 0, P1+P3 = Pair 1
  const p0Name = players[0]?.name ?? "P0";
  const p1Name = players[1]?.name ?? "P1";
  const p2Name = players[2]?.name ?? "P2";
  const p3Name = players[3]?.name ?? "P3";

  return (
    <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5">
      <div className="flex items-center justify-between">
        {/* Pair 0 (P0 + P2) */}
        <div className="flex flex-col items-center">
          <span className="text-xs text-domino-400">Pair 0</span>
          <span
            className={`text-2xl font-bold ${
              leading === 0 ? "text-gold-400" : "text-domino-50"
            }`}
          >
            {formatScore(pair0Score)}
          </span>
          <span className="text-[10px] text-domino-400">{p0Name} + {p2Name}</span>
        </div>

        {/* Center info */}
        <div className="flex flex-col items-center gap-1">
          {/* Target badge */}
          <span className="rounded-full bg-domino-700/50 px-3 py-0.5 text-[10px] font-medium text-domino-300">
            Target: {TARGET_SCORE}
          </span>

          {/* Round */}
          <span className="text-xs text-domino-400">
            Round {roundNumber + 1}
          </span>

          {/* Last hand winner indicator */}
          {lastHandWinner !== null && (
            <span className="text-xs font-semibold text-gold-400">
              {playerToPair(lastHandWinner) === 0 ? "Pair 0" : "Pair 1"} won last
            </span>
          )}
        </div>

        {/* Pair 1 (P1 + P3) */}
        <div className="flex flex-col items-center">
          <span className="text-xs text-domino-400">Pair 1</span>
          <span
            className={`text-2xl font-bold ${
              leading === 1 ? "text-gold-400" : "text-domino-50"
            }`}
          >
            {formatScore(pair1Score)}
          </span>
          <span className="text-[10px] text-domino-400">{p1Name} + {p3Name}</span>
        </div>
      </div>
    </div>
  );
}
