"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { updateProfile, uploadAvatar } from "@/lib/actions/profile";
import { getInitials } from "@/lib/profile-validation";
import { CountrySelect } from "./CountrySelect";

type ProfileProps = {
  username: string;
  country: string | null;
  avatar_url: string | null;
};

export function EditProfileForm({ profile }: { profile: ProfileProps }) {
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [avatarError, setAvatarError] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, formAction] = useActionState(updateProfile, {
    success: undefined,
    error: undefined,
    username: undefined,
  });

  const displayUsername = state.username ?? profile.username;
  const initials = getInitials(displayUsername);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError("");

    // Client-side size check before sending
    const MAX_SIZE = 1 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setAvatarError("La imagen no puede superar 1 MB");
      // Reset the input so the user can select a different file
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const fd = new FormData();
    fd.append("avatar", file);

    startTransition(async () => {
      try {
        const result = await uploadAvatar(fd);
        if (result.error) {
          setAvatarError(result.error);
        } else if (result.url) {
          setAvatarUrl(result.url);
        }
      } catch {
        setAvatarError("Error al subir la imagen. Intentalo de nuevo.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* ── Header ── */}
      <section className="flex items-center gap-4">
        <Link
          href={`/profile/${displayUsername}`}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-domino-700 text-domino-400 transition-colors hover:bg-domino-700 hover:text-white"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-5 w-5"
            role="img"
            aria-label="Volver al perfil"
          >
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          Editar perfil
        </h1>
      </section>

      <form action={formAction}>
        {/* ── Avatar ── */}
        <section className="mb-8 rounded-2xl border border-domino-700/50 bg-domino-900/60 p-6">
          <h2 className="mb-4 text-sm font-semibold text-domino-300">
            Foto de perfil
          </h2>
          <div className="flex items-center gap-6">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="h-24 w-24 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-domino-700 text-3xl font-bold text-gold-400">
                {initials}
              </div>
            )}
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-lg border border-domino-700 px-4 py-2 text-sm font-medium text-domino-300 transition-colors hover:bg-domino-700 hover:text-white disabled:opacity-50"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                  role="img"
                  aria-label="Cambiar foto"
                >
                  <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {isPending ? "Subiendo..." : "Cambiar foto"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                name="avatar"
                accept="image/jpeg,image/png"
                className="hidden"
                tabIndex={-1}
                onChange={handleAvatarChange}
              />
              <p className="mt-2 text-xs text-domino-500">
                JPG, PNG. Máx 1 MB.
              </p>
              {avatarError && (
                <p className="mt-2 text-xs text-red-400">{avatarError}</p>
              )}
            </div>
          </div>
        </section>

        {/* ── Username ── */}
        <section className="mb-8 rounded-2xl border border-domino-700/50 bg-domino-900/60 p-6">
          <h2 className="mb-4 text-sm font-semibold text-domino-300">
            Nombre de usuario
          </h2>
          <input
            type="text"
            name="username"
            defaultValue={displayUsername}
            className="w-full rounded-lg border border-domino-700 bg-domino-800/50 px-4 py-2.5 text-sm text-white placeholder-domino-500 outline-none transition-colors focus:border-gold-500/50"
            placeholder="Tu nombre de usuario"
          />
          <p className="mt-2 text-xs text-domino-500">
            3–20 caracteres, solo letras, números, guiones y guiones bajos.
          </p>
          {state.error && (
            <p className="mt-2 text-xs text-red-400">{state.error}</p>
          )}
        </section>

        {/* ── Country ── */}
        <section className="mb-8 rounded-2xl border border-domino-700/50 bg-domino-900/60 p-6">
          <h2 className="mb-4 text-sm font-semibold text-domino-300">País</h2>
          <CountrySelect defaultValue={profile.country} name="country" />
        </section>

        {/* ── Actions ── */}
        <section className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Link
            href={`/profile/${displayUsername}`}
            className="inline-flex items-center justify-center rounded-xl border border-domino-700 px-6 py-2.5 text-sm font-medium text-domino-300 transition-colors hover:bg-domino-700 hover:text-white"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-xl bg-linear-to-r from-gold-500 to-gold-600 px-6 py-2.5 text-sm font-semibold text-domino-950 shadow-lg shadow-gold-500/20 transition-all hover:from-gold-400 hover:to-gold-500 hover:shadow-gold-500/30 active:scale-[0.97] disabled:opacity-50"
          >
            {isPending ? "Guardando..." : "Guardar cambios"}
          </button>
        </section>
      </form>
    </div>
  );
}
