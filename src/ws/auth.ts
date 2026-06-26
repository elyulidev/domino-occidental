import crypto from "node:crypto";

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
 * Base64url-decode a JWT segment to a UTF-8 string.
 */
function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  return Buffer.from(padded, "base64").toString("utf-8");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Verify a Supabase JWT using HS256 (HMAC-SHA256).
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

    // Verify HMAC-SHA256 signature
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64url");

    // Timing-safe comparison to prevent timing attacks
    if (expectedSignature.length !== signatureB64.length) return null;

    const expectedBuf = Buffer.from(expectedSignature);
    const actualBuf = Buffer.from(signatureB64);
    if (!crypto.timingSafeEqual(expectedBuf, actualBuf)) {
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
