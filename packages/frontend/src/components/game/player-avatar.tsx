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

  return (
    <div
      ref={ref}
      className="absolute z-10 flex items-center justify-center"
      style={style}
      title={playerName}
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
    </div>
  );
}
