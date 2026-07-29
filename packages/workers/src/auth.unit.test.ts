import { importJWK, type JWK, type KeyLike, SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { jwksFromPayload, verifyToken } from "./auth";

// ---------------------------------------------------------------------------
// Test key setup
// ---------------------------------------------------------------------------
// We generate an ECDSA P-256 key pair (ES256) — the same algorithm Supabase
// uses for its JWKS signing keys. The public key is published as a JWKS,
// the private key signs test tokens.
// ---------------------------------------------------------------------------

let privateKey: KeyLike;
/** GetKey function built from the test public JWK */
let testKeyResolver: ReturnType<typeof jwksFromPayload>;

beforeAll(async () => {
  // Generate ECDSA P-256 key pair via Web Crypto API
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );

  // Export private key as JWK for SignJWT
  const privJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  privateKey = await importJWK(privJwk, "ES256");

  // Export public key as JWK and build a local JWKS
  const rawPub = (await crypto.subtle.exportKey(
    "jwk",
    keyPair.publicKey,
  )) as unknown as JWK;
  testKeyResolver = jwksFromPayload({ keys: [rawPub] });
});

/**
 * Create a valid JWT signed with the test private key.
 */
async function createToken(
  payload: Record<string, unknown>,
  options?: { expiresInSeconds?: number },
): Promise<string> {
  let jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setIssuedAt();

  if (options?.expiresInSeconds !== undefined) {
    jwt = jwt.setExpirationTime(`${options.expiresInSeconds}s`);
  }

  return jwt.sign(privateKey);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("verifyToken", () => {
  it("returns userId from sub claim on a valid token", async () => {
    const token = await createToken({ sub: "user-abc-123" });
    const result = await verifyToken(token, testKeyResolver);

    expect(result).toEqual({ userId: "user-abc-123" });
  });

  it("returns userId from userId claim when sub is absent", async () => {
    const token = await createToken({ userId: "user-alt-456" });
    const result = await verifyToken(token, testKeyResolver);

    expect(result).toEqual({ userId: "user-alt-456" });
  });

  it("returns null for an expired token", async () => {
    const token = await createToken(
      { sub: "user-expired" },
      { expiresInSeconds: -10 },
    );
    const result = await verifyToken(token, testKeyResolver);

    expect(result).toBeNull();
  });

  it("returns null for a token signed with a different key", async () => {
    // Generate a completely different key pair and sign with it
    const otherPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    );
    const otherPrivJwk = await crypto.subtle.exportKey(
      "jwk",
      otherPair.privateKey,
    );
    const otherKey = await importJWK(otherPrivJwk, "ES256");

    const token = await new SignJWT({ sub: "user-wrong" })
      .setProtectedHeader({ alg: "ES256", typ: "JWT" })
      .setIssuedAt()
      .sign(otherKey);

    const result = await verifyToken(token, testKeyResolver);

    expect(result).toBeNull();
  });

  it("returns null for an empty string", async () => {
    const result = await verifyToken("", testKeyResolver);
    expect(result).toBeNull();
  });

  it("returns null for a malformed token (not 3 parts)", async () => {
    const result = await verifyToken("not.a.valid.jwt.token", testKeyResolver);
    expect(result).toBeNull();
  });

  it("returns null when no sub or userId claim exists", async () => {
    const token = await createToken({ email: "test@example.com" });
    const result = await verifyToken(token, testKeyResolver);

    expect(result).toBeNull();
  });
});
