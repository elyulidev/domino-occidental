import Link from "next/link";

export function PlayVsCpuButton() {
  return (
    <Link
      href="/cpu"
      className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-600 to-emerald-700 px-8 py-3.5 text-base font-semibold text-white shadow-xl shadow-emerald-500/20 transition-all hover:from-emerald-500 hover:to-emerald-600 hover:shadow-emerald-500/30 active:scale-[0.97]"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5m-4.25-11.396c.251.023.501.05.75.082M12 21a8.966 8.966 0 005.982-2.275M12 21a8.966 8.966 0 01-5.982-2.275M15.75 3.186a24.284 24.284 0 012.068.954M6.25 3.186a24.284 24.284 0 00-2.068.954M12 14.25a3 3 0 01-3-3" />
      </svg>
      Jugar vs CPU
    </Link>
  );
}
