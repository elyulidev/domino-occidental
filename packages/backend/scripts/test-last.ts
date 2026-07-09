const WS_BASE = "ws://localhost:3001";
const matchId = "dae41fe5-1e16-4938-b87a-4659f01ee956";
async function main() {
  const players = [];
  for (let i = 0; i < 4; i++) {
    const pid = `p${i}`;
    const ws = new WebSocket(`${WS_BASE}/ws/game/${matchId}/${pid}`);
    await new Promise((resolve, reject) => {
      ws.onopen = () => {
        console.log(`${pid} OK`);
        resolve();
      };
      ws.onerror = (e) => reject(e);
      setTimeout(() => reject("timeout"), 5000);
    });
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.state) ws.__s = d.state;
    };
    players.push(ws);
  }
  await new Promise((r) => setTimeout(r, 500));
  const t = players[0].__s?.currentTurn;
  console.log(`Turn: ${t}`);
  players[t].send(JSON.stringify({ type: "pass" }));
  await new Promise((r) => setTimeout(r, 1500));
  console.log(`After pass: ${players[0].__s?.currentTurn} (was ${t})`);
  for (const ws of players) ws.close();
}
main();
