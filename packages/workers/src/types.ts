/**
 * Cloudflare Worker Env interface.
 *
 * Defines all Durable Object bindings and environment variables
 * available to the Worker entrypoint.
 */
export interface Env {
  // Durable Object bindings
  GAME_DO: DurableObjectNamespace;
  MATCHMAKING_DO: DurableObjectNamespace;

  // Environment variables
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;

  // Secrets (injected at runtime)
  JWT_SECRET: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

/**
 * Persistent state for a GameDO instance.
 *
 * Stored in Durable Object SQLite storage.
 */
export interface GameDOStorage {
  /** The full match state (serialized MatchState from @domino/shared) */
  match: unknown;
  /** Assigned player IDs (set before game starts, 4 entries) */
  playerIds: string[];
  /** Next heartbeat check timestamp (Unix ms) */
  heartbeatDue: number;
  /** Next turn timeout check timestamp (Unix ms) */
  turnCheckDue: number;
  /** Abandonment deadline (Unix ms), null if no disconnect pending */
  abandonmentDue: number | null;
  /** Player ID whose disconnect triggered abandonment timer */
  pausedPlayerId: string | null;
  /** Whether the game has started (4 players connected) */
  started: boolean;
}

/**
 * Persistent state for a MatchmakingDO instance.
 *
 * Stored in Durable Object SQLite storage.
 */
export interface MatchmakingDOState {
  /** Players currently in the queue */
  queue: Array<{ userId: string; elo: number; joinedAt: number }>;
  /** Whether a matching alarm is currently scheduled */
  alarmScheduled: boolean;
}
