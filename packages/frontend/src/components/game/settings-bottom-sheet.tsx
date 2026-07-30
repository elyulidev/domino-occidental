"use client";

import { TARGET_SCORE } from "@domino/shared";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useGameStore } from "@/stores/game-store";

const TOTAL_TILES = 55;

const STATUS_LABELS: Record<string, string> = {
  waiting: "Esperando",
  in_progress: "En curso",
  finished: "Finalizada",
  abandoned: "Abandonada",
};

interface SettingsBottomSheetProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsBottomSheet({ open, onClose }: SettingsBottomSheetProps) {
  const engine = useGameStore((s) => s.engine);
  const status = useGameStore((s) => s.game.status);
  const boardTiles = useGameStore((s) => s.game.board.tiles.length);
  const ownHandCount = useGameStore((s) => s.game.ownHand.length);
  const playerCount = useGameStore((s) => s.game.players.length);

  const isOnline = engine?.remote ?? false;
  const poolCount = TOTAL_TILES - playerCount * 10 - boardTiles;

  const items: [string, string | number][] = [
    ["Objetivo", TARGET_SCORE],
    ["Modo", isOnline ? "Online" : "Local"],
    ["Fichas en pozo", poolCount],
    ["Fichas jugadas", boardTiles],
    ["Fichas en mano", ownHandCount],
    ["Estado", STATUS_LABELS[status] ?? status],
  ];

  return (
    <BottomSheet open={open} onClose={onClose} title="Partida">
      <ul className="space-y-3">
        {items.map(([label, value]) => (
          <li
            key={label}
            className="flex items-center justify-between text-sm text-domino-100"
          >
            <span className="text-domino-400">{label}</span>
            <span className="font-medium text-domino-50">{String(value)}</span>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
