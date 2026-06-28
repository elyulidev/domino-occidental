# Proposal: Settings Page and Theme System

## Intent

The app is fully hardcoded dark mode with no user control over theme, no settings page, and no way to access the profile from the sidebar. Users need a preferences hub and a light/dark theme toggle.

## Scope

### In Scope
- `ThemeProvider` client component with localStorage-based dark class on `<html>`
- Light mode CSS variables in `globals.css`
- `/settings` page with theme toggle, preference toggles, profile edit link, logout placeholder
- Profile link wrapping user footer in sidebar (desktop + mobile drawer)
- Settings nav item (gear icon) in sidebar + mobile menu `NAV_ITEMS`
- Wrap root layout with `ThemeProvider`

### Out of Scope
- Backend sync of theme preference (future)
- Logout/auth implementation (no-op placeholder only)
- Light mode for game/match pages (deferred)
- Full light mode across all pages (this phase: dashboard + settings)

## Capabilities

### New Capabilities
- `theme-system`: ThemeProvider context, localStorage persistence, dark class toggle, light CSS vars
- `settings-page`: Settings route with theme toggle, preference controls, navigation

### Modified Capabilities
- None — `profile-edit-page` unchanged; settings only links to it

## Approach

1. **ThemeProvider** (`src/components/theme-provider.tsx`): client component reading `localStorage("theme")`, default `"dark"`. Toggles `dark` class on `<html>`.
2. **globals.css**: add light-mode overrides under `:root:not(.dark)` / `.light` — swap `--color-domino-*` backgrounds to light tones.
3. **Root layout**: wrap with `<ThemeProvider>`.
4. **Settings page** (`src/app/(dashboard)/settings/page.tsx`): theme toggle switch, display preference toggles (ELO, notifications), profile edit link, "Cerrar sesión" button (no-op).
5. **Sidebar nav**: add `SettingsIcon`, gear icon entry to both dashboard layout and MobileMenu `NAV_ITEMS`.
6. **Profile link**: wrap sidebar user footer avatar+name in `<Link href="/profile/JugadorDemo">` — both desktop sidebar and mobile drawer.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/frontend/src/app/layout.tsx` | Modified | Wrap with ThemeProvider |
| `packages/frontend/src/app/globals.css` | Modified | Add light CSS vars |
| `packages/frontend/src/app/(dashboard)/layout.tsx` | Modified | Settings nav item, profile link |
| `packages/frontend/src/components/mobile-menu.tsx` | Modified | Settings nav item, profile link |
| `packages/frontend/src/components/theme-provider.tsx` | **New** | Theme context + toggle |
| `packages/frontend/src/app/(dashboard)/settings/page.tsx` | **New** | Settings UI |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Flash of dark theme before JS loads | Medium | Acceptable flicker; inline `<script>` in `<head>` as future refinement |
| Tailwind v4 `dark:` variant not configured | Low | Verify tailwind config supports `class`-based dark mode |

## Rollback Plan

1. Remove `<ThemeProvider>` from root layout
2. Revert `globals.css` light vars
3. Delete settings route + remove nav items from both menus
4. Revert profile `<Link>` changes in sidebar + mobile drawer

## Dependencies

- Tailwind CSS v4 `dark` variant strategy configured for class-based toggle

## Success Criteria

- [ ] Theme toggle persists across page reloads (localStorage)
- [ ] Light mode correctly switches bg/text in dashboard layout + settings page
- [ ] Settings page renders at `/settings` with theme toggle, preference toggles, profile edit link, logout button
- [ ] Sidebar profile avatar/name navigates to `/profile/JugadorDemo`
- [ ] Settings nav item visible in sidebar + mobile menu
