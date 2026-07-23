"use client";

import { useCallback, useEffect, useRef } from "react";
import { GameBoard } from "@/components/game/game-board";
import { GameStatusOverlay } from "@/components/game/game-status-overlay";
import { PlayerHand } from "@/components/game/player-hand";
import { ScorePanel } from "@/components/game/score-panel";
import { useGameStore } from "@/stores/game-store";

// ---------------------------------------------------------------------------
// CPU Match Page
// ---------------------------------------------------------------------------

export default function CpuMatchPage() {
  const initCpuMatch = useGameStore((s) => s.initCpuMatch);
  const engine = useGameStore((s) => s.engine);
  const status = useGameStore((s) => s.game.status);
  const currentTurn = useGameStore((s) => s.game.turn.currentTurn);

  const isProcessing = useRef(false);

  // Initialize CPU match on mount
  useEffect(() => {
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
    asyncFn.call(engine, () => {
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
  }, [engine, status, currentTurn]);

  // Trigger bot processing after human plays or passes
  useEffect(() => {
    if (currentTurn !== 0 && status === "in_progress") {
      processBots();
    }
  }, [currentTurn, status, processBots]);

  // Auto-play: if it's human's turn and a tile is selected, wait for side selection
  // The PlayerHand component handles tile selection and side picking

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

      {/* Overlays */}
      <GameStatusOverlay />
    </div>
  );
}
