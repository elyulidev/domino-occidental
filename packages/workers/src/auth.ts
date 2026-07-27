import { jwtVerify, type JWTPayload } from "jose";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VerifiedToken {
  userId: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Verify a Supabase JWT using HS256 (HMAC-SHA256).
 *
 * Uses the `jose` library which works in Cloudflare Workers runtime
 * (no Node.js dependencies required).
 *
 * @param token - Raw JWT string from `?token=` query parameter
 * @param secret - The JWT secret (from SUPABASE_JWT_SECRET / JWT_SECRET env)
 * @returns `VerifiedToken` with the user's UUID, or `null` if verification
 *          fails (invalid signature, expired, or malformed token)
 */
export async function verifyToken(
  token: string,
  secret: string,
): Promise<VerifiedToken | null> {
  if (!token) return null;

  try {
    const encoder = new TextEncoder();
    const key = encoder.encode(secret);

    // jwtVerify throws on invalid/expired tokens — we catch and return null
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });

    // Extract userId — try common Supabase JWT claim locations
    const casted = payload as JWTPayload & {
      userId?: string;
    };
    const userId = casted.userId ?? casted.sub ?? null;
    if (!userId) return null;

    return { userId };
  } catch {
    return null;
  }
}
