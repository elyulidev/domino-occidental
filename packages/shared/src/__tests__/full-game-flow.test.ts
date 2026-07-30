import { describe, it, expect } from "vitest";
import type { MatchState, Tile, Side } from "../types";
import {
  initializeMatch,
  startHand,
  playTile,
  passTurn,
  redealHand,
} from "../game/match";
import { createDeck, shuffle, deal } from "../game/deck";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function t(top: number, bottom: number): Tile {
  return { top, bottom, id: `${top}-${bottom}` };
}

/**
 * Marks all 4 players as connected (createPlayer sets isConnected: false,
 * but the game engine requires connected players to allow actions).
 */
function connectAll(match: MatchState): MatchState {
  return {
    ...match,
    players: match.players.map((p) => ({ ...p, isConnected: true })) as MatchState["players"],
  };
}

/**
 * Initializes a match, starts the hand, and connects all players.
 */
function setupMatch(
  hands: [Tile[], Tile[], Tile[], Tile[]],
  pool: Tile[],
  targetScore = 200,
): MatchState {
  const initResult = initializeMatch("test", hands, pool, targetScore);
  const handResult = startHand(initResult.match);
  return connectAll(handResult.match);
}

/**
 * Helper: extracts a specific event type from an events array.
 */
function findEvent<T extends { type: string }>(
  events: T[],
  type: T["type"],
): T | undefined {
  return events.find((e) => e.type === type);
}

/**
 * Walks through a hand playing as many moves as possible automatically.
 * Returns { match, events, handEnded, matchEnded }.
 */
function autoPlayHand(match: MatchState): {
  match: MatchState;
  events: any[];
  handEnded: boolean;
  matchEnded: boolean;
} {
  const allEvents: any[] = [];
  let state = match;
  let moves = 120;
  let handEnded = false;
  let matchEnded = false;

  while (moves > 0 && !handEnded) {
    moves--;
    const idx = state.turn.currentTurn;
    const player = state.players[idx];

    const board = state.board;
    const tileToPlay = player.hand.find(
      (t) =>
        !player.blockedTileIds.includes(t.id) &&
        ((board.leftEnd !== null &&
          (t.top === board.leftEnd || t.bottom === board.leftEnd)) ||
          (board.rightEnd !== null &&
            (t.top === board.rightEnd || t.bottom === board.rightEnd))),
    );

    let result: { match: MatchState; events: any[] };
    if (tileToPlay) {
      const side: Side =
        board.leftEnd !== null &&
        (tileToPlay.top === board.leftEnd || tileToPlay.bottom === board.leftEnd)
          ? "left"
          : "right";
      result = playTile(state, player.id, tileToPlay.id, side);
    } else {
      result = passTurn(state, player.id);
    }

    allEvents.push(...result.events);

    if (findEvent(result.events, "game_error")) {
      break;
    }

    state = result.match;

    if (findEvent(result.events, "hand_ended")) {
      handEnded = true;
      if (findEvent(result.events, "match_ended")) {
        matchEnded = true;
      }
    }
  }

  return { match: state, events: allEvents, handEnded, matchEnded };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Full game flow", () => {
  // -------------------------------------------------------------------------
  // Scenario 1: init + start hand + basic play
  // -------------------------------------------------------------------------
  it("Scenario 1: initializes match, starts hand, basic tile play", () => {
    const deck = shuffle(createDeck());
    const { hands, pool } = deal(deck);
    const match = setupMatch(hands, pool);

    expect(match.status).toBe("in_progress");
    expect(match.players).toHaveLength(4);
    expect(match.turn.turnDeadline).not.toBeNull();
    expect(match.turn.roundNumber).toBe(0);

    // First player plays a tile
    const firstPlayer = match.turn.currentTurn;
    const player = match.players[firstPlayer];
    const result = playTile(match, player.id, player.hand[0].id, "right");

    expect(findEvent(result.events, "game_error")).toBeUndefined();
    expect(findEvent(result.events, "tile_played")).toBeDefined();
    expect(result.match.turn.currentTurn).not.toBe(firstPlayer);
    expect(
      result.match.players[firstPlayer].hand.find((t) => t.id === player.hand[0].id),
    ).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Scenario 2: auto-play with real deck → hand ends
  // -------------------------------------------------------------------------
  it("Scenario 2: hand ends naturally during play", () => {
    const deck = shuffle(createDeck());
    const { hands, pool } = deal(deck);
    const match = setupMatch(hands, pool);

    const result = autoPlayHand(match);

    expect(result.handEnded).toBe(true);
    // At least one hand was played (may have advanced past round 0 if
    // scores fell short and a redeal occurred)
  });

  // -------------------------------------------------------------------------
  // Scenario 3: full match to target score across multiple hands
  // -------------------------------------------------------------------------
  it("Scenario 3: match reaches target score and ends", () => {
    const TARGET = 50;
    const deck = shuffle(createDeck());
    const { hands, pool } = deal(deck);

    let match = setupMatch(hands, pool, TARGET);
    let matchEnded = false;
    let totalHands = 0;
    let finalScores: [number, number] = [0, 0];
    let winner: number | undefined;

    for (let i = 0; i < 50 && !matchEnded; i++) {
      const result = autoPlayHand(match);
      totalHands++;

      if (result.matchEnded) {
        matchEnded = true;
        const me = findEvent(result.events, "match_ended") as any;
        finalScores = me.finalScores;
        winner = me.winner;
        expect(result.match.status).toBe("finished");
      } else {
        // Hand ended but match continues — redeal
        const redeal = redealHand(result.match);
        expect(redeal.events[0].type).toBe("round_started");
        match = connectAll(redeal.match);
      }
    }

    expect(matchEnded).toBe(true);
    expect(totalHands).toBeGreaterThanOrEqual(1);
    expect(winner).toBeDefined();
    expect(winner).toBeGreaterThanOrEqual(0);
    expect(winner).toBeLessThanOrEqual(1);
    expect(finalScores[0] + finalScores[1]).toBeGreaterThanOrEqual(TARGET);
  });

  // -------------------------------------------------------------------------
  // Scenario 4: player passes when no matching tile
  // -------------------------------------------------------------------------
  it("Scenario 4: player passes turn when no tile matches", () => {
    // p0 has [9-9] (highest double → starts)
    // After p0 plays [9-9], board ends are both 9
    // p1 has [1-2], [3-4] — neither matches 9 → must pass
    const hands: [Tile[], Tile[], Tile[], Tile[]] = [
      [t(9, 9), t(9, 0)],
      [t(1, 2), t(3, 4)],
      [t(0, 1)],
      [t(4, 5)],
    ];
    let match = setupMatch(hands, []);

    // p0 starts
    expect(match.turn.currentTurn).toBe(0);
    let result = playTile(match, "p0", "9-9", "right");
    match = result.match;
    expect(findEvent(result.events, "tile_played")).toBeDefined();

    // p1 has no 9 → must pass
    expect(match.turn.currentTurn).toBe(1);
    const p1 = match.players[1];
    expect(p1.hand.every((t) => t.top !== 9 && t.bottom !== 9)).toBe(true);

    result = passTurn(match, "p1");
    match = result.match;
    expect(findEvent(result.events, "player_passed")).toBeDefined();
    expect(match.turn.currentTurn).toBe(2);
  });

  // -------------------------------------------------------------------------
  // Scenario 5: invalid tile play is rejected
  // -------------------------------------------------------------------------
  it("Scenario 5: rejects play of tile that does not match board end", () => {
    const deck = shuffle(createDeck());
    const { hands, pool } = deal(deck);
    let match = setupMatch(hands, pool);

    // First player plays a tile
    const first = match.turn.currentTurn;
    const result1 = playTile(match, match.players[first].id, match.players[first].hand[0].id, "right");
    expect(findEvent(result1.events, "game_error")).toBeUndefined();
    match = result1.match;

    // Next player tries to play a tile that doesn't match either end
    const next = match.turn.currentTurn;
    const nextPlayer = match.players[next];
    const board = match.board;
    const mismatched = nextPlayer.hand.find(
      (t) =>
        board.leftEnd !== null &&
        board.rightEnd !== null &&
        t.top !== board.leftEnd &&
        t.bottom !== board.leftEnd &&
        t.top !== board.rightEnd &&
        t.bottom !== board.rightEnd,
    );

    // This scenario only applies if player has a mismatched tile
    if (mismatched) {
      const result2 = playTile(match, nextPlayer.id, mismatched.id, "right");
      const error = findEvent(result2.events, "game_error") as any;
      expect(error).toBeDefined();
      expect(error.code).toBe("INVALID_PLAY");
    }
    // If all tiles match ends (possible with random deal), skip assertion
  });

  // -------------------------------------------------------------------------
  // Scenario 6: turn order cycle 0→1→2→3→0 (using auto-play)
  // -------------------------------------------------------------------------
  it("Scenario 6: turn order cycles 0→1→2→3→0 across 4 consecutive moves", () => {
    const deck = shuffle(createDeck());
    const { hands, pool } = deal(deck);
    let match = setupMatch(hands, pool);

    // Auto-play the first 4 turns and verify the cycle
    const firstPlayer = match.turn.currentTurn;
    for (let i = 0; i < 4; i++) {
      const idx = match.turn.currentTurn;
      const player = match.players[idx];
      const board = match.board;

      // Find any playable tile
      const tile = player.hand.find(
        (t) =>
          (board.leftEnd !== null &&
            (t.top === board.leftEnd || t.bottom === board.leftEnd)) ||
          (board.rightEnd !== null &&
            (t.top === board.rightEnd || t.bottom === board.rightEnd)),
      );
      const result = tile
        ? playTile(match, player.id, tile.id, "right")
        : passTurn(match, player.id);

      expect(findEvent(result.events, "game_error")).toBeUndefined();
      match = result.match;
    }

    // After 4 consecutive turns, we should be back to the original player
    expect(match.turn.currentTurn).toBe(firstPlayer);
  });

  // -------------------------------------------------------------------------
  // Scenario 7: auto-play produces hand_ended event with valid scoring
  // -------------------------------------------------------------------------
  it("Scenario 7: auto-play produces hand_ended with valid scoring", () => {
    const deck = shuffle(createDeck());
    const { hands, pool } = deal(deck);
    const match = setupMatch(hands, pool);

    const result = autoPlayHand(match);

    expect(result.handEnded).toBe(true);
    const handEnded = findEvent(result.events, "hand_ended")! as any;
    const handScored = findEvent(result.events, "hand_scored")! as any;

    expect(handEnded).toBeDefined();
    expect(["empty_hand", "blocked", "annulled", "forced_winner"]).toContain(handEnded.reason);
    expect(handScored).toBeDefined();
    expect(handScored.scores).toBeDefined();
    expect(handScored.scores[0] + handScored.scores[1]).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Scenario 8: redealHand after hand ends
  // -------------------------------------------------------------------------
  it("Scenario 8: redeal creates fresh hands and resets board", () => {
    const hands: [Tile[], Tile[], Tile[], Tile[]] = [
      [t(6, 6), t(6, 0)],
      [t(6, 1)],
      [t(1, 2)],
      [t(2, 3)],
    ];
    let match = setupMatch(hands, []);

    // Play until hand ends
    let r = playTile(match, "p0", "6-6", "right");
    match = r.match;
    r = playTile(match, "p1", "6-1", "right");
    match = r.match;
    r = playTile(match, "p2", "1-2", "right");
    match = r.match;
    r = playTile(match, "p3", "2-3", "right");
    match = r.match;
    r = playTile(match, "p0", "6-0", "left");
    match = r.match;

    if (findEvent(r.events, "match_ended")) {
      return; // match ended, nothing to redeal
    }

    const prevRound = match.turn.roundNumber;

    const redeal = redealHand(match);
    expect(redeal.events[0].type).toBe("round_started");

    const newMatch = redeal.match;
    expect(newMatch.board.leftEnd).toBeNull();
    expect(newMatch.board.rightEnd).toBeNull();
    expect(newMatch.board.tiles).toHaveLength(0);
    expect(newMatch.players[0].hand).toHaveLength(10);
    expect(newMatch.players[1].hand).toHaveLength(10);
    expect(newMatch.players[2].hand).toHaveLength(10);
    expect(newMatch.players[3].hand).toHaveLength(10);
    expect(newMatch.turn.roundNumber).toBe(prevRound + 1);
    expect(newMatch.poolCount).toBe(15);
  });
});
