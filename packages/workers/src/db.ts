/**
 * Supabase REST client for Cloudflare Workers.
 *
 * Uses native fetch() — zero external dependencies.
 * Service-role key required for RLS-bypassing writes.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SupabaseRestConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
}

interface SupabaseErrorResponse {
  message: string;
  details: string;
  hint: string;
  code: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildHeaders(config: SupabaseRestConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${config.serviceRoleKey}`,
    apikey: config.serviceRoleKey,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Insert a single row into a Supabase table via PostgREST REST API.
 * Fire-and-forget: errors are logged but never thrown (game must not crash).
 */
export async function supabaseInsert(
  table: string,
  row: Record<string, unknown>,
  config: SupabaseRestConfig,
): Promise<void> {
  const url = `${config.supabaseUrl}/rest/v1/${table}`;

  const res = await fetch(url, {
    method: "POST",
    headers: buildHeaders(config),
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as SupabaseErrorResponse;
      errMsg = body.message ?? errMsg;
    } catch {
      // body may not be JSON
    }
    console.error(`[db] insert failed table=${table} status=${res.status}: ${errMsg}`);
  }
}

/**
 * Upsert a single row into a Supabase table via PostgREST REST API.
 * Fire-and-forget: errors are logged but never thrown.
 *
 * @param onConflict - comma-separated column names for the unique constraint
 */
export async function supabaseUpsert(
  table: string,
  row: Record<string, unknown>,
  onConflict: string,
  config: SupabaseRestConfig,
): Promise<void> {
  const url = new URL(`${config.supabaseUrl}/rest/v1/${table}`);
  url.searchParams.set("on_conflict", onConflict);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      ...buildHeaders(config),
      Prefer: "return=minimal,resolution=merge-duplicates",
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as SupabaseErrorResponse;
      errMsg = body.message ?? errMsg;
    } catch {
      // body may not be JSON
    }
    console.error(`[db] upsert failed table=${table} status=${res.status}: ${errMsg}`);
  }
}
