import { describe, expect, it } from "bun:test";
import { LocalGameEngine } from "../local-engine";
import { createDeck, shuffle, deal, initializeMatch, startHand } from "@domino/shared/src/game";
import { setCurrentTurn } from "@domino/shared/src/game";
import type { MatchState, Tile } from "@domino/shared";

function createTestEngine(): LocalGameEngine {
  const deck = shuffle(createDeck());
  const { hands, pool } = deal(deck);
  const matchResult = initializeMatch("test-match", hands, pool);
  let handResult = startHand(matchResult.match);
  // Force turn to player 0 (human) so tests are deterministic
  const forcedTurn = setCurrentTurn(handResult.match.turn, 0);
  // Connect ALL players (bots need isConnected=true or processBotTurns will infinite-loop)
  const connectedPlayers = handResult.match.players.map((p) => ({
    ...p,
    isConnected: true,
  })) as MatchState["players"];
  const match = { ...handResult.match, players: connectedPlayers, turn: forcedTurn };
  return new LocalGameEngine(match, 0);
}

describe("LocalGameEngine", () => {
  it("initializes with player 0 as the human", () => {
    const engine = createTestEngine();
    expect(engine.playerIndex).toBe(0);
    engine.destroy();
  });

  it("exposes the current match state", () => {
    const engine = createTestEngine();
    expect(engine.state).toBeDefined();
    expect(engine.state.matchId).toBe("test-match");
    expect(engine.state.status).toBe("in_progress");
    engine.destroy();
  });

  it("exposes the human player's hand with 10 tiles", () => {
    const engine = createTestEngine();
    expect(engine.hand).toHaveLength(10);
    engine.destroy();
  });

  it("playTile returns tile_played event and updated match", () => {
    const engine = createTestEngine();
    const tile = engine.hand[0];
    const result = engine.playTile(tile.id, "left");
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events[0].type).toBe("tile_played");
    expect(result.match.board.tiles).toHaveLength(1);
    engine.destroy();
  });

  it("playTile removes the tile from the human hand", () => {
    const engine = createTestEngine();
    const tile = engine.hand[0];
    const initialLength = engine.hand.length;
    engine.playTile(tile.id, "left");
    expect(engine.hand).toHaveLength(initialLength - 1);
    expect(engine.hand.some((t) => t.id === tile.id)).toBe(false);
    engine.destroy();
  });

  it("playTile advances turn away from human", () => {
    const engine = createTestEngine();
    const tile = engine.hand[0];
    engine.playTile(tile.id, "left");
    // Turn advanced to next player (bot)
    expect(engine.state.turn.currentTurn).not.toBe(0);
    engine.destroy();
  });

  it("processBotTurns resolves all bot turns back to human", () => {
    const engine = createTestEngine();
    engine.playTile(engine.hand[0].id, "left");
    const currentTurn = engine.state.turn.currentTurn;
    expect(currentTurn).not.toBe(0); // it's a bot's turn

    const finalState = engine.processBotTurns();
    expect(finalState.turn.currentTurn).toBe(0);
    engine.destroy();
  });

  it("processBotTurns returns immediately if it's already human's turn", () => {
    const engine = createTestEngine();
    // No human action yet — human's turn
    const state = engine.processBotTurns();
    expect(state.turn.currentTurn).toBe(0);
    engine.destroy();
  });

  it("processBotTurns updates board and hand state after bot moves", () => {
    const engine = createTestEngine();
    const tile = engine.hand[0];
    engine.playTile(tile.id, "left");
    const beforeCount = engine.state.board.tiles.length;

    engine.processBotTurns();
    // Bots should have played or passed, potentially adding to board
    expect(engine.state.turn.currentTurn).toBe(0);
    // At minimum, human's tile is still on the board
    expect(engine.state.board.tiles.length).toBeGreaterThanOrEqual(beforeCount);
    engine.destroy();
  });

  it("pass returns player_passed event", () => {
    const engine = createTestEngine();
    // Force a blocked situation: set board to values that no hand tile matches
    // Actually, on empty board any tile is playable, so let's just verify pass works
    // by directly testing the passTurn path via the engine
    const result = engine.pass();
    expect(result.events.some((e) => e.type === "player_passed")).toBe(true);
    engine.destroy();
  });

  it("pass advances turn away from human", () => {
    const engine = createTestEngine();
    engine.pass();
    expect(engine.state.turn.currentTurn).not.toBe(0);
    engine.destroy();
  });

  it("destroy can be called multiple times without throwing", () => {
    const engine = createTestEngine();
    engine.destroy();
    expect(() => engine.destroy()).not.toThrow();
  });

  it("playTile on invalid tile returns game_error event", () => {
    const engine = createTestEngine();
    const result = engine.playTile("nonexistent-tile-id", "left");
    expect(result.events.some((e) => e.type === "game_error")).toBe(true);
    engine.destroy();
  });

  it("match state reflects board after playTile", () => {
    const engine = createTestEngine();
    const tile = engine.hand[0];
    engine.playTile(tile.id, "left");
    expect(engine.state.board.tiles).toHaveLength(1);
    expect(engine.state.board.tiles[0].tile.id).toBe(tile.id);
    engine.destroy();
  });

  it("hand reference stays in sync with state", () => {
    const engine = createTestEngine();
    const handBefore = engine.hand.length;
    const tile = engine.hand[0];
    engine.playTile(tile.id, "left");
    expect(engine.hand).toBe(engine.state.players[0].hand);
    expect(engine.hand.length).toBe(handBefore - 1);
    engine.destroy();
  });
});
