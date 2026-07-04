"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function QuickMatchButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuickMatch = async () => {
    setLoading(true);
    setError(null);
    try {
      // Uses Next.js rewrite — /api/* proxied to backend
      const res = await fetch("/api/v1/dev/create-match", { method: "POST" });
      if (!res.ok) {
        throw new Error(`Backend responded with ${res.status}`);
      }
      const { matchId } = await res.json();
      router.push(`/match/${matchId}?playerId=p0&mode=online`);
    } catch (err) {
      setLoading(false);
      setError(
        err instanceof TypeError
          ? "Backend not reachable — make sure backend is running on port 3001"
          : "Failed to create match — try again",
      );
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleQuickMatch}
        disabled={loading}
        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 px-8 py-3.5 text-base font-semibold text-black shadow-xl shadow-gold-500/20 transition-all hover:from-gold-400 hover:to-gold-500 hover:shadow-gold-500/30 active:scale-[0.97] disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {loading ? "Creando partida..." : "Jugar ahora"}
      </button>
      {error && (
        <p className="text-xs text-red-400 max-w-xs">{error}</p>
      )}
    </div>
  );
}
