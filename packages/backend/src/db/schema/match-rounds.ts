import {
  boolean,
  foreignKey,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { matches } from "./matches";

/**
 * Match rounds table — persists per-hand results for replay and match history.
 * Schema mirrors the SQL migration. Writes go through `recordRound()`
 * in `../rounds.ts` which uses Drizzle ORM (fire-and-forget).
 */
export const matchRounds = pgTable(
  "match_rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id").notNull(),
    roundNumber: integer("round_number").notNull(),
    winningPair: smallint("winning_pair"),
    points: integer("points").notNull().default(0),
    isBlocked: boolean("is_blocked").notNull().default(false),
    isAnnulled: boolean("is_annulled").notNull().default(false),
    reason: text("reason").notNull(),
    handScores: smallint("hand_scores").array().notNull(),
    scoresAfter: smallint("scores_after").array().notNull(),
    boardLeftEnd: smallint("board_left_end"),
    boardRightEnd: smallint("board_right_end"),
    boardTileCount: integer("board_tile_count").notNull().default(0),
    playerHands: smallint("player_hands").array().notNull(),
    firstPlayer: smallint("first_player").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle foreignKey type inference mismatch
    foreignKey((() => ({
      columns: [table.matchId],
      foreignColumns: [matches.id],
      name: "match_rounds_match_id_fkey",
    })) as any).onDelete("cascade"),
  ],
);
