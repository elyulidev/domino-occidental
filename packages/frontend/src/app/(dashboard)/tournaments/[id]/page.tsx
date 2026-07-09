import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Detalle del Torneo — Dominó Occidental",
};

export const dynamic = "force-static";

export async function generateStaticParams() {
  return [{ id: "1" }, { id: "2" }, { id: "3" }];
}

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = DEMO_TOURNAMENT;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* ── Header card ── */}
      <section className="rounded-2xl border border-domino-700/50 bg-linear-to-b from-domino-800 to-domino-900 p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-flex items-center rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">
                <span className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                En vivo
              </span>
              <span className="inline-flex items-center rounded-full bg-gold-500/15 px-2 py-0.5 text-xs font-medium text-gold-400">
                Single Elimination
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              {tournament.name}
            </h1>
          </div>
          <div className="flex items-center gap-6 text-center">
            <div>
              <p className="text-xs text-domino-400">Premio</p>
              <p className="text-lg font-bold text-gold-400">
                {tournament.prizePool}
              </p>
            </div>
            <div>
              <p className="text-xs text-domino-400">Entry</p>
              <p className="text-lg font-bold text-white">
                {tournament.entryFee}
              </p>
            </div>
            <div>
              <p className="text-xs text-domino-400">Parejas</p>
              <p className="text-lg font-bold text-white">{tournament.pairs}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bracket visualization (SVG) ── */}
      <section className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Bracket</h2>
        <div className="w-full max-w-3xl mx-auto overflow-x-auto">
          <svg
            viewBox="0 0 820 520"
            className="w-full min-w-[600px]"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Round labels */}
            <text
              x="60"
              y="30"
              textAnchor="middle"
              className="fill-domino-400 text-[11px] font-medium"
            >
              Cuartos
            </text>
            <text
              x="290"
              y="30"
              textAnchor="middle"
              className="fill-domino-400 text-[11px] font-medium"
            >
              Semifinal
            </text>
            <text
              x="500"
              y="30"
              textAnchor="middle"
              className="fill-domino-400 text-[11px] font-medium"
            >
              Final
            </text>
            <text
              x="700"
              y="30"
              textAnchor="middle"
              className="fill-gold-400 text-[11px] font-semibold"
            >
              Campeón
            </text>

            {/* ── Quarterfinal 1 ── */}
            <rect
              x="10"
              y="55"
              width="100"
              height="36"
              rx="6"
              className="fill-domino-800 stroke-domino-700"
              strokeWidth="1"
            />
            <text x="15" y="68" className="fill-white text-[10px]">
              Los Dados
            </text>
            <text x="15" y="82" className="fill-domino-400 text-[9px]">
              ELO 1420
            </text>

            <rect
              x="10"
              y="95"
              width="100"
              height="36"
              rx="6"
              className="fill-domino-800 stroke-domino-700"
              strokeWidth="1"
            />
            <text x="15" y="108" className="fill-domino-500 text-[10px]">
              Fichas Rápidas
            </text>
            <text x="15" y="122" className="fill-domino-400 text-[9px]">
              ELO 1180
            </text>

            {/* Winner line QF1 */}
            <path
              d="M110 73 H130 V155 H150"
              className="stroke-domino-600"
              strokeWidth="1"
              fill="none"
            />

            {/* ── Quarterfinal 2 ── */}
            <rect
              x="10"
              y="145"
              width="100"
              height="36"
              rx="6"
              className="fill-domino-800 stroke-domino-700"
              strokeWidth="1"
            />
            <text x="15" y="158" className="fill-white text-[10px]">
              El Palmar
            </text>
            <text x="15" y="172" className="fill-domino-400 text-[9px]">
              ELO 1350
            </text>

            <rect
              x="10"
              y="185"
              width="100"
              height="36"
              rx="6"
              className="fill-gold-500/10 stroke-gold-500/30"
              strokeWidth="1"
            />
            <text
              x="15"
              y="198"
              className="fill-gold-400 text-[10px] font-medium"
            >
              Reyes del 9
            </text>
            <text x="15" y="212" className="fill-domino-400 text-[9px]">
              ELO 1510
            </text>

            {/* Winner line QF2 */}
            <path
              d="M110 163 H130 V155 H150"
              className="stroke-domino-600"
              strokeWidth="1"
              fill="none"
            />

            {/* ── Quarterfinal 3 ── */}
            <rect
              x="10"
              y="260"
              width="100"
              height="36"
              rx="6"
              className="fill-domino-800 stroke-domino-700"
              strokeWidth="1"
            />
            <text x="15" y="273" className="fill-white text-[10px]">
              Doble Nueve
            </text>
            <text x="15" y="287" className="fill-domino-400 text-[9px]">
              ELO 1290
            </text>

            <rect
              x="10"
              y="300"
              width="100"
              height="36"
              rx="6"
              className="fill-domino-800 stroke-domino-700"
              strokeWidth="1"
            />
            <text x="15" y="313" className="fill-domino-500 text-[10px]">
              Pozo Vacío
            </text>
            <text x="15" y="327" className="fill-domino-400 text-[9px]">
              ELO 1050
            </text>

            {/* Winner line QF3 */}
            <path
              d="M110 278 H130 V355 H150"
              className="stroke-domino-600"
              strokeWidth="1"
              fill="none"
            />

            {/* ── Quarterfinal 4 ── */}
            <rect
              x="10"
              y="350"
              width="100"
              height="36"
              rx="6"
              className="fill-gold-500/10 stroke-gold-500/30"
              strokeWidth="1"
            />
            <text
              x="15"
              y="363"
              className="fill-gold-400 text-[10px] font-medium"
            >
              Masters Domino
            </text>
            <text x="15" y="377" className="fill-domino-400 text-[9px]">
              ELO 1580
            </text>

            <rect
              x="10"
              y="390"
              width="100"
              height="36"
              rx="6"
              className="fill-domino-800 stroke-domino-700"
              strokeWidth="1"
            />
            <text x="15" y="403" className="fill-domino-500 text-[10px]">
              Par de Ases
            </text>
            <text x="15" y="417" className="fill-domino-400 text-[9px]">
              ELO 1120
            </text>

            {/* Winner line QF4 */}
            <path
              d="M110 368 H130 V355 H150"
              className="stroke-domino-600"
              strokeWidth="1"
              fill="1"
            />

            {/* ── Semifinal 1 ── */}
            <rect
              x="150"
              y="135"
              width="110"
              height="36"
              rx="6"
              className="fill-domino-800 stroke-domino-700"
              strokeWidth="1"
            />
            <text x="155" y="148" className="fill-white text-[10px]">
              Los Dados
            </text>
            <text x="155" y="162" className="fill-domino-400 text-[9px]">
              W QF1
            </text>

            <rect
              x="150"
              y="175"
              width="110"
              height="36"
              rx="6"
              className="fill-gold-500/10 stroke-gold-500/30"
              strokeWidth="1"
            />
            <text
              x="155"
              y="188"
              className="fill-gold-400 text-[10px] font-medium"
            >
              Reyes del 9
            </text>
            <text x="155" y="202" className="fill-domino-400 text-[9px]">
              W QF2
            </text>

            {/* Winner line SF1 */}
            <path
              d="M260 153 H280 V255 H300"
              className="stroke-domino-600"
              strokeWidth="1"
              fill="none"
            />

            {/* ── Semifinal 2 ── */}
            <rect
              x="150"
              y="335"
              width="110"
              height="36"
              rx="6"
              className="fill-domino-800 stroke-domino-700"
              strokeWidth="1"
            />
            <text x="155" y="348" className="fill-white text-[10px]">
              Doble Nueve
            </text>
            <text x="155" y="362" className="fill-domino-400 text-[9px]">
              W QF3
            </text>

            <rect
              x="150"
              y="375"
              width="110"
              height="36"
              rx="6"
              className="fill-gold-500/10 stroke-gold-500/30"
              strokeWidth="1"
            />
            <text
              x="155"
              y="388"
              className="fill-gold-400 text-[10px] font-medium"
            >
              Masters Domino
            </text>
            <text x="155" y="402" className="fill-domino-400 text-[9px]">
              W QF4
            </text>

            {/* Winner line SF2 */}
            <path
              d="M260 353 H280 V255 H300"
              className="stroke-domino-600"
              strokeWidth="1"
              fill="none"
            />

            {/* ── Final ── */}
            <rect
              x="300"
              y="235"
              width="120"
              height="36"
              rx="6"
              className="fill-gold-500/10 stroke-gold-500/30"
              strokeWidth="1.5"
            />
            <text
              x="305"
              y="248"
              className="fill-gold-400 text-[10px] font-medium"
            >
              Reyes del 9
            </text>
            <text x="305" y="262" className="fill-domino-400 text-[9px]">
              W SF1
            </text>

            <rect
              x="300"
              y="275"
              width="120"
              height="36"
              rx="6"
              className="fill-domino-800 stroke-domino-700"
              strokeWidth="1"
            />
            <text x="305" y="288" className="fill-white text-[10px]">
              Masters Domino
            </text>
            <text x="305" y="302" className="fill-domino-400 text-[9px]">
              W SF2
            </text>

            {/* Winner line Final */}
            <path
              d="M420 253 H440 V255 H460"
              className="stroke-gold-500"
              strokeWidth="1.5"
              fill="none"
            />

            {/* ── Champion ── */}
            <rect
              x="460"
              y="235"
              width="130"
              height="46"
              rx="8"
              className="fill-gold-500/15 stroke-gold-500"
              strokeWidth="1.5"
            />
            <text
              x="465"
              y="252"
              className="fill-gold-400 text-[11px] font-bold"
            >
              🏆 Reyes del 9
            </text>
            <text x="465" y="268" className="fill-domino-300 text-[9px]">
              Campeón actual
            </text>

            {/* Decorative bracket lines connecting rounds */}
            <line
              x1="130"
              y1="155"
              x2="150"
              y2="155"
              className="stroke-domino-600"
              strokeWidth="1"
            />
            <line
              x1="260"
              y1="255"
              x2="300"
              y2="255"
              className="stroke-domino-600"
              strokeWidth="1"
            />
          </svg>
        </div>
      </section>

      {/* ── Participants ── */}
      <section className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5">
        <h2 className="text-lg font-semibold text-white mb-4">
          Participantes ({tournament.participants.length})
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {tournament.participants.map((pair) => (
            <div
              key={pair.name}
              className="flex items-center gap-3 rounded-xl bg-domino-800/40 px-4 py-3"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-domino-700 text-xs font-semibold text-gold-400">
                {pair.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {pair.name}
                </p>
                <p className="text-xs text-domino-400">ELO {pair.elo}</p>
              </div>
              {pair.seed && (
                <span className="rounded-full bg-domino-700/50 px-2 py-0.5 text-xs text-domino-400">
                  #{pair.seed}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Info / Rules ── */}
      <section className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5">
        <h2 className="text-lg font-semibold text-white mb-4">
          Formato y Reglas
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-white mb-1">Formato</h3>
            <p className="text-sm text-domino-300">
              Single Elimination con 8 parejas. Cada ronda elimina a la mitad de
              los participantes. El ganador avanza; el perdedor queda eliminado.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-white mb-1">Cronograma</h3>
            <p className="text-sm text-domino-300">
              Cuartos: 28 Jun · Semifinal: 29 Jun · Final: 30 Jun
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-white mb-1">
              Distribución de premios
            </h3>
            <div className="overflow-hidden rounded-lg border border-domino-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-domino-700 bg-domino-800/50">
                    <th className="px-4 py-2 text-left text-xs font-medium text-domino-400">
                      Posición
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-domino-400">
                      Premio
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-domino-700/50">
                    <td className="px-4 py-2 text-white">1.er lugar</td>
                    <td className="px-4 py-2 text-gold-400 font-medium">
                      540 monedas
                    </td>
                  </tr>
                  <tr className="border-b border-domino-700/50">
                    <td className="px-4 py-2 text-white">2.do lugar</td>
                    <td className="px-4 py-2 text-domino-300">270 monedas</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-white">Plataforma</td>
                    <td className="px-4 py-2 text-domino-400">90 monedas</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="flex justify-center">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 px-8 py-3.5 text-base font-semibold text-domino-950 shadow-xl shadow-gold-500/20 transition-all hover:from-gold-400 hover:to-gold-500 hover:shadow-gold-500/30 active:scale-[0.97]"
        >
          Inscribirse
        </button>
      </section>
    </div>
  );
}

/* ─── Placeholder data ─── */

const DEMO_TOURNAMENT = {
  id: "1",
  name: "Torneo Relámpago #42",
  status: "En vivo",
  bracketType: "Single Elimination",
  pairs: 8,
  entryFee: "50 monedas",
  prizePool: "1,000 monedas",
  participants: [
    { name: "Los Dados", initials: "LD", elo: 1420, seed: 1 },
    { name: "Reyes del 9", initials: "R9", elo: 1510, seed: 2 },
    { name: "Masters Domino", initials: "MD", elo: 1580, seed: 3 },
    { name: "El Palmar", initials: "EP", elo: 1350, seed: 4 },
    { name: "Doble Nueve", initials: "DN", elo: 1290, seed: 5 },
    { name: "Fichas Rápidas", initials: "FR", elo: 1180, seed: 6 },
    { name: "Par de Ases", initials: "PA", elo: 1120, seed: 7 },
    { name: "Pozo Vacío", initials: "PV", elo: 1050, seed: 8 },
  ],
};
