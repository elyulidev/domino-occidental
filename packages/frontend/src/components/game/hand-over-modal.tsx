"use client";

import { useEffect, useRef } from "react";
import { useGameStore } from "@/stores/game-store";

// ---------------------------------------------------------------------------
// HandOverModal
//
// Shows a brief summary after each hand ends: which pair won, points scored,
// and the current match scores. Auto-dismisses after 5 seconds.
//
// The game state underneath is already updated with the new hand (redeal).
// When the modal closes, the player can immediately play the next hand.
// ---------------------------------------------------------------------------

const HAND_OVER_DURATION_MS = 5_000;

export function HandOverModal() {
  const handOver = useGameStore((s) => s.handOver);
  const setHandOver = useGameStore((s) => s.setHandOver);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!handOver) {
      // Clean up any stale timer when dismissed externally
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      return;
    }

    // Auto-dismiss after the configured duration
    timerRef.current = setTimeout(() => {
      setHandOver(null);
      timerRef.current = null;
    }, HAND_OVER_DURATION_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [handOver, setHandOver]);

  if (!handOver) return null;

  const { winningPair, points, scores } = handOver;
  const winnerLabel = `Pair ${winningPair + 1}`;
  const isPair1 = winningPair === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm animate-in fade-in zoom-in-95 duration-200 rounded-2xl border border-domino-700/50 bg-domino-900/60 p-8 text-center shadow-2xl">
        {/* Result icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gold-500/20">
          <span className="text-3xl">🎯</span>
        </div>

        {/* Title: who won the hand */}
        <h2 className="text-xl font-bold text-domino-50">
          {winnerLabel} takes the hand
        </h2>
        <p className="mt-1 text-sm text-domino-400">
          +{points} point{points !== 1 ? "s" : ""}
        </p>

        {/* Match scores */}
        <div className="mt-5 flex items-center justify-center gap-6">
          <div className={`text-center ${isPair1 ? "text-domino-300" : "text-gold-400"}`}>
            <p className="text-xs uppercase tracking-wide text-domino-500">Pair 1</p>
            <p className="text-2xl font-bold">{scores[0]}</p>
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-domino-600">MATCH</span>
            <span className="text-xs text-domino-500">vs</span>
          </div>

          <div className={`text-center ${isPair1 ? "text-gold-400" : "text-domino-300"}`}>
            <p className="text-xs uppercase tracking-wide text-domino-500">Pair 2</p>
            <p className="text-2xl font-bold">{scores[1]}</p>
          </div>
        </div>

        {/* Progress bar / auto-dismiss indicator */}
        <AutoDismissProgress duration={HAND_OVER_DURATION_MS} />

        {/* Skip button */}
        <button
          type="button"
          onClick={() => setHandOver(null)}
          className="mt-3 text-xs text-domino-500 underline underline-offset-2 hover:text-domino-300 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auto-dismiss progress bar
// ---------------------------------------------------------------------------

function AutoDismissProgress({ duration }: { duration: number }) {
  return (
    <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-domino-800">
      <div
        className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-400"
        style={{
          animation: `shrink ${duration}ms linear forwards`,
        }}
      />
    </div>
  );
}
