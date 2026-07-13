import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión — Dominó Occidental",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-domino-950 via-domino-900 to-domino-800 px-4">
      {/* Background decorative dots */}
      <div className="pointer-events-none fixed inset-0 select-none opacity-[0.03]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,#fff_1px,transparent_1px)] bg-[length:40px_40px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl border border-domino-700/50 bg-domino-900/80 backdrop-blur-xl p-8 shadow-2xl shadow-black/40 sm:p-10">
          {/* Logo / Brand */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 shadow-lg shadow-gold-500/20">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-7 w-7 text-domino-950"
                aria-hidden="true"
              >
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="currentColor"
                />
                <line
                  x1="3"
                  y1="12"
                  x2="21"
                  y2="12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <circle cx="8.5" cy="8" r="1.5" fill="currentColor" />
                <circle cx="15.5" cy="16" r="1.5" fill="currentColor" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Dominó Occidental
            </h1>
            <p className="mt-1.5 text-sm text-domino-300">
              Iniciá sesión para jugar
            </p>
          </div>

          <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-domino-800/50" />}>
            <LoginForm />
          </Suspense>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-domino-600">
          Al iniciar sesión aceptás los{" "}
          {/* biome-ignore lint/a11y/useValidAnchor: placeholder, se reemplaza cuando existan las páginas */}
          <a href="#" className="underline hover:text-domino-400 transition-colors">
            Términos y condiciones
          </a>{" "}
          y la{" "}
          {/* biome-ignore lint/a11y/useValidAnchor: placeholder, se reemplaza cuando existan las páginas */}
          <a href="#" className="underline hover:text-domino-400 transition-colors">
            Política de privacidad
          </a>
        </p>
      </div>
    </main>
  );
}
