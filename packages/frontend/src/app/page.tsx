import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-domino-950 via-domino-900 to-domino-800 px-4">
      {/* Background decorative dots */}
      <div className="pointer-events-none fixed inset-0 select-none opacity-[0.03]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,#fff_1px,transparent_1px)] bg-[length:40px_40px]" />
      </div>

      <div className="text-center">
        {/* Logo */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 shadow-2xl shadow-gold-500/20">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-10 w-10 text-domino-950"
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

        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Dominó Occidental
        </h1>
        <p className="mt-4 max-w-md text-lg text-domino-300">
          El dominó doble-9 llegó a la web. Partidas en tiempo real,
          torneos, ranking ELO y toda la acción con amigos.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="w-full sm:w-auto rounded-lg bg-gradient-to-r from-gold-500 to-gold-600 px-8 py-3 text-sm font-semibold text-domino-950 shadow-lg shadow-gold-500/20 transition-all hover:from-gold-400 hover:to-gold-500 active:scale-[0.98] text-center"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="w-full sm:w-auto rounded-lg border border-domino-700 bg-domino-800/50 px-8 py-3 text-sm font-medium text-domino-200 transition-all hover:bg-domino-700/50 hover:text-white active:scale-[0.98] text-center"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </main>
  );
}
