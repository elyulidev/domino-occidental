import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notificaciones — Dominó Occidental",
};

export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* ── Header ── */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            Notificaciones
          </h1>
          <p className="mt-1 text-sm text-domino-400">
            Mantente al día con tus actividades.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-domino-700 px-4 py-2 text-sm font-medium text-domino-300 transition-colors hover:bg-domino-700 hover:text-white"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
          Marcar todas como leídas
        </button>
      </section>

      {/* ── Notification list ── */}
      <div className="space-y-2">
        {NOTIFICATIONS.map((notification) => (
          <div
            key={notification.id}
            className="flex items-start gap-4 rounded-2xl border border-domino-700/50 bg-domino-900/60 px-5 py-4 transition-colors hover:bg-domino-800/40"
          >
            {/* Unread dot */}
            <div className="flex shrink-0 items-center pt-1.5">
              {notification.unread ? (
                <span className="h-2.5 w-2.5 rounded-full bg-gold-500" />
              ) : (
                <span className="h-2.5 w-2.5 rounded-full bg-transparent" />
              )}
            </div>

            {/* Icon */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-domino-800/60 text-domino-400">
              {notification.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-white">
                  {notification.title}
                </p>
                <span className="shrink-0 text-xs text-domino-500">
                  {notification.time}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-domino-400">
                {notification.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      {NOTIFICATIONS.length === 0 && (
        <div className="rounded-2xl border border-domino-700/50 bg-domino-900/60 p-10 text-center">
          <p className="text-sm text-domino-400">No tenés notificaciones</p>
        </div>
      )}

      {/* ── Load more ── */}
      {NOTIFICATIONS.length > 0 && (
        <div className="text-center">
          <button
            type="button"
            disabled
            className="rounded-lg border border-domino-700 px-6 py-2.5 text-sm font-medium text-domino-500 transition-colors"
          >
            Cargar más
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Notification icons ─── */

function GamepadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
    >
      <path d="M6 12h4m-2-2v4m5 0h.01M17 7a2 2 0 012 2v2a2 2 0 01-2 2h-1l-1.5 4.5A1.5 1.5 0 0115 19H9a1.5 1.5 0 01-1.5-1.5L6 13H5a2 2 0 01-2-2V9a2 2 0 012-2h1l1.5-4.5A1.5 1.5 0 019 1h6a1.5 1.5 0 011.5 1.5L18 7h-1z" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
    >
      <path d="M6 9H4.5a2.5 2.5 0 010-5H6m12 5h1.5a2.5 2.5 0 000-5H18M6 9v6a3 3 0 003 3h6a3 3 0 003-3V9M6 9V4h12v5M8 21h8" />
    </svg>
  );
}

function UserPlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
    >
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2m8-10a4 4 0 100-8 4 4 0 000 8zm6 8v-6m3 3h-6" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
    >
      <path d="M12 19V5m0 0l-5 5m5-5l5 5" />
    </svg>
  );
}

function AwardIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
    >
      <path d="M12 15l-2 5l9-13h-6l2-5-9 13h6z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
    >
      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

/* ─── Placeholder data ─── */

const NOTIFICATIONS = [
  {
    id: "1",
    type: "match_invite" as const,
    title: "Invitación a partida",
    body: "María García te invitó a una partida rápida. ¿Aceptás el desafío?",
    time: "hace 5 min",
    unread: true,
    icon: <GamepadIcon />,
  },
  {
    id: "2",
    type: "tournament_start" as const,
    title: "Torneo iniciado",
    body: "El Torneo Relámpago #42 comenzó. Tu primera partida es contra ParejaFenix.",
    time: "hace 15 min",
    unread: true,
    icon: <TrophyIcon />,
  },
  {
    id: "3",
    type: "friend_request" as const,
    title: "Solicitud de amistad",
    body: "Pedro Sánchez quiere ser tu amigo.",
    time: "hace 1 hora",
    unread: true,
    icon: <UserPlusIcon />,
  },
  {
    id: "4",
    type: "elo_change" as const,
    title: "ELO actualizado",
    body: "Tu ELO subió de 1,180 a 1,210 (+30) tras la victoria contra DuoRápido.",
    time: "hace 2 horas",
    unread: false,
    icon: <ArrowUpIcon />,
  },
  {
    id: "5",
    type: "tournament_result" as const,
    title: "Resultado del torneo",
    body: "Terminaste en 2do lugar en la Liga de Plata. ¡Ganaste 270 monedas!",
    time: "hace 5 horas",
    unread: false,
    icon: <AwardIcon />,
  },
  {
    id: "6",
    type: "system" as const,
    title: "Mantenimiento programado",
    body: "El servidor se actualizará mañana a las 03:00 UTC. Podría haber interrupciones breves.",
    time: "hace 1 día",
    unread: false,
    icon: <BellIcon />,
  },
  {
    id: "7",
    type: "match_invite" as const,
    title: "Invitación a partida",
    body: "Carlos López te desafió a una partida clasificatoria.",
    time: "hace 1 día",
    unread: false,
    icon: <GamepadIcon />,
  },
  {
    id: "8",
    type: "elo_change" as const,
    title: "ELO actualizado",
    body: "Tu ELO bajó de 1,210 a 1,195 (-15) tras la derrota contra LosInvencibles.",
    time: "hace 2 días",
    unread: false,
    icon: <ArrowUpIcon />,
  },
];
