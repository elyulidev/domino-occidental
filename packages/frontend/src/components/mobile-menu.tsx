"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createBrowserClient } from "@/lib/supabase/client";

interface Profile {
  username: string;
  elo: number;
  coins: number;
}

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}> = [
  { href: "/lobby",         label: "Inicio",         icon: HomeIcon },
  { href: "/friends",       label: "Amigos",         icon: FriendsIcon },
  { href: "/pairs",         label: "Parejas",        icon: PairsIcon },
  { href: "/tournaments",   label: "Torneos",        icon: TrophyIcon },
  { href: "/notifications", label: "Notificaciones", icon: BellIcon, badge: 3 },
  { href: "/shop",          label: "Tienda",         icon: ShopIcon },
  { href: "/settings",      label: "Configuración",  icon: SettingsIcon },
];

export default function MobileMenu() {
  const [open, setOpen]       = useState(false);
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    async function fetchProfile() {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("username, elo, coins")
          .eq("id", user.id)
          .maybeSingle();
        if (data) setProfile(data);
      }
    }
    fetchProfile();
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  const drawer = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menú de navegación"
      className={`fixed inset-0 z-9999 lg:hidden transition-all duration-300 ease-out ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`absolute inset-0 bg-black/65 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Drawer */}
      <div
        className={`absolute inset-y-0 left-0 z-10 flex w-72 flex-col
          bg-domino-900 border-r border-domino-800 shadow-2xl
          transition-transform duration-300 ease-out
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-domino-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 shadow-lg">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-black" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="currentColor" />
                <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="8.5" cy="8"   r="1.5" fill="currentColor" />
                <circle cx="15.5" cy="16" r="1.5" fill="currentColor" />
              </svg>
            </div>
            <span className="text-base font-bold tracking-tight text-domino-50">
              Dominó Occidental
            </span>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-domino-400 transition-colors hover:text-domino-50"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon, badge }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5
                text-sm font-medium text-domino-300
                transition-all hover:bg-domino-800/60 hover:text-domino-50"
            >
              <Icon className="h-5 w-5 shrink-0 text-domino-400 transition-colors group-hover:text-gold-400" />
              <span className="flex-1">{label}</span>
              {badge !== undefined && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-500/20 px-1.5 text-xs font-semibold text-gold-400">
                  {badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-domino-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-domino-700 text-sm font-bold text-gold-400">
              {profile?.username?.slice(0, 2).toUpperCase() ?? "??"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-domino-50">
                {profile?.username ?? "Sin perfil"}
              </p>
              <p className="text-xs text-domino-400">
                ELO {profile?.elo?.toLocaleString("es-AR") ?? "—"}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-gold-500/10 px-2.5 py-1">
              <span className="text-xs font-semibold text-gold-400">
                {profile?.coins?.toLocaleString("es-AR") ?? "0"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-domino-700 text-domino-300 transition-colors hover:bg-domino-700 hover:text-domino-50"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {mounted && createPortal(drawer, document.body)}
    </>
  );
}

/* ─── Icons ─── */

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}
function FriendsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
function PairsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
    </svg>
  );
}
function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M6 9H4.5a2.5 2.5 0 010-5H6m12 5h1.5a2.5 2.5 0 000-5H18M6 9v6a3 3 0 003 3h6a3 3 0 003-3V9M6 9V4h12v5M8 21h8" />
    </svg>
  );
}
function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}
function ShopIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
    </svg>
  );
}
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
