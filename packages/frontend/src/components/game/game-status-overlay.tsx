"use client";

import { TARGET_SCORE } from "@domino/shared";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { GameStatus } from "@/lib/game/types";
import { useGameStore } from "@/stores/game-store";

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/** Determine the overlay mode based on game status. */
export function resolveOverlayMode(
  status: GameStatus,
): "hand_ended" | "match_ended" | "none" {
  if (status === "finished") return "match_ended";
  if (status === "abandoned") return "match_ended";
  // hand_ended is not directly in the status enum — it is transient.
  // The overlay shows when status transitions to a terminal state.
  return "none";
}

/** Build a human-readable result message for a finished match. */
export function buildMatchResultMessage(
  status: GameStatus,
  scores: [number, number],
  matchAbandonedBy?: string | null,
  players?: Array<{ id: string; name?: string; handSize: number; isConnected: boolean }>,
): { title: string; subtitle: string } {
  if (status === "abandoned") {
    // TODO: All players must have username (not email) for proper display
    const leaverName = matchAbandonedBy
      ? players?.find((p) => p.id === matchAbandonedBy)?.name
      : undefined;
    return {
      title: "Match Abandoned",
      subtitle: leaverName
        ? `${leaverName} left the match`
        : "A player left the match",
    };
  }

  const [pair0, pair1] = scores;
  if (pair0 >= TARGET_SCORE || pair1 >= TARGET_SCORE) {
    const winner = pair0 > pair1 ? 0 : 1;
    return {
      title: `Pair ${winner + 1} Wins!`,
      subtitle: `Final score: ${pair0} – ${pair1}`,
    };
  }

  return {
    title: "Match Complete",
    subtitle: `Score: ${pair0} – ${pair1}`,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GameStatusOverlay() {
  const router = useRouter();
  const status = useGameStore((s) => s.game.status);
  const scores = useGameStore((s) => s.game.scores);
  const matchAbandonedBy = useGameStore((s) => s.game.matchAbandonedBy);
  const players = useGameStore((s) => s.game.players);
  const reset = useGameStore((s) => s.reset);

  const mode = resolveOverlayMode(status);

  const handleBackToLobby = useCallback(() => {
    reset();
    router.push("/lobby");
  }, [reset, router]);

  if (mode === "none") return null;

  const { title, subtitle } = buildMatchResultMessage(status, scores, matchAbandonedBy, players);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-domino-700/50 bg-domino-900/60 p-8 text-center shadow-2xl">
        {/* Trophy / result icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gold-500/20">
          <span className="text-3xl">
            {status === "abandoned" ? "💔" : "🏆"}
          </span>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-domino-50">{title}</h2>

        {/* Subtitle */}
        <p className="mt-2 text-sm text-domino-300">{subtitle}</p>

        {/* Scores breakdown */}
        {status === "finished" && (
          <div className="mt-4 flex items-center justify-center gap-6">
            <div className="text-center">
              <p className="text-xs text-domino-400">Pair 0</p>
              <p className="text-lg font-bold text-domino-50">{scores[0]}</p>
            </div>
            <span className="text-domino-500">vs</span>
            <div className="text-center">
              <p className="text-xs text-domino-400">Pair 1</p>
              <p className="text-lg font-bold text-domino-50">{scores[1]}</p>
            </div>
          </div>
        )}

        {/* Back to lobby button */}
        <button
          type="button"
          onClick={handleBackToLobby}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 px-6 py-3 text-sm font-semibold text-black shadow-lg transition-all hover:from-gold-400 hover:to-gold-500 active:scale-[0.97]"
        >
          Back to Lobby
        </button>
      </div>
    </div>
  );
}
