/**
 * Minimal WS test — path-based playerId.
 */
const BASE = "http://localhost:3001";
const WS_BASE = "ws://localhost:3001";

const { matchId } = await fetch(`${BASE}/api/v1/dev/create-match`, {
  method: "POST",
}).then((r) => r.json());
console.log("Match:", matchId);

// playerId goes in the PATH, not query
const url = `${WS_BASE}/ws/game/${matchId}/p0`;
console.log("Connecting to:", url);
const ws = new WebSocket(url);

ws.onmessage = (e) => {
  const data = JSON.parse(e.data);
  console.log("MESSAGE received:");
  console.log("  type:", data.type);
  console.log("  has state:", !!data.state);
  console.log("  events:", data.events?.length);
  if (data.state) {
    console.log("  state.matchId:", data.state.matchId);
    console.log("  state.players:", data.state.players.map((p: { id: string; handSize: number }) => `${p.id}(sz=${p.handSize})`));
    console.log("  state.currentTurn:", data.state.currentTurn);
  }
};

ws.onerror = (e: Event) => console.log("Error:", (e as ErrorEvent).message || e);
ws.onclose = (e) => console.log("Close:", e.code, e.reason);

await new Promise<void>((resolve, reject) => {
  ws.onopen = () => {
    console.log("Connected! Waiting 3s for messages...");
    resolve();
  };
  setTimeout(() => reject(new Error("connect timeout")), 5000);
});

await new Promise((r) => setTimeout(r, 3000));
console.log("\nDone - closing");
ws.close();
