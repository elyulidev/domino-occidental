import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Amigos — Dominó Occidental",
};

export default function FriendsPage() {
  const pendingCount = PENDING_REQUESTS.length;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* ── Header ── */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-domino-50 sm:text-3xl">Amigos</h1>
          <p className="mt-1 text-sm text-domino-400">
            Gestioná tus conexiones y solicitá amistades.
          </p>
        </div>
        <Link
          href="/users/search"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 px-6 py-2.5 text-sm font-semibold text-black shadow-lg shadow-gold-500/20 transition-all hover:from-gold-400 hover:to-gold-500 active:scale-[0.97]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          Buscar jugadores
        </Link>
      </section>

      {/* ── Tabs ── */}
      <div className="flex gap-6 border-b border-domino-700">
        <span className="border-b-2 border-gold-500 pb-3 text-sm font-medium text-domino-50">
          Amigos
        </span>
        <span className="relative pb-3 text-sm font-medium text-domino-400 transition-colors hover:text-domino-200">
          Solicitudes
          {pendingCount > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-500/20 px-1.5 text-xs font-semibold text-gold-400">
              {pendingCount}
            </span>
          )}
        </span>
      </div>

      {/* ── Friends list ── */}
      <div className="space-y-3">
        {FRIENDS_ONLINE.map((friend) => (
          <div
            key={friend.name}
            className="flex items-center gap-4 rounded-2xl border border-domino-700/50 bg-domino-900/60 px-5 py-4 transition-colors hover:bg-domino-800/40"
          >
            <div className="relative shrink-0">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-domino-700 text-sm font-semibold text-gold-400">
                {friend.initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-40" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-domino-50">
                {friend.name}
              </p>
              <p className="text-xs text-domino-400">
                ELO {friend.elo} · {friend.status}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/lobby"
                className="rounded-lg border border-domino-700 px-3 py-1.5 text-xs font-medium text-domino-300 transition-colors hover:bg-domino-700 hover:text-domino-50"
              >
                Retar
              </Link>
              <Link
                href={`/profile/${friend.username}`}
                className="rounded-lg border border-domino-700 px-3 py-1.5 text-xs font-medium text-domino-300 transition-colors hover:bg-domino-700 hover:text-domino-50"
              >
                Ver perfil
              </Link>
              <button
                type="button"
                className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {FRIENDS_ONLINE.length === 0 && (
        <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-10 text-center">
          <p className="text-sm text-domino-400">No hay amigos conectados</p>
          <Link
            href="/users/search"
            className="mt-3 inline-block text-sm font-medium text-gold-400 hover:text-gold-300 transition-colors"
          >
            Buscar jugadores
          </Link>
        </div>
      )}

      {/* ── Pending requests ── */}
      <div className="space-y-3">
        {PENDING_REQUESTS.map((request) => (
          <div
            key={request.name}
            className="flex items-center gap-4 rounded-2xl border border-domino-700/50 bg-domino-900/60 px-5 py-4 transition-colors hover:bg-domino-800/40"
          >
            <div className="relative shrink-0">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-domino-700 text-sm font-semibold text-gold-400">
                {request.initials}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-domino-50">
                {request.name}
              </p>
              <p className="text-xs text-domino-400">ELO {request.elo}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg bg-green-500/15 px-4 py-1.5 text-xs font-medium text-green-400 transition-colors hover:bg-green-500/25"
              >
                Aceptar
              </button>
              <button
                type="button"
                className="rounded-lg border border-domino-700 px-4 py-1.5 text-xs font-medium text-domino-300 transition-colors hover:bg-domino-700 hover:text-domino-50"
              >
                Rechazar
              </button>
            </div>
          </div>
        ))}
      </div>

      {PENDING_REQUESTS.length === 0 && (
        <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-10 text-center">
          <p className="text-sm text-domino-400">
            No tenés solicitudes pendientes
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Placeholder data ─── */

const FRIENDS_ONLINE = [
  {
    name: "María García",
    username: "maria_g",
    initials: "MG",
    elo: 1450,
    status: "En partida",
  },
  {
    name: "Carlos López",
    username: "carlos_l",
    initials: "CL",
    elo: 1180,
    status: "En lobby",
  },
  {
    name: "Ana Martínez",
    username: "ana_m",
    initials: "AM",
    elo: 1320,
    status: "En partida",
  },
];

const PENDING_REQUESTS = [
  { name: "Pedro Sánchez", initials: "PS", elo: 1050 },
  { name: "Lucía Fernández", initials: "LF", elo: 1380 },
];
