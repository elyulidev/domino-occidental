import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buscar Jugadores — Dominó Occidental",
};

export default function UserSearchPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* ── Header ── */}
      <section>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          Buscar Jugadores
        </h1>
        <p className="mt-1 text-sm text-domino-400">
          Encontrá jugadores para agregar a tus amigos o retar a una partida.
        </p>
      </section>

      {/* ── Search input ── */}
      <section className="relative">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-domino-500"
        >
          <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Buscá por nombre de usuario..."
          className="block w-full rounded-lg border border-domino-700 bg-domino-800/50 px-4 py-2.5 pl-10 text-sm text-white placeholder-domino-500 transition-colors focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
        />
      </section>

      {/* ── Results grid ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {SEARCH_RESULTS.map((user) => (
          <div
            key={user.username}
            className="flex items-center gap-4 rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5 transition-colors hover:bg-domino-800/40"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-domino-700 text-sm font-semibold text-gold-400">
              {user.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-white">
                  {user.username}
                </p>
                {user.country && (
                  <span className="inline-flex items-center rounded-full bg-domino-700/50 px-1.5 py-0.5 text-[10px] font-medium text-domino-300">
                    {user.country}
                  </span>
                )}
              </div>
              <p className="text-xs text-domino-400">ELO {user.elo}</p>
            </div>
            <div className="flex items-center gap-2">
              {user.friendStatus === "none" && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-gold-500 to-gold-600 px-4 py-1.5 text-xs font-semibold text-domino-950 shadow-lg shadow-gold-500/20 transition-all hover:from-gold-400 hover:to-gold-500 active:scale-[0.97]"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="h-3 w-3"
                  >
                    <path d="M12 5v14m-7-7h14" />
                  </svg>
                  Agregar
                </button>
              )}
              {user.friendStatus === "pending" && (
                <span className="inline-flex items-center rounded-full bg-gold-500/15 px-2.5 py-1 text-xs font-medium text-gold-400">
                  Pendiente
                </span>
              )}
              {user.friendStatus === "friends" && (
                <span className="inline-flex items-center rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-medium text-green-400">
                  Amigos
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {SEARCH_RESULTS.length === 0 && (
        <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-10 text-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="mx-auto mb-3 h-10 w-10 text-domino-600"
          >
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <p className="text-sm text-domino-400">
            No encontramos jugadores con ese nombre
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Placeholder data ─── */

const SEARCH_RESULTS: Array<{
  username: string;
  initials: string;
  elo: number;
  country: string;
  friendStatus: "none" | "pending" | "friends";
}> = [
  {
    username: "maria_g",
    initials: "MG",
    elo: 1450,
    country: "AR",
    friendStatus: "friends",
  },
  {
    username: "carlos_l",
    initials: "CL",
    elo: 1180,
    country: "UY",
    friendStatus: "pending",
  },
  {
    username: "ana_m",
    initials: "AM",
    elo: 1320,
    country: "AR",
    friendStatus: "none",
  },
  {
    username: "pedro_s",
    initials: "PS",
    elo: 1050,
    country: "CL",
    friendStatus: "none",
  },
  {
    username: "lucia_f",
    initials: "LF",
    elo: 1380,
    country: "UY",
    friendStatus: "friends",
  },
];
