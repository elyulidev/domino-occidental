"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueueStatus {
  queueCount: number;
  estimatedWait: number; // seconds
}

// ---------------------------------------------------------------------------
// Hook — polls GET /matchmaking/status every `intervalMs`
// ---------------------------------------------------------------------------

export function useQueueStatus(intervalMs = 2_000): QueueStatus {
  const [status, setStatus] = useState<QueueStatus>({
    queueCount: 0,
    estimatedWait: 0,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const supabase = createBrowserClient();

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const res = await fetch("/api/v1/matchmaking/status", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;

        const data = await res.json();
        if (!cancelled) {
          setStatus({
            queueCount: data.queueCount ?? 0,
            estimatedWait: data.estimatedWait ?? 0,
          });
        }
      } catch {
        // Silent — server might be down
      }
    }

    // Initial fetch
    fetchStatus();

    // Poll
    intervalRef.current = setInterval(fetchStatus, intervalMs);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [intervalMs, supabase]);

  return status;
}
