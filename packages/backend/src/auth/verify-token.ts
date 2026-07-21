/**
 * Standalone JWT verification — reusable by both REST and WS handlers.
 *
 * Verifies Supabase JWT tokens and returns the user's `sub` claim (UUID).
 *
 * Supports three verification strategies (auto-detected by token `alg`):
 *
 * 1. **JWKS (Supabase Cloud — preferred)**: Fetches public keys from the
 *    project's JWKS endpoint. Works with Supabase's new asymmetric signing
 *    keys (ES256). The JWKS URL is built from `SUPABASE_URL` env var.
 *
 * 2. **EC key (local Docker)**: Uses a hardcoded EC P-256 public key from
 *    Supabase v2 local Docker's `GOTRUE_JWT_KEYS`.
 *
 * 3. **HMAC (legacy)**: Falls back to HS256 with `SUPABASE_JWT_SECRET`.
 *
 * @see https://supabase.com/docs/guides/auth/jwts
 * @see https://supabase.com/docs/guides/auth/signing-keys
 */

import { createRemoteJWKSet, importJWK, jwtVerify } from "jose";

// ---------------------------------------------------------------------------
// JWKS — Supabase Cloud (asymmetric keys, preferred for cloud deployments)
// ---------------------------------------------------------------------------

function getSupabaseProjectRef(): string | null {
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    (Bun.env as Record<string, string>).SUPABASE_URL ??
    (Bun.env as Record<string, string>).NEXT_PUBLIC_SUPABASE_URL ??
    "";
  // Extract project ref from URL like "https://xyz.supabase.co"
  const match = url.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/);
  return match?.[1] ?? null;
}

/** Cached JWKS set (created once, auto-refreshes keys). */
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> | null {
  const projectRef = getSupabaseProjectRef();
  if (!projectRef) return null;
  if (!cachedJwks) {
    cachedJwks = createRemoteJWKSet(
      new URL(
        `https://${projectRef}.supabase.co/auth/v1/.well-known/jwks.json`,
      ),
    );
  }
  return cachedJwks;
}

// ---------------------------------------------------------------------------
// EC public key — Supabase local Docker (P-256 / ES256)
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
    cachedEcKey = (await importJWK(EC_PUBLIC_KEY, "ES256")) as CryptoKey;
  }
  return cachedEcKey;
}

// ---------------------------------------------------------------------------
// HMAC — legacy shared secret (HS256)
// ---------------------------------------------------------------------------

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
 * Strategy selection by `alg` header:
 * - ES256 → JWKS endpoint (cloud) → hardcoded EC key (local Docker) fallback
 * - HS256 → HMAC shared secret (legacy)
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
      // Try JWKS first (Supabase Cloud), fall back to hardcoded EC key (local)
      const jwks = getJwks();
      if (jwks) {
        const { payload } = await jwtVerify(token, jwks, {
          algorithms: ["ES256"],
        });
        if (!payload?.sub) return null;
        return { sub: payload.sub as string };
      }
      // Local Docker fallback
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
