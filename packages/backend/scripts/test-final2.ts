const WS_BASE = "ws://localhost:3001";
const matchId = "2a3612f0-e7c7-4948-b733-7812292e0e39";

async function main() {
  const ps = [];
  for (let i = 0; i < 4; i++) {
    const pid = `p${i}`;
    const ws = new WebSocket(`${WS_BASE}/ws/game/${matchId}/${pid}`);
    await new Promise((r, j) => {
      ws.onopen = () => r();
      ws.onerror = (e) => j(e);
      setTimeout(() => j("timeout"), 5000);
    });
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.state) ws.__s = d.state;
      console.log(
        pid +
          " msg: ev=" +
          (d.events?.length ?? 0) +
          " st=" +
          !!d.state +
          " t=" +
          (d.state?.currentTurn ?? "-") +
          " e0=" +
          (d.events?.[0]?.type ?? "-"),
      );
    };
    ps.push(ws);
  }
  await new Promise((r) => setTimeout(r, 500));
  const t = ps[0].__s?.currentTurn;
  console.log(`\nTurn: ${t}`);
  ps[t].send(JSON.stringify({ type: "pass" }));
  await new Promise((r) => setTimeout(r, 2000));
  const nt = ps[0].__s?.currentTurn;
  console.log(`After: ${nt} (was ${t}) ${nt !== t ? "CHANGED" : "SAME"}`);
  for (const w of ps) w.close();
}
main();
