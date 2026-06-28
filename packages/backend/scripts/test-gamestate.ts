/**
 * GameState E2E Test — connects 4 WebSocket clients, plays through a hand,
 * and validates all GameState transitions.
 *
 * Usage: bun run scripts/test-gamestate.ts
 */

const BASE = "http://localhost:3001";
const WS_BASE = "ws://localhost:3001";

// ---------------------------------------------------------------------------
// 1. Create a match
// ---------------------------------------------------------------------------
console.log("\n=== 1. Creating match ===");
const { matchId } = await fetch(`${BASE}/api/v1/dev/create-match`, {
  method: "POST",
}).then((r) => r.json());
console.log(`Match ID: ${matchId}`);

// ---------------------------------------------------------------------------
// 2. Connect 4 players
// ---------------------------------------------------------------------------
console.log("\n=== 2. Connecting 4 players ===");

interface Player {
  id: string;
  ws: WebSocket;
  state: any; // latest sanitized state
  buffer: any[]; // buffered messages not yet processed
  resolveQueue: Array<(msg: any) => void>; // pending waitForMessage resolvers
}

const players: Player[] = [];

for (let i = 0; i < 4; i++) {
  const playerId = `p${i}`;
  const ws = new WebSocket(`${WS_BASE}/ws/game/${matchId}/${playerId}`);

  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = (e) => reject(e);
    setTimeout(() => reject(new Error("WS connection timeout")), 5000);
  });

  const p: Player = {
    id: playerId,
    ws,
    state: null,
    buffer: [],
    resolveQueue: [],
  };

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    // Store latest state
    if (msg.state) p.state = msg.state;
    // If someone is waiting, resolve them; otherwise buffer
    if (p.resolveQueue.length > 0) {
      const resolve = p.resolveQueue.shift()!;
      resolve(msg);
    } else {
      p.buffer.push(msg);
    }
  };

  players.push(p);
}

// Helper: wait for the next message from a player
function waitForMsg(p: Player): Promise<any> {
  if (p.buffer.length > 0) {
    return Promise.resolve(p.buffer.shift()!);
  }
  return new Promise((resolve) => {
    p.resolveQueue.push(resolve);
  });
}

// Consume initial state messages for all 4
for (const p of players) {
  const msg = await waitForMsg(p);
  console.log(`  ${p.id} connected — handSize=${p.state?.players.find((pl: any) => pl.id === p.id)?.handSize}`);
}
console.log("  ✅ All 4 connected with initial state");

// ---------------------------------------------------------------------------
// 3. Verify initial GameState
// ---------------------------------------------------------------------------
console.log("\n=== 3. Validating initial GameState ===");

const s = players[0].state;
console.assert(s.matchId === matchId, `matchId: ${s.matchId}`);
console.assert(s.players.length === 4, "4 players");
console.assert(s.board.leftEnd === null, "empty board");
console.assert(s.board.rightEnd === null, "empty board");
console.assert(s.board.tiles.length === 0, "no tiles on board");
console.assert(typeof s.currentTurn === "number", `currentTurn=${s.currentTurn}`);
console.assert(s.poolCount === 15, `poolCount=${s.poolCount}`);
console.assert(s.scores[0] === 0 && s.scores[1] === 0, "scores 0-0");
console.assert(s.status === "in_progress", "status=in_progress");
console.assert(s.targetScore === 200, "targetScore=200");

// Hand sizes should be 10 for all players
for (let i = 0; i < 4; i++) {
  const own = s.players.find((pl: any) => pl.id === `p${i}`);
  console.assert(own.handSize === 10, `p${i} handSize=${own.handSize}`);
}
console.log("  ✅ Initial GameState valid");

// ---------------------------------------------------------------------------
// 4. Game flow: first turn — pass all players until hand ends
// ---------------------------------------------------------------------------
console.log("\n=== 4. Playing through (all pass — blocked detection) ===");

let turnPlayerIndex = s.currentTurn;
let roundsPlayed = 0;
const MAX_ROUNDS = 10;

while (roundsPlayed < MAX_ROUNDS) {
  const p = players[turnPlayerIndex];

  // Clear stale buffered messages from PREVIOUS player's broadcasts
  p.buffer.length = 0;

  // Send pass
  console.log(`  ${p.id} passes...`);
  p.ws.send(JSON.stringify({ type: "pass" }));

  // Wait for p's own response (the rest of the loop saw p's own broadcast)
  const response = await waitForMsg(p);
  const state = p.state;

  // Check for hand/match end
  const isHandEnd = response.events?.some((e: any) => e.type === "hand_ended");
  const isMatchEnd = state?.status === "finished";

  if (state) {
    console.log(`    → turn=${state.currentTurn} scores=[${state.scores}] status=${state.status}`);
    turnPlayerIndex = state.currentTurn;
  }

  if (isMatchEnd) {
    console.log(`\n  Match ended! Final: ${JSON.stringify(state?.scores)}`);
    break;
  }

  if (isHandEnd) {
    roundsPlayed++;
    console.log(`  Hand ${roundsPlayed} ended. scores=[${state?.scores}]`);

    if (roundsPlayed >= MAX_ROUNDS) {
      console.log("  ⏱ Max rounds reached");
      break;
    }

    // Wait for the subsequent round_started event to reach all players
    await new Promise((r) => setTimeout(r, 300));
    const newState = players[0].state;
    turnPlayerIndex = newState?.currentTurn ?? 0;
  }
}

// ---------------------------------------------------------------------------
// 5. Summary
// ---------------------------------------------------------------------------
console.log(`\n=== Summary ===`);
const final = players[0].state;
console.log(`  Match status: ${final?.status}`);
console.log(`  Final scores: [${final?.scores}]`);
console.log(`  Rounds played: ${roundsPlayed}`);
console.log(`  Board tiles: ${final?.board?.tiles?.length ?? 0}`);

if (final?.status === "finished") {
  const winner = final.scores[0] > final.scores[1] ? "Pair 0" : "Pair 1";
  console.log(`  🏆 Winner: ${winner} (${Math.max(...final.scores)} pts)`);
}

// ---------------------------------------------------------------------------
// 6. Cleanup
// ---------------------------------------------------------------------------
for (const p of players) p.ws.close();
console.log("\n✅ Test complete");

export {};
