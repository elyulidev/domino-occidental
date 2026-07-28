"use client"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { useGameStore } from "@/stores/game-store"
import { resolveLeadingPair, formatScore, playerToPair } from "@/components/game/score-panel"

interface ScoreBottomSheetProps {
  open: boolean
  onClose: () => void
}

export function ScoreBottomSheet({ open, onClose }: ScoreBottomSheetProps) {
  const game = useGameStore((s) => s.game)
  const players = game?.players ?? []
  const scores = game?.scores ?? [0, 0]
  const round = (game?.turn?.roundNumber ?? 0) + 1
  const lastWinner = game?.turn?.lastHandWinner ?? null
  const consecutiveNull = game?.turn?.consecutiveNullRounds ?? 0
  const targetScore = 200

  const leading = resolveLeadingPair(scores)

  return (
    <BottomSheet open={open} onClose={onClose} title="Marcador">
      <div className="space-y-4 p-4">
        {/* Pair scores */}
        <div className="grid grid-cols-2 gap-3">
          <ScoreCard
            label="Pareja 1"
            score={formatScore(scores[0])}
            players={players.filter((_, i) => playerToPair(i) === 0)}
            isLeading={leading === 0}
          />
          <ScoreCard
            label="Pareja 2"
            score={formatScore(scores[1])}
            players={players.filter((_, i) => playerToPair(i) === 1)}
            isLeading={leading === 1}
          />
        </div>

        {/* Match info */}
        <div className="space-y-2 text-sm text-domino-300">
          <div className="flex justify-between">
            <span>Ronda</span>
            <span className="text-domino-50">{round}</span>
          </div>
          <div className="flex justify-between">
            <span>Objetivo</span>
            <span className="text-domino-50">{targetScore}</span>
          </div>
          {lastWinner !== null && (
            <div className="flex justify-between">
              <span>Última mano</span>
              <span className="text-gold-400">Pareja {playerToPair(lastWinner) + 1}</span>
            </div>
          )}
          {consecutiveNull > 0 && (
            <div className="flex justify-between">
              <span>Manos anuladas</span>
              <span className="text-domino-50">{consecutiveNull}</span>
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  )
}

function ScoreCard({
  label,
  score,
  players,
  isLeading,
}: {
  label: string
  score: string
  players: Array<{ name?: string }>
  isLeading: boolean
}) {
  return (
    <div
      className={`rounded-xl p-3 ${
        isLeading ? "bg-gold-400/10 border border-gold-400/30" : "bg-domino-800/50"
      }`}
    >
      <div className="text-xs text-domino-400">{label}</div>
      <div className={`text-2xl font-bold ${isLeading ? "text-gold-400" : "text-domino-50"}`}>
        {score}
      </div>
      <div className="mt-1 text-xs text-domino-400">
        {players.map((p) => p.name ?? "Jugador").join(" + ")}
      </div>
    </div>
  )
}
