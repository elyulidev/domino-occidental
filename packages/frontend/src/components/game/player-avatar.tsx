"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/** Map a seat index (0–3) to a CSS position class (counter-clockwise). */
export function seatPositionClass(
  seatIndex: number,
): "bottom" | "right" | "top" | "left" {
  const positions = ["bottom", "right", "top", "left"] as const;
  return positions[seatIndex] ?? "bottom";
}

/** Compute the absolute CSS position for a given seat (counter-clockwise). */
export function seatStyle(
  seatIndex: number,
): React.CSSProperties {
  switch (seatIndex) {
    case 0: // bottom (self)
      return { bottom: "8px", left: "50%", transform: "translateX(-50%)" };
    case 1: // right (counter-clockwise from bottom)
      return { right: "8px", top: "50%", transform: "translateY(-50%)" };
    case 2: // top (partner)
      return { top: "8px", left: "50%", transform: "translateX(-50%)" };
    case 3: // left (counter-clockwise from top)
      return { left: "8px", top: "50%", transform: "translateY(-50%)" };
  default:
    return {};
  }
}

/**
 * Compute the CSS class for tooltip positioning based on seat.
 * Tooltips always point inward toward the board center to avoid viewport overflow.
 */
export function tooltipPositionClass(seatIndex: number): string {
  switch (seatIndex) {
    case 0: // bottom → tooltip above
      return "bottom-full left-1/2 -translate-x-1/2 mb-2";
    case 1: // right → tooltip to the left (toward center)
      return "right-full top-1/2 -translate-y-1/2 mr-2";
    case 2: // top → tooltip below
      return "top-full left-1/2 -translate-x-1/2 mt-2";
    case 3: // left → tooltip to the right (toward center)
      return "left-full top-1/2 -translate-y-1/2 ml-2";
    default:
      return "bottom-full left-1/2 -translate-x-1/2 mb-2";
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
  className?: string;
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
  className,
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

  return (
    <div
      ref={ref}
      className={[
        "absolute z-10 flex items-center justify-center group",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      data-seat={dataSeat}
    >
      {/* Avatar circle — focusable for touch tooltip on mobile */}
      <div
        tabIndex={0}
        role="img"
        aria-label={`Avatar de ${playerName}`}
        className={[
          "relative flex items-center justify-center rounded-full",
          "w-10 h-10 sm:w-16 sm:h-16",
          "outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70",
          "cursor-default select-none",
          isActive ? "ring-2 ring-yellow-400 animate-pulse" : "",
          grayed ? "grayscale opacity-50" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={playerName}
            className="pointer-events-none h-full w-full rounded-full object-cover"
          />
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="pointer-events-none h-full w-full rounded-full bg-domino-700 p-1.5 text-domino-300"
          >
            <circle cx="12" cy="8" r="4" fill="currentColor" />
            <path
              d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8"
              fill="currentColor"
            />
          </svg>
        )}
      </div>

      {/* Hover/focus tooltip — positioned inward toward board center */}
      <div
        className={[
          "absolute z-50 pointer-events-none whitespace-nowrap",
          "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
          "transition-opacity duration-150",
          "bg-domino-900/95 border border-domino-700/60 rounded-lg",
          "px-2 py-1.5 sm:px-3 sm:py-2 max-w-[200px]",
          "backdrop-blur-sm shadow-lg",
          tooltipPositionClass(seatIndex),
        ].join(" ")}
      >
        <div className="flex flex-col gap-0.5 sm:gap-1">
          <span className="text-[11px] sm:text-xs font-semibold text-domino-50 truncate">
            {playerName}
          </span>

          {handSize !== undefined && (
            <span className="text-[10px] sm:text-[11px] text-domino-400">
              {handSize} {handSize === 1 ? "ficha" : "fichas"}
            </span>
          )}

          <span className="flex items-center gap-1 sm:gap-1.5">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-[9px] sm:text-[10px] text-domino-400">
              {isConnected ? "En línea" : "Sin conexión"}
            </span>
          </span>

          {pairLabel && (
            <span className="text-[9px] sm:text-[10px] text-domino-500">{pairLabel}</span>
          )}
        </div>
      </div>
    </div>
  );
}
