"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/** Map a seat index (0–3) to a CSS position class. */
export function seatPositionClass(
  seatIndex: number,
): "bottom" | "left" | "top" | "right" {
  const positions = ["bottom", "left", "top", "right"] as const;
  return positions[seatIndex] ?? "bottom";
}

/** Compute the absolute CSS position for a given seat. */
export function seatStyle(
  seatIndex: number,
): React.CSSProperties {
  switch (seatIndex) {
    case 0: // bottom (self)
      return { bottom: "8px", left: "50%", transform: "translateX(-50%)" };
    case 1: // left (P2)
      return { left: "8px", top: "50%", transform: "translateY(-50%)" };
    case 2: // top (P3, partner)
      return { top: "8px", left: "50%", transform: "translateX(-50%)" };
    case 3: // right (P4)
      return { right: "8px", top: "50%", transform: "translateY(-50%)" };
    default:
      return {};
  }
}

/**
 * Determine if the avatar should be grayed out.
 * Returns true if disconnected AND more than 30s have elapsed.
 */
export function isGrayedOut(
  isConnected: boolean,
  disconnectedSince: number | null,
  now: number,
): boolean {
  if (isConnected) return false;
  if (disconnectedSince === null) return false;
  return now - disconnectedSince > 30_000;
}

/**
 * Detect prefers-reduced-motion. Returns true if animations should be disabled.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface PlayerAvatarProps {
  avatarUrl: string;
  playerName: string;
  isActive: boolean;
  isConnected: boolean;
  disconnectedSince: number | null;
  seatIndex: number;
  handSize?: number;
  pairLabel?: string;
  "data-seat"?: number;
  avatarRef?: React.RefObject<HTMLDivElement | null>;
}

export function PlayerAvatar({
  avatarUrl,
  playerName,
  isActive,
  isConnected,
  disconnectedSince,
  seatIndex,
  handSize,
  pairLabel,
  "data-seat": dataSeat,
  avatarRef,
}: PlayerAvatarProps) {
  const [now, setNow] = useState(Date.now());
  const internalRef = useRef<HTMLDivElement>(null);
  const ref = avatarRef ?? internalRef;

  // Update `now` every 5s to trigger gray-out re-evaluation
  useEffect(() => {
    if (isConnected || disconnectedSince === null) return;
    const id = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(id);
  }, [isConnected, disconnectedSince]);

  const grayed = isGrayedOut(isConnected, disconnectedSince, now);
  const style = seatStyle(seatIndex);

  // Tooltip position: avoid overlapping the board center
  const tooltipSide = seatIndex <= 1 ? "left" : "right";

  return (
    <div
      ref={ref}
      className="absolute z-10 flex items-center justify-center group"
      style={style}
      data-seat={dataSeat}
    >
      <div
        className={[
          "relative flex items-center justify-center rounded-full",
          // Size: 64px desktop, 40px mobile
          "w-10 h-10 sm:w-16 sm:h-16",
          // Active highlight
          isActive ? "ring-2 ring-yellow-400 animate-pulse" : "",
          // Disconnected gray-out
          grayed ? "grayscale opacity-50" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={playerName}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          // Default SVG avatar — simple person silhouette
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-full w-full rounded-full bg-domino-700 p-1.5 text-domino-300"
          >
            <circle cx="12" cy="8" r="4" fill="currentColor" />
            <path
              d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8"
              fill="currentColor"
            />
          </svg>
        )}
      </div>

      {/* Hover tooltip */}
      <div
        className={[
          "absolute z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150",
          "bg-domino-900/95 border border-domino-700/60 rounded-lg px-3 py-2 min-w-[120px]",
          "backdrop-blur-sm shadow-lg",
          // Position tooltip based on seat
          tooltipSide === "left"
            ? "left-full ml-2 top-1/2 -translate-y-1/2"
            : "right-full mr-2 top-1/2 -translate-y-1/2",
        ].join(" ")}
      >
        <div className="flex flex-col gap-1">
          {/* Player name */}
          <span className="text-xs font-semibold text-domino-50 truncate">
            {playerName}
          </span>

          {/* Hand size */}
          {handSize !== undefined && (
            <span className="text-[11px] text-domino-400">
              {handSize} {handSize === 1 ? "tile" : "tiles"}
            </span>
          )}

          {/* Connection status */}
          <span className="flex items-center gap-1.5">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-[10px] text-domino-400">
              {isConnected ? "Online" : "Offline"}
            </span>
          </span>

          {/* Pair label */}
          {pairLabel && (
            <span className="text-[10px] text-domino-500">{pairLabel}</span>
          )}
        </div>
      </div>
    </div>
  );
}
