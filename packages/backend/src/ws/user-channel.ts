/**
 * User WebSocket channel manager for pushing events to individual users.
 *
 * Maintains a flat Map of userId → WebSocket connections.
 * Used for server-initiated pushes like match_found notifications.
 *
 * @see AGENTS.md §8 for WebSocket message types
 */

import type { UserChannelManager, UserWsConnection } from "@domino/shared";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a UserChannelManager that tracks user WebSocket connections
 * and provides a push mechanism for server-initiated events.
 */
export function createUserChannelManager(): UserChannelManager {
  const channels = new Map<string, UserWsConnection>();

  return {
    register(userId: string, ws: UserWsConnection): void {
      channels.set(userId, ws);
    },

    disconnect(userId: string): void {
      channels.delete(userId);
    },

    getChannel(userId: string): UserWsConnection | undefined {
      return channels.get(userId);
    },

    pushToUser(userId: string, event: Record<string, unknown>): boolean {
      const ws = channels.get(userId);
      if (!ws) return false;

      try {
        ws.send(JSON.stringify(event));
      } catch {
        // Silently no-op — connection may be stale
      }

      return true;
    },
  };
}
