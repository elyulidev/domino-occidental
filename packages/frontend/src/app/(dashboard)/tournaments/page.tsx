import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Torneos — Dominó Occidental",
};

export default function TournamentsPage() {
  const activeTournaments = TOURNAMENTS.filter((t) => t.tab === "active");
  const upcomingTournaments = TOURNAMENTS.filter((t) => t.tab === "upcoming");
  const finishedTournaments = TOURNAMENTS.filter((t) => t.tab === "finished");

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* ── Header ── */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Torneos</h1>
          <p className="mt-1 text-sm text-domino-400">
            Competí contra otras parejas y escalá en el ranking.
          </p>
        </div>
        <Link
          href="/tournaments/create"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 px-6 py-2.5 text-sm font-semibold text-domino-950 shadow-lg shadow-gold-500/20 transition-all hover:from-gold-400 hover:to-gold-500 active:scale-[0.97]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
          >
            <path d="M12 5v14m7-7H5" />
          </svg>
          Crear torneo
        </Link>
      </section>

      {/* ── Tabs ── */}
      <div className="flex gap-6 border-b border-domino-700">
        <span className="border-b-2 border-gold-500 pb-3 text-sm font-medium text-white">
          Activos
        </span>
        <span className="pb-3 text-sm font-medium text-domino-400 transition-colors hover:text-domino-200">
          Próximos
        </span>
        <span className="pb-3 text-sm font-medium text-domino-400 transition-colors hover:text-domino-200">
          Finalizados
        </span>
      </div>

      {/* ── Tournament cards grid ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {activeTournaments.map((tournament) => (
          <Link
            key={tournament.id}
            href={`/tournaments/${tournament.id}`}
            className="group rounded-xl border border-domino-700/40 bg-domino-800/30 p-4 transition-all hover:border-gold-500/30 hover:bg-domino-800/50"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">
                <span className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                En vivo
              </span>
              <span className="text-xs text-domino-500">
                {tournament.bracketType}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-white group-hover:text-gold-400 transition-colors">
              {tournament.name}
            </h3>
            <div className="mt-2 flex items-center justify-between text-xs text-domino-400">
              <span>{tournament.pairs} parejas</span>
              <span>Entry: {tournament.entryFee}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-domino-400">
              <span>Premio: {tournament.prizePool}</span>
              <span>{tournament.phase}</span>
            </div>
          </Link>
        ))}

        {upcomingTournaments.map((tournament) => (
          <Link
            key={tournament.id}
            href={`/tournaments/${tournament.id}`}
            className="group rounded-xl border border-domino-700/40 bg-domino-800/30 p-4 transition-all hover:border-gold-500/30 hover:bg-domino-800/50"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center rounded-full bg-gold-500/15 px-2 py-0.5 text-xs font-medium text-gold-400">
                Próximo
              </span>
              <span className="text-xs text-domino-500">
                {tournament.bracketType}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-white group-hover:text-gold-400 transition-colors">
              {tournament.name}
            </h3>
            <div className="mt-2 flex items-center justify-between text-xs text-domino-400">
              <span>{tournament.pairs} parejas</span>
              <span>Entry: {tournament.entryFee}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-domino-400">
              <span>Premio: {tournament.prizePool}</span>
              <span>{tournament.phase}</span>
            </div>
          </Link>
        ))}

        {finishedTournaments.map((tournament) => (
          <Link
            key={tournament.id}
            href={`/tournaments/${tournament.id}`}
            className="group rounded-xl border border-domino-700/40 bg-domino-800/30 p-4 transition-all hover:border-gold-500/30 hover:bg-domino-800/50"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center rounded-full bg-domino-700/50 px-2 py-0.5 text-xs font-medium text-domino-400">
                Finalizado
              </span>
              <span className="text-xs text-domino-500">
                {tournament.bracketType}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-white group-hover:text-gold-400 transition-colors">
              {tournament.name}
            </h3>
            <div className="mt-2 flex items-center justify-between text-xs text-domino-400">
              <span>{tournament.pairs} parejas</span>
              <span>Entry: {tournament.entryFee}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-domino-400">
              <span>Premio: {tournament.prizePool}</span>
              <span>{tournament.phase}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Empty states per tab (only shown when all are empty) ── */}
      {activeTournaments.length === 0 &&
        upcomingTournaments.length === 0 &&
        finishedTournaments.length === 0 && (
          <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-10 text-center">
            <p className="text-sm text-domino-400">
              No hay torneos disponibles en este momento.
            </p>
            <Link
              href="/tournaments/create"
              className="mt-3 inline-block text-sm font-medium text-gold-400 hover:text-gold-300 transition-colors"
            >
              Crear el primero
            </Link>
          </div>
        )}
    </div>
  );
}

/* ─── Placeholder data ─── */

const TOURNAMENTS = [
  {
    id: "1",
    name: "Torneo Relámpago #42",
    tab: "active" as const,
    bracketType: "Single Elimination",
    pairs: 16,
    entryFee: "50 monedas",
    prizePool: "1,000 monedas",
    phase: "Cuartos de final",
  },
  {
    id: "2",
    name: "Liga de Plata — Temporada 3",
    tab: "active" as const,
    bracketType: "Double Elimination",
    pairs: 32,
    entryFee: "100 monedas",
    prizePool: "2,500 monedas",
    phase: "Ronda 2",
  },
  {
    id: "3",
    name: "Torneo Master — Edición Especial",
    tab: "upcoming" as const,
    bracketType: "Single Elimination",
    pairs: 16,
    entryFee: "200 monedas",
    prizePool: "5,000 monedas",
    phase: "Inscripciones abiertas",
  },
  {
    id: "4",
    name: "Copa Fin de Semana",
    tab: "upcoming" as const,
    bracketType: "Round Robin",
    pairs: 8,
    entryFee: "25 monedas",
    prizePool: "400 monedas",
    phase: "Inscripciones abiertas",
  },
  {
    id: "5",
    name: "Torneo Inaugural #1",
    tab: "finished" as const,
    bracketType: "Single Elimination",
    pairs: 16,
    entryFee: "50 monedas",
    prizePool: "800 monedas",
    phase: "Finalizado",
  },
  {
    id: "6",
    name: "Liga de Bronce — Temporada 1",
    tab: "finished" as const,
    bracketType: "Double Elimination",
    pairs: 8,
    entryFee: "30 monedas",
    prizePool: "300 monedas",
    phase: "Finalizado",
  },
];
