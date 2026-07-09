import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getInitials } from "@/lib/profile-validation";
import { formatMemberSince } from "@/lib/profile-view";
import { getCountryName, getFlagEmoji } from "@/lib/countries";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return { title: `${username} — Dominó Occidental` };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, country, created_at")
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOwnProfile = user?.id === profile.id;
  const initials = getInitials(profile.username);
  const memberSince = formatMemberSince(profile.created_at);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* ── Profile header ── */}
      <section className="rounded-2xl border border-domino-700/50 bg-linear-to-b from-domino-800 to-domino-900 p-6 sm:p-8">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          {/* Avatar */}
          <div className="relative shrink-0">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-domino-700 text-2xl font-bold text-gold-400">
                {initials}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-40" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-green-500" />
            </span>
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-white sm:text-3xl">
                {profile.username}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/15 px-3 py-1 text-xs font-semibold text-gold-400">
                ELO 1200
              </span>
              {profile.country && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-domino-700/60 px-2.5 py-0.5 text-xs font-medium text-domino-300">
                  <span className="text-sm leading-none">{getFlagEmoji(profile.country)}</span>
                  {getCountryName(profile.country)}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-3 text-sm text-domino-400">
              <span>Miembro desde {memberSince}</span>
              <span className="h-1 w-1 rounded-full bg-domino-600" />
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                En línea
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            {isOwnProfile && (
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
                  role="img"
                  aria-label="Editar perfil"
                >
                  <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar perfil
              </Link>
            )}
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
                role="img"
                aria-label="Agregar como amigo"
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
            <p className="text-3xl font-bold text-white">0</p>
            <p className="mt-1 text-sm text-domino-400">Partidas jugadas</p>
          </div>
          <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5 text-center">
            <p className="text-3xl font-bold text-green-400">0</p>
            <p className="mt-1 text-sm text-domino-400">Victorias</p>
          </div>
          <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5 text-center">
            <p className="text-3xl font-bold text-gold-400">0</p>
            <p className="mt-1 text-sm text-domino-400">Racha actual</p>
          </div>
          <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5 text-center">
            <p className="text-3xl font-bold text-gold-400">0%</p>
            <p className="mt-1 text-sm text-domino-400">Porcentaje</p>
          </div>
        </div>
      </section>

      {/* ── Achievements ── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">Logros</h2>
        <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5">
          <p className="py-4 text-center text-sm text-domino-400">
            Sin logros desbloqueados
          </p>
        </div>
      </section>

      {/* ── Recent matches ── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">
          Partidas recientes
        </h2>
        <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5">
          <p className="py-8 text-center text-sm text-domino-400">
            Sin partidas recientes
          </p>
        </div>
      </section>
    </div>
  );
}
