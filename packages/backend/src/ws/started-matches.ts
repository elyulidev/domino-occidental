/**
 * Shared set of matchIds that have been started (all 4 players connected).
 * Used by both createWsPlugin (connection.ts) and createTimerManager (timer-manager.ts)
 * to prevent duplicate starts and to clean up when matches end.
 */
export const startedMatches = new Set<string>();
