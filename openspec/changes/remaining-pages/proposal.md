# Proposal: remaining-dashboard-pages

## Intent

Deliver all remaining dashboard UI pages as static server components with placeholder data. Unblocks client-side navigation across the full app without dependency on WebSocket or backend integration.

## Scope

### In Scope
- **Batch 1** (HIGH): `/friends`, `/notifications`, `not-found.tsx`, `error.tsx`
- **Batch 2** (HIGH): `/users/search`, `/pairs`
- **Batch 3** (MEDIUM): `/profile/[username]`, `/shop`
- **Batch 4** (MEDIUM): `/tournaments`, `/tournaments/[id]`, `/tournaments/create`
- SVG single-elimination bracket tree for tournament detail page

### Out of Scope
- WebSocket integration (match/replay deferred)
- Stripe payment integration (shop is placeholder UI)
- Profile editing (separate change)
- Real Supabase data fetching or client logic
- Any client interactivity beyond existing MobileMenu pattern

## Capabilities

### New Capabilities
- `friends-page`: Friend list with online-only filter, request tabs, accept/decline
- `notifications-page`: Notification center with 6 types, mark-all-read, unread indicator
- `user-search`: Player search with result grid, friend status + add actions
- `pairs-page`: Active pairs + pending invitations, create-pair flow
- `profile-page`: Public profile with avatar, ELO, stats grid, achievements, recent matches
- `shop-page`: Coin packages (3 tiers), premium upsell, watch-ad section, balance display
- `tournaments-page`: Tournament list with active/upcoming/finished tabs
- `tournament-detail`: Single detail page with SVG bracket tree, pair list, status
- `tournament-create`: Admin form for creating tournaments

### Modified Capabilities
- None

## Approach

All pages are **server components** with `export const metadata`. Placeholder data as `const` arrays at file bottom (matching lobby.tsx pattern). Follow existing styling tokens exactly. Tournament bracket uses inline SVG for a single-elimination tree. Build after each batch to verify compilation.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/frontend/src/app/(dashboard)/friends/page.tsx` | New | Friends page with tabs + online list |
| `packages/frontend/src/app/(dashboard)/notifications/page.tsx` | New | Notification center |
| `packages/frontend/src/app/not-found.tsx` | New | Global 404 with domino aesthetic |
| `packages/frontend/src/app/error.tsx` | New | Global error boundary |
| `packages/frontend/src/app/(dashboard)/users/search/page.tsx` | New | Player search |
| `packages/frontend/src/app/(dashboard)/pairs/page.tsx` | New | Pair management |
| `packages/frontend/src/app/(dashboard)/profile/[username]/page.tsx` | New | Public profile |
| `packages/frontend/src/app/(dashboard)/shop/page.tsx` | New | Shop/coins UI |
| `packages/frontend/src/app/(dashboard)/tournaments/page.tsx` | New | Tournament list |
| `packages/frontend/src/app/(dashboard)/tournaments/[id]/page.tsx` | New | Tournament detail + bracket |
| `packages/frontend/src/app/(dashboard)/tournaments/create/page.tsx` | New | Tournament creation form |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Styling drift from existing patterns | Low | Reuse exact class strings from lobby page |
| SVG bracket complex on first pass | Low | Hardcode a 16-pair tree with sample labels |

## Rollback Plan

Delete each page directory before deploy if issues surface. No database or backend changes — pure UI.

## Dependencies

- Existing `(dashboard)/layout.tsx` sidebar nav (already links to all routes)
- Tailwind CSS v4 with domino/gold color tokens

## Success Criteria

- [ ] All 11 pages render without build errors
- [ ] `bun run build` passes after each batch
- [ ] Navigation through all sidebar links works
- [ ] 404 and error pages display correctly
- [ ] Bracket SVG renders a recognizable tournament tree
