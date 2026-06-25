import { describe, expect, it } from "bun:test";
import { checkTimeout, handleHandEnd, initializeMatch, passTurn, playTile, startHand } from "../match";
import type { BoardState, PlayerState, ScoreState, Tile, TurnState } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function t(top: number, bottom: number): Tile {
  return { top, bottom, id: crypto.randomUUID() };
}

function makeHands(): [Tile[], Tile[], Tile[], Tile[]] {
  return [
    [t(0, 1), t(2, 3), t(4, 5), t(6, 7), t(8, 9), t(0, 2), t(1, 3), t(4, 6), t(5, 7), t(8, 0)],
    [t(0, 3), t(1, 4), t(2, 5), t(3, 6), t(4, 7), t(5, 8), t(6, 9), t(0, 4), t(1, 5), t(2, 6)],
    [t(0, 5), t(1, 6), t(2, 7), t(3, 8), t(4, 9), t(0, 6), t(1, 7), t(2, 8), t(3, 9), t(0, 7)],
    [t(0, 8), t(1, 9), t(2, 0), t(3, 1), t(4, 2), t(5, 3), t(6, 4), t(7, 5), t(8, 6), t(9, 7)],
  ];
}

function makePool(): Tile[] {
  return [
    t(0, 9), t(1, 8), t(2, 7), t(3, 6), t(4, 5),
    t(5, 6), t(6, 7), t(7, 8), t(8, 9), t(9, 0),
    t(1, 2), t(3, 4), t(5, 9), t(6, 8), t(7, 9),
  ];
}

// ---------------------------------------------------------------------------
// initializeMatch
// ---------------------------------------------------------------------------

describe("initializeMatch", () => {
  it("creates a match with status in_progress", () => {
    const hands = makeHands();
    const pool = makePool();
    const result = initializeMatch("match-1", hands, pool);
    expect(result.match.status).toBe("in_progress");
  });

  it("sets the matchId correctly", () => {
    const hands = makeHands();
    const pool = makePool();
    const result = initializeMatch("match-42", hands, pool);
    expect(result.match.matchId).toBe("match-42");
  });

  it("creates 4 players with correct ids and hands", () => {
    const hands = makeHands();
    const pool = makePool();
    const result = initializeMatch("match-1", hands, pool);
    const players = result.match.players;
    expect(players).toHaveLength(4);
    expect(players[0].id).toBe("p0");
    expect(players[1].id).toBe("p1");
    expect(players[2].id).toBe("p2");
    expect(players[3].id).toBe("p3");
    expect(players[0].hand).toHaveLength(10);
    expect(players[1].hand).toHaveLength(10);
  });

  it("initializes board, turn, and scores", () => {
    const hands = makeHands();
    const pool = makePool();
    const result = initializeMatch("match-1", hands, pool);
    expect(result.match.board).toEqual({ leftEnd: null, rightEnd: null, tiles: [] });
    expect(result.match.turn.currentTurn).toBe(0);
    expect(result.match.turn.consecutiveNullRounds).toBe(0);
    expect(result.match.scores).toEqual({ scores: [0, 0], isTiebreaker: false });
  });

  it("sets pool and poolCount correctly", () => {
    const hands = makeHands();
    const pool = makePool();
    const result = initializeMatch("match-1", hands, pool);
    expect(result.match.pool).toBe(pool);
    expect(result.match.poolCount).toBe(15);
  });

  it("uses default targetScore of 200", () => {
    const hands = makeHands();
    const pool = makePool();
    const result = initializeMatch("match-1", hands, pool);
    expect(result.match.targetScore).toBe(200);
  });

  it("accepts custom targetScore", () => {
    const hands = makeHands();
    const pool = makePool();
    const result = initializeMatch("match-1", hands, pool, 100);
    expect(result.match.targetScore).toBe(100);
  });

  it("emits no events", () => {
    const hands = makeHands();
    const pool = makePool();
    const result = initializeMatch("match-1", hands, pool);
    expect(result.events).toEqual([]);
  });

  it("all players are connected by default", () => {
    const hands = makeHands();
    const pool = makePool();
    const result = initializeMatch("match-1", hands, pool);
    for (const player of result.match.players) {
      expect(player.isConnected).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// startHand
// ---------------------------------------------------------------------------

describe("startHand", () => {
  it("resets all players' consecutive passes to 0", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    // Manually set some passes
    const modifiedMatch = {
      ...match,
      players: match.players.map((p) => ({ ...p, consecutivePasses: 3 })) as any,
    };
    const result = startHand(modifiedMatch);
    for (const player of result.match.players) {
      expect(player.consecutivePasses).toBe(0);
    }
  });

  it("creates a fresh empty board", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    // Put a tile on the board
    const modifiedMatch = {
      ...match,
      board: { leftEnd: 5, rightEnd: 3, tiles: [{ tile: t(5, 3), side: "left" as const, playerId: "p0" }] },
    };
    const result = startHand(modifiedMatch);
    expect(result.match.board).toEqual({ leftEnd: null, rightEnd: null, tiles: [] });
  });

  it("sets a turn deadline", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const result = startHand(match);
    expect(result.match.turn.turnDeadline).not.toBeNull();
    expect(result.match.turn.turnDeadline).toBeGreaterThan(0);
  });

  it("emits round_started event with firstPlayer", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const result = startHand(match);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe("round_started");
    const firstPlayerEvent = result.events[0] as { type: "round_started"; firstPlayer: number };
    expect(firstPlayerEvent.firstPlayer).toBeGreaterThanOrEqual(0);
    expect(firstPlayerEvent.firstPlayer).toBeLessThanOrEqual(3);
  });

  it("sets currentTurn to the first player", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const result = startHand(match);
    const firstPlayerEvent = result.events[0] as { type: "round_started"; firstPlayer: number };
    expect(result.match.turn.currentTurn).toBe(firstPlayerEvent.firstPlayer);
  });

  it("returns same match reference if no state needed changing (immutability check)", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const result = startHand(match);
    // The match object should be a new reference
    expect(result.match).not.toBe(match);
    // But the players array and board should be new references
    expect(result.match.players).not.toBe(match.players);
    expect(result.match.board).not.toBe(match.board);
  });
});

// ---------------------------------------------------------------------------
// playTile
// ---------------------------------------------------------------------------

describe("playTile", () => {
  it("places a tile on the board and removes it from the player's hand", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const started = startHand(match).match;
    const currentTurn = started.turn.currentTurn;
    const playerId = started.players[currentTurn].id;
    const tileToPlay = started.players[currentTurn].hand[0];

    const result = playTile(started, playerId, tileToPlay.id, "left");

    // Tile should be removed from hand
    expect(result.match.players[currentTurn].hand).toHaveLength(9);
    // Board should have one tile
    expect(result.match.board.tiles).toHaveLength(1);
  });

  it("emits tile_played event", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const started = startHand(match).match;
    const currentTurn = started.turn.currentTurn;
    const playerId = started.players[currentTurn].id;
    const tileToPlay = started.players[currentTurn].hand[0];

    const result = playTile(started, playerId, tileToPlay.id, "left");

    const tileEvent = result.events.find((e) => e.type === "tile_played");
    expect(tileEvent).toBeDefined();
    if (tileEvent?.type === "tile_played") {
      expect(tileEvent.playerId).toBe(playerId);
      expect(tileEvent.tileId).toBe(tileToPlay.id);
    }
  });

  it("advances the turn after a valid play", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const started = startHand(match).match;
    const currentTurn = started.turn.currentTurn;
    const playerId = started.players[currentTurn].id;
    const tileToPlay = started.players[currentTurn].hand[0];

    const result = playTile(started, playerId, tileToPlay.id, "left");

    expect(result.match.turn.currentTurn).not.toBe(currentTurn);
  });

  it("returns game_error when match is already over", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const overMatch = { ...match, status: "finished" as const };

    const result = playTile(overMatch, "p0", "any-tile", "left");

    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe("game_error");
    if (result.events[0].type === "game_error") {
      expect(result.events[0].code).toBe("MATCH_ALREADY_OVER");
    }
  });

  it("returns game_error when match is not in_progress", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const waitingMatch = { ...match, status: "waiting" as const };

    const result = playTile(waitingMatch, "p0", "any-tile", "left");

    expect(result.events[0].type).toBe("game_error");
    if (result.events[0].type === "game_error") {
      expect(result.events[0].code).toBe("MATCH_NOT_ACTIVE");
    }
  });

  it("returns game_error when player is disconnected", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const started = startHand(match).match;
    const currentTurn = started.turn.currentTurn;
    const playerId = started.players[currentTurn].id;

    const disconnectedMatch = {
      ...started,
      players: started.players.map((p, i) =>
        i === currentTurn ? { ...p, isConnected: false } : p,
      ) as any,
    };

    const result = playTile(disconnectedMatch, playerId, "any-tile", "left");

    expect(result.events[0].type).toBe("game_error");
    if (result.events[0].type === "game_error") {
      expect(result.events[0].code).toBe("PLAYER_DISCONNECTED");
    }
  });

  it("returns game_error when it's not the player's turn", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const started = startHand(match).match;
    const currentTurn = started.turn.currentTurn;
    // Pick a player who is NOT the current turn
    const wrongPlayer = (currentTurn + 1) % 4;
    const playerId = started.players[wrongPlayer].id;

    const result = playTile(started, playerId, "any-tile", "left");

    expect(result.events[0].type).toBe("game_error");
    if (result.events[0].type === "game_error") {
      expect(result.events[0].code).toBe("NOT_YOUR_TURN");
    }
  });

  it("returns game_error when tile is not in player's hand", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const started = startHand(match).match;
    const currentTurn = started.turn.currentTurn;
    const playerId = started.players[currentTurn].id;

    const result = playTile(started, playerId, "nonexistent-tile-id", "left");

    expect(result.events[0].type).toBe("game_error");
    if (result.events[0].type === "game_error") {
      expect(result.events[0].code).toBe("TILE_NOT_FOUND");
    }
  });

  it("resets consecutive passes after a valid play", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const started = startHand(match).match;
    const currentTurn = started.turn.currentTurn;
    // Give the player some passes
    const modifiedMatch = {
      ...started,
      players: started.players.map((p, i) =>
        i === currentTurn ? { ...p, consecutivePasses: 3 } : p,
      ) as any,
    };
    const playerId = modifiedMatch.players[currentTurn].id;
    const tileToPlay = modifiedMatch.players[currentTurn].hand[0];

    const result = playTile(modifiedMatch, playerId, tileToPlay.id, "left");

    expect(result.match.players[currentTurn].consecutivePasses).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// passTurn
// ---------------------------------------------------------------------------

describe("passTurn", () => {
  it("increments the player's consecutive passes", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const started = startHand(match).match;
    const currentTurn = started.turn.currentTurn;
    const playerId = started.players[currentTurn].id;

    const result = passTurn(started, playerId);

    expect(result.match.players[currentTurn].consecutivePasses).toBe(1);
  });

  it("advances the turn", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const started = startHand(match).match;
    const currentTurn = started.turn.currentTurn;
    const playerId = started.players[currentTurn].id;

    const result = passTurn(started, playerId);

    expect(result.match.turn.currentTurn).not.toBe(currentTurn);
  });

  it("emits player_passed event", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const started = startHand(match).match;
    const currentTurn = started.turn.currentTurn;
    const playerId = started.players[currentTurn].id;

    const result = passTurn(started, playerId);

    const passEvent = result.events.find((e) => e.type === "player_passed");
    expect(passEvent).toBeDefined();
    if (passEvent?.type === "player_passed") {
      expect(passEvent.playerId).toBe(playerId);
    }
  });

  it("returns game_error when match is already over", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const overMatch = { ...match, status: "finished" as const };

    const result = passTurn(overMatch, "p0");

    expect(result.events[0].type).toBe("game_error");
    if (result.events[0].type === "game_error") {
      expect(result.events[0].code).toBe("MATCH_ALREADY_OVER");
    }
  });

  it("returns game_error when match is not in_progress", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const waitingMatch = { ...match, status: "waiting" as const };

    const result = passTurn(waitingMatch, "p0");

    expect(result.events[0].type).toBe("game_error");
    if (result.events[0].type === "game_error") {
      expect(result.events[0].code).toBe("MATCH_NOT_ACTIVE");
    }
  });

  it("returns game_error when player is disconnected", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const started = startHand(match).match;
    const currentTurn = started.turn.currentTurn;

    const disconnectedMatch = {
      ...started,
      players: started.players.map((p, i) =>
        i === currentTurn ? { ...p, isConnected: false } : p,
      ) as any,
    };
    const playerId = disconnectedMatch.players[currentTurn].id;

    const result = passTurn(disconnectedMatch, playerId);

    expect(result.events[0].type).toBe("game_error");
    if (result.events[0].type === "game_error") {
      expect(result.events[0].code).toBe("PLAYER_DISCONNECTED");
    }
  });

  it("returns game_error when it's not the player's turn", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const started = startHand(match).match;
    const currentTurn = started.turn.currentTurn;
    const wrongPlayer = (currentTurn + 1) % 4;
    const playerId = started.players[wrongPlayer].id;

    const result = passTurn(started, playerId);

    expect(result.events[0].type).toBe("game_error");
    if (result.events[0].type === "game_error") {
      expect(result.events[0].code).toBe("NOT_YOUR_TURN");
    }
  });

  it("returns game_error when player's hand is empty", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const started = startHand(match).match;
    const currentTurn = started.turn.currentTurn;
    const playerId = started.players[currentTurn].id;

    // Empty the player's hand
    const emptyHandMatch = {
      ...started,
      players: started.players.map((p, i) =>
        i === currentTurn ? { ...p, hand: [] } : p,
      ) as any,
    };

    const result = passTurn(emptyHandMatch, playerId);

    expect(result.events[0].type).toBe("game_error");
    if (result.events[0].type === "game_error") {
      expect(result.events[0].code).toBe("HAND_EMPTY");
    }
  });
});

// ---------------------------------------------------------------------------
// checkTimeout
// ---------------------------------------------------------------------------

describe("checkTimeout", () => {
  it("returns unchanged match when turn has not timed out", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const started = startHand(match).match;
    const now = Date.now();

    const result = checkTimeout(started, now);

    expect(result.events).toEqual([]);
    expect(result.match.turn.currentTurn).toBe(started.turn.currentTurn);
  });

  it("forces a pass when turn has timed out", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const started = startHand(match).match;
    const currentTurn = started.turn.currentTurn;
    const deadline = started.turn.turnDeadline!;

    const result = checkTimeout(started, deadline + 1);

    // Should have advanced turn
    expect(result.match.turn.currentTurn).not.toBe(currentTurn);
    // Should have emitted turn_timeout event
    const timeoutEvent = result.events.find((e) => e.type === "turn_timeout");
    expect(timeoutEvent).toBeDefined();
    if (timeoutEvent?.type === "turn_timeout") {
      expect(timeoutEvent.playerId).toBe(started.players[currentTurn].id);
      expect(timeoutEvent.forcedPass).toBe(true);
    }
  });

  it("increments pass count on timeout", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const started = startHand(match).match;
    const currentTurn = started.turn.currentTurn;
    const deadline = started.turn.turnDeadline!;

    const result = checkTimeout(started, deadline + 1);

    expect(result.match.players[currentTurn].consecutivePasses).toBe(1);
  });

  it("does not change match when turnDeadline is null", () => {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const started = startHand(match).match;
    // Manually set deadline to null
    const noDeadlineMatch = {
      ...started,
      turn: { ...started.turn, turnDeadline: null },
    };

    const result = checkTimeout(noDeadlineMatch, Date.now());

    expect(result.events).toEqual([]);
    expect(result.match.turn.turnDeadline).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// handleHandEnd
// ---------------------------------------------------------------------------

describe("handleHandEnd", () => {
  function makeMatch(overrides: {
    players?: Partial<PlayerState>[];
    board?: BoardState;
    turn?: Partial<TurnState>;
    scores?: ScoreState;
  } = {}) {
    const hands = makeHands();
    const pool = makePool();
    const match = initializeMatch("match-1", hands, pool).match;
    const started = startHand(match).match;

    if (overrides.players) {
      (started as any).players = started.players.map((p, i) => ({
        ...p,
        ...overrides.players![i],
      }));
    }
    if (overrides.board) {
      started.board = overrides.board;
    }
    if (overrides.turn) {
      started.turn = { ...started.turn, ...overrides.turn };
    }
    if (overrides.scores) {
      started.scores = overrides.scores;
    }
    return started;
  }

  describe("empty_hand win", () => {
    it("emits hand_ended with winner player index", () => {
      const match = makeMatch({
        players: [{ hand: [] }, { hand: [t(1, 2)] }, { hand: [t(3, 4)] }, { hand: [t(5, 6)] }],
      });

      const result = handleHandEnd(match, 0, "empty_hand");

      const handEndEvent = result.events.find((e) => e.type === "hand_ended");
      expect(handEndEvent).toBeDefined();
      if (handEndEvent?.type === "hand_ended") {
        expect(handEndEvent.winner).toBe(0);
        expect(handEndEvent.reason).toBe("empty_hand");
      }
    });

    it("awards points equal to sum of losers' tiles", () => {
      const match = makeMatch({
        players: [
          { hand: [] },
          { hand: [t(1, 2)] }, // sum = 3
          { hand: [t(3, 4)] }, // sum = 7
          { hand: [t(5, 6)] }, // sum = 11
        ],
      });

      const result = handleHandEnd(match, 0, "empty_hand");

      const scoredEvent = result.events.find((e) => e.type === "hand_scored");
      expect(scoredEvent).toBeDefined();
      if (scoredEvent?.type === "hand_scored") {
        expect(scoredEvent.winningPair).toBe(0); // P1 is pair 0
        expect(scoredEvent.points).toBe(21); // 3 + 7 + 11
        expect(scoredEvent.scores[0]).toBe(21);
        expect(scoredEvent.scores[1]).toBe(0);
      }
    });

    it("updates turn's lastHandWinner", () => {
      const match = makeMatch({
        players: [{ hand: [] }, { hand: [t(1, 2)] }, { hand: [t(3, 4)] }, { hand: [t(5, 6)] }],
      });

      const result = handleHandEnd(match, 0, "empty_hand");

      expect(result.match.turn.lastHandWinner).toBe(0);
    });
  });

  describe("blocked board win", () => {
    it("emits hand_ended with correct winner for pair 0", () => {
      // Pair 0 (P1+P3) has lower sum than pair 1 (P2+P4)
      const match = makeMatch({
        board: { leftEnd: 9, rightEnd: 9, tiles: [] },
        players: [
          { hand: [t(0, 1)] }, // sum = 1
          { hand: [t(2, 3)] }, // sum = 5
          { hand: [t(0, 2)] }, // sum = 2
          { hand: [t(4, 5)] }, // sum = 9
        ],
      });

      const result = handleHandEnd(match, 0, "blocked");

      const handEndEvent = result.events.find((e) => e.type === "hand_ended");
      expect(handEndEvent).toBeDefined();
      if (handEndEvent?.type === "hand_ended") {
        expect(handEndEvent.winner).toBe(0); // First player of winning pair
        expect(handEndEvent.reason).toBe("blocked");
      }
    });

    it("awards points equal to losing pair's total", () => {
      // Pair 0 sum = 1+2 = 3, Pair 1 sum = 5+9 = 14
      const match = makeMatch({
        board: { leftEnd: 9, rightEnd: 9, tiles: [] },
        players: [
          { hand: [t(0, 1)] }, // sum = 1
          { hand: [t(2, 3)] }, // sum = 5
          { hand: [t(0, 2)] }, // sum = 2
          { hand: [t(4, 5)] }, // sum = 9
        ],
      });

      const result = handleHandEnd(match, 0, "blocked");

      const scoredEvent = result.events.find((e) => e.type === "hand_scored");
      expect(scoredEvent).toBeDefined();
      if (scoredEvent?.type === "hand_scored") {
        expect(scoredEvent.winningPair).toBe(0);
        expect(scoredEvent.points).toBe(14); // Losing pair total
      }
    });
  });

  describe("annulled hand", () => {
    it("emits hand_ended with winner null for tied blocked hand", () => {
      // Both pairs have equal sums → annulled
      const match = makeMatch({
        board: { leftEnd: 9, rightEnd: 9, tiles: [] },
        turn: { consecutiveNullRounds: 0 },
        players: [
          { hand: [t(0, 1)] }, // sum = 1
          { hand: [t(0, 2)] }, // sum = 2
          { hand: [t(0, 3)] }, // sum = 3
          { hand: [t(0, 4)] }, // sum = 4
        ],
        // Pair 0 sum = 1+3 = 4, Pair 1 sum = 2+4 = 6 → NOT tied
        // Let me fix: need equal pair sums
        // Pair 0: P1+P3 = 1+3 = 4, Pair 1: P2+P4 = 2+2 = 4 → tied
      });

      // Actually let me create a properly tied scenario
      const match2 = makeMatch({
        board: { leftEnd: 9, rightEnd: 9, tiles: [] },
        turn: { consecutiveNullRounds: 0 },
        players: [
          { hand: [t(0, 1)] }, // sum = 1
          { hand: [t(0, 2)] }, // sum = 2
          { hand: [t(0, 3)] }, // sum = 3
          { hand: [t(1, 1)] }, // sum = 2
        ],
        // Pair 0: 1+3 = 4, Pair 1: 2+2 = 4 → tied
      });

      const result = handleHandEnd(match2, 0, "blocked");

      const handEndEvent = result.events.find((e) => e.type === "hand_ended");
      expect(handEndEvent).toBeDefined();
      if (handEndEvent?.type === "hand_ended") {
        expect(handEndEvent.winner).toBeNull();
        expect(handEndEvent.reason).toBe("annulled");
      }
    });

    it("increments consecutiveNullRounds", () => {
      const match = makeMatch({
        board: { leftEnd: 9, rightEnd: 9, tiles: [] },
        turn: { consecutiveNullRounds: 1 },
        players: [
          { hand: [t(0, 1)] }, // sum = 1
          { hand: [t(0, 2)] }, // sum = 2
          { hand: [t(0, 3)] }, // sum = 3
          { hand: [t(1, 1)] }, // sum = 2
        ],
      });

      const result = handleHandEnd(match, 0, "blocked");

      expect(result.match.turn.consecutiveNullRounds).toBe(2);
    });
  });

  describe("4th cascade forced winner", () => {
    it("forces a winner when 4th consecutive annulled hand", () => {
      // Pair 0: 1+3 = 4, Pair 1: 2+2 = 4 → tied
      const match = makeMatch({
        board: { leftEnd: 9, rightEnd: 9, tiles: [] },
        turn: { consecutiveNullRounds: 3 }, // 4th consecutive
        players: [
          { hand: [t(0, 1)] }, // sum = 1
          { hand: [t(0, 2)] }, // sum = 2
          { hand: [t(0, 3)] }, // sum = 3
          { hand: [t(1, 1)] }, // sum = 2
        ],
      });

      const result = handleHandEnd(match, 0, "blocked");

      const handEndEvent = result.events.find((e) => e.type === "hand_ended");
      expect(handEndEvent).toBeDefined();
      if (handEndEvent?.type === "hand_ended") {
        expect(handEndEvent.winner).toBe(0); // P1 has lowest sum (1)
        expect(handEndEvent.reason).toBe("forced_winner");
      }
    });

    it("resets consecutiveNullRounds after forced winner", () => {
      const match = makeMatch({
        board: { leftEnd: 9, rightEnd: 9, tiles: [] },
        turn: { consecutiveNullRounds: 3 },
        players: [
          { hand: [t(0, 1)] }, // sum = 1
          { hand: [t(0, 2)] }, // sum = 2
          { hand: [t(0, 3)] }, // sum = 3
          { hand: [t(1, 1)] }, // sum = 2
        ],
      });

      const result = handleHandEnd(match, 0, "blocked");

      expect(result.match.turn.consecutiveNullRounds).toBe(0);
    });
  });

  describe("match end detection", () => {
    it("emits match_ended when score reaches target", () => {
      const match = makeMatch({
        scores: { scores: [190, 50], isTiebreaker: false },
        players: [{ hand: [] }, { hand: [t(1, 2)] }, { hand: [t(3, 4)] }, { hand: [t(5, 6)] }],
      });

      const result = handleHandEnd(match, 0, "empty_hand");

      const matchEndEvent = result.events.find((e) => e.type === "match_ended");
      expect(matchEndEvent).toBeDefined();
      if (matchEndEvent?.type === "match_ended") {
        expect(matchEndEvent.winner).toBe(0);
        expect(matchEndEvent.reason).toBe("reached_target");
      }
    });

    it("sets match status to finished when match ends", () => {
      const match = makeMatch({
        scores: { scores: [190, 50], isTiebreaker: false },
        players: [{ hand: [] }, { hand: [t(1, 2)] }, { hand: [t(3, 4)] }, { hand: [t(5, 6)] }],
      });

      const result = handleHandEnd(match, 0, "empty_hand");

      expect(result.match.status).toBe("finished");
    });
  });
});
