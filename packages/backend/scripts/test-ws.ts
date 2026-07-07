const url = 'ws://localhost:3001/ws/game/ecc14c19-6d6c-4299-bae5-207fb2c68aee/p0';
console.log('Connecting to:', url);
const ws = new WebSocket(url);
ws.onmessage = (_e) => console.log('MSG');
ws.onerror = (e) => console.log('ERR:', e.message);
ws.onclose = (e) => console.log('CLOSE:', e.code, e.reason);
ws.onopen = () => console.log('OPEN');
setTimeout(() => { ws.close(); process.exit(0); }, 3000);
