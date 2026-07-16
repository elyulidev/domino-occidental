import type { BoardState, MatchState, SanitizedMatchState, Side, Tile } from "@domino/shared";
import { create } from "zustand";
import { LocalGameEngine } from "@/lib/game/local-engine";
import type { GameEngine, GameStatus } from "@/lib/game/types";

// ---------------------------------------------------------------------------
// Hand-over modal data
// ---------------------------------------------------------------------------

export interface HandOverInfo {
  winningPair: 0 | 1;
  points: number;
  scores: [number, number];
}

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface GameState {
  board: BoardState;
  scores: [number, number];
  players: Array<{ id: string; name?: string; handSize: number; isConnected: boolean }>;
  ownHand: Tile[];
  /** Tile IDs blocked by timeout for the current player (from server). */
  blockedTileIds: string[];
  /** Avatar URLs for each player, indexed by seat position (0–3). */
  avatarUrls: [string, string, string, string];
  /** Map of playerId → disconnect timestamp (Date.now() or null). */
  disconnectedSince: Map<string, number | null>;
  /** Index (0-3) of the player THIS client controls. Used for turn checking. */
  playerIndex: number;
  turn: {
    currentTurn: 0 | 1 | 2 | 3;
    turnDeadline: number | null;
    consecutiveNullRounds: number;
    roundNumber: number;
    lastHandWinner: number | null;
  };
  status: GameStatus;
}

interface UIState {
  selectedTileId: string | null;
  error: string | null;
}

interface StoreState {
  game: GameState;
  ui: UIState;
  engine: GameEngine | null;
  handOver: HandOverInfo | null;

  // Actions
  initEngine: (match: MatchState) => void;
  setEngine: (engine: GameEngine) => void;
  applyWsUpdate: (sanitized: SanitizedMatchState, yourHand?: Tile[]) => void;
  setHandOver: (info: HandOverInfo | null) => void;
  selectTile: (tileId: string) => void;
  clearSelection: () => void;
  playTile: (side: Side) => void;
  pass: () => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

const defaultGameState: GameState = {
  board: { leftEnd: null, rightEnd: null, tiles: [] },
  scores: [0, 0],
  players: [],
  ownHand: [],
  blockedTileIds: [],
  avatarUrls: ["", "", "", ""],
  disconnectedSince: new Map(),
  playerIndex: 0,
  turn: {
    currentTurn: 0,
    turnDeadline: null,
    consecutiveNullRounds: 0,
    roundNumber: 0,
    lastHandWinner: null,
  },
  status: "waiting",
};

const defaultUIState: UIState = {
  selectedTileId: null,
  error: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function syncGameState(state: StoreState, match: MatchState): Partial<StoreState> {
  const playerIdx = state.engine?.playerIndex ?? 0;
  return {
    game: {
      board: match.board,
      scores: match.scores.scores,
      players: match.players.map((p) => ({
        id: p.id,
        name: p.name,
        handSize: p.hand.length,
        isConnected: p.isConnected,
      })),
      ownHand: state.engine?.hand ?? match.players[0].hand,
      blockedTileIds: match.players[playerIdx]?.blockedTileIds ?? [],
      avatarUrls: state.game?.avatarUrls ?? ["", "", "", ""],
      disconnectedSince: state.game?.disconnectedSince ?? new Map(),
      playerIndex: playerIdx,
      turn: {
        currentTurn: match.turn.currentTurn,
        turnDeadline: match.turn.turnDeadline,
        consecutiveNullRounds: match.turn.consecutiveNullRounds,
        roundNumber: match.turn.roundNumber,
        lastHandWinner: match.turn.lastHandWinner,
      },
      status: match.status as GameStatus,
    },
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGameStore = create<StoreState>((set, get) => ({
  game: { ...defaultGameState },
  ui: { ...defaultUIState },
  engine: null,
  handOver: null,

  initEngine: (match: MatchState) => {
    const engine = new LocalGameEngine(match, 0);
    set({
      engine,
      ...syncGameState({ engine } as unknown as StoreState, match),
      ui: { ...defaultUIState },
      handOver: null,
    });
  },

  setEngine: (engine: GameEngine) => {
    set({
      engine,
      ...syncGameState({ engine } as unknown as StoreState, engine.state),
      ui: { ...defaultUIState },
      handOver: null,
    });
  },

  setHandOver: (info: HandOverInfo | null) => {
    set({ handOver: info });
  },

  applyWsUpdate: (sanitized: SanitizedMatchState, yourHand?: Tile[]) => {
    const store = get();
    const existingPlayers = store.game.players;
    const playerIdx = store.engine?.playerIndex ?? 0;

    // Track disconnect timestamps
    const newDisconnectedSince = new Map(store.game.disconnectedSince);
    for (let i = 0; i < sanitized.players.length; i++) {
      const p = sanitized.players[i];
      const existing = existingPlayers[i];
      if (!p || !existing) continue;

      if (!p.isConnected && existing.isConnected) {
        // Player just disconnected — record timestamp
        newDisconnectedSince.set(p.id, Date.now());
      } else if (p.isConnected) {
        // Player reconnected — clear timestamp
        newDisconnectedSince.delete(p.id);
      }
    }

    set({
      game: {
        board: sanitized.board as BoardState,
        scores: sanitized.scores,
        players: sanitized.players.map((p, i) => ({
          id: p.id,
          name: p.name ?? existingPlayers[i]?.name,
          handSize: p.handSize,
          isConnected: p.isConnected,
        })),
        ownHand: yourHand ?? store.game.ownHand,
        blockedTileIds: sanitized.players[playerIdx]?.blockedTileIds ?? [],
        avatarUrls: sanitized.avatarUrls,
        disconnectedSince: newDisconnectedSince,
        playerIndex: playerIdx,
        turn: {
          currentTurn: sanitized.currentTurn as 0 | 1 | 2 | 3,
          turnDeadline: sanitized.turnDeadline,
          consecutiveNullRounds: sanitized.consecutiveNullRounds,
          roundNumber: sanitized.roundNumber,
          lastHandWinner: sanitized.lastHandWinner,
        },
        status: sanitized.status as GameStatus,
      },
    });
  },

  selectTile: (tileId: string) => {
    set({ ui: { ...get().ui, selectedTileId: tileId, error: null } });
  },

  clearSelection: () => {
    set({ ui: { ...get().ui, selectedTileId: null } });
  },

  playTile: (side: Side) => {
    const { engine, ui } = get();
    if (!engine) return;

    if (!ui.selectedTileId) {
      set({ ui: { ...ui, error: "No tile selected" } });
      return;
    }

    if (engine.remote) {
      // Remote (WS) mode: send message + optimistically update own-hand only.
      // Server broadcast will reconcile board, turn, handSizes.
      engine.playTile(ui.selectedTileId, side);
      set({
        game: { ...get().game, ownHand: engine.hand },
        ui: { selectedTileId: null, error: null },
      });
    } else {
      // Local mode: full synchronous processing
      const result = engine.playTile(ui.selectedTileId, side);
      set({
        ...syncGameState(get(), result.match),
        ui: { selectedTileId: null, error: null },
      });
    }
  },

  pass: () => {
    const { engine } = get();
    if (!engine) return;

    if (engine.remote) {
      // Remote (WS) mode: send message, clear selection.
      engine.pass();
      set({ ui: { ...get().ui, selectedTileId: null } });
    } else {
      // Local mode: full synchronous processing
      const result = engine.pass();
      set({
        ...syncGameState(get(), result.match),
        ui: { selectedTileId: null, error: null },
      });
    }
  },

  reset: () => {
    const { engine } = get();
    if (engine) engine.destroy();
    set({
      game: { ...defaultGameState },
      ui: { ...defaultUIState },
      engine: null,
      handOver: null,
    });
  },
}));
