# Tasks: profile-edit

## Task 1: Create edit profile page

| Aspect | Detail |
|--------|--------|
| **File** | `packages/frontend/src/app/(dashboard)/profile/edit/page.tsx` |
| **Type** | `"use client"` — `useState` form |
| **Est.** | ~130 lines |

**Checklist:**
- [x] Imports: useState, useRouter, Link from next/navigation and next/link
- [x] DEMO_PROFILE constant with avatar, username, country, showElo, notifications
- [x] useState for: avatar, username, country, showElo, notifications, saved
- [x] No dynamic param — edits current user
- [x] Avatar: large circle with initials, "Cambiar foto" button + hidden file input
- [x] Username input with validation hint
- [x] Country select with codes: AR, BO, BR, CL, CO, CR, DO, EC, ES, MX, PA, PE, PY, UY, US, VE formatted as "AR (Argentina)"
- [x] Display prefs: two checkboxes/toggles
- [x] Save: shows success message, no real save
- [x] Cancel: links back to `/profile/[username]`
- [x] Back arrow in header
- [x] Design tokens match spec
- [x] Build clean (bun run build in frontend)

## Task 2: Add edit button to profile page

| Aspect | Detail |
|--------|--------|
| **File** | `packages/frontend/src/app/(dashboard)/profile/[username]/page.tsx` |
| **Type** | Modify server component |
| **Est.** | ~5 lines |

**Checklist:**
- [x] Add "Editar perfil" Link above "Agregar como amigo"
- [x] Link href: `/profile/edit`
- [x] Secondary button style (outlined, not gradient)
- [x] Build clean

## Estimated total: ~135 lines

## Review workload
- **Estimated changed lines**: ~135 (under 400, single PR)
- **Review budget risk**: Low
- **Decision needed before apply**: No
