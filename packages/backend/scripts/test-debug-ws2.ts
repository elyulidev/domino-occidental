const WS_BASE = 'ws://localhost:3001';
const matchId = '023e9e3f-e2e0-4957-b7e5-f445a7ecf4c9';

async function main() {
  const players = [];
  for (let i = 0; i < 4; i++) {
    const pid = 'p' + i;
    const ws = new WebSocket(WS_BASE + '/ws/game/' + matchId + '/' + pid);
    await new Promise((resolve, reject) => {
      ws.onopen = () => { console.log(pid + ' connected'); resolve(); };
      ws.onerror = (e) => reject(e);
      setTimeout(() => reject(new Error('timeout ' + pid)), 5000);
    });
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      console.log(pid + ' msg: type=' + d.type + ' events=' + (d.events?.length ?? 0) + ' currentTurn=' + (d.state?.currentTurn ?? '?'));
      ws.__state = d.state;
    };
    players.push(ws);
  }
  await new Promise(r => setTimeout(r, 500));

  const firstTurn = players[0].__state?.currentTurn;
  console.log('\nFirst turn: player ' + firstTurn);

  const p = players[firstTurn];
  console.log('Sending pass from p' + firstTurn);
  p.send(JSON.stringify({ type: 'pass' }));
  await new Promise(r => setTimeout(r, 1500));

  const newTurn = players[0].__state?.currentTurn;
  console.log('After pass, currentTurn: ' + newTurn);
  if (newTurn === firstTurn) console.log('TURN DID NOT CHANGE!');
  else console.log('Turn changed!');

  for (const ws of players) ws.close();
  console.log('Done');
}
main();
