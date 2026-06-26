// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JwtPayload {
  /** Standard JWT claims */
  sub?: string;
  aud?: string;
  exp?: number;
  iat?: number;
  /** Supabase-specific — the user's UUID */
  userId?: string;
}

export interface VerifiedToken {
  userId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const JWT_SECRET_ENV = "SUPABASE_JWT_SECRET";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Timing-safe string comparison to prevent timing attacks on signatures.
 * Bun-native — no import required.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Base64url-decode a JWT segment to a UTF-8 string.
 * Uses Bun's native `atob()` (Web API) instead of Buffer.
 */
function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  return atob(padded);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Verify a Supabase JWT using HS256 (HMAC-SHA256).
 *
 * Uses `Bun.CryptoHasher` for HMAC and `atob()` for base64url decode —
 * no Node.js compatibility imports.
 *
 * @param token - Raw JWT string from `?token=` query parameter
 * @returns `VerifiedToken` with the user's UUID, or `null` if verification
 *          fails (invalid signature, expired, or malformed token)
 */
export function verifyToken(token: string): VerifiedToken | null {
  try {
    const secret = process.env[JWT_SECRET_ENV];
    if (!secret) return null;

    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify HMAC-SHA256 signature using Bun's native CryptoHasher
    const hasher = new Bun.CryptoHasher("sha256", secret);
    hasher.update(`${headerB64}.${payloadB64}`);
    const expectedSignature = hasher.digest("base64url");

    // Timing-safe comparison to prevent timing attacks
    if (!timingSafeEqual(expectedSignature, signatureB64)) {
      return null;
    }

    // Decode and parse payload
    const payload: JwtPayload = JSON.parse(base64UrlDecode(payloadB64));

    // Check expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }

    // Extract userId — try common Supabase JWT claim locations
    const userId = payload.userId ?? payload.sub ?? null;
    if (!userId) return null;

    return { userId };
  } catch {
    return null;
  }
}
