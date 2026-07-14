import { createBrowserClient } from "../supabase/client";

/**
 * Authenticated fetch helper for the backend API.
 *
 * Uses relative URLs — Next.js rewrites `/api/v1/*` to the backend.
 * Attaches the Supabase session token as a Bearer header.
 * Throws on 401 so callers can handle redirect.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const supabase = createBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new AuthError("No active session");
  }

  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...options.headers,
    },
  });

  if (res.status === 401) {
    throw new AuthError("Unauthorized");
  }

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
