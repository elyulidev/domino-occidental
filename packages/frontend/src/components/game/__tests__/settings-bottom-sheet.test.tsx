import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsBottomSheet } from "../settings-bottom-sheet";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/stores/game-store", () => ({
  useGameStore: vi.fn(),
}));

vi.mock("@domino/shared", () => ({
  TARGET_SCORE: 200,
}));

vi.mock("@/components/ui/bottom-sheet", () => ({
  BottomSheet: ({ open, title, children }: { open: boolean; title?: string; children: React.ReactNode }) =>
    open ? (
      <div data-testid="bottom-sheet" data-title={title}>
        {children}
      </div>
    ) : null,
}));

import { useGameStore } from "@/stores/game-store";

const mockUse = useGameStore as unknown as ReturnType<typeof vi.fn>;

function setupStore(overrides: Record<string, unknown> = {}) {
  const defaults = {
    engine: { remote: false },
    game: {
      status: "in_progress",
      board: { tiles: [1, 2, 3] },
      ownHand: [1, 2, 3, 4, 5],
      players: [{ id: "p1" }, { id: "p2" }, { id: "p3" }, { id: "p4" }],
    },
  };
  const merged = { ...defaults, ...overrides };

  mockUse.mockImplementation((selector: (s: typeof merged) => unknown) => {
    return selector(merged);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SettingsBottomSheet", () => {
  it("does not render when closed", () => {
    setupStore();
    const { container } = render(<SettingsBottomSheet open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders all info items", () => {
    setupStore();
    render(<SettingsBottomSheet open={true} onClose={vi.fn()} />);

    expect(screen.getByText("Objetivo")).toBeDefined();
    expect(screen.getByText("Modo")).toBeDefined();
    expect(screen.getByText("Fichas en pozo")).toBeDefined();
    expect(screen.getByText("Fichas jugadas")).toBeDefined();
    expect(screen.getByText("Fichas en mano")).toBeDefined();
    expect(screen.getByText("Estado")).toBeDefined();
  });

  it("shows target score of 200", () => {
    setupStore();
    render(<SettingsBottomSheet open={true} onClose={vi.fn()} />);
    expect(screen.getByText("200")).toBeDefined();
  });

  it("shows Local mode when engine.remote is false", () => {
    setupStore({ engine: { remote: false } });
    render(<SettingsBottomSheet open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Local")).toBeDefined();
  });

  it("shows Online mode when engine.remote is true", () => {
    setupStore({ engine: { remote: true } });
    render(<SettingsBottomSheet open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Online")).toBeDefined();
  });

  it("calculates pool count correctly (55 - 40 - boardTiles)", () => {
    // 55 total - 40 dealt (4 players × 10) - 3 played = 12 in pool
    setupStore({
      engine: { remote: false },
      game: {
        status: "in_progress",
        board: { tiles: [1, 2, 3] }, // 3 tiles on board
        ownHand: [1, 2, 3, 4, 5], // 5 tiles
        players: [{ id: "p1" }, { id: "p2" }, { id: "p3" }, { id: "p4" }],
      },
    });
    render(<SettingsBottomSheet open={true} onClose={vi.fn()} />);
    expect(screen.getByText("12")).toBeDefined(); // 55 - 40 - 3 = 12
  });

  it("shows correct tile counts", () => {
    setupStore({
      game: {
        status: "in_progress",
        board: { tiles: new Array(10).fill(0) }, // 10 tiles on board
        ownHand: new Array(7).fill(0), // 7 tiles in hand
        players: [{ id: "p1" }, { id: "p2" }, { id: "p3" }, { id: "p4" }],
      },
    });
    render(<SettingsBottomSheet open={true} onClose={vi.fn()} />);

    // Pool: 55 - 40 - 10 = 5
    expect(screen.getByText("5")).toBeDefined();
    // Board tiles
    expect(screen.getByText("10")).toBeDefined();
    // Own hand
    expect(screen.getByText("7")).toBeDefined();
  });

  it("shows in_progress status", () => {
    setupStore({ game: { status: "in_progress", board: { tiles: [] }, ownHand: [], players: [] } });
    render(<SettingsBottomSheet open={true} onClose={vi.fn()} />);
    expect(screen.getByText("En curso")).toBeDefined();
  });

  it("shows waiting status", () => {
    setupStore({ game: { status: "waiting", board: { tiles: [] }, ownHand: [], players: [] } });
    render(<SettingsBottomSheet open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Esperando")).toBeDefined();
  });

  it("shows finished status", () => {
    setupStore({ game: { status: "finished", board: { tiles: [] }, ownHand: [], players: [] } });
    render(<SettingsBottomSheet open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Finalizada")).toBeDefined();
  });

  it("renders with title 'Partida'", () => {
    setupStore();
    render(<SettingsBottomSheet open={true} onClose={vi.fn()} />);
    const sheet = screen.getByTestId("bottom-sheet");
    expect(sheet.getAttribute("data-title")).toBe("Partida");
  });
});
