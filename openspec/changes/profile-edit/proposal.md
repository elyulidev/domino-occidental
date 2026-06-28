# Proposal: profile-edit

## Intent

Allow logged-in users to edit their own profile (avatar, username, country, display preferences). The current profile page is read-only with placeholder data. This is the first interactive client component on the dashboard.

## Scope

### In Scope
- Edit form at `/profile/edit` with avatar area, username input, country selector, display preference toggle
- Pre-populated fields from current user data (placeholder, matching existing pattern)
- Back navigation to `/profile/[username]`
- `"use client"` component with local form state
- Design parity with existing profile page (domino/gold tokens)

### Out of Scope
- Supabase mutation or API calls (placeholder UI — no backend wiring)
- Image upload to storage backend
- Avatar cropping or processing
- Editing another user's profile
- Sidebar nav entry (sub-page accessed from profile page)

## Capabilities

### New Capabilities
- `profile-edit-page`: Edit profile form — avatar upload placeholder, editable username, ISO country dropdown (LATAM + US + ES), display preference toggle

### Modified Capabilities
- None

## Approach

Client component at `(dashboard)/profile/edit/page.tsx` with `"use client"`. `useState` for all form fields, pre-populated from `DEMO_PROFILE` (matching existing page pattern). Country dropdown renders hardcoded ISO codes. Avatar: click-to-upload area (no-op). Save button shows success feedback — no actual mutation. Profile page gets an "Editar perfil" action button.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `(dashboard)/profile/edit/page.tsx` | New | Client component with edit form |
| `(dashboard)/profile/[username]/page.tsx` | Modified | Add "Editar perfil" button link |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Form layout drifts from profile page | Low | Reuse exact class tokens from existing page |
| Client component increases JS bundle | Low | Auth-gated page — acceptable tradeoff |

## Rollback Plan

Delete `profile/edit/` directory. Revert edit link on profile page. No backend changes.

## Dependencies

- Existing `(dashboard)/layout.tsx` (no sidebar change needed)
- Profile page design tokens and component layout

## Success Criteria

- [ ] Form renders at `/profile/edit` with pre-populated data
- [ ] All 4 field types (avatar, username, country, toggle) are interactive
- [ ] Back link navigates to `/profile/[username]`
- [ ] `bun run build` passes
- [ ] Visual style matches profile page
