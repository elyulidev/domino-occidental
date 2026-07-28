"use client"

import { useState } from "react"
import { ScoreBottomSheet } from "./score-bottom-sheet"
import { PlayersBottomSheet } from "./players-bottom-sheet"
import { SettingsBottomSheet } from "./settings-bottom-sheet"

interface MatchNavBarProps {
  onLeaveMatch?: () => void
}

type SheetType = "score" | "players" | "settings" | null

export function MatchNavBar({ onLeaveMatch }: MatchNavBarProps) {
  const [activeSheet, setActiveSheet] = useState<SheetType>(null)

  const toggleSheet = (sheet: SheetType) => {
    setActiveSheet((prev) => (prev === sheet ? null : sheet))
  }

  return (
    <>
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-domino-700/50 bg-domino-900/95 backdrop-blur-sm px-2 py-1.5">
        <NavButton
          icon={<ChartBarIcon />}
          label="Marcador"
          onClick={() => toggleSheet("score")}
          isActive={activeSheet === "score"}
        />
        <NavButton
          icon={<UsersIcon />}
          label="Jugadores"
          onClick={() => toggleSheet("players")}
          isActive={activeSheet === "players"}
        />
        <NavButton
          icon={<CogIcon />}
          label="Info"
          onClick={() => toggleSheet("settings")}
          isActive={activeSheet === "settings"}
        />
        <NavButton
          icon={<DoorExitIcon />}
          label="Salir"
          onClick={onLeaveMatch ?? (() => {})}
          isActive={false}
          isDanger
        />
      </div>

      <ScoreBottomSheet open={activeSheet === "score"} onClose={() => setActiveSheet(null)} />
      <PlayersBottomSheet open={activeSheet === "players"} onClose={() => setActiveSheet(null)} />
      <SettingsBottomSheet open={activeSheet === "settings"} onClose={() => setActiveSheet(null)} />
    </>
  )
}

function NavButton({
  icon,
  label,
  onClick,
  isActive,
  isDanger,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  isActive: boolean
  isDanger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-lg p-2.5 min-w-[44px] min-h-[44px] transition-colors ${
        isActive
          ? "bg-domino-700/50 text-gold-400"
          : isDanger
            ? "text-red-400 hover:bg-red-400/10"
            : "text-domino-300 hover:bg-domino-700/30"
      }`}
      aria-label={label}
    >
      {icon}
      <span className="text-[10px] leading-tight">{label}</span>
    </button>
  )
}

function ChartBarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" x2="18" y1="20" y2="10" />
      <line x1="12" x2="12" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="14" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function CogIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function DoorExitIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  )
}
