const WS_BASE = 'ws://localhost:3001';
const matchId = 'cd29f7c7-7a73-4ee6-a5bb-2577fb3d4b9d';

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
      console.log(`${pid} msg: type=${d.type} events=${d.events?.length ?? 0} turn=${d.state?.currentTurn ?? '-'}`);
    };
    players.push(ws);
  }
  await new Promise(r => setTimeout(r, 500));

  const firstTurn = players[0].__state?.currentTurn;
  console.log(`\nFirst turn: player ${firstTurn}`);

  const sender = players[firstTurn];
  console.log(`Sending pass from p${firstTurn}`);
  sender.send(JSON.stringify({ type: 'pass' }));
  await new Promise(r => setTimeout(r, 1500));

  console.log(`p0 state: turn=${players[0].__state?.currentTurn} scores=${JSON.stringify(players[0].__state?.scores)}`);
  console.log(`p2 state: turn=${players[2].__state?.currentTurn}`);

  const newTurn = players[0].__state?.currentTurn;
  const turnChanged = newTurn !== firstTurn;
  console.log(`\nTurn changed: ${turnChanged} (was ${firstTurn}, now ${newTurn})`);

  for (const ws of players) ws.close();
  console.log(turnChanged ? 'SUCCESS' : 'FAIL - turn did not advance');
}
main();
