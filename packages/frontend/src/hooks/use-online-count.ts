"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Hook — polls Supabase for the count of online users (status != 'offline')
// Updates every `intervalMs` (default: 60 seconds)
// ---------------------------------------------------------------------------

export function useOnlineCount(intervalMs = 60_000): number {
  const [count, setCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const supabase = createBrowserClient();

  useEffect(() => {
    let cancelled = false;

    async function fetchCount() {
      try {
        const { count: onlineCount, error } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .neq("status", "offline");

        if (!cancelled && !error && onlineCount !== null) {
          setCount(onlineCount);
        }
      } catch {
        // Silent — server might be down or user not authenticated
      }
    }

    // Initial fetch
    fetchCount();

    // Poll
    intervalRef.current = setInterval(fetchCount, intervalMs);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [intervalMs, supabase]);

  return count;
}
