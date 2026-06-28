import { Elysia } from "elysia";

const app = new Elysia()
  .get("/health", () => ({ status: "ok" }))
  .ws("/echo", {
    open(ws) {
      console.log("OPEN: ws.data=", JSON.stringify(ws.data));
      ws.send(JSON.stringify({ type: "welcome", data: ws.data }));
    },
    message(ws, raw) {
      console.log("MSG raw:", raw.toString());
      ws.send(JSON.stringify({ type: "echo", data: raw.toString() }));
    },
    close(ws) {
      console.log("CLOSE: ws.data=", JSON.stringify(ws.data));
    },
  })
  .listen(3001);

console.log(`Listening on ${app.server?.hostname}:${app.server?.port}`);
