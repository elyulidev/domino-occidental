import Link from "next/link";
import type { LeaderboardEntry, ProfileResponse } from "@/lib/api/types";
import { createClient } from "@/lib/supabase/server";
import { QuickMatchButton } from "./_components/quick-match-button";

export const metadata = {
  title: "Lobby — Dominó Occidental",
};

// --- Sub-components (pure functions) ---

function WelcomeHeader({
  profile,
}: {
  profile: ProfileResponse | null;
}) {
  return (
    <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-domino-50 sm:text-3xl">
          Buenas,{" "}
          <span className="text-gold-400">
            {profile?.username ?? "Jugador"}
          </span>
        </h1>
        <p className="mt-1 text-sm text-domino-400">
          Bienvenido de vuelta. Tus amigos te esperan.
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="rounded-xl border border-domino-700 bg-domino-900/60 px-4 py-2 text-center">
          <p className="text-xs text-domino-400">ELO</p>
          <p className="text-lg font-bold text-domino-50">
            {profile
              ? profile.elo.toLocaleString("es-AR")
              : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-domino-700 bg-domino-900/60 px-4 py-2 text-center">
          <p className="text-xs text-domino-400">Monedas</p>
          <p className="text-lg font-bold text-gold-400">
            {profile
              ? profile.coins.toLocaleString("es-AR")
              : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-domino-700 bg-domino-900/60 px-4 py-2 text-center">
          <p className="text-xs text-domino-400">Ranking</p>
          <p className="text-lg font-bold text-domino-50">
            {profile
              ? `#${profile.rank.toLocaleString("es-AR")}`
              : "—"}
          </p>
        </div>
      </div>
    </section>
  );
}

function QuickMatchCard() {
  return (
    <section>
      <div className="relative overflow-hidden rounded-2xl border border-domino-700/50 bg-gradient-to-br from-domino-800 via-domino-800/80 to-domino-900 p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 select-none opacity-[0.04]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,#d4a843_0%,transparent_50%)]" />
        </div>
        <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-domino-50 sm:text-2xl">
              Partida rápida
            </h2>
            <p className="mt-1.5 max-w-md text-sm text-domino-300">
              Encontrá una pareja al instante. Sistema de emparejamiento por
              ELO para partidas equilibradas.
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
  );
}

function LeaderboardCard({
  leaderboard,
}: {
  leaderboard: LeaderboardEntry[];
}) {
  return (
    <section className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-domino-50">
          Leaderboard — Top 10
        </h2>
        <Link
          href="/leaderboard"
          className="text-xs font-medium text-gold-400 hover:text-gold-300 transition-colors"
        >
          Ver completo
        </Link>
      </div>
      {leaderboard.length === 0 ? (
        <p className="py-4 text-center text-sm text-domino-400">
          Aún no hay jugadores en el ranking
        </p>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry) => (
            <div
              key={entry.username}
              className="flex items-center gap-3 rounded-xl bg-domino-800/40 px-3 py-2.5 transition-colors hover:bg-domino-800/60"
            >
              <span className="w-8 text-right text-sm font-bold text-domino-300">
                #{entry.rank}
              </span>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-domino-700 text-xs font-semibold text-gold-400">
                {entry.username.slice(0, 2).toUpperCase()}
              </div>
              <span className="flex-1 truncate text-sm font-medium text-domino-50">
                {entry.username}
              </span>
              <span className="text-sm font-bold text-domino-300">
                {entry.elo.toLocaleString("es-AR")}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FriendsOnlineCard({
  friends,
}: {
  friends: Array<{ username: string; elo: number }>;
}) {
  return (
    <section className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-domino-50">
          Amigos online
        </h2>
        <Link
          href="/friends"
          className="text-xs font-medium text-gold-400 hover:text-gold-300 transition-colors"
        >
          Ver todos
        </Link>
      </div>
      {friends.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-domino-400">
            No hay amigos conectados
          </p>
          <Link
            href="/users/search"
            className="mt-2 inline-block text-xs text-gold-400 hover:text-gold-300"
          >
            Buscar jugadores
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {friends.map((friend) => (
            <div
              key={friend.username}
              className="flex items-center gap-3 rounded-xl bg-domino-800/40 px-3 py-2.5 transition-colors hover:bg-domino-800/60"
            >
              <div className="relative shrink-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-domino-700 text-xs font-semibold text-gold-400">
                  {friend.username.slice(0, 2).toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-domino-50">
                  {friend.username}
                </p>
                <p className="text-xs text-domino-400">
                  ELO {friend.elo.toLocaleString("es-AR")}
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
      )}
    </section>
  );
}

function TournamentsCard({
  tournaments,
}: {
  tournaments: Array<{
    id: string;
    name: string;
    status: string;
    pairs_count: number;
    prize_pool: number;
  }>;
}) {
  return (
    <section className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-domino-50">
          Torneos activos
        </h2>
        <Link
          href="/tournaments"
          className="text-xs font-medium text-gold-400 hover:text-gold-300 transition-colors"
        >
          Ver todos
        </Link>
      </div>
      {tournaments.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-domino-400">
            No hay torneos activos
          </p>
          <Link
            href="/tournaments"
            className="mt-2 inline-block text-xs text-gold-400 hover:text-gold-300"
          >
            Ver torneos
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tournaments.map((t) => (
            <Link
              key={t.id}
              href={`/tournaments/${t.id}`}
              className="group rounded-xl border border-domino-700/40 bg-domino-800/30 p-4 transition-all hover:border-gold-500/30 hover:bg-domino-800/50"
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    t.status === "in_progress"
                      ? "bg-green-500/15 text-green-400"
                      : "bg-gold-500/15 text-gold-400"
                  }`}
                >
                  {t.status === "in_progress" && (
                    <span className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                  )}
                  {t.status === "in_progress" ? "En vivo" : "Próximo"}
                </span>
                <span className="text-xs text-domino-500">
                  {t.pairs_count} parejas
                </span>
              </div>
              <h3 className="text-sm font-semibold text-domino-50 transition-colors group-hover:text-gold-400">
                {t.name}
              </h3>
              <div className="mt-2 text-xs text-domino-400">
                <span>
                  Premio: {t.prize_pool.toLocaleString("es-AR")} monedas
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

// TODO: Replace with real data when match_moves schema is implemented
function StatsCard() {
  return (
    <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5">
      <h2 className="mb-3 text-sm font-semibold text-domino-50">
        Estadísticas de hoy
      </h2>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-2xl font-bold text-domino-50">0</p>
          <p className="text-xs text-domino-400">Partidas</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-green-400">0</p>
          <p className="text-xs text-domino-400">Ganadas</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-red-400">0</p>
          <p className="text-xs text-domino-400">Perdidas</p>
        </div>
      </div>
    </div>
  );
}

// TODO: Replace with real data when streak tracking is implemented
function StreaksCard() {
  return (
    <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5">
      <h2 className="mb-3 text-sm font-semibold text-domino-50">Rachas</h2>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div>
          <p className="text-2xl font-bold text-gold-400">0</p>
          <p className="text-xs text-domino-400">
            Victorias consecutivas
          </p>
        </div>
        <div>
          <p className="text-2xl font-bold text-domino-50">0</p>
          <p className="text-xs text-domino-400">Días seguidos</p>
        </div>
      </div>
    </div>
  );
}

function PremiumUpsell() {
  return (
    <section className="rounded-2xl border border-gold-500/20 bg-gradient-to-r from-gold-500/5 via-domino-800/60 to-gold-500/5 p-5 sm:p-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-domino-50">
            Desbloqueá{" "}
            <span className="text-gold-400">Premium</span>
          </h2>
          <p className="mt-1 text-sm text-domino-300">
            Sin anuncios, torneos exclusivos, badge de oro y más
            beneficios.
          </p>
        </div>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 rounded-lg border border-gold-500/30 bg-gold-500/10 px-5 py-2.5 text-sm font-medium text-gold-400 transition-all hover:bg-gold-500/20 active:scale-[0.97]"
        >
          Ver planes
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>
    </section>
  );
}

// --- Main page (async server component) ---

export default async function LobbyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: ProfileResponse | null = null;
  let leaderboard: LeaderboardEntry[] = [];
  let friends: Array<{ username: string; elo: number }> = [];
  let tournaments: Array<{
    id: string;
    name: string;
    status: string;
    pairs_count: number;
    prize_pool: number;
  }> = [];

  if (user) {
    const [
      profileResult,
      leaderboardResult,
      friendsResult,
      tournamentsResult,
    ] = await Promise.allSettled([
      supabase
        .from("profiles")
        .select("id, username, avatar_url, elo, coins, country")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("id, username, avatar_url, elo")
        .order("elo", { ascending: false })
        .limit(10),
      supabase
        .from("friendships")
        .select("requester_id, addressee_id, status")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq("status", "accepted"),
      supabase
        .from("tournaments")
        .select("id, name, status, pairs_count, prize_pool")
        .in("status", ["registration", "in_progress"])
        .order("starts_at", { ascending: true })
        .limit(4),
    ]);

    if (
      profileResult.status === "fulfilled" &&
      profileResult.value.data
    ) {
      const p = profileResult.value.data;
      const rankResult = await supabase
        .rpc("get_rank", { player_elo: p.elo })
        .maybeSingle();
      profile = { ...p, rank: (rankResult.data as number) ?? 1 };
    }

    if (leaderboardResult.status === "fulfilled") {
      const rows = leaderboardResult.value.data ?? [];
      leaderboard = rows.map(
        (r: { username: string; elo: number; avatar_url: string | null }, i: number) => ({
          rank: i + 1,
          username: r.username,
          elo: r.elo,
          avatar_url: r.avatar_url,
        }),
      );
    }

    if (friendsResult.status === "fulfilled") {
      const fRows = friendsResult.value.data ?? [];
      const friendIds = fRows
        .flatMap((f: { requester_id: string; addressee_id: string }) => [
          f.requester_id,
          f.addressee_id,
        ])
        .filter((id: string) => id !== user.id);
      if (friendIds.length > 0) {
        const uniqueIds = [...new Set(friendIds)];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("username, elo")
          .in("id", uniqueIds);
        friends = profiles ?? [];
      }
    }

    if (tournamentsResult.status === "fulfilled") {
      tournaments = tournamentsResult.value.data ?? [];
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <WelcomeHeader profile={profile} />
      <QuickMatchCard />
      <LeaderboardCard leaderboard={leaderboard} />

      <div className="grid gap-6 lg:grid-cols-3">
        <FriendsOnlineCard friends={friends} />

        <section className="space-y-6 lg:col-span-2">
          <TournamentsCard tournaments={tournaments} />
          <div className="grid gap-4 sm:grid-cols-2">
            <StatsCard />
            <StreaksCard />
          </div>
        </section>
      </div>

      <PremiumUpsell />
    </div>
  );
}
