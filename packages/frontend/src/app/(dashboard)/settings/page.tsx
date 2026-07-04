"use client";

import Link from "next/link";
import { useState } from "react";
import { useTheme } from "@/providers/theme-provider";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/lobby"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-domino-400 transition-colors hover:bg-domino-800/60 hover:text-domino-50"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-domino-50">Configuración</h1>
      </div>

      {/* Apariencia */}
      <section className="mb-6 rounded-xl border border-domino-800 bg-domino-900/50 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-domino-400">
          Apariencia
        </h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {theme === "dark" ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-gold-400">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-gold-400">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            )}
            <div>
              <p className="text-sm font-medium text-domino-50">Tema</p>
              <p className="text-xs text-domino-400">
                {theme === "dark" ? "Modo oscuro" : "Modo claro"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gold-400 focus:ring-offset-2 focus:ring-offset-domino-900 ${
              theme === "dark" ? "bg-gold-500" : "bg-domino-600"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
                theme === "dark" ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </section>

      {/* Preferencias */}
      <section className="mb-6 rounded-xl border border-domino-800 bg-domino-900/50 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-domino-400">
          Preferencias
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-domino-50">Mostrar ELO</p>
              <p className="text-xs text-domino-400">Visible en tu perfil público</p>
            </div>
            <Toggle defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-domino-50">Notificaciones</p>
              <p className="text-xs text-domino-400">Recibir alertas de invites y torneos</p>
            </div>
            <Toggle defaultChecked />
          </div>
        </div>
      </section>

      {/* Perfil */}
      <section className="mb-6 rounded-xl border border-domino-800 bg-domino-900/50 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-domino-400">
          Perfil
        </h2>
        <Link
          href="/profile/edit"
          className="group flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-domino-800/60"
        >
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-domino-400 group-hover:text-gold-400">
              <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-sm font-medium text-domino-50">Editar perfil</span>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-domino-400 group-hover:text-gold-400">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </section>

      {/* Cerrar sesión */}
      <section className="rounded-xl border border-domino-800 bg-domino-900/50 p-5">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Cerrar sesión
        </button>
      </section>
    </div>
  );
}

function Toggle({ defaultChecked = false }: { defaultChecked?: boolean }) {
  const [on, setOn] = useState(defaultChecked);

  return (
    <button
      type="button"
      onClick={() => setOn(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gold-400 focus:ring-offset-2 focus:ring-offset-domino-900 ${
        on ? "bg-gold-500" : "bg-domino-600"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
          on ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
