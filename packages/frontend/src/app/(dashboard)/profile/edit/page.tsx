"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const COUNTRIES = [
  { code: "AR", name: "Argentina" },
  { code: "BO", name: "Bolivia" },
  { code: "BR", name: "Brasil" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "CR", name: "Costa Rica" },
  { code: "DO", name: "República Dominicana" },
  { code: "EC", name: "Ecuador" },
  { code: "ES", name: "España" },
  { code: "MX", name: "México" },
  { code: "PA", name: "Panamá" },
  { code: "PE", name: "Perú" },
  { code: "PY", name: "Paraguay" },
  { code: "UY", name: "Uruguay" },
  { code: "US", name: "Estados Unidos" },
  { code: "VE", name: "Venezuela" },
];

const DEMO_PROFILE = {
  username: "JugadorDemo",
  initials: "JD",
  country: "AR",
  showElo: true,
  notifications: true,
};

export default function EditProfilePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(DEMO_PROFILE.username);
  const [country, setCountry] = useState(DEMO_PROFILE.country);
  const [showElo, setShowElo] = useState(DEMO_PROFILE.showElo);
  const [notifications, setNotifications] = useState(DEMO_PROFILE.notifications);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Editar perfil — Dominó Occidental";
  }, []);

  function handleSave() {
    if (username.length < 3 || username.length > 20) {
      setError("El nombre de usuario debe tener entre 3 y 20 caracteres.");
      setSaved(false);
      return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      setError("El nombre de usuario solo puede contener letras y números.");
      setSaved(false);
      return;
    }
    setError("");
    setSaved(true);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* ── Header ── */}
      <section className="flex items-center gap-4">
        <Link
          href="/profile/JugadorDemo"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-domino-700 text-domino-400 transition-colors hover:bg-domino-700 hover:text-domino-50"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-domino-50 sm:text-3xl">
          Editar perfil
        </h1>
      </section>

      {/* ── Avatar ── */}
      <section className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-6">
        <h2 className="mb-4 text-sm font-semibold text-domino-300">Foto de perfil</h2>
        <div className="flex items-center gap-6">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-domino-700 text-3xl font-bold text-gold-400">
            {DEMO_PROFILE.initials}
          </div>
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-domino-700 px-4 py-2 text-sm font-medium text-domino-300 transition-colors hover:bg-domino-700 hover:text-domino-50"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Cambiar foto
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              tabIndex={-1}
            />
            <p className="mt-2 text-xs text-domino-500">JPG, PNG. Máx 2 MB.</p>
          </div>
        </div>
      </section>

      {/* ── Username ── */}
      <section className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-6">
        <h2 className="mb-4 text-sm font-semibold text-domino-300">
          Nombre de usuario
        </h2>
        <input
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setSaved(false);
          }}
          className="w-full rounded-lg border border-domino-700 bg-domino-800/50 px-4 py-2.5 text-sm text-domino-50 placeholder-domino-500 outline-none transition-colors focus:border-gold-500/50"
          placeholder="Tu nombre de usuario"
        />
        <p className="mt-2 text-xs text-domino-500">
          3–20 caracteres, solo letras y números.
        </p>
        {error && (
          <p className="mt-2 text-xs text-red-400">{error}</p>
        )}
      </section>

      {/* ── Country ── */}
      <section className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-6">
        <h2 className="mb-4 text-sm font-semibold text-domino-300">País</h2>
        <select
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setSaved(false);
          }}
          className="w-full rounded-lg border border-domino-700 bg-domino-800/50 px-4 py-2.5 text-sm text-domino-50 outline-none transition-colors focus:border-gold-500/50"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} ({c.name})
            </option>
          ))}
        </select>
      </section>

      {/* ── Display preferences ── */}
      <section className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-6">
        <h2 className="mb-4 text-sm font-semibold text-domino-300">
          Preferencias de visualización
        </h2>
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span className="text-sm text-domino-50">Mostrar ELO en el perfil</span>
            <button
              type="button"
              role="switch"
              aria-checked={showElo}
              onClick={() => {
                setShowElo(!showElo);
                setSaved(false);
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                showElo ? "bg-gold-500" : "bg-domino-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  showElo ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </label>
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span className="text-sm text-domino-50">
              Recibir notificaciones de torneos
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={notifications}
              onClick={() => {
                setNotifications(!notifications);
                setSaved(false);
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                notifications ? "bg-gold-500" : "bg-domino-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  notifications ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </label>
        </div>
      </section>

      {/* ── Actions ── */}
      <section className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/profile/JugadorDemo"
          className="inline-flex items-center justify-center rounded-xl border border-domino-700 px-6 py-2.5 text-sm font-medium text-domino-300 transition-colors hover:bg-domino-700 hover:text-domino-50"
        >
          Cancelar
        </Link>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 px-6 py-2.5 text-sm font-semibold text-black shadow-lg shadow-gold-500/20 transition-all hover:from-gold-400 hover:to-gold-500 hover:shadow-gold-500/30 active:scale-[0.97]"
        >
          Guardar cambios
        </button>
      </section>

      {/* ── Success message ── */}
      {saved && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-center text-sm text-green-400">
          Cambios guardados correctamente
        </div>
      )}
    </div>
  );
}
