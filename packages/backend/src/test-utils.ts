/**
 * Test utilities — JWT signing via @elysiajs/jwt (avoids direct jose dependency).
 *
 * Uses a mini Elysia app wrapped with @elysiajs/jwt's plugin so tests can
 * generate valid JWTs without importing `jose` directly.
 */

import { jwt } from "@elysiajs/jwt";
import { Elysia } from "elysia";

const TEST_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long";

// Mini Elysia app that uses @elysiajs/jwt's sign() for token generation.
const signerApp = new Elysia()
  .use(jwt({ name: "jwt", secret: TEST_SECRET, alg: "HS256" }))
  .post("/sign", async ({ jwt: jwtPlugin, body }) => {
    return jwtPlugin.sign((body ?? {}) as Record<string, string>);
  });

export async function signToken(sub: string): Promise<string> {
  const res = await signerApp.handle(
    new Request("http://localhost/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sub }),
    }),
  );
  return res.text();
}

export async function signTokenNoSub(): Promise<string> {
  const res = await signerApp.handle(
    new Request("http://localhost/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "user" }),
    }),
  );
  return res.text();
}
