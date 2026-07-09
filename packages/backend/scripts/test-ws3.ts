const url =
  "ws://localhost:3001/ws/game/96034f1d-e41d-4eeb-9595-10fc235f4f77/p0";
console.log("Connecting to:", url);
const ws = new WebSocket(url);
ws.onmessage = (e) => {
  const d = JSON.parse(e.data);
  console.log(
    "MSG type=" +
      d.type +
      " events=" +
      (d.events?.length ?? 0) +
      " state=" +
      (d.state ? "yes" : "no"),
  );
  if (d.state)
    console.log(
      "  players:",
      d.state.players.map((p) => `${p.handSize} tiles`),
    );
};
ws.onerror = (e) => console.log("ERR:", e.message);
ws.onclose = (e) => console.log("CLOSE:", e.code, e.reason);
ws.onopen = () => console.log("OPEN");
setTimeout(() => {
  ws.close();
  process.exit(0);
}, 3000);
