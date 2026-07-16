import {
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Matches table — persists terminal-state matches (finished/abandoned).
 * Schema mirrors the SQL migration. Writes go through `persistMatch()`
 * in `../matches.ts` which uses Drizzle ORM (fire-and-forget).
 */
export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: text("status")
    .notNull()
    .$type<"finished" | "abandoned">(),
  winner: smallint("winner"),
  forfeitBy: uuid("forfeit_by"),
  scores: integer("scores").array().notNull(),
  roundCount: integer("round_count").notNull(),
  targetScore: integer("target_score").notNull().default(200),
  playerIds: uuid("player_ids").array().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
