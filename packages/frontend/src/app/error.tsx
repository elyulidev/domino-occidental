"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
        {/* Warning icon */}
        <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-14 w-14 text-red-400"
            aria-hidden="true"
          >
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-white sm:text-4xl">
          Algo salió mal
        </h1>
        <p className="mt-3 max-w-md text-sm text-domino-400">
          Ocurrió un error inesperado. Intentalo de nuevo.
        </p>

        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 px-6 py-2.5 text-sm font-semibold text-domino-950 shadow-lg shadow-gold-500/20 transition-all hover:from-gold-400 hover:to-gold-500 active:scale-[0.97]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4"
            >
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reintentar
          </button>
          <a
            href="mailto:soporte@domino-occidental.com"
            className="text-gold-400 hover:text-gold-300 transition-colors text-sm font-medium"
          >
            Contactar soporte
          </a>
        </div>

        {error.digest && (
          <p className="mt-6 text-xs text-domino-600">Error {error.digest}</p>
        )}
      </div>
    </div>
  );
}
