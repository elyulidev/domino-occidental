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
import { matchRounds } from "./match-rounds";

/**
 * Match moves table — historial de jugadas para replay y auditoría.
 * Schema mirrors the SQL migration. The actual writes go through
 * `recordMatchMove()` in `../moves.ts` which uses Drizzle ORM (fire-and-forget).
 *
 * Normalized schema: matches → match_rounds → match_moves
 * Each move references a round via round_id FK.
 */
export const matchMoves = pgTable(
  "match_moves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id").notNull(),
    roundId: uuid("round_id"),
    roundNumber: integer("round_number").notNull(), // denormalized for query convenience
    playerIndex: smallint("player_index").notNull(),
    moveNumber: integer("move_number").notNull(),
    isPass: boolean("is_pass").notNull(),
    actionSource: text("action_source").notNull().default("player"),
    tileId: text("tile_id"),
    tileTop: smallint("tile_top"),
    tileBottom: smallint("tile_bottom"),
    side: text("side"),
    boardLeftEnd: smallint("board_left_end"),
    boardRightEnd: smallint("board_right_end"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle foreignKey type inference mismatch
    foreignKey((() => ({
      columns: [table.matchId],
      foreignColumns: [matches.id],
      name: "match_moves_match_id_fkey",
    })) as any).onDelete("cascade"),
    // NOTE: round_id FK dropped — nullable for abandoned matches mid-hand
  ],
);
