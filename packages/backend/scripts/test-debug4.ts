const WS_BASE = 'ws://localhost:3001';
const matchId = '2423b8ae-0775-4a7f-9aeb-3c601bd3038f';

async function connect(pid) {
  const ws = new WebSocket(WS_BASE + '/ws/game/' + matchId + '/' + pid);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = (e) => j(e); setTimeout(() => j('timeout'), 5000); });
  ws.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.state) ws.__s = d.state;
    const evTypes = d.events.map(e => e.type + (e.code ? '(' + e.code + ')' : '')).join(',');
    ws.__last = 'ev=' + d.events.length + ' [' + evTypes + '] st=' + (!!d.state) + ' t=' + (d.state?.currentTurn ?? '-');
  };
  return ws;
}

async function main() {
  const p0 = await connect('p0'), p1 = await connect('p1'), p2 = await connect('p2'), p3 = await connect('p3');
  const ps = [p0, p1, p2, p3];
  await new Promise(r => setTimeout(r, 300));

  for (let round = 0; round < 8; round++) {
    const turn = ps[0].__s?.currentTurn;
    if (turn === undefined) break;
    const p = ps[turn];
    p.send(JSON.stringify({ type: 'pass' }));
    await new Promise(r => setTimeout(r, 300));
    console.log('R' + round + ': p' + turn + ' pass -> ' + p.__last + ' (p0 sees t=' + ps[0].__s?.currentTurn + ')');
  }
  for (const w of ps) w.close();
}
main();
