/**
 * Standalone JWT verification — reusable by both REST and WS handlers.
 *
 * Extracts the Supabase JWT secret and verifies the token, returning
 * the user's `sub` claim (UUID) on success.
 *
 * Unlike the Elysia authGuard plugin, this function is framework-agnostic
 * and can be called from WS handlers or other non-Elysia contexts.
 *
 * Supports both ES256 (Supabase v2 EC keys — default for local Docker)
 * and HS256 (legacy shared secret). Auto-detects from the token header.
 */

import { importJWK, jwtVerify } from "jose";

// ---------------------------------------------------------------------------
// EC public key from Supabase GOTRUE_JWT_KEYS (P-256 / ES256)
// ---------------------------------------------------------------------------

const EC_PUBLIC_KEY = {
  kty: "EC",
  crv: "P-256",
  x: "M5Sjqn5zwC9Kl1zVfUUGvv9boQjCGd45G8sdopBExB4",
  y: "P6IXMvA2WYXSHSOMTBH2jsw_9rrzGy89FjPf6oOsIxQ",
} as const;

/** Cached EC CryptoKey (imported once, reused across calls). */
let cachedEcKey: CryptoKey | null = null;

async function getEcKey(): Promise<CryptoKey> {
  if (!cachedEcKey) {
    cachedEcKey = await importJWK(EC_PUBLIC_KEY, "ES256");
  }
  return cachedEcKey;
}

/** Get the HMAC secret as a Uint8Array. */
function getHmacKey(): Uint8Array {
  const secret =
    process.env.SUPABASE_JWT_SECRET ??
    (Bun.env as Record<string, string>).SUPABASE_JWT_SECRET ??
    "";
  return new TextEncoder().encode(secret);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Verifies a Supabase JWT token and returns the user ID.
 *
 * Auto-detects ES256 vs HS256 from the token header `alg` field.
 * Supports Supabase v2 local Docker (ES256) and older setups (HS256).
 *
 * @returns `{ sub: string }` on success, or `null` if the token is invalid/expired.
 */
export async function verifyToken(
  token: string,
): Promise<{ sub: string } | null> {
  try {
    // Decode header to determine algorithm
    const [headerB64] = token.split(".");
    if (!headerB64) return null;
    const header = JSON.parse(
      atob(headerB64.replace(/-/g, "+").replace(/_/g, "/")),
    );

    let key: CryptoKey | Uint8Array;
    let algorithms: string[];

    if (header.alg === "ES256") {
      key = await getEcKey();
      algorithms = ["ES256"];
    } else {
      // Default: HS256 with shared secret
      key = getHmacKey();
      algorithms = ["HS256"];
    }

    const { payload } = await jwtVerify(token, key, { algorithms });

    if (!payload?.sub) return null;
    return { sub: payload.sub as string };
  } catch {
    return null;
  }
}
