import { Elysia } from "elysia";
import { getGame, updateGame } from "./game/store";
import { createWsPlugin } from "./ws/connection";

const PORT = Number(Bun.env.PORT) || 3001;

const store = { getGame, updateGame };

const app = new Elysia()
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }))
  .ws("/ws/game/:matchId", createWsPlugin({ store }).ws)
  .listen(PORT);

console.log(`Backend running on http://${app.server?.hostname}:${PORT}`);
