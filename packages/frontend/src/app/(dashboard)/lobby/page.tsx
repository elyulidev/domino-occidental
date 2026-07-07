import type { Metadata } from "next";
import Link from "next/link";
import { QuickMatchButton } from "./_components/quick-match-button";

export const metadata: Metadata = {
  title: "Inicio — Dominó Occidental",
};

export default function LobbyPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* ── Welcome header ── */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-domino-50 sm:text-3xl">
            Buenas, <span className="text-gold-400">JugadorDemo</span>
          </h1>
          <p className="mt-1 text-sm text-domino-400">
            Bienvenido de vuelta. Tus amigos te esperan.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* ELO badge */}
          <div className="rounded-xl border border-domino-700 bg-domino-900/60 px-4 py-2 text-center">
            <p className="text-xs text-domino-400">ELO</p>
            <p className="text-lg font-bold text-domino-50">1,200</p>
          </div>
          {/* Coins badge */}
          <div className="rounded-xl border border-domino-700 bg-domino-900/60 px-4 py-2 text-center">
            <p className="text-xs text-domino-400">Monedas</p>
            <p className="text-lg font-bold text-gold-400">250</p>
          </div>
          {/* Rank badge */}
          <div className="rounded-xl border border-domino-700 bg-domino-900/60 px-4 py-2 text-center">
            <p className="text-xs text-domino-400">Ranking</p>
            <p className="text-lg font-bold text-domino-50">#842</p>
          </div>
        </div>
      </section>

      {/* ── Quick Match ── */}
      <section>
        <div className="relative overflow-hidden rounded-2xl border border-domino-700/50 bg-gradient-to-br from-domino-800 via-domino-800/80 to-domino-900 p-6 sm:p-8">
          {/* Decorative background pattern */}
          <div className="pointer-events-none absolute inset-0 select-none opacity-[0.04]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,#d4a843_0%,transparent_50%)]" />
          </div>

          <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-domino-50 sm:text-2xl">
                Partida rápida
              </h2>
              <p className="mt-1.5 max-w-md text-sm text-domino-300">
                Encontrá una pareja al instante. Sistema de emparejamiento por ELO
                para partidas equilibradas.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-domino-700/50 px-3 py-1 text-xs text-domino-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  124 jugadores en cola
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-domino-700/50 px-3 py-1 text-xs text-domino-300">
                  ⏱ ~15 segundos
                </span>
              </div>
            </div>
            <QuickMatchButton />
          </div>
        </div>
      </section>

      {/* ── Main grid: Friends + Tournaments ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Friends Online */}
        <section className="lg:col-span-1">
          <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-domino-50">Amigos online</h2>
              <Link
                href="/friends"
                className="text-xs font-medium text-gold-400 hover:text-gold-300 transition-colors"
              >
                Ver todos
              </Link>
            </div>

            <div className="space-y-3">
              {FRIENDS_ONLINE.map((friend) => (
                <div
                  key={friend.name}
                  className="flex items-center gap-3 rounded-xl bg-domino-800/40 px-3 py-2.5 transition-colors hover:bg-domino-800/60"
                >
                  <div className="relative shrink-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-domino-700 text-xs font-semibold text-gold-400">
                      {friend.initials}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-40" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
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
                  <button
                    type="button"
                    className="rounded-lg border border-domino-700 px-3 py-1.5 text-xs font-medium text-domino-300 transition-colors hover:bg-domino-700 hover:text-domino-50"
                  >
                    Retar
                  </button>
                </div>
              ))}
            </div>

            {FRIENDS_ONLINE.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm text-domino-400">No hay amigos conectados</p>
                <Link
                  href="/users/search"
                  className="mt-2 inline-block text-xs text-gold-400 hover:text-gold-300"
                >
                  Buscar jugadores
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Tournaments + Side info */}
        <section className="lg:col-span-2 space-y-6">
          {/* Active tournaments */}
          <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-domino-50">Torneos activos</h2>
              <Link
                href="/tournaments"
                className="text-xs font-medium text-gold-400 hover:text-gold-300 transition-colors"
              >
                Ver todos
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {TOURNAMENTS.map((t) => (
                <Link
                  key={t.name}
                  href={`/tournaments/${t.id}`}
                  className="group rounded-xl border border-domino-700/40 bg-domino-800/30 p-4 transition-all hover:border-gold-500/30 hover:bg-domino-800/50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.status === "En vivo"
                          ? "bg-green-500/15 text-green-400"
                          : "bg-gold-500/15 text-gold-400"
                      }`}
                    >
                      {t.status === "En vivo" && (
                        <span className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                      )}
                      {t.status}
                    </span>
                    <span className="text-xs text-domino-500">
                      {t.pairs} parejas
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-domino-50 group-hover:text-gold-400 transition-colors">
                    {t.name}
                  </h3>
                  <div className="mt-2 flex items-center justify-between text-xs text-domino-400">
                    <span>Premio: {t.prize}</span>
                    <span>{t.phase}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent activity / Stats row */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5">
              <h2 className="text-sm font-semibold text-domino-50 mb-3">
                Estadísticas de hoy
              </h2>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-2xl font-bold text-domino-50">3</p>
                  <p className="text-xs text-domino-400">Partidas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-400">2</p>
                  <p className="text-xs text-domino-400">Ganadas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-400">1</p>
                  <p className="text-xs text-domino-400">Perdidas</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5">
              <h2 className="text-sm font-semibold text-domino-50 mb-3">
                Rachas
              </h2>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="text-2xl font-bold text-gold-400">2</p>
                  <p className="text-xs text-domino-400">Victorias consecutivas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-domino-50">5</p>
                  <p className="text-xs text-domino-400">Días seguidos</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── Premium upsell ── */}
      <section className="rounded-2xl border border-gold-500/20 bg-gradient-to-r from-gold-500/5 via-domino-800/60 to-gold-500/5 p-5 sm:p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-domino-50">
              Desbloqueá <span className="text-gold-400">Premium</span>
            </h2>
            <p className="mt-1 text-sm text-domino-300">
              Sin anuncios, torneos exclusivos, badge de oro y más beneficios.
            </p>
          </div>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 rounded-lg border border-gold-500/30 bg-gold-500/10 px-5 py-2.5 text-sm font-medium text-gold-400 transition-all hover:bg-gold-500/20 active:scale-[0.97]"
          >
            Ver planes
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
              <path d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ─── Placeholder data ─── */

const FRIENDS_ONLINE = [
  { name: "María García", initials: "MG", elo: 1450, status: "En partida" },
  { name: "Carlos López", initials: "CL", elo: 1180, status: "En lobby" },
  { name: "Ana Martínez", initials: "AM", elo: 1320, status: "En partida" },
];

const TOURNAMENTS = [
  {
    id: "1",
    name: "Torneo Relámpago #42",
    status: "En vivo",
    pairs: 16,
    prize: "1,000 monedas",
    phase: "Cuartos de final",
  },
  {
    id: "2",
    name: "Liga de Plata",
    status: "Próximo",
    pairs: 32,
    prize: "2,500 monedas",
    phase: "Inscripciones abiertas",
  },
  {
    id: "3",
    name: "Torneo de Parejas",
    status: "En vivo",
    pairs: 8,
    prize: "500 monedas",
    phase: "Semifinal",
  },
];
