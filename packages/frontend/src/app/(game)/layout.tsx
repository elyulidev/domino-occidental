import type { ReactNode } from "react";

/**
 * Layout for the (game) route group.
 * Minimal — no sidebar/nav. The game page owns its full-screen layout.
 */
export default function GameLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
