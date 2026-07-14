/**
 * JWT Auth Guard — Elysia plugin that verifies Supabase JWT tokens.
 *
 * Usage:
 *   app
 *     .onError(authErrorHandler)
 *     .use(authGuard())
 *     .get("/profile/me", ({ userId }) => { ... })
 *
 * The authGuard plugin injects `userId` into the handler context on success.
 * Throws 401 if the token is missing, invalid, or has no `sub` claim.
 *
 * IMPORTANT: Add `authErrorHandler` to the app's `onError` for JSON error
 * responses. Without it, auth errors return the error message as plain text.
 *
 * NOTE: authGuard() is a factory — it reads SUPABASE_JWT_SECRET at call time,
 * not at module load time. This avoids stale secrets from module caching.
 */

import { jwt } from "@elysiajs/jwt";
import { Elysia } from "elysia";

export function authGuard() {
  const secret =
    process.env.SUPABASE_JWT_SECRET ??
    (Bun.env as Record<string, string>).SUPABASE_JWT_SECRET ??
    "";

  return new Elysia({ name: "auth-guard" })
    .use(
      jwt({
        name: "jwt",
        secret,
      }),
    )
    .resolve({ as: "scoped" }, async ({ jwt, headers, set }) => {
      const authHeader = headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        set.status = 401;
        throw new Error("Missing or invalid authorization header");
      }

      const token = authHeader.slice(7);
      const payload = await jwt.verify(token);

      if (!payload?.sub) {
        set.status = 401;
        throw new Error("Invalid or expired token");
      }

      return { userId: payload.sub as string };
    });
}

/**
 * Auth error handler — converts 401 errors to JSON.
 * Use in app-level `onError`:
 *   app.onError(authErrorHandler).use(authGuard())
 */
export function authErrorHandler({ set }: { set: { status: number } }) {
  if (set.status === 401) {
    return { error: "unauthorized" };
  }
}
