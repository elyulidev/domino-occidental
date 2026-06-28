# Spec: settings-and-theme

## 1. Theme system

### ThemeProvider
- Client component (`"use client"`)
- React context providing `{ theme, toggleTheme }` where theme is `"light" | "dark"`
- On mount: read `localStorage.getItem("theme")` → fallback to `"dark"`
- On toggle: flip theme, save to localStorage, toggle `dark` class on `document.documentElement`
- Wraps children in `ThemeContext.Provider`

### CSS light mode variables in globals.css
- Add `:root` block with light mode colors (light bg, dark text)
- `.dark` class overrides for dark mode
- Or use Tailwind v4 `@variant dark` + `@custom-variant dark`
- Key variables: background, text, card backgrounds, border colors

### Root layout
- Wrap body with ThemeProvider
- Add `dark` class to `<html>` server-side (default)

## 2. Settings page

**Route**: `/settings`
**Type**: Client component ("use client") — needs theme toggle interactivity
**Nav icon**: Gear/cog icon in sidebar

### Sections:
1. **Header**: "Configuración" with back arrow to `/lobby`
2. **Apariencia**: Theme toggle (light/dark) with sun/moon icons
3. **Preferencias**: Show ELO toggle, Notifications toggle (same as edit profile)
4. **Perfil**: Link to `/profile/edit` with arrow
5. **Cerrar sesión**: Button (no-op placeholder)

## 3. Profile link in sidebar

- Wrap the user footer section in `<Link href="/profile/JugadorDemo">`
- Keep same visual layout (avatar, username, ELO, coins)

## 4. Settings nav item

- Add to sidebar NAV_ITEMS with gear icon
- Add to MobileMenu nav items
