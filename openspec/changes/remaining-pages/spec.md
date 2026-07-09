# Remaining Dashboard Pages — Specification

## Pages Overview

| # | Page | Route | Type |
|---|------|-------|------|
| 1 | Friends | `/friends` | Server (static) |
| 2 | Notifications | `/notifications` | Server (static) |
| 3 | 404 | `/not-found` | Server (static) |
| 4 | Error | `/error` | Client boundary |
| 5 | Player Search | `/users/search` | Server (static) |
| 6 | Pairs | `/pairs` | Server (static) |
| 7 | Public Profile | `/profile/[username]` | Server (static) |
| 8 | Shop | `/shop` | Server (static) |
| 9 | Tournament List | `/tournaments` | Server (static) |
| 10 | Tournament Detail | `/tournaments/[id]` | Server (static) |
| 11 | Tournament Create | `/tournaments/create` | Server (static) |

**Metadata**: Each page MUST export a `metadata` object with a `title` matching the page name (e.g., `"Amigos — Dominó Occidental"`).

---

### 1. `/friends`

- **Tabs**: "Amigos" (active) | "Solicitudes" with pending count badge
- **Amigos tab**: SHOW friends with `status='online'`. Each row: avatar initials + [online dot](#design-tokens), name, ELO, status text, Retar link (`/lobby`), Ver perfil link (`/profile/{username}`), Eliminar button
- **Solicitudes tab**: SHOW inbound `friendships` where `status='pending'` and `addressee_id` = current user. Each row: avatar, name, ELO, Accept/Decline buttons
- **Header**: "Buscar jugadores" link → `/users/search`
- **Empty (amigos)**: "No hay amigos conectados" + CTA "Buscar jugadores"
- **Empty (solicitudes)**: "No tenés solicitudes pendientes"
- **Placeholder data**: `FRIENDS_ONLINE: Friend[]`, `PENDING_REQUESTS: Friend[]`, `const PLACEHOLDER_USER_ID = "u1"`

### 2. `/notifications`

- **Header**: title "Notificaciones" + "Marcar todas como leídas" button (no-op)
- **List**: 10 items. Each has: type icon, title, body snippet, relative timestamp (`hace 5 min`), unread indicator (left gold dot if `read=false`)
- **Icons per type**: match_invite→gamepad, tournament_start→trophy, friend_request→user-plus, elo_change→arrow-up, tournament_result→award, system→bell
- **Empty**: "No tenés notificaciones"
- **Pagination**: "Cargar más" button (disabled, no-op)

### 3. `/not-found`

- **Layout**: `min-h-dvh`, centered, `bg-linear-to-b from-domino-950 via-domino-900 to-domino-800`, decorative dots
- **Content**: broken domino SVG icon, "Página no encontrada" title, "La página que buscás no existe o fue movida." description, "Volver al inicio" CTA (Link → `/lobby`), small "Error 404" note

### 4. `/error`

- **Must be** `'use client'` and export `ErrorBoundary` signature: `({ error, reset }: { error: Error & { digest?: string }; reset: () => void })`
- **Layout**: same dark gradient as not-found
- **Content**: error alert icon, "Algo salió mal" title, "Ocurrió un error inesperado. Intentalo de nuevo." description, "Reintentar" button calls `reset()`, "Contactar soporte" link (mailto), small error code note

### 5. `/users/search`

- **Search input**: [input class](#design-tokens) with search icon, placeholder "Buscá por nombre de usuario..."
- **Results grid**: 2 cols (desktop) / 1 col (mobile). Each card: avatar circle (initials), username, ELO, country badge (ISO code), friend status badge, action button ("Agregar" | "Pendiente" | "Amigos")
- **States**: initial (search prompt), loading (skeleton), results, empty ("No encontramos jugadores con ese nombre")
- **Placeholder**: `SEARCH_RESULTS: SearchUser[]`, skeleton SHIMMER shown for 0 results mock

### 6. `/pairs`

- **Header**: "Mis Parejas" + "Crear pareja" CTA button (link → `/users/search`)
- **Active pairs section**: cards with both avatars (initials side by side), combined elo, status badge, win rate from `player_stats`, "Disolver" button
- **Pending invitations**: cards with sender info, "Aceptar" / "Rechazar" buttons
- **Empty (no pairs)**: "No tenés parejas" + CTA "Buscar jugadores"
- **Empty (no invitations)**: "No tenés invitaciones pendientes"
- **Placeholder data**: `ACTIVE_PAIRS: Pair[]`, `PENDING_INVITATIONS: Pair[]`

### 7. `/profile/[username]`

- **Dynamic route**: `params: Promise<{ username: string }>`. `export const dynamic = 'force-static'` with `generateStaticParams` returning at least `[{ username: "DemoPlayer" }]`
- **Header**: large avatar (initials), username, ELO badge, country flag (ISO code), "Miembro desde {date}", online/offline status
- **Stats grid**: 4 columns — Partidas jugadas, Victorias, Porcentaje, Rachas. Values from `player_stats` placeholder
- **Achievements**: horizontal scroll of badges. `user_achievements` with `achievements`. Locked=grey, unlocked=colored
- **Recent matches**: table with opponent, result (victoria/derrota), score, date
- **Empty (no matches)**: "Todavía no jugó ninguna partida"

### 8. `/shop`

- **Balance card**: current coin count prominently with gold styling
- **Premium section**: feature list (sin anuncios, torneos exclusivos, badge de oro, nombre en dorado), price "4,99€/mes", "Suscribirse" CTA button (no-op)
- **Coin packages**: 3 cards row — 100 (0,99€), 550/4,99€ ("Más popular" badge), 1200/9,99€ ("Mejor valor" badge). Each: coin amount, price, "Comprar" button (no-op)
- **Watch ad**: "+15 monedas por anuncio", counter "3/5", button → increments counter, disabled when 5/5
- **Recent transactions**: last 5 from `coin_transactions` placeholder
- **Note**: All Stripe integration deferred. This is placeholder UI only.

### 9. `/tournaments`

- **Tabs**: "Activos" | "Próximos" | "Finalizados"
- **Cards grid**: each card has name, status badge ([badge classes](#design-tokens)), bracket type, pair count, entry fee, prize pool, phase label, "Ver detalle" link → `/tournaments/[id]`
- **Admin**: "Crear torneo" button at top-right
- **Placeholder data**: `TOURNAMENTS: Tournament[]` per tab

### 10. `/tournaments/[id]`

- **Dynamic route**: `params: Promise<{ id: string }>`. `export const dynamic = 'force-static'` with `generateStaticParams` returning `[{ id: "1" }, { id: "2" }, { id: "3" }]`
- **Header**: name, status badge, bracket type, prize pool, entry fee, pair count
- **Bracket**: inline SVG single-elimination tree (max 16 pairs). Pairs vs pairs, winners highlighted in gold, connecting lines between rounds
- **Participants**: list of registered pairs with ELO
- **Rules**: format description, schedule placeholder, prize distribution table
- **CTA**: "Inscribirse" button if `status=registration`

### 11. `/tournaments/create`

- **Form fields**: name (input), description (textarea), bracket_type (radio: single_elimination|double_elimination|round_robin), entry_fee (number + coin icon), max_pairs (select: 4|8|16|32), prize_pool (input)
- **Preview card**: live summary of form values
- **Submit**: "Crear torneo" button (no-op)
- **Cancel**: link → `/tournaments`

## Design Token Reference

All components MUST use exact classes from the design tokens listed in the task prompt. Key tokens:
- Cards: `rounded-2xl border border-domino-700/50 bg-domino-900/60 p-5`
- Container: `mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8`
- Primary CTA, Secondary, Input, Online dot, Badge live/gold — verbatim from tokens
- Tabs: tab active `border-b-2 border-gold-500 text-white`, inactive `text-domino-400 hover:text-domino-200`
- Dividers: `relative my-6` with `border-t border-domino-700`

## Edge Cases

- **Dynamic segments** (`[username]`, `[id]`): MUST use `params: Promise<...>` and `generateStaticParams` with demo values for static export
- **Empty states**: EVERY list component MUST have an empty state variant
- **Profile not found**: handle gracefully — show placeholder "Usuario no encontrado" instead of crashing
- **Counter limits**: ad views capped at 5/day — disabled state when limit reached
- **Requests tab badge**: computed from `PENDING_REQUESTS.length` — show `0` or omit if none

All pages are static server components with `const` placeholder data arrays at file bottom, matching the `lobby/page.tsx` pattern. No client interactivity beyond the existing `MobileMenu` shared component.
