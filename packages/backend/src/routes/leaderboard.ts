/**
 * Leaderboard routes — paginated ELO ranking with dense rank.
 *
 * All routes in this group require a valid JWT token (use authGuard).
 */

import { count, desc } from "drizzle-orm";
import { Elysia } from "elysia";
import { getDb } from "../db/client";
import { profiles } from "../db/schema";

export const leaderboardRoutes = new Elysia().get(
  "/leaderboard/individual",
  async ({ query }) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));

    const db = await getDb();
    if (!db) {
      return { data: [], total: 0, page, totalPages: 0 };
    }

    // 1) Total count for pagination metadata
    const countResult = await db.select({ count: count() }).from(profiles);
    const total = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(total / limit);

    if (total === 0) {
      return { data: [], total: 0, page, totalPages: 0 };
    }

    // 2) Fetch ALL profiles ordered by elo DESC for dense rank computation.
    //    Dense rank requires seeing all higher entries to assign correct ranks.
    const allRows = await db
      .select({
        id: profiles.id,
        username: profiles.username,
        avatarUrl: profiles.avatarUrl,
        elo: profiles.elo,
      })
      .from(profiles)
      .orderBy(desc(profiles.elo));

    // 3) Compute rank: same ELO = same rank, next different ELO = prev position + 1
    //    This is standard competition ranking (1224, not 1223).
    const ranked: Array<{
      id: string;
      username: string;
      avatarUrl: string | null;
      elo: number;
      rank: number;
    }> = [];

    for (let i = 0; i < allRows.length; i++) {
      const row = allRows[i];
      let rank: number;
      if (i === 0) {
        rank = 1;
      } else if (row.elo === allRows[i - 1].elo) {
        // Same ELO → same rank as previous
        rank = ranked[i - 1].rank;
      } else {
        // Different ELO → rank = position (1-based) after skipping tied entries
        rank = i + 1;
      }
      ranked.push({ ...row, rank });
    }

    // 4) Paginate: slice the ranked array
    const offset = (page - 1) * limit;
    const pageEntries = ranked.slice(offset, offset + limit);

    const data = pageEntries.map((entry) => ({
      rank: entry.rank,
      username: entry.username,
      elo: entry.elo,
      avatar_url: entry.avatarUrl,
    }));

    return { data, total, page, totalPages };
  },
);
