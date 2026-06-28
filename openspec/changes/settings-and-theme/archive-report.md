# Archive Report: settings-and-theme

## Summary

Created Settings page with light/dark theme toggle, ThemeProvider with localStorage persistence, profile link in sidebar, and Settings nav item.

## Artifacts

| Phase | Location | Status |
|-------|----------|--------|
| Proposal | `openspec/changes/settings-and-theme/proposal.md` + Engram | ✅ |
| Spec | `openspec/changes/settings-and-theme/spec.md` + Engram | ✅ |
| Tasks | `openspec/changes/settings-and-theme/tasks.md` + Engram | ✅ |
| Apply | 6 files (1 new page, 1 new provider, 4 modified) | ✅ |
| Verify | Build clean, 20 routes | ✅ |
| Archive | (this file) + Engram | ✅ |

## Files Changed

| File | Action | What |
|------|--------|------|
| `src/providers/theme-provider.tsx` | **New** | Theme context with localStorage, dark/light class toggle |
| `src/app/globals.css` | Modified | `:root` light mode + `.dark` overrides as CSS variables |
| `src/app/layout.tsx` | Modified | Imported ThemeProvider, wrapped body, added `dark` class default |
| `src/app/(dashboard)/settings/page.tsx` | **New** | Settings page: theme toggle, prefs, profile link, logout |
| `src/app/(dashboard)/layout.tsx` | Modified | Profile link wraps sidebar footer + Settings nav item with gear icon |
| `src/components/mobile-menu.tsx` | Modified | Added Settings nav item |

## What changed

- **Sidebar**: Ahora el avatar/nombre en el footer es clickable → lleva al perfil. Se agregó "Configuración" con ícono de engranaje en el nav.
- **Settings** (`/settings`): Toggle de tema (oscuro/claro) con sol/luna, preferencias (ELO, notificaciones), link a editar perfil, cerrar sesión (placeholder).
- **Theme**: Persiste en localStorage, aplica clase `dark`/`light` en `<html>`, CSS variables en body para bg/text.

## Open Items

- Migrate individual pages (lobby, friends, etc.) to use theme-aware colors instead of hardcoded `domino-*` dark colors
- Wire actual auth for "Cerrar sesión"
- Wire actual preference save to Supabase
