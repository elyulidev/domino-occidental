import { describe, expect, it } from "bun:test";
import type { MatchState } from "@domino/shared";
import {
  createDeck,
  deal,
  initializeMatch,
  setCurrentTurn,
  shuffle,
  startHand,
} from "@domino/shared/src/game";
import { LocalGameEngine } from "../local-engine";

function createTestEngine(): LocalGameEngine {
  const deck = shuffle(createDeck());
  const { hands, pool } = deal(deck);
  const matchResult = initializeMatch("test-match", hands, pool);
  const handResult = startHand(matchResult.match);
  // Force turn to player 0 (human) so tests are deterministic
  const forcedTurn = setCurrentTurn(handResult.match.turn, 0);
  // Connect ALL players (bots need isConnected=true or processBotTurns will infinite-loop)
  const connectedPlayers = handResult.match.players.map((p) => ({
    ...p,
    isConnected: true,
  })) as MatchState["players"];
  const match = {
    ...handResult.match,
    players: connectedPlayers,
    turn: forcedTurn,
  };
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

  it("pass returns player_passed event", () => {
    const engine = createTestEngine();
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

  // =========================================================================
  // processBotTurns — sync version
  // =========================================================================

  describe("processBotTurns (sync)", () => {
    it("returns immediately if it's already human's turn", () => {
      const engine = createTestEngine();
      const state = engine.processBotTurns();
      expect(state.turn.currentTurn).toBe(0);
      engine.destroy();
    });

    it("resolves bot turns until human's turn", () => {
      const engine = createTestEngine();
      // Play a tile to advance to bot's turn
      const tile = engine.hand[0];
      engine.playTile(tile.id, "left");
      expect(engine.state.turn.currentTurn).not.toBe(0);

      // processBotTurns should resolve all bot turns back to human
      const finalState = engine.processBotTurns();
      expect(finalState.turn.currentTurn).toBe(0);
      engine.destroy();
    });

    it("stops if match ends during bot turns", () => {
      const engine = createTestEngine();
      // Manually empty a bot's hand to trigger match end scenario
      const bot1 = engine.state.players[1];
      const emptyBot1 = { ...bot1, hand: [] as MatchState["players"][0]["hand"] };
      const newPlayers = engine.state.players.map((p, i) =>
        i === 1 ? emptyBot1 : p,
      ) as MatchState["players"];
      // Modify internal state (test-only)
      (engine as unknown as { _state: MatchState })._state = {
        ...engine.state,
        players: newPlayers,
      };

      // processBotTurns should not infinite-loop
      const finalState = engine.processBotTurns();
      expect(finalState).toBeDefined();
      engine.destroy();
    });

    it("bot plays a valid move on the board", () => {
      const engine = createTestEngine();
      // Play human tile to advance turn
      const tile = engine.hand[0];
      engine.playTile(tile.id, "left");

      const boardTilesBefore = engine.state.board.tiles.length;
      engine.processBotTurns();

      // At least one new tile should be on the board (bot played)
      // or the bot passed (board unchanged but turn advanced)
      expect(engine.state.turn.currentTurn).toBe(0);
      expect(engine.state.board.tiles.length).toBeGreaterThanOrEqual(boardTilesBefore);
      engine.destroy();
    });
  });
});
