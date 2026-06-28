const url = 'ws://localhost:3001/ws/game/3447e313-2232-45be-b56c-56eed4aead96/p0';
console.log('Connecting to:', url);
const ws = new WebSocket(url);
ws.onmessage = (e) => {
  const d = JSON.parse(e.data);
  console.log('MSG type=' + d.type + ' events=' + (d.events?.length ?? 0));
};
ws.onerror = (e) => console.log('ERR:', e.message);
ws.onclose = (e) => console.log('CLOSE:', e.code, e.reason);
ws.onopen = () => console.log('OPEN');
setTimeout(() => { ws.close(); process.exit(0); }, 3000);
