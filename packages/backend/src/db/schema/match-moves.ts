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
 * Match moves table — historial de jugadas para replay y auditoría.
 * Schema mirrors the SQL migration. The actual writes go through
 * `recordMatchMove()` in `../moves.ts` which uses Drizzle ORM (fire-and-forget).
 * This schema exists for consistency and future typed reads.
 */
export const matchMoves = pgTable(
  "match_moves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id").notNull(),
    roundNumber: integer("round_number").notNull(),
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
  ],
);
