const url = 'ws://localhost:3001/ws/game/__test-match-id/p0';
console.log('Connecting to:', url);
const ws = new WebSocket(url);
ws.onmessage = (e) => {
  const d = JSON.parse(e.data);
  console.log(`CLIENT msg: type=${d.type} events=${d.events?.length ?? 0} hasState=${!!d.state}`);
};
ws.onerror = (e) => console.log('ERR:', (e.message ?? 'unknown'));
ws.onclose = (e) => console.log('CLOSE:', e.code, e.reason);
ws.onopen = () => console.log('OPEN');
setTimeout(() => { ws.close(); process.exit(0); }, 5000);
