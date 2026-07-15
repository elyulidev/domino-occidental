/**
 * Standalone JWT verification — reusable by both REST and WS handlers.
 *
 * Extracts the Supabase JWT secret and verifies the token, returning
 * the user's `sub` claim (UUID) on success.
 *
 * Unlike the Elysia authGuard plugin, this function is framework-agnostic
 * and can be called from WS handlers or other non-Elysia contexts.
 */

import { jwtVerify } from "jose";

/**
 * Verifies a Supabase JWT token and returns the user ID.
 *
 * @returns `{ sub: string }` on success, or `null` if the token is invalid/expired.
 */
export async function verifyToken(
  token: string,
): Promise<{ sub: string } | null> {
  try {
    const secret =
      process.env.SUPABASE_JWT_SECRET ??
      (Bun.env as Record<string, string>).SUPABASE_JWT_SECRET ??
      "";

    const encoder = new TextEncoder();
    const key = encoder.encode(secret);

    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
    });

    if (!payload?.sub) return null;
    return { sub: payload.sub as string };
  } catch {
    return null;
  }
}
