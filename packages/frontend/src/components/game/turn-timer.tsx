"use client";
import { useEffect, useState } from "react";
import { useGameStore } from "@/stores/game-store";

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/** Calculate remaining seconds from a deadline (Unix ms). */
export function getTimeRemaining(deadline: number | null): number {
  if (deadline === null) return 0;
  const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  return Math.min(remaining, 45); // cap at max turn time
}

/** Check if it is the human player's turn. */
export function isHumanTurn(currentTurn: number, playerIndex: number): boolean {
  return currentTurn === playerIndex;
}

/** Build a progress percentage (0–100) from remaining seconds. */
export function turnProgressPercent(remaining: number, maxSeconds = 45): number {
  if (maxSeconds <= 0) return 0;
  return Math.round((remaining / maxSeconds) * 100);
}

/** Return a color class based on remaining seconds. */
export function timerColorClass(remaining: number): string {
  if (remaining <= 10) return "bg-red-500";
  if (remaining <= 20) return "bg-amber-500";
  return "bg-green-500";
}

/** Resolve outer container classes based on compact prop. */
export function resolveTimerClasses(compact = false): string {
  if (compact) {
    return "rounded-lg bg-domino-900/60 p-2";
  }
  return "rounded-2xl border border-domino-700/50 bg-domino-900/60 p-4";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TurnTimer({ compact = false }: { compact?: boolean } = {}) {
  const currentTurn = useGameStore((s) => s.game.turn.currentTurn);
  const turnDeadline = useGameStore((s) => s.game.turn.turnDeadline);
  const playerIndex = useGameStore((s) => s.game.playerIndex);
  const isRemote = useGameStore((s) => s.engine?.remote ?? false);

  const [remaining, setRemaining] = useState(() =>
    getTimeRemaining(turnDeadline),
  );

  // Tick every second while deadline is active
  useEffect(() => {
    if (turnDeadline === null) return;

    const tick = () => setRemaining(getTimeRemaining(turnDeadline));
    tick(); // immediate first tick
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [turnDeadline]);

  const humanTurn = isHumanTurn(currentTurn, playerIndex);
  const progress = turnProgressPercent(remaining);
  const colorClass = timerColorClass(remaining);
  const containerClass = resolveTimerClasses(compact);

  if (compact) {
    return (
      <div className={containerClass}>
        {/* Compact: slim bar + label only */}
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] text-domino-400">
            {humanTurn ? "Your turn" : `P${currentTurn + 1}'s turn`}
          </span>
          {humanTurn && (
            <span className="font-mono text-[10px] font-bold text-domino-50">
              {remaining}s
            </span>
          )}
        </div>
        {humanTurn && turnDeadline !== null && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-domino-700">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-linear ${colorClass}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {!humanTurn && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-domino-400">
              {isRemote ? `Waiting…` : "Bots thinking"}
            </span>
            <span className="flex gap-0.5">
              <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-domino-400 [animation-delay:0ms]" />
              <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-domino-400 [animation-delay:150ms]" />
              <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-domino-400 [animation-delay:300ms]" />
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={containerClass}>
      {/* Turn label */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-domino-400">
          {humanTurn ? "Your turn" : `Player ${currentTurn + 1}'s turn`}
        </span>
        {humanTurn && (
          <span className="font-mono text-sm font-bold text-domino-50">
            {remaining}s
          </span>
        )}
      </div>

      {/* Countdown bar */}
      {humanTurn && turnDeadline !== null && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-domino-700">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-linear ${colorClass}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Turn waiting indicator */}
      {!humanTurn && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-domino-400">
            {isRemote ? `Waiting for Player ${currentTurn + 1}…` : "Bots thinking"}
          </span>
          <span className="flex gap-0.5">
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-domino-400 [animation-delay:0ms]" />
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-domino-400 [animation-delay:150ms]" />
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-domino-400 [animation-delay:300ms]" />
          </span>
        </div>
      )}
    </div>
  );
}
