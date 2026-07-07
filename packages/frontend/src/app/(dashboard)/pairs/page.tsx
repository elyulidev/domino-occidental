import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mis Parejas — Dominó Occidental",
};

export default function PairsPage() {
  const hasActivePairs = ACTIVE_PAIRS.length > 0;
  const hasPendingInvitations = PENDING_INVITATIONS.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* ── Header ── */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-domino-50 sm:text-3xl">
            Mis Parejas
          </h1>
          <p className="mt-1 text-sm text-domino-400">
            Gestioná tus parejas de juego y aceptá invitaciones.
          </p>
        </div>
        <Link
          href="/users/search"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 px-6 py-2.5 text-sm font-semibold text-black shadow-lg shadow-gold-500/20 transition-all hover:from-gold-400 hover:to-gold-500 active:scale-[0.97]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
            <path d="M12 5v14m-7-7h14" />
          </svg>
          Crear pareja
        </Link>
      </section>

      {/* ── Active pairs ── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-domino-50">Parejas activas</h2>

        {hasActivePairs ? (
          <div className="space-y-4">
            {ACTIVE_PAIRS.map((pair) => (
              <div
                key={pair.id}
                className="flex flex-col gap-4 rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5 sm:flex-row sm:items-center"
              >
                {/* Avatars */}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-domino-700 text-sm font-semibold text-gold-400">
                    {pair.player1.initials}
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-domino-500" aria-hidden="true">
                    <path d="M12 5v14m-7-7h14" />
                  </svg>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-domino-700 text-sm font-semibold text-gold-400">
                    {pair.player2.initials}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-domino-50">
                      {pair.player1.name}
                      <span className="text-domino-500"> + </span>
                      {pair.player2.name}
                    </p>
                    <span className="inline-flex items-center rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">
                      {pair.status}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-xs text-domino-400">
                    <span>
                      ELO combinado:{" "}
                      <span className="font-semibold text-domino-50">
                        {pair.combinedElo}
                      </span>
                    </span>
                    <span>
                      Win rate:{" "}
                      <span className="font-semibold text-domino-50">
                        {pair.winRate}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Link
                    href="/lobby"
                    className="rounded-lg border border-domino-700 px-4 py-2 text-sm font-medium text-domino-300 transition-colors hover:bg-domino-700 hover:text-domino-50"
                  >
                    Jugar
                  </Link>
                  <button
                    type="button"
                    className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
                  >
                    Disolver
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-10 text-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="mx-auto mb-3 h-10 w-10 text-domino-600"
              aria-hidden="true"
            >
              <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <p className="text-sm text-domino-400">No tenés parejas activas</p>
            <Link
              href="/users/search"
              className="mt-3 inline-block text-sm font-medium text-gold-400 hover:text-gold-300 transition-colors"
            >
              Buscar jugadores
            </Link>
          </div>
        )}
      </section>

      {/* ── Pending invitations ── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-domino-50">
          Invitaciones pendientes
        </h2>

        {hasPendingInvitations ? (
          <div className="space-y-3">
            {PENDING_INVITATIONS.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center gap-4 rounded-2xl border border-domino-700/50 bg-domino-900/60 px-5 py-4 transition-colors hover:bg-domino-800/40"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-domino-700 text-sm font-semibold text-gold-400">
                  {invitation.sender.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-domino-50">
                    {invitation.sender.name}
                  </p>
                  <p className="text-xs text-domino-400">
                    ELO {invitation.sender.elo} · Te invitó hace{" "}
                    {invitation.timeAgo}
                  </p>
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
        ) : (
          <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-10 text-center">
            <p className="text-sm text-domino-400">
              No tenés invitaciones pendientes
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

/* ─── Placeholder data ─── */

const ACTIVE_PAIRS = [
  {
    id: "pair-1",
    player1: { name: "María García", initials: "MG", elo: 1450 },
    player2: { name: "JugadorDemo", initials: "JD", elo: 1200 },
    combinedElo: 1325,
    status: "Activa",
    winRate: "68%",
  },
];

const PENDING_INVITATIONS = [
  {
    id: "inv-1",
    sender: { name: "Carlos López", initials: "CL", elo: 1180 },
    timeAgo: "2 horas",
  },
];
