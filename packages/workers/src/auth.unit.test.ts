import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { verifyToken } from "./auth";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const TEST_SECRET = "test-jwt-secret-for-workers";

/** Create a valid JWT with the given payload */
async function createToken(
  payload: Record<string, unknown>,
  secret: string = TEST_SECRET,
  options?: { expiresInSeconds?: number },
): Promise<string> {
  const encoder = new TextEncoder();
  const key = encoder.encode(secret);

  let jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt();

  if (options?.expiresInSeconds !== undefined) {
    jwt = jwt.setExpirationTime(`${options.expiresInSeconds}s`);
  }

  return jwt.sign(key);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("verifyToken", () => {
  it("returns userId from sub claim on a valid token", async () => {
    const token = await createToken({ sub: "user-abc-123" });
    const result = await verifyToken(token, TEST_SECRET);

    expect(result).toEqual({ userId: "user-abc-123" });
  });

  it("returns userId from userId claim when sub is absent", async () => {
    const token = await createToken({ userId: "user-alt-456" });
    const result = await verifyToken(token, TEST_SECRET);

    expect(result).toEqual({ userId: "user-alt-456" });
  });

  it("returns null for an expired token", async () => {
    const token = await createToken(
      { sub: "user-expired" },
      TEST_SECRET,
      { expiresInSeconds: -10 },
    );
    const result = await verifyToken(token, TEST_SECRET);

    expect(result).toBeNull();
  });

  it("returns null for a token signed with a different secret", async () => {
    const token = await createToken({ sub: "user-wrong" }, "wrong-secret");
    const result = await verifyToken(token, TEST_SECRET);

    expect(result).toBeNull();
  });

  it("returns null for an empty string", async () => {
    const result = await verifyToken("", TEST_SECRET);
    expect(result).toBeNull();
  });

  it("returns null for a malformed token (not 3 parts)", async () => {
    const result = await verifyToken("not.a.valid.jwt.token", TEST_SECRET);
    expect(result).toBeNull();
  });

  it("returns null when no sub or userId claim exists", async () => {
    const token = await createToken({ email: "test@example.com" });
    const result = await verifyToken(token, TEST_SECRET);

    expect(result).toBeNull();
  });
});
