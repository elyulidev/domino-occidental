/**
 * Matchmaking WebSocket handler.
 *
 * Provides a lightweight per-user WS channel at `/ws/matchmaking/:userId`
 * for server-initiated push notifications (match_found, queue updates).
 *
 * Lifecycle:
 *   1. Client connects with `?token=<jwt>`
 *   2. Server verifies JWT, registers user in UserChannelManager
 *   3. Server pushes events (match_found, queue_position_update, etc.)
 *   4. On disconnect, user is unregistered from UserChannelManager
 *
 * @see openspec/changes/quick-match-queue/design.md §Decision: Dedicated WS route
 */

import type { UserChannelManager, UserWsConnection } from "@domino/shared";
import type { ElysiaWS } from "elysia/ws";
import { verifyToken } from "../auth/verify-token";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MatchmakingWsDeps {
  userChannelManager: UserChannelManager;
  verifyToken?: typeof verifyToken;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a WS handler for `/ws/matchmaking/:userId`.
 *
 * The handler bridges Elysia's WS API to the UserChannelManager,
 * enabling server-push matchmaking events to individual users.
 */
export function matchmakingWsHandler(deps: MatchmakingWsDeps) {
  const tokenVerifier = deps.verifyToken ?? verifyToken;

  return {
    open(ws: ElysiaWS) {
      const query = (ws.data as Record<string, unknown>).query as
        | Record<string, string>
        | undefined;
      const token = query?.token;

      if (!token) {
        ws.close(4001, "Missing authentication token");
        return;
      }

      // Verify JWT — lightweight, no DB call
      tokenVerifier(token)
        .then((result) => {
          // If the connection closed while we were verifying, abort registration
          if ((ws.data as Record<string, unknown>).__closed) return;

          // Defense-in-depth: check the socket is still open
          try {
            if (ws.readyState !== 1) return;
          } catch {
            return; // socket already destroyed
          }

          if (!result) {
            ws.close(4001, "Invalid or expired token");
            return;
          }

          const userId = result.sub;

          // Register in user channel for push notifications
          deps.userChannelManager.register(userId, ws as unknown as UserWsConnection);

          // Store userId on ws.data for close handler
          (ws.data as Record<string, unknown>).userId = userId;

          // Send initial acknowledgement
          ws.send(JSON.stringify({ type: "connected", userId }));
        })
        .catch((err) => {
          console.error("[matchmaking-ws] Token verification failed:", err);
          try {
            if (ws.readyState === 1) {
              ws.close(4001, "Authentication error");
            }
          } catch {
            // socket already destroyed, nothing to do
          }
        });
    },

    message(_ws: ElysiaWS, rawData: string | Buffer | Record<string, unknown>) {
      // Lightweight heartbeat — clients send pong to keep connection alive
      let parsed: { type?: string };
      if (typeof rawData === "object" && !Buffer.isBuffer(rawData)) {
        parsed = rawData as Record<string, unknown> as { type?: string };
      } else {
        try {
          parsed = JSON.parse(
            typeof rawData === "string" ? rawData : (rawData as Buffer).toString(),
          );
        } catch {
          return; // Ignore malformed messages
        }
      }

      if (parsed.type === "pong") {
        // Acknowledged — connection is alive
      }
    },

    close(ws: ElysiaWS) {
      // Mark as closed so the async .then() won't register an orphan connection
      (ws.data as Record<string, unknown>).__closed = true;

      const userId = (ws.data as Record<string, unknown>).userId as
        | string
        | undefined;
      if (userId) {
        deps.userChannelManager.disconnect(userId);
      }
    },
  };
}
