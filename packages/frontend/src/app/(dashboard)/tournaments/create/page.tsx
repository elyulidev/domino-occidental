import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Crear Torneo — Dominó Occidental",
};

export default function CreateTournamentPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* ── Header ── */}
      <section>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          Crear torneo
        </h1>
        <p className="mt-1 text-sm text-domino-400">
          Configurá un nuevo torneo para que otros jugadores se inscriban.
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* ── Form ── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5 space-y-5">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-white mb-1.5">
                Nombre del torneo
              </label>
              <input
                type="text"
                id="name"
                placeholder="Nombre del torneo"
                className="block w-full rounded-lg border border-domino-700 bg-domino-800/50 px-4 py-2.5 text-sm text-white placeholder-domino-500 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-white mb-1.5">
                Descripción y reglas
              </label>
              <textarea
                id="description"
                placeholder="Descripción y reglas"
                rows={4}
                className="block w-full min-h-[100px] resize-y rounded-lg border border-domino-700 bg-domino-800/50 px-4 py-2.5 text-sm text-white placeholder-domino-500 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
              />
            </div>

            {/* Bracket type */}
            <fieldset>
              <legend className="block text-sm font-medium text-white mb-2">
                Tipo de bracket
              </legend>
              <div className="space-y-2">
                <label className="flex items-center gap-3 rounded-lg border border-domino-700 p-3 cursor-pointer transition-colors has-[:checked]:border-gold-500 has-[:checked]:bg-gold-500/5">
                  <input
                    type="radio"
                    name="bracket_type"
                    value="single_elimination"
                    defaultChecked
                    className="accent-gold-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">
                      Single Elimination
                    </p>
                    <p className="text-xs text-domino-400">
                      Eliminación directa
                    </p>
                  </div>
                </label>
                <label className="flex items-center gap-3 rounded-lg border border-domino-700 p-3 cursor-pointer transition-colors has-[:checked]:border-gold-500 has-[:checked]:bg-gold-500/5">
                  <input
                    type="radio"
                    name="bracket_type"
                    value="double_elimination"
                    className="accent-gold-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">
                      Double Elimination
                    </p>
                    <p className="text-xs text-domino-400">
                      Doble eliminación
                    </p>
                  </div>
                </label>
                <label className="flex items-center gap-3 rounded-lg border border-domino-700 p-3 cursor-pointer transition-colors has-[:checked]:border-gold-500 has-[:checked]:bg-gold-500/5">
                  <input
                    type="radio"
                    name="bracket_type"
                    value="round_robin"
                    className="accent-gold-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">
                      Round Robin
                    </p>
                    <p className="text-xs text-domino-400">
                      Todos contra todos
                    </p>
                  </div>
                </label>
              </div>
            </fieldset>

            {/* Entry fee */}
            <div>
              <label htmlFor="entry_fee" className="block text-sm font-medium text-white mb-1.5">
                Costo de inscripción
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v12m-3-9h6a2 2 0 012 2v1a2 2 0 01-2 2h-6a2 2 0 01-2-2v-1a2 2 0 012-2z" />
                  </svg>
                </span>
                <input
                  type="number"
                  id="entry_fee"
                  placeholder="50"
                  min={0}
                  className="block w-full rounded-lg border border-domino-700 bg-domino-800/50 py-2.5 pl-10 pr-4 text-sm text-white placeholder-domino-500 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                />
              </div>
            </div>

            {/* Max pairs */}
            <div>
              <label htmlFor="max_pairs" className="block text-sm font-medium text-white mb-1.5">
                Máximo de parejas
              </label>
              <select
                id="max_pairs"
                className="block w-full appearance-none rounded-lg border border-domino-700 bg-domino-800/50 px-4 py-2.5 text-sm text-white focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 0.75rem center",
                  backgroundSize: "1.25em",
                }}
              >
                <option value="4">4 parejas</option>
                <option value="8" selected>
                  8 parejas
                </option>
                <option value="16">16 parejas</option>
                <option value="32">32 parejas</option>
              </select>
            </div>

            {/* Prize pool */}
            <div>
              <label htmlFor="prize_pool" className="block text-sm font-medium text-white mb-1.5">
                Pozo de premios
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v12m-3-9h6a2 2 0 012 2v1a2 2 0 01-2 2h-6a2 2 0 01-2-2v-1a2 2 0 012-2z" />
                  </svg>
                </span>
                <input
                  type="number"
                  id="prize_pool"
                  placeholder="1000"
                  min={0}
                  className="block w-full rounded-lg border border-domino-700 bg-domino-800/50 py-2.5 pl-10 pr-4 text-sm text-white placeholder-domino-500 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                />
              </div>
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 px-6 py-2.5 text-sm font-semibold text-domino-950 shadow-lg shadow-gold-500/20 transition-all hover:from-gold-400 hover:to-gold-500 active:scale-[0.97]"
            >
              Crear torneo
            </button>
            <Link
              href="/tournaments"
              className="rounded-lg border border-domino-700 px-4 py-2 text-sm font-medium text-domino-300 transition-colors hover:bg-domino-700 hover:text-white"
            >
              Cancelar
            </Link>
          </div>
        </div>

        {/* ── Preview card ── */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5">
            <h3 className="text-sm font-semibold text-white mb-4">
              Vista previa
            </h3>
            <div className="rounded-xl border border-domino-700/40 bg-domino-800/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center rounded-full bg-gold-500/15 px-2 py-0.5 text-xs font-medium text-gold-400">
                  Próximo
                </span>
                <span className="text-xs text-domino-500">
                  Single Elimination
                </span>
              </div>
              <h4 className="text-sm font-semibold text-white">
                Nombre del torneo
              </h4>
              <div className="mt-2 space-y-1 text-xs text-domino-400">
                <p>8 parejas máximo</p>
                <p>Entry: 50 monedas</p>
                <p>Premio: 1,000 monedas</p>
              </div>
              <div className="mt-3 rounded-lg bg-domino-800/60 px-3 py-2 text-xs text-domino-300">
                <p className="font-medium text-domino-200">Distribución</p>
                <p>1.er: 540 · 2.do: 270 · Plataforma: 90</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-domino-500 text-center">
              La vista previa se actualizará con tus datos
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
