/**
 * Pure route-matching rules for proxy.ts.
 * Extracted for testability — no Next.js runtime dependencies.
 */

/** Routes that require authentication (match against URL pathname). */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/game",
  "/lobby",
  "/profile",
  "/friends",
  "/tournaments",
  "/shop",
  "/notifications",
  "/users",
  "/match",
  "/pairs",
  "/settings",
];

/** Routes that are always public (no auth required). */
const PUBLIC_PREFIXES = ["/login", "/register", "/auth", "/_next", "/favicon"];

/**
 * Returns true if the given pathname requires authentication.
 */
export function isProtectedRoute(pathname: string): boolean {
  // Static assets are never protected
  if (pathname.startsWith("/_next")) return false;

  // Check public prefixes first
  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return false;
    }
  }

  // Root is public
  if (pathname === "/") return false;

  // Check protected prefixes
  for (const prefix of PROTECTED_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return true;
    }
  }

  // Default: allow (unknown routes are public)
  return false;
}

/**
 * Builds the full redirect URL to /login with a ?next= param.
 */
export function getAuthRedirectUrl(pathname: string, origin: string): string {
  return `${origin}/login?next=${encodeURIComponent(pathname)}`;
}

/** Routes that a logged-in user should never see (redirect away). */
const AUTH_ONLY_PREFIXES = ["/login", "/register"];

/** Where to send an already-authenticated user landing on an auth route. */
export const AUTHENTICATED_HOME = "/lobby";

/**
 * Returns true if the given pathname is an auth-only route
 * (should redirect to app if the user already has a session).
 */
export function isAuthRoute(pathname: string): boolean {
  return AUTH_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
