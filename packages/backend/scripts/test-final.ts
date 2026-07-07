const WS_BASE = 'ws://localhost:3001';
const matchId = 'b9ce8c05-c0a9-43d4-bd70-9e46a58c4aaa';

async function main() {
  const players = [];
  for (let i = 0; i < 4; i++) {
    const pid = `p${i}`;
    const ws = new WebSocket(`${WS_BASE}/ws/game/${matchId}/${pid}`);
    await new Promise((resolve, reject) => {
      ws.onopen = () => { console.log(`${pid} connected`); resolve(); };
      ws.onerror = (e) => reject(e);
      setTimeout(() => reject(new Error(`timeout ${pid}`)), 5000);
    });
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.state) ws.__state = d.state;
      console.log(`${pid} msg: events=${d.events?.length ?? 0} hasState=${!!d.state} turn=${d.state?.currentTurn ?? '-'}`);
    };
    players.push(ws);
  }
  await new Promise(r => setTimeout(r, 500));
  const firstTurn = players[0].__state?.currentTurn;
  console.log(`\nFirst turn: ${firstTurn}`);
  players[firstTurn].send(JSON.stringify({ type: 'pass' }));
  await new Promise(r => setTimeout(r, 1500));
  console.log(`After pass: turn=${players[0].__state?.currentTurn} (was ${firstTurn})`);
  for (const ws of players) ws.close();
  console.log(firstTurn !== players[0].__state?.currentTurn ? 'SUCCESS' : 'FAIL');
}
main();
