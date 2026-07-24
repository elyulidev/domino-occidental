"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GameBoard } from "@/components/game/game-board";
import { GameStatusOverlay } from "@/components/game/game-status-overlay";
import { LeaveMatchConfirmModal } from "@/components/game/leave-match-confirm-modal";
import { PlayerHand } from "@/components/game/player-hand";
import { ScorePanel } from "@/components/game/score-panel";
import { useGameStore } from "@/stores/game-store";

// ---------------------------------------------------------------------------
// CPU Match Page
// ---------------------------------------------------------------------------

export default function CpuMatchPage() {
  const router = useRouter();
  const initCpuMatch = useGameStore((s) => s.initCpuMatch);
  const engine = useGameStore((s) => s.engine);
  const status = useGameStore((s) => s.game.status);
  const currentTurn = useGameStore((s) => s.game.turn.currentTurn);
  const turnDeadline = useGameStore((s) => s.game.turn.turnDeadline);
  const playerIndex = useGameStore((s) => s.game.playerIndex);
  const reset = useGameStore((s) => s.reset);
  const markPassed = useGameStore((s) => s.markPassed);

  const isProcessing = useRef(false);
  const isAbandoned = useRef(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Initialize CPU match on mount
  useEffect(() => {
    isAbandoned.current = false;
    initCpuMatch();
  }, [initCpuMatch]);

  // Process bot turns when it's not the human's turn
  const processBots = useCallback(() => {
    if (!engine || engine.remote) return;
    if (isProcessing.current) return;
    if (status !== "in_progress") return;
    if (currentTurn === 0) return; // Human's turn

    isProcessing.current = true;

    // Use async bot processing with delays for visual feedback
    const asyncFn = engine.processBotTurnsAsync;
    if (!asyncFn) {
      isProcessing.current = false;
      return;
    }
    asyncFn.call(engine, (events?: import("@domino/shared").GameEvent[]) => {
        // Guard: skip if user abandoned during bot processing
        if (isAbandoned.current) return;

        // Detect passes (voluntary or forced) from bot turns for visual indicator
        if (events) {
          const passEvent = events.find(
            (e) => e.type === "player_passed" || e.type === "turn_timeout",
          );
          if (passEvent && "playerId" in passEvent) {
            markPassed(passEvent.playerId);
          }
        }

        // Sync state to store after each bot action
        useGameStore.setState((state) => {
          if (!state.engine) return {};
          const match = state.engine.state;
          const playerIdx = state.engine.playerIndex;
          return {
            game: {
              ...state.game,
              board: match.board,
              scores: match.scores.scores,
              players: match.players.map((p) => ({
                id: p.id,
                name: p.name,
                handSize: p.hand.length,
                isConnected: p.isConnected,
              })),
              ownHand: state.engine.hand,
              blockedTileIds:
                match.players[playerIdx]?.blockedTileIds ?? [],
              turn: {
                currentTurn: match.turn.currentTurn,
                turnDeadline: match.turn.turnDeadline,
                consecutiveNullRounds: match.turn.consecutiveNullRounds,
                roundNumber: match.turn.roundNumber,
                lastHandWinner: match.turn.lastHandWinner,
              },
              status: match.status,
            },
          };
        });
      })
      .then(() => {
        isProcessing.current = false;
      });
  }, [engine, status, currentTurn, markPassed]);

  // Trigger bot processing after human plays or passes
  useEffect(() => {
    if (currentTurn !== 0 && status === "in_progress") {
      processBots();
    }
  }, [currentTurn, status, processBots]);

  // Enforce turn timeout for the human player
  useEffect(() => {
    if (!engine || engine.remote) return;
    if (status !== "in_progress") return;
    if (currentTurn !== playerIndex) return;
    if (turnDeadline === null) return;

    const interval = setInterval(() => {
      if (isAbandoned.current) return;
      if (!engine || engine.remote) return;

      const now = Date.now();
      if (now < (turnDeadline ?? Infinity)) return;

      // Time's up — call shared checkTimeout to force pass + block playable tiles
      const result = engine.checkTimeout(now);
      if (!result) return;

      // Sync state to store
      const match = result.match;
      const idx = engine.playerIndex;
      useGameStore.setState((state) => ({
        game: {
          ...state.game,
          board: match.board,
          scores: match.scores.scores,
          players: match.players.map((p) => ({
            id: p.id,
            name: p.name,
            handSize: p.hand.length,
            isConnected: p.isConnected,
          })),
          ownHand: engine.hand,
          blockedTileIds: match.players[idx]?.blockedTileIds ?? [],
          turn: {
            currentTurn: match.turn.currentTurn,
            turnDeadline: match.turn.turnDeadline,
            consecutiveNullRounds: match.turn.consecutiveNullRounds,
            roundNumber: match.turn.roundNumber,
            lastHandWinner: match.turn.lastHandWinner,
          },
          status: match.status,
        },
      }));

      // Mark the passed player for visual indicator (forced timeout counts as pass)
      const timeoutEvent = result.events.find((e) => e.type === "turn_timeout");
      if (timeoutEvent && timeoutEvent.type === "turn_timeout") {
        markPassed(timeoutEvent.playerId);
      }

      // If it was the human who timed out and it's now a bot's turn, trigger bot processing
      if (match.turn.currentTurn !== playerIndex && match.status === "in_progress") {
        processBots();
      }
    }, 500); // Check every 500ms for responsive enforcement

    return () => clearInterval(interval);
  }, [engine, status, currentTurn, turnDeadline, playerIndex, markPassed, processBots]);

  // Abandon match
  const handleConfirmAbandon = useCallback(() => {
    setShowLeaveModal(false);
    isAbandoned.current = true;
    reset();
    router.push("/lobby");
  }, [reset, router]);

  const canAbandon = status === "in_progress";

  return (
    <div className="relative min-h-screen bg-domino-950 text-domino-50">
      {/* Grid: 2 rows × 2 columns */}
      <div className="grid grid-rows-[1fr_auto] grid-cols-1 lg:grid-cols-[280px_1fr] gap-2 p-2 h-screen max-h-screen">
        {/* Row 1: Board (spans both columns) */}
        <div className="lg:col-span-2 min-h-0">
          <GameBoard />
        </div>

        {/* Row 2, Col 1: ScorePanel */}
        <div className="hidden lg:block h-full">
          <ScorePanel />
        </div>

        {/* Row 2, Col 2: PlayerHand */}
        <div className="relative min-h-0" data-hand-area>
          <PlayerHand />
        </div>
      </div>

      {/* Abandon button — bottom-left, subtle */}
      {canAbandon && (
        <button
          type="button"
          onClick={() => setShowLeaveModal(true)}
          className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-lg border border-domino-700/50 bg-domino-900/80 px-3 py-1.5 text-xs text-domino-400 backdrop-blur-sm transition-colors hover:border-red-500/50 hover:text-red-400"
        >
          {/* Door/exit icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {/* Text — hidden on mobile */}
          <span className="hidden sm:inline">Abandonar partida</span>
        </button>
      )}

      {/* Leave confirmation modal */}
      <LeaveMatchConfirmModal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        onConfirm={handleConfirmAbandon}
      />

      {/* Overlays */}
      <GameStatusOverlay />
    </div>
  );
}
