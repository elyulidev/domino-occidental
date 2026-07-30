"use client"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { useGameStore } from "@/stores/game-store"
import { computeOpponents, connectionDotClass } from "@/components/game/opponent-indicator"

interface PlayersBottomSheetProps {
  open: boolean
  onClose: () => void
}

export function PlayersBottomSheet({ open, onClose }: PlayersBottomSheetProps) {
  const game = useGameStore((s) => s.game)
  const playerIndex = useGameStore((s) => s.game.playerIndex)
  const avatarUrls = useGameStore((s) => s.game.avatarUrls)

  const players = game?.players ?? []
  const currentTurn = game?.turn?.currentTurn ?? null
  const boardTileCount = game?.board?.tiles?.length ?? 0

  const opponents = computeOpponents(players, boardTileCount, playerIndex ?? 0)

  // Group by pair: playerIndex % 2 === 0 means pair 0, else pair 1
  const myPair = (playerIndex ?? 0) % 2
  const myPairLabel = "Tu pareja"
  const rivalPairLabel = "Rivales"

  return (
    <BottomSheet open={open} onClose={onClose} title="Jugadores">
      <div className="p-4 space-y-4">
        {/* My pair */}
        <div>
          <div className="text-xs font-medium text-gold-400 mb-2">{myPairLabel}</div>
          <div className="space-y-2">
            {players
              .map((p, i) => ({ ...p, seatIndex: i }))
              .filter((p) => p.seatIndex % 2 === myPair)
              .map((p) => (
                <PlayerRow
                  key={p.id}
                  name={p.name ?? `Jugador ${p.seatIndex + 1}`}
                  avatar={avatarUrls?.[p.seatIndex]}
                  handSize={p.handSize ?? 0}
                  isConnected={p.isConnected ?? false}
                  isCurrentTurn={currentTurn === p.seatIndex}
                  isSelf={p.seatIndex === playerIndex}
                />
              ))}
          </div>
        </div>

        {/* Rival pair */}
        <div>
          <div className="text-xs font-medium text-domino-400 mb-2">{rivalPairLabel}</div>
          <div className="space-y-2">
            {players
              .map((p, i) => ({ ...p, seatIndex: i }))
              .filter((p) => p.seatIndex % 2 !== myPair)
              .map((p) => (
                <PlayerRow
                  key={p.id}
                  name={p.name ?? `Jugador ${p.seatIndex + 1}`}
                  avatar={avatarUrls?.[p.seatIndex]}
                  handSize={p.handSize ?? 0}
                  isConnected={p.isConnected ?? false}
                  isCurrentTurn={currentTurn === p.seatIndex}
                  isSelf={false}
                />
              ))}
          </div>
        </div>
      </div>
    </BottomSheet>
  )
}

function PlayerRow({
  name,
  avatar,
  handSize,
  isConnected,
  isCurrentTurn,
  isSelf,
}: {
  name: string
  avatar?: string
  handSize: number
  isConnected: boolean
  isCurrentTurn: boolean
  isSelf: boolean
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg p-2 ${
        isCurrentTurn
          ? "bg-gold-400/10 border border-gold-400/30"
          : "bg-domino-800/50"
      }`}
    >
      {/* Avatar */}
      <div className="relative h-8 w-8 shrink-0">
        {avatar ? (
          <img src={avatar} alt={name} className="h-full w-full rounded-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-domino-700 text-xs text-domino-300">
            {name.charAt(0)}
          </div>
        )}
        {/* Connection dot */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-domino-900 ${connectionDotClass(isConnected)}`}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-domino-50 truncate">
          {name} {isSelf && <span className="text-domino-400">( vos )</span>}
        </div>
        <div className="text-xs text-domino-400">
          {handSize} {handSize === 1 ? "ficha" : "fichas"}
        </div>
      </div>

      {/* Turn indicator */}
      {isCurrentTurn && (
        <div className="text-xs font-medium text-gold-400">Turno</div>
      )}
    </div>
  )
}
