"use client";

import { useQueueStatus } from "@/hooks/use-queue-status";

// ---------------------------------------------------------------------------
// Component — real-time queue status badge for the lobby
// ---------------------------------------------------------------------------

export function QueueStatusBadge() {
  const { queueCount, estimatedWait } = useQueueStatus(15_000);

  return (
    <div className="mt-3 flex flex-wrap gap-3">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-domino-700/50 px-3 py-1 text-xs text-domino-300">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        {queueCount} {queueCount === 1 ? "jugador" : "jugadores"} en cola
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-domino-700/50 px-3 py-1 text-xs text-domino-300">
        ⏱ ~{estimatedWait}s
      </span>
    </div>
  );
}
