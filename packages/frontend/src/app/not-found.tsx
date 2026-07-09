import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-linear-to-b from-domino-950 via-domino-900 to-domino-800 px-4">
      {/* Decorative dots pattern */}
      <div className="pointer-events-none absolute inset-0 select-none opacity-[0.03]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, #d4a843 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      <div className="relative flex flex-col items-center text-center">
        {/* Broken domino icon */}
        <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-2xl border border-domino-700/50 bg-domino-900/60">
          <svg
            viewBox="0 0 64 64"
            fill="none"
            className="h-14 w-14 text-domino-500"
            aria-hidden="true"
          >
            {/* Left half */}
            <rect
              x="4"
              y="8"
              width="24"
              height="48"
              rx="3"
              stroke="currentColor"
              strokeWidth="2"
            />
            <circle cx="16" cy="22" r="3" fill="currentColor" />
            <circle cx="16" cy="42" r="3" fill="currentColor" />
            {/* Right half — shifted / broken */}
            <rect
              x="34"
              y="12"
              width="24"
              height="48"
              rx="3"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
            <circle cx="46" cy="26" r="3" fill="currentColor" />
            {/* Crack line */}
            <path
              d="M30 8 L34 24 L28 40 L34 56"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-white sm:text-4xl">
          Página no encontrada
        </h1>
        <p className="mt-3 max-w-md text-sm text-domino-400">
          La página que buscás no existe o fue movida.
        </p>

        <Link
          href="/lobby"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 px-6 py-2.5 text-sm font-semibold text-domino-950 shadow-lg shadow-gold-500/20 transition-all hover:from-gold-400 hover:to-gold-500 active:scale-[0.97]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
          >
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Volver al inicio
        </Link>

        <p className="mt-6 text-xs text-domino-600">Error 404</p>
      </div>
    </div>
  );
}
