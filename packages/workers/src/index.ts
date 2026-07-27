import type { Env } from "./types";
export { GameDO } from "./game-do";
export { MatchmakingDO } from "./matchmaking-do";

// ---------------------------------------------------------------------------
// URL patterns
// ---------------------------------------------------------------------------

const GAME_WS_RE = /^\/ws\/game\/([^/]+)$/;
const MATCHMAKING_WS_RE = /^\/ws\/matchmaking$/;
const MATCHMAKING_HTTP_RE = /^\/matchmaking\//;

// ---------------------------------------------------------------------------
// Worker entrypoint
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new Request(request).url;
    const path = new URL(url).pathname;

    // /ws/game/:matchId → GameDO
    const gameMatch = path.match(GAME_WS_RE);
    if (gameMatch) {
      const matchId = gameMatch[1];
      const id = env.GAME_DO.idFromName(matchId);
      const stub = env.GAME_DO.get(id);
      return stub.fetch(request);
    }

    // /ws/matchmaking → MatchmakingDO (singleton)
    if (MATCHMAKING_WS_RE.test(path)) {
      const id = env.MATCHMAKING_DO.idFromName("singleton");
      const stub = env.MATCHMAKING_DO.get(id);
      return stub.fetch(request);
    }

    // /matchmaking/* (HTTP) → MatchmakingDO (singleton)
    if (MATCHMAKING_HTTP_RE.test(path)) {
      const id = env.MATCHMAKING_DO.idFromName("singleton");
      const stub = env.MATCHMAKING_DO.get(id);
      return stub.fetch(request);
    }

    // 404 for everything else
    return Response.json({ error: "not_found" }, { status: 404 });
  },
};
