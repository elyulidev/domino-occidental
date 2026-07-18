"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// LeaveMatchConfirmModal
//
// Confirmation dialog before leaving a match. Requires explicit user
// confirmation before sending the `leave` WebSocket message to the server.
// Follows the HandOverModal styling pattern.
// ---------------------------------------------------------------------------

export interface LeaveMatchConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  playerName?: string;
}

export function LeaveMatchConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  playerName,
}: LeaveMatchConfirmModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap: focus the dialog on open
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-match-title"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="mx-4 w-full max-w-sm rounded-2xl border border-domino-700/50 bg-domino-900/60 p-8 text-center shadow-2xl outline-none"
      >
        {/* Warning icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
          <span className="text-3xl">🚪</span>
        </div>

        {/* Title */}
        <h2 id="leave-match-title" className="text-xl font-bold text-domino-50">
          Leave Match?
        </h2>

        {/* Body */}
        <p className="mt-2 text-sm text-domino-300">
          {playerName
            ? `${playerName}, are you sure you want to leave? This will end the game for all players.`
            : "Are you sure you want to leave? This will end the game for all players."}
        </p>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-domino-600/50 bg-domino-800/50 px-4 py-2 text-sm font-medium text-domino-300 transition-colors hover:bg-domino-700/50 hover:text-domino-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 active:scale-[0.97]"
          >
            Leave Match
          </button>
        </div>
      </div>
    </div>
  );
}
