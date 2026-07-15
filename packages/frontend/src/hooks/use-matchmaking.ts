"use client";

import type { MatchFoundPayload } from "@domino/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MatchmakingStatus = "idle" | "queued" | "matched" | "error";

export interface UseMatchmakingReturn {
  joinQueue: () => Promise<void>;
  leaveQueue: () => Promise<void>;
  status: MatchmakingStatus;
  queuePosition: number | null;
  waitTimeMs: number;
  queueCount: number;
  matchId: string | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMatchmaking(): UseMatchmakingReturn {
  const [status, setStatus] = useState<MatchmakingStatus>("idle");
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [waitTimeMs, setWaitTimeMs] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const waitIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusRef = useRef<MatchmakingStatus>("idle");
  const supabase = createBrowserClient();

  // Keep ref in sync with state
  statusRef.current = status;

  // --- Cleanup helper (closes WS + interval, no server call) ---
  const cleanupResources = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (waitIntervalRef.current) {
      clearInterval(waitIntervalRef.current);
      waitIntervalRef.current = null;
    }
  }, []);

  // --- Connect WS for matchmaking notifications ---
  const connectWs = useCallback(
    (userId: string, token: string) => {
      const ws = new WebSocket(
        `${WS_BASE_URL}/ws/matchmaking/${userId}?token=${token}`,
      );

      ws.onmessage = (ev: MessageEvent) => {
        try {
          const msg = JSON.parse(ev.data);

          if (msg.type === "match_found") {
            const payload = msg as MatchFoundPayload;
            setMatchId(payload.matchId);
            setStatus("matched");
            cleanupResources();

            // Redirect to match
            window.location.href = `/match/${payload.matchId}`;
          } else if (msg.type === "queue_position_update") {
            setQueuePosition(msg.position);
            setQueueCount(msg.queueCount);
          } else if (msg.type === "match_cancelled") {
            setStatus("idle");
            setQueuePosition(null);
            setError("Match cancelled — re-queueing...");
            cleanupResources();
            // Auto re-join after short delay
            setTimeout(() => {
              setError(null);
            }, 2000);
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
      };

      ws.onerror = () => {
        // onerror is always followed by onclose
      };

      wsRef.current = ws;
    },
    [cleanupResources],
  );

  // --- Start wait time counter ---
  const startWaitCounter = useCallback(() => {
    setWaitTimeMs(0);
    waitIntervalRef.current = setInterval(() => {
      setWaitTimeMs((prev) => prev + 1000);
    }, 1000);
  }, []);

  // --- Join queue ---
  const joinQueue = useCallback(async () => {
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setError("Not authenticated");
      return;
    }

    try {
      const res = await fetch("/api/v1/matchmaking/quick", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 409) {
          setError("Already in queue");
        } else {
          setError("Failed to join queue");
        }
        return;
      }

      const data = await res.json();

      setStatus("queued");
      setQueuePosition(data.position ?? null);
      setQueueCount(data.queueCount ?? 0);

      startWaitCounter();
      connectWs(session.user.id, session.access_token);
    } catch {
      setError("Failed to join queue — is the server running?");
    }
  }, [supabase, startWaitCounter, connectWs]);

  // --- Leave queue ---
  const leaveQueue = useCallback(async () => {
    cleanupResources();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      await fetch("/api/v1/matchmaking/leave", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }).catch(() => {
        // Best-effort — even if leave fails, we reset local state
      });
    }

    setStatus("idle");
    setQueuePosition(null);
    setWaitTimeMs(0);
    setQueueCount(0);
    setMatchId(null);
    setError(null);
  }, [supabase, cleanupResources]);

  // --- Cleanup on unmount: leave queue if still queued ---
  useEffect(() => {
    return () => {
      if (statusRef.current === "queued") {
        // Fire-and-forget server leave on unmount
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.access_token) {
            fetch("/api/v1/matchmaking/leave", {
              method: "POST",
              headers: { Authorization: `Bearer ${session.access_token}` },
            }).catch(() => {});
          }
        });
      }
      cleanupResources();
    };
  }, [supabase, cleanupResources]);

  return {
    joinQueue,
    leaveQueue,
    status,
    queuePosition,
    waitTimeMs,
    queueCount,
    matchId,
    error,
  };
}
