import { describe, expect, it } from "bun:test";
import type {
  SanitizedMatchState,
  Tile,
  WsServerMessage,
} from "@domino/shared";
import { createDeck, deal, shuffle } from "@domino/shared/src/game/deck";
import { initializeMatch, startHand } from "@domino/shared/src/game/match";
import { Elysia } from "elysia";
import { createWsPlugin } from "../../ws/connection";
import { createGame, getGame, updateGame } from "../store";

// ---------------------------------------------------------------------------
// Test server — lightweight Elysia instance with the same routes as server.ts
// ---------------------------------------------------------------------------

const PORT = 30_000 + Math.floor(Math.random() * 1000);
const store = { getGame, updateGame };

const app = new Elysia()
  .post("/api/v1/dev/create-match", () => {
    const deck = shuffle(createDeck());
    const { hands, pool } = deal(deck);

    const matchId = crypto.randomUUID();
    let { match } = initializeMatch(matchId, hands, pool);

    const handResult = startHand(match);
    match = handResult.match;

    createGame(matchId, match);

    return { matchId };
  })
  .ws(
    "/ws/game/:matchId/:playerId",
    // biome-ignore lint/suspicious/noExplicitAny: Elysia WS handler type mismatch with WsPlugin.ws shape
    createWsPlugin({ store }).ws as any,
  )
  .listen(PORT);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function waitForMessage(
  ws: WebSocket,
  timeoutMs = 3000,
): Promise<WsServerMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timeout waiting for WS message")),
      timeoutMs,
    );
    const handler = (ev: MessageEvent) => {
      clearTimeout(timer);
      ws.removeEventListener("message", handler);
      resolve(JSON.parse(ev.data as string));
    };
    ws.addEventListener("message", handler);
  });
}

/**
 * Reads WS messages until a predicate is satisfied, then returns that message.
 * Discards all messages that don't match. Throws on timeout.
 */
async function waitForMessageWhere(
  ws: WebSocket,
  predicate: (msg: WsServerMessage) => boolean,
  timeoutMs = 5000,
): Promise<WsServerMessage> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const remaining = Math.max(500, deadline - Date.now());
    const msg = await waitForMessage(ws, remaining);
    if (predicate(msg)) return msg;
  }
  throw new Error(
    `Timeout waiting for message matching predicate after ${timeoutMs}ms`,
  );
}

function waitForOpen(ws: WebSocket, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }
    const timer = setTimeout(
      () => reject(new Error("Timeout waiting for WS open")),
      timeoutMs,
    );
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function closeWs(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (
      ws.readyState === WebSocket.CLOSED ||
      ws.readyState === WebSocket.CLOSING
    ) {
      resolve();
      return;
    }
    ws.addEventListener("close", () => resolve(), { once: true });
    ws.close();
  });
}

// ---------------------------------------------------------------------------
// Integration test
// ---------------------------------------------------------------------------

describe("Full integration: create match → connect WS → play tile", () => {
  let matchId: string;

  it("creates a match via dev endpoint", async () => {
    const res = await app.handle(
      new Request(`http://localhost:${PORT}/api/v1/dev/create-match`, {
        method: "POST",
      }),
    );
    const body = (await res.json()) as { matchId: string };
    matchId = body.matchId;
    expect(matchId).toBeDefined();
    expect(typeof matchId).toBe("string");
    expect(matchId.length).toBeGreaterThan(0);
  });

  it("connects via WebSocket and receives initial game_events", async () => {
    const ws = new WebSocket(
      `ws://localhost:${PORT}/ws/game/${matchId}/p0`,
    );
    await waitForOpen(ws);

    try {
      const msg = await waitForMessage(ws);

      // Should be game_events envelope
      expect(msg.type).toBe("game_events");

      // Should include state
      expect(msg.state).toBeDefined();
      const state = msg.state as SanitizedMatchState;
      expect(state.status).toBe("in_progress");
      expect(state.players).toHaveLength(4);
      expect(state.players[0].handSize).toBe(10);

      // Should include yourHand for this player
      expect(msg.yourHand).toBeDefined();
      expect(msg.yourHand).toHaveLength(10);

      // yourHand tiles should have valid structure
      for (const tile of msg.yourHand as Tile[]) {
        expect(tile.id).toBeDefined();
        expect(typeof tile.top).toBe("number");
        expect(typeof tile.bottom).toBe("number");
      }

      // Board should be empty initially
      expect(state.board.tiles).toHaveLength(0);
      expect(state.board.leftEnd).toBeNull();
      expect(state.board.rightEnd).toBeNull();
    } finally {
      await closeWs(ws);
    }
  });

  it("plays a tile and receives updated game_events with board (including bot turns)", async () => {
    // Step 1: Connect as p0 to discover whose turn it is
    const probe = new WebSocket(
      `ws://localhost:${PORT}/ws/game/${matchId}/p0`,
    );
    await waitForOpen(probe);
    const probeMsg = await waitForMessage(probe);
    const probeState = probeMsg.state as SanitizedMatchState;
    const activePlayerIndex = probeState.currentTurn;
    await closeWs(probe);

    // Step 2: Connect as the active player
    const playerId = `p${activePlayerIndex}`;
    const ws = new WebSocket(
      `ws://localhost:${PORT}/ws/game/${matchId}/${playerId}`,
    );
    await waitForOpen(ws);

    try {
      // Receive initial state for this player
      const initialMsg = await waitForMessage(ws);
      expect(initialMsg.type).toBe("game_events");
      const yourHand = initialMsg.yourHand as Tile[];
      expect(yourHand.length).toBe(10);

      // Find a playable tile — for the first move, any tile works (empty board)
      const tileToPlay = yourHand[0];

      // Play the tile on the right side
      ws.send(
        JSON.stringify({
          type: "play_tile",
          tileId: tileToPlay.id,
          side: "right",
        }),
      );

      // Wait for game_events response from the server
      const response = await waitForMessage(ws);

      expect(response.type).toBe("game_events");

      // Response should include updated state
      expect(response.state).toBeDefined();
      const newState = response.state as SanitizedMatchState;

      // Board should now have the human tile + bot tiles
      // (bots play automatically after the human's move)
      expect(newState.board.tiles.length).toBeGreaterThanOrEqual(1);

      // The human's played tile should be on the board
      const humanTile = newState.board.tiles.find(
        (t) => t.tile.id === tileToPlay.id,
      );
      expect(humanTile).toBeDefined();
      expect(humanTile?.side).toBe("right");
      expect(humanTile?.playerId).toBe(playerId);

      // Board ends should be set
      expect(newState.board.rightEnd).not.toBeNull();

      // Player's hand should now have 9 tiles (only the human played)
      expect(newState.players[activePlayerIndex].handSize).toBe(9);
    } finally {
      await closeWs(ws);
    }
  });

  it("receives tile_played event in the events array after human play with bot turns", async () => {
    // Create a fresh match for this test to avoid state leakage
    const res = await app.handle(
      new Request(`http://localhost:${PORT}/api/v1/dev/create-match`, {
        method: "POST",
      }),
    );
    const { matchId: freshMatchId } = (await res.json()) as {
      matchId: string;
    };

    // Discover active player from initial state
    const probe = new WebSocket(
      `ws://localhost:${PORT}/ws/game/${freshMatchId}/p0`,
    );
    await waitForOpen(probe);
    const probeMsg = await waitForMessage(probe);
    const probeState = probeMsg.state as SanitizedMatchState;
    const activePlayerIndex = probeState.currentTurn;
    await closeWs(probe);

    const playerId = `p${activePlayerIndex}`;
    const ws = new WebSocket(
      `ws://localhost:${PORT}/ws/game/${freshMatchId}/${playerId}`,
    );
    await waitForOpen(ws);

    try {
      // Receive initial state + yourHand
      const initialMsg = await waitForMessage(ws);
      expect(initialMsg.type).toBe("game_events");
      const yourHand = initialMsg.yourHand as Tile[];
      const tileToPlay = yourHand[0];

      // Play the tile
      ws.send(
        JSON.stringify({
          type: "play_tile",
          tileId: tileToPlay.id,
          side: "left",
        }),
      );

      // The server may send bot events (from runBotTurnsOnOpen or from
      // executeBotTurns after the human's play) as separate WS messages.
      // Read messages until we find the human's tile_played event.
      const msg = await waitForMessageWhere(
        ws,
        (m) =>
          m.type === "game_events" &&
          m.events.some(
            (e) => e.type === "tile_played" && e.playerId === playerId,
          ),
        5000,
      );
      expect(msg.type).toBe("game_events");

      // The human's tile_played should be in this message's events
      const tilePlayedEvent = msg.events.find(
        (e) => e.type === "tile_played" && e.playerId === playerId,
      );
      expect(tilePlayedEvent).toBeDefined();
      if (tilePlayedEvent?.type === "tile_played") {
        expect(tilePlayedEvent.tileId).toBe(tileToPlay.id);
        expect(tilePlayedEvent.side).toBe("left");
      }

      // Board should reflect all plays (human + bots)
      const state = msg.state as SanitizedMatchState;
      expect(state.board.tiles.length).toBeGreaterThanOrEqual(1);

      // Human's tile should be on the board
      const humanTile = state.board.tiles.find(
        (t) => t.tile.id === tileToPlay.id,
      );
      expect(humanTile).toBeDefined();
    } finally {
      await closeWs(ws);
    }
  });
});
