"use client";

import { useMatchmaking } from "@/hooks/use-matchmaking";

export function QuickMatchButton() {
  const {
    joinQueue,
    leaveQueue,
    status,
    queuePosition,
    waitTimeMs,
    queueCount,
    error,
  } = useMatchmaking();

  // --- Match found: show redirecting state ---
  if (status === "matched") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-white">
        <svg
          className="h-5 w-5 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
        </svg>
        ¡Partida encontrada! Redirigiendo...
      </div>
    );
  }

  // --- In queue: show position + wait + leave button ---
  if (status === "queued") {
    const waitSeconds = Math.floor(waitTimeMs / 1000);
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/20 px-6 py-3 font-semibold text-amber-400">
          <svg
            className="h-5 w-5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
          </svg>
          En cola — Posición: {queuePosition ?? "—"}
        </div>
        <div className="text-sm text-slate-400">
          Espera estimada: ~{waitSeconds}s · {queueCount} jugadores en cola
        </div>
        <button
          type="button"
          onClick={leaveQueue}
          className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
          Salir de la cola
        </button>
      </div>
    );
  }

  // --- Idle / error: show join button ---
  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={joinQueue}
        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 px-8 py-3.5 text-base font-semibold text-black shadow-xl shadow-gold-500/20 transition-all hover:from-gold-400 hover:to-gold-500 hover:shadow-gold-500/30 active:scale-[0.97]"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Jugar ahora
      </button>
      {error && <p className="max-w-xs text-xs text-red-400">{error}</p>}
    </div>
  );
}
