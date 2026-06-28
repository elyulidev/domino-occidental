const ws = new WebSocket('ws://localhost:3001/echo');
ws.onopen = () => { console.log('OPEN'); ws.send(JSON.stringify({hello:'world'})); };
ws.onmessage = (e) => console.log('MSG:', e.data.substring(0, 200));
ws.onerror = (e) => console.log('ERR:', e.message);
ws.onclose = (e) => console.log('CLOSE:', e.code);
setTimeout(() => process.exit(0), 3000);
