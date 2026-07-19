"use client";

import type { WsClientMessage, WsServerMessage } from "@domino/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { WsGameEngine } from "@/lib/game/ws-engine";
import { useGameStore } from "@/stores/game-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WsStatus = "connecting" | "connected" | "disconnected";

export interface UseWebSocketReturn {
  status: WsStatus;
  send: (msg: WsClientMessage) => void;
  engine: WsGameEngine;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_MAX_ATTEMPTS = 10;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWebSocket(matchId: string, playerId: string, disabled = false): UseWebSocketReturn {
  const [status, setStatus] = useState<WsStatus>(disabled ? "disconnected" : "connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const engineRef = useRef<WsGameEngine | null>(null);
  const engineInitializedRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  // Create engine lazily — will be initialized on first message from server
  if (!engineRef.current) {
    engineRef.current = new WsGameEngine(
      // Initial placeholder — will be replaced on first game_events message
      {
        matchId,
        players: [
          { id: playerId, handSize: 0, isConnected: true, blockedTileIds: [] },
          { id: "", handSize: 0, isConnected: false, blockedTileIds: [] },
          { id: "", handSize: 0, isConnected: false, blockedTileIds: [] },
          { id: "", handSize: 0, isConnected: false, blockedTileIds: [] },
        ],
        board: { leftEnd: null, rightEnd: null, tiles: [] },
        currentTurn: 0,
        scores: [0, 0],
        roundNumber: 0,
        poolCount: 0,
        status: "waiting",
        targetScore: 200,
        turnDeadline: null,
        consecutiveNullRounds: 0,
        lastHandWinner: null,
        avatarUrls: ["", "", "", ""],
      },
      [],
      0,
      () => {
        // Placeholder send — replaced once WS is connected
      },
    );
  }

  // Stable send function that delegates to the current WS instance
  const send = useCallback((msg: WsClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    if (disabled || !matchId) return;

    unmountedRef.current = false;

    // Clear any pending reconnect timer
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    function connect() {
      // Don't reconnect if unmounted or match ended
      if (unmountedRef.current) return;
      const currentStatus = useGameStore.getState().game.status;
      if (currentStatus === "finished" || currentStatus === "abandoned") return;

      // Reset engine initialization flag for the new connection
      engineInitializedRef.current = false;

      const url = `${WS_BASE_URL}/ws/game/${matchId}/${playerId}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      // Wire the engine's send to the live WS instance
      engineRef.current?.setSend((msg: WsClientMessage) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(msg));
        }
      });

      setStatus("connecting");

      ws.onopen = () => {
        // Guard: only set connected if this WS is still the current one
        if (wsRef.current !== ws) return;
        // Success — reset backoff
        reconnectAttemptRef.current = 0;
        setStatus("connected");
      };

      ws.onmessage = (ev: MessageEvent) => {
        // Guard: ignore messages from a stale WS (old match's connection)
        if (wsRef.current !== ws) return;
        try {
          const msg: WsServerMessage = JSON.parse(ev.data);
          console.log("[ws] received:", msg.type, msg.events?.map(e => e.type).join(','), "hasState:", !!msg.state);

          if (msg.type === "game_events") {
            // Capture hand-scored data for the hand-over modal.
            const handScored = msg.events?.find(
              (e): e is { type: "hand_scored"; winningPair: 0 | 1; points: number; scores: [number, number] } =>
                e.type === "hand_scored",
            );
            if (handScored) {
              useGameStore.getState().setHandOver({
                winningPair: handScored.winningPair,
                points: handScored.points,
                scores: handScored.scores,
              });
            }

            // Capture match_abandoned event for leave-match flow
            const abandoned = msg.events?.find(
              (e): e is { type: "match_abandoned"; disconnectedPlayerId: string; disconnectedPlayerName?: string; reason: "abandonment" | "forfeit" } =>
                e.type === "match_abandoned",
            );
            if (abandoned) {
              console.log("[ws] match_abandoned received:", abandoned.disconnectedPlayerId, abandoned.disconnectedPlayerName ?? "", "by", playerId);
              // Store the player who caused abandonment (for overlay display)
              useGameStore.setState((s) => ({
                game: { ...s.game, matchAbandonedBy: abandoned.disconnectedPlayerId },
              }));
            }

            const sanitized = msg.state;
            if (sanitized) {
              const store = useGameStore.getState();

              // Compute the REAL playerIndex by finding this window's playerId
              // in the server's authoritative players array
              const playerIndex = sanitized.players.findIndex(
                (p) => p.id === playerId,
              );

              engineRef.current?.applyState(
                sanitized,
                msg.yourHand,
                playerIndex >= 0 ? playerIndex : undefined,
              );

              // On first message: wire engine to store, then sync
              if (!engineInitializedRef.current) {
                // biome-ignore lint/style/noNonNullAssertion: engineRef set before connect
                store.setEngine(engineRef.current!);
                engineInitializedRef.current = true;
              }

              store.applyWsUpdate(sanitized, msg.yourHand);
            }
          }
        } catch (err) {
          console.error("[ws] error processing message:", err, ev.data);
        }
      };

      ws.onclose = () => {
        // Guard: only update status if this WS is still the current one.
        // Without this guard, a stale old-match onclose can overwrite the
        // new connection's status after a navigate (e.g. abandon → lobby → new match).
        if (wsRef.current !== ws) return;
        wsRef.current = null;

        // Check if match is already over — don't reconnect
        const matchStatus = useGameStore.getState().game.status;
        if (matchStatus === "finished" || matchStatus === "abandoned") {
          setStatus("disconnected");
          return;
        }

        // Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s (cap)
        const attempt = reconnectAttemptRef.current;
        if (attempt < RECONNECT_MAX_ATTEMPTS) {
          const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
          console.log(`[ws] reconnecting in ${delay}ms (attempt ${attempt + 1}/${RECONNECT_MAX_ATTEMPTS})`);
          setStatus("connecting");
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            connect();
          }, delay);
          reconnectAttemptRef.current = attempt + 1;
        } else {
          console.log("[ws] max reconnect attempts reached, giving up");
          setStatus("disconnected");
        }
      };

      ws.onerror = () => {
        // onerror is always followed by onclose, so reconnect logic runs there
      };
    }

    connect();

    return () => {
      unmountedRef.current = true;

      // Cancel pending reconnect timer
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      // Close current WS
      const ws = wsRef.current;
      if (ws) {
        ws.close();
        // Only clear wsRef if it still points to this WS (avoids clearing a newer connection)
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
      }
    };
  }, [matchId, playerId, disabled]);

  return {
    status,
    send,
    engine: engineRef.current,
  };
}
