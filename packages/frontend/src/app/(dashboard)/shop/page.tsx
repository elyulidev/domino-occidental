import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tienda — Dominó Occidental",
};

export default function ShopPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* ── Balance card ── */}
      <section className="rounded-2xl border border-domino-700/50 bg-gradient-to-br from-domino-800 to-domino-900 p-6 sm:p-8">
        <p className="text-sm text-domino-400">Tu saldo</p>
        <div className="mt-2 flex items-center gap-3">
          <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-gold-400">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <text x="12" y="16" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="bold">$</text>
          </svg>
          <span className="text-4xl font-bold text-gold-400">250</span>
          <span className="text-sm text-domino-400">monedas</span>
        </div>
      </section>

      {/* ── Premium section ── */}
      <section className="rounded-2xl border border-gold-500/20 bg-gradient-to-r from-gold-500/5 via-domino-800/60 to-gold-500/5 p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-domino-50">Premium</h2>
              <span className="inline-flex items-center rounded-full bg-gold-500/15 px-2.5 py-0.5 text-xs font-semibold text-gold-400">
                Oro
              </span>
            </div>
            <ul className="mt-4 space-y-2">
              {PREMIUM_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-domino-300">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-green-400">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="shrink-0 text-center sm:text-right">
            <p className="text-2xl font-bold text-domino-50">4,99 €</p>
            <p className="text-sm text-domino-400">/ mes</p>
            <button
              type="button"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 px-6 py-2.5 text-sm font-semibold text-black shadow-lg shadow-gold-500/20 transition-all hover:from-gold-400 hover:to-gold-500 active:scale-[0.97]"
            >
              Suscribirse
            </button>
          </div>
        </div>
      </section>

      {/* ── Coin packages ── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-domino-50">Comprar monedas</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {COIN_PACKAGES.map((pkg) => (
            <div
              key={pkg.coins}
              className={`relative flex flex-col items-center rounded-2xl border p-6 text-center transition-colors ${
                pkg.badge
                  ? "border-gold-500/30 bg-domino-800/60"
                  : "border-domino-700/50 bg-domino-900/60"
              }`}
            >
              {pkg.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold-500/15 px-3 py-0.5 text-xs font-semibold text-gold-400">
                  {pkg.badge}
                </span>
              )}
              <svg viewBox="0 0 24 24" fill="none" className={`h-10 w-10 ${pkg.badge ? "text-gold-400" : "text-domino-400"}`}>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <text x="12" y="16" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="bold">$</text>
              </svg>
              <p className="mt-3 text-2xl font-bold text-domino-50">{pkg.coins}</p>
              <p className="text-xs text-domino-400">monedas</p>
              <p className="mt-2 text-lg font-semibold text-domino-200">{pkg.price}</p>
              <button
                type="button"
                className={`mt-4 w-full rounded-lg px-4 py-2 text-sm font-medium transition-all active:scale-[0.97] ${
                  pkg.badge
                    ? "bg-gradient-to-r from-gold-500 to-gold-600 text-black shadow-lg shadow-gold-500/20 hover:from-gold-400 hover:to-gold-500"
                    : "border border-domino-700 text-domino-300 hover:bg-domino-700 hover:text-domino-50"
                }`}
              >
                Comprar
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Watch ad ── */}
      <section className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-domino-50">+15 monedas por anuncio</p>
            <p className="mt-1 text-xs text-domino-400">
              {AD_PROGRESS.viewed} / {AD_PROGRESS.dailyLimit} hoy
            </p>
            <div className="mt-2 h-2 w-48 overflow-hidden rounded-full bg-domino-700">
              <div
                className="h-2 rounded-full bg-gold-500"
                style={{ width: `${(AD_PROGRESS.viewed / AD_PROGRESS.dailyLimit) * 100}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            disabled={AD_PROGRESS.viewed >= AD_PROGRESS.dailyLimit}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-domino-700 px-4 py-2 text-sm font-medium text-domino-300 transition-colors hover:bg-domino-700 hover:text-domino-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Ver anuncio
          </button>
        </div>
      </section>

      {/* ── Recent transactions ── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-domino-50">
          Transacciones recientes
        </h2>
        <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5">
          <div className="space-y-3">
            {RECENT_TRANSACTIONS.map((tx, i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-xl bg-domino-800/40 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-domino-50">
                    {tx.description}
                  </p>
                  <p className="text-xs text-domino-400">{tx.date}</p>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    tx.amount > 0 ? "text-green-400" : "text-domino-400"
                  }`}
                >
                  {tx.amount > 0 ? "+" : ""}
                  {tx.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─── Placeholder data ─── */

const PREMIUM_FEATURES = [
  "Sin anuncios",
  "Torneos exclusivos",
  "Badge de oro en tu perfil",
  "Nombre en dorado en las partidas",
];

const COIN_PACKAGES = [
  { coins: "100", price: "0,99 €", badge: null },
  { coins: "550", price: "4,99 €", badge: "Más popular" },
  { coins: "1200", price: "9,99 €", badge: "Mejor valor" },
];

const AD_PROGRESS = { viewed: 3, dailyLimit: 5 };

const RECENT_TRANSACTIONS = [
  { description: "Bono diario", date: "Hoy", amount: +10 },
  { description: "Anuncio recompensado", date: "Hoy", amount: +15 },
  { description: "Entrada a torneo", date: "Ayer", amount: -50 },
  { description: "Compra de monedas", date: "Hace 3 días", amount: +550 },
  { description: "Bono diario", date: "Hace 4 días", amount: +10 },
];
