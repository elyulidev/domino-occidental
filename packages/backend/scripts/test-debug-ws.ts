const WS_BASE = "ws://localhost:3001";
const matchId = "7e22738e-5ff2-4014-afa8-5dfab2f4be8a";

async function main() {
  const players = [];

  for (let i = 0; i < 4; i++) {
    const pid = `p${i}`;
    const ws = new WebSocket(`${WS_BASE}/ws/game/${matchId}/${pid}`);
    await new Promise((resolve, reject) => {
      ws.onopen = () => {
        console.log(`${pid} connected`);
        resolve();
      };
      ws.onerror = (e) => reject(e);
      setTimeout(() => reject(new Error(`timeout ${pid}`)), 5000);
    });
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      console.log(
        pid +
          " msg: type=" +
          d.type +
          " events=" +
          (d.events?.length ?? 0) +
          " currentTurn=" +
          (d.state?.currentTurn ?? "?"),
      );
      ws.__state = d.state;
    };
    players.push(ws);
  }

  // Wait for initial states
  await new Promise((r) => setTimeout(r, 1000));

  // See the first turn
  const firstTurn = players[0].__state?.currentTurn;
  console.log(`\nFirst turn: player ${firstTurn}`);

  // Send pass from first player
  const p = players[firstTurn];
  console.log(`Sending pass from p${firstTurn}`);
  p.send(JSON.stringify({ type: "pass" }));

  // Wait for response
  await new Promise((r) => setTimeout(r, 2000));

  const newTurn = players[0].__state?.currentTurn;
  console.log(`After pass, currentTurn: ${newTurn}`);
  if (newTurn === firstTurn) console.log("TURN DID NOT CHANGE!");

  for (const ws of players) ws.close();
  console.log("Done");
}
main();
