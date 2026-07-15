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
 * Supports both ES256 (Supabase v2 EC keys) and HS256 (legacy shared secret)
 * via verifyToken().
 */

import { Elysia } from "elysia";
import { verifyToken } from "./verify-token";

export function authGuard() {
  return new Elysia({ name: "auth-guard" })
    .resolve({ as: "scoped" }, async ({ headers, set }) => {
      const authHeader = headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        set.status = 401;
        throw new Error("Missing or invalid authorization header");
      }

      const token = authHeader.slice(7);
      const result = await verifyToken(token);

      if (!result?.sub) {
        set.status = 401;
        throw new Error("Invalid or expired token");
      }

      return { userId: result.sub };
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
