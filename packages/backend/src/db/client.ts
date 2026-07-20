
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DrizzleDB = PostgresJsDatabase<typeof schema>;

let db: DrizzleDB | null = null;
let rawSql: ReturnType<typeof postgres> | null = null;
let dbInitPromise: Promise<DrizzleDB | null> | null = null;

/**
 * Returns the raw postgres.js client for raw SQL queries.
 * Useful for tables without a Drizzle schema (e.g. `pairs`).
 */
export async function getRawSql(): Promise<ReturnType<typeof postgres> | null> {
  if (rawSql) return rawSql;
  const url =
    process.env.SUPABASE_DB_URL ??
    (Bun.env as Record<string, string | undefined>).SUPABASE_DB_URL;
  if (!url) return null;
  rawSql = postgres(url, { max: 1, idle_timeout: 10 });
  return rawSql;
}

export async function getDb(): Promise<DrizzleDB | null> {
  // Fast path: already connected
  if (db) return db;
  // Deduplicate concurrent initialization
  if (dbInitPromise) return dbInitPromise;

  const url =
    process.env.SUPABASE_DB_URL ??
    (Bun.env as Record<string, string | undefined>).SUPABASE_DB_URL;
  if (!url) return null;

  dbInitPromise = (async () => {
    try {
      const queryClient = postgres(url, { max: 1, idle_timeout: 10 });
      rawSql = queryClient;
      db = drizzle(queryClient, { schema });
      return db;
    } catch (err) {
      console.warn(
        "[db/client] drizzle init failed:",
        (err as Error)?.message,
      );
      return null;
    }
  })();

  return dbInitPromise;
}
