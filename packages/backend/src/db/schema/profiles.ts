import {
  char,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Profiles table — mirrors the SQL migration.
 * Schema only for now (deferred typed queries).
 */
export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  username: text("username").notNull(),
  avatarUrl: text("avatar_url"),
  status: text("status").default("offline"),
  country: char("country", { length: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  elo: integer("elo").notNull().default(1200),
  coins: integer("coins").notNull().default(250),
});

/**
 * Reference to auth.users — minimal columns needed for the FK.
 * Full auth.users is managed by Supabase, not Drizzle.
 */
export const authUsers = pgTable("users", {
  id: uuid("id").primaryKey(),
});
