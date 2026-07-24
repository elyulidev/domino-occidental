"use client";

import { useOnlineCount } from "@/hooks/use-online-count";

// ---------------------------------------------------------------------------
// Component — online users count badge for the lobby
// ---------------------------------------------------------------------------

export function QueueStatusBadge() {
  const onlineCount = useOnlineCount(60_000);

  return (
    <div className="mt-3">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-domino-700/50 px-3 py-1 text-xs text-domino-300">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        {onlineCount} jugadores online
      </span>
    </div>
  );
}
