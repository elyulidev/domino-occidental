const url = 'ws://localhost:3001/ws/game/b22dae2d-7674-4db5-89d0-7faa9059f786/p0';
console.log('Connecting to:', url);
const ws = new WebSocket(url);

ws.onmessage = (e) => {
  console.log('CLIENT GOT:', e.data.substring(0, 200));
};
ws.onerror = (e) => console.log('ERR:', e.message);
ws.onclose = (e) => console.log('CLOSE:', e.code, e.reason);
ws.onopen = () => {
  console.log('OPEN');
  // Try sending a message
  ws.send(JSON.stringify({ type: 'pass' }));
};
setTimeout(() => {
  console.log('Timeout - closing');
  ws.close();
  process.exit(0);
}, 3000);
