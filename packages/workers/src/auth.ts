import {
  createRemoteJWKSet,
  type JWK,
  type JWTPayload,
  jwtVerify,
  type KeyLike,
} from "jose";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VerifiedToken {
  userId: string;
}

/**
 * A function that resolves a JWKS to a cryptographic key.
 *
 * Compatible with jose's `GetKeyFunction` — this is the type returned by
 * `createRemoteJWKSet` and accepted by `jwtVerify` as the key argument.
 */
// biome-ignore lint/complexity/noBannedTypes: jose GetKeyFunction uses `Object`
type GetKey = (protectedHeader: Object, token: Object) => Promise<KeyLike>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Module-level cache for remote JWK Sets.
 *
 * Keyed by Supabase project URL so each DO isolate creates at most one
 * fetch-and-cache cycle per project. `createRemoteJWKSet` already caches
 * internally — this Map avoids re-creating the wrapper on every request.
 */
const jwksCache = new Map<string, GetKey>();

/**
 * Resolve a JWK Set function for a Supabase project.
 *
 * The JWKS endpoint is `{supabaseUrl}/auth/v1/.well-known/jwks.json`.
 * Supabase publishes ECC P-256 keys there; the returned function
 * auto-detects the algorithm from the `kid` in the JWT header.
 */
function jwksFromUrl(supabaseUrl: string): GetKey {
  const cached = jwksCache.get(supabaseUrl);
  if (cached) return cached;

  const url = new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`);
  const jwks = createRemoteJWKSet(url) as unknown as GetKey;
  jwksCache.set(supabaseUrl, jwks);
  return jwks;
}

/**
 * Build a JWK Set resolver from a local JWKS payload (no network).
 *
 * Uses `createRemoteJWKSet` with a data: URI to avoid actual HTTP traffic.
 * Exported for testing — allows tests to inject controlled keys.
 */
export function jwksFromPayload(payload: { keys: JWK[] }): GetKey {
  const json = JSON.stringify(payload);
  const encoded = btoa(json);
  return createRemoteJWKSet(
    new URL(`data:application/json;base64,${encoded}`),
  ) as unknown as GetKey;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Verify a Supabase JWT against a key resolver.
 *
 * @param token - Raw JWT string from `?token=` query parameter
 * @param keyResolver - Either:
 *   - A Supabase project URL string (e.g. `"https://xxx.supabase.co"`) — the
 *     JWKS endpoint is auto-resolved from it
 *   - A `GetKey` function (from `jwksFromPayload()` or `createRemoteJWKSet`)
 * @returns `VerifiedToken` with the user's UUID, or `null` on failure
 */
export async function verifyToken(
  token: string,
  keyResolver: string | GetKey,
): Promise<VerifiedToken | null> {
  if (!token) return null;

  try {
    const getKey =
      typeof keyResolver === "string" ? jwksFromUrl(keyResolver) : keyResolver;
    const { payload } = await jwtVerify(token, getKey);

    const casted = payload as JWTPayload & { userId?: string };
    const userId = casted.userId ?? casted.sub ?? null;
    if (!userId) return null;

    return { userId };
  } catch {
    return null;
  }
}
