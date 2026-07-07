import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Perfil — Dominó Occidental",
};

export const dynamic = "force-static";

export async function generateStaticParams() {
  return [{ username: "JugadorDemo" }];
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = DEMO_PROFILE;
  const winRate = Math.round(
    (profile.stats.wins / profile.stats.played) * 100,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* ── Profile header ── */}
      <section className="rounded-2xl border border-domino-700/50 bg-gradient-to-br from-domino-800 to-domino-900 p-6 sm:p-8">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-domino-700 text-2xl font-bold text-gold-400">
              {profile.initials}
            </div>
            {profile.isOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-40" />
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-green-500" />
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-white sm:text-3xl">
                {username}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/15 px-3 py-1 text-xs font-semibold text-gold-400">
                ELO {profile.elo}
              </span>
              <span className="inline-flex items-center rounded-full bg-domino-700/60 px-2.5 py-0.5 text-xs font-medium text-domino-300">
                {profile.country}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3 text-sm text-domino-400">
              <span>Miembro desde {profile.memberSince}</span>
              <span className="h-1 w-1 rounded-full bg-domino-600" />
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${profile.isOnline ? "bg-green-500" : "bg-domino-500"}`}
                />
                {profile.isOnline ? "En línea" : "Desconectado"}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Link
              href="/profile/edit"
              className="inline-flex items-center gap-2 rounded-lg border border-domino-700 px-4 py-2 text-sm font-medium text-domino-300 transition-colors hover:bg-domino-700 hover:text-white"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Editar perfil
            </Link>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-domino-700 px-4 py-2 text-sm font-medium text-domino-300 transition-colors hover:bg-domino-700 hover:text-white"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M12 4v16m8-8H4" />
              </svg>
              Agregar como amigo
            </button>
          </div>
        </div>
      </section>

      {/* ── Stats grid ── */}
      <section>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5 text-center">
            <p className="text-3xl font-bold text-white">{profile.stats.played}</p>
            <p className="mt-1 text-sm text-domino-400">Partidas jugadas</p>
          </div>
          <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5 text-center">
            <p className="text-3xl font-bold text-green-400">{profile.stats.wins}</p>
            <p className="mt-1 text-sm text-domino-400">Victorias</p>
          </div>
          <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5 text-center">
            <p className="text-3xl font-bold text-gold-400">{profile.stats.streak}</p>
            <p className="mt-1 text-sm text-domino-400">Racha actual</p>
          </div>
          <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5 text-center">
            <p className="text-3xl font-bold text-gold-400">{winRate}%</p>
            <p className="mt-1 text-sm text-domino-400">Porcentaje</p>
          </div>
        </div>
      </section>

      {/* ── Achievements ── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">Logros</h2>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {profile.achievements.map((a) => (
            <div
              key={a.name}
              className={`flex shrink-0 flex-col items-center gap-2 rounded-2xl border border-domino-700/50 bg-domino-900/60 px-5 py-4 text-center transition-colors ${
                a.unlocked ? "" : "opacity-30 grayscale"
              }`}
            >
              <span className="text-3xl">{a.icon}</span>
              <span className="max-w-[100px] text-xs text-domino-300">
                {a.name}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Recent matches ── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">
          Partidas recientes
        </h2>
        <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5">
          {profile.recentMatches.length > 0 ? (
            <div className="space-y-3">
              {profile.recentMatches.map((match, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: demo data sin IDs estables
                  key={i}
                  className="flex items-center gap-4 rounded-xl bg-domino-800/40 px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      vs {match.opponent}
                    </p>
                    <p className="text-xs text-domino-400">{match.date}</p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      match.result === "Victoria"
                        ? "bg-green-500/15 text-green-400"
                        : "bg-domino-700/60 text-domino-400"
                    }`}
                  >
                    {match.result}
                  </span>
                  <span className="text-sm font-medium text-domino-200">
                    {match.score}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-domino-400">
              Sin partidas recientes
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

/* ─── Placeholder data ─── */

const DEMO_PROFILE = {
  username: "JugadorDemo",
  initials: "JD",
  elo: 1200,
  country: "AR",
  memberSince: "Enero 2025",
  isOnline: true,
  stats: { played: 142, wins: 87, losses: 55, streak: 3 },
  achievements: [
    { name: "Primera victoria", unlocked: true, icon: "🏆" },
    { name: "Racha de 3", unlocked: true, icon: "🔥" },
    { name: "Torneo relámpago", unlocked: true, icon: "⚡" },
    { name: "100 partidas", unlocked: false, icon: "🎯" },
    { name: "Maestro del doble-9", unlocked: false, icon: "👑" },
    { name: "Leyenda", unlocked: false, icon: "⭐" },
  ],
  recentMatches: [
    { opponent: "María García", result: "Victoria", score: "120–85", date: "Hace 2 horas" },
    { opponent: "Carlos López", result: "Derrota", score: "90–110", date: "Ayer" },
    { opponent: "Ana Martínez", result: "Victoria", score: "130–75", date: "Hace 2 días" },
    { opponent: "Pedro Sánchez", result: "Victoria", score: "105–95", date: "Hace 3 días" },
    { opponent: "Lucía Fernández", result: "Derrota", score: "80–115", date: "Hace 5 días" },
  ],
};
