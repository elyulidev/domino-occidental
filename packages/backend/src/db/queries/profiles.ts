/**
 * Profile queries — read-only access to profiles table.
 *
 * Uses lazy DB connection. Returns null/empty on missing DB for dev resilience.
 */

import { count, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../client";
import { profiles } from "../schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProfileResult {
  id: string;
  username: string;
  avatarUrl: string | null;
  elo: number;
  coins: number;
  country: string | null;
  rank: number;
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  avatarUrl: string | null;
  elo: number;
  coins: number;
  country: string | null;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Get profile by user ID with computed rank.
 *
 * Rank = COUNT(*) + 1 of profiles with higher ELO (1-based).
 * Returns null if DB unavailable or profile not found.
 */
export async function getProfile(
  userId: string,
): Promise<ProfileResult | null> {
  const db = await getDb();
  if (!db) return null;

  // 1) Fetch profile row
  const rows = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      avatarUrl: profiles.avatarUrl,
      elo: profiles.elo,
      coins: profiles.coins,
      country: profiles.country,
    })
    .from(profiles)
    .where(eq(profiles.id, userId));

  if (rows.length === 0) return null;

  const row = rows[0];

  // 2) Compute rank: count players with higher elo + 1
  const rankRows = await db
    .select({ count: count() })
    .from(profiles)
    .where(sql`${profiles.elo} > ${row.elo}`);

  const rank = (rankRows[0]?.count ?? 0) + 1;

  return {
    id: row.id,
    username: row.username,
    avatarUrl: row.avatarUrl,
    elo: row.elo,
    coins: row.coins,
    country: row.country,
    rank,
  };
}

/**
 * Get paginated leaderboard ordered by ELO DESC.
 *
 * @param page - 1-based page number
 * @param limit - items per page (default 20)
 */
export async function getLeaderboard(
  page: number,
  limit: number,
): Promise<LeaderboardEntry[]> {
  const db = await getDb();
  if (!db) return [];

  const offset = (page - 1) * limit;

  return db
    .select({
      id: profiles.id,
      username: profiles.username,
      avatarUrl: profiles.avatarUrl,
      elo: profiles.elo,
      coins: profiles.coins,
      country: profiles.country,
    })
    .from(profiles)
    .orderBy(desc(profiles.elo))
    .offset(offset)
    .limit(limit);
}
