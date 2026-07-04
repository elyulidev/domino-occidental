/**
 * board-path.test.ts
 *
 * Valida cada invariante listado en BOARD_LAYOUT_SPEC.md §8.
 * Si alguno de estos tests falla, el path o la lógica de colocación
 * violan el contrato del documento de diseño — no el test.
 */

import { describe, it, expect } from "bun:test";
import {
  generateSnakePath,
  generateDoubleNineSet,
  isDouble,
  resolveRenderOrientation,
  resolveFlipped,
  computeTileCells,
  createEmptyBoard,
  placeOpeningTile,
  placeTileAtEnd,
  nextRightSlotIndex,
  nextLeftSlotIndex,
  totalPlacedTiles,
  TOTAL_SLOTS,
  BOARD_COLS,
  BOARD_ROWS,
  OPENING_SLOT_INDEX,
  type PathSlot,
  type TileId,
} from "./board-path";

describe("generateSnakePath", () => {
  const path = generateSnakePath();

  it("I7 — genera exactamente 109 slots", () => {
    expect(path.length).toBe(TOTAL_SLOTS);
  });

  it("I8 — nunca usa columna fuera de 0..7", () => {
    for (const slot of path) {
      expect(slot.col).toBeGreaterThanOrEqual(0);
      expect(slot.col).toBeLessThanOrEqual(BOARD_COLS - 1);
    }
  });

  it("I8 — nunca usa fila fuera de 0..14", () => {
    for (const slot of path) {
      expect(slot.row).toBeGreaterThanOrEqual(0);
      expect(slot.row).toBeLessThanOrEqual(BOARD_ROWS - 1);
    }
  });

  it("fila par avanza RIGHT, fila impar avanza LEFT", () => {
    for (const slot of path) {
      const expectedDir = slot.row % 2 === 0 ? "right" : "left";
      expect(slot.direction).toBe(expectedDir);
    }
  });

  it("slot 0 está en A1 (col=0, row=0)", () => {
    expect(path[0]).toMatchObject({ col: 0, row: 0, direction: "right" });
  });

  it("slot 7 es esquina de pared derecha (H1)", () => {
    expect(path[7]).toMatchObject({
      col: 7,
      row: 0,
      isCorner: true,
      cornerWall: "right",
    });
  });

  it("slot 8 inicia la fila 1 en la misma columna que el slot 7 (H2)", () => {
    expect(path[8]).toMatchObject({ col: 7, row: 1, direction: "left" });
  });

  it("slot 15 es esquina de pared izquierda (A2)", () => {
    expect(path[15]).toMatchObject({
      col: 0,
      row: 1,
      isCorner: true,
      cornerWall: "left",
    });
  });

  it("todas las esquinas ocurren cada 8 slots empezando en el 7", () => {
    const cornerIndices = path
      .filter((s) => s.isCorner)
      .map((s) => s.index);
    const expected = Array.from(
      { length: cornerIndices.length },
      (_, i) => 7 + i * 8
    );
    expect(cornerIndices).toEqual(expected);
  });

  it("el slot 54 (apertura) existe dentro del rango válido", () => {
    expect(path[OPENING_SLOT_INDEX]).toBeDefined();
  });
});

describe("I1 — no colisión de celdas entre fichas adyacentes", () => {
  it("dos fichas consecutivas en tramo recto no comparten celdas", () => {
    const path = generateSnakePath();
    const slotA = path[2];
    const slotB = path[3];

    const tileA = {
      tileId: "1-2" as TileId,
      slotIndex: 2,
      slot: slotA,
      flipped: false,
      renderOrientation: resolveRenderOrientation(slotA, "1-2" as TileId),
    };
    const tileB = {
      tileId: "3-4" as TileId,
      slotIndex: 3,
      slot: slotB,
      flipped: false,
      renderOrientation: resolveRenderOrientation(slotB, "3-4" as TileId),
    };

    const cellsA = computeTileCells(tileA);
    const cellsB = computeTileCells(tileB);

    // Las fichas en columnas distintas deben tener baseX distinto
    expect(cellsA.c0.x).not.toBe(cellsB.c0.x);
  });
});

describe("I2 — la ficha de apertura siempre ocupa el slot 54", () => {
  it("placeOpeningTile asigna slotIndex 54", () => {
    const board = createEmptyBoard();
    const result = placeOpeningTile(board, "9-9" as TileId);
    expect(result.openingTile?.slotIndex).toBe(OPENING_SLOT_INDEX);
  });

  it("lanza error si se intenta colocar apertura dos veces", () => {
    const board = createEmptyBoard();
    const once = placeOpeningTile(board, "9-9" as TileId);
    expect(() => placeOpeningTile(once, "8-8" as TileId)).toThrow();
  });
});

describe("I3/I4 — crecimiento ordenado de extremos", () => {
  it("extremo derecho crece en slots 55, 56, 57...", () => {
    let board = createEmptyBoard();
    board = placeOpeningTile(board, "5-5" as TileId);
    board = placeTileAtEnd(board, "5-3" as TileId, "right");
    board = placeTileAtEnd(board, "3-2" as TileId, "right");

    expect(board.rightTiles[0].slotIndex).toBe(55);
    expect(board.rightTiles[1].slotIndex).toBe(56);
  });

  it("extremo izquierdo crece en slots 53, 52, 51...", () => {
    let board = createEmptyBoard();
    board = placeOpeningTile(board, "5-5" as TileId);
    board = placeTileAtEnd(board, "5-1" as TileId, "left");
    board = placeTileAtEnd(board, "1-0" as TileId, "left");

    expect(board.leftTiles[0].slotIndex).toBe(52); // más antigua, más lejos
    expect(board.leftTiles[1].slotIndex).toBe(53); // más nueva, más cerca del centro
  });
});

describe("I5/I6 — orientación correcta en esquinas", () => {
  const path = generateSnakePath();
  const cornerSlot = path.find((s) => s.isCorner)!;

  it("doble en esquina → 'perpendicular'", () => {
    const orientation = resolveRenderOrientation(cornerSlot, "8-8" as TileId);
    expect(orientation).toBe("perpendicular");
  });

  it("no-doble en esquina pared derecha → 'corner-right'", () => {
    const rightCorner = path.find((s) => s.cornerWall === "right")!;
    const orientation = resolveRenderOrientation(
      rightCorner,
      "7-9" as TileId
    );
    expect(orientation).toBe("corner-right");
  });

  it("no-doble en esquina pared izquierda → 'corner-left'", () => {
    const leftCorner = path.find((s) => s.cornerWall === "left")!;
    const orientation = resolveRenderOrientation(leftCorner, "2-6" as TileId);
    expect(orientation).toBe("corner-left");
  });

  it("ficha en tramo recto nunca usa orientación de esquina", () => {
    const straightSlot = path.find((s) => !s.isCorner)!;
    const orientation = resolveRenderOrientation(
      straightSlot,
      "9-9" as TileId // incluso un doble, en tramo recto, no es 'perpendicular'
    );
    expect(orientation).not.toBe("perpendicular");
    expect(orientation).not.toBe("corner-right");
    expect(orientation).not.toBe("corner-left");
  });
});

describe("I9 — fichas en forma canónica (head <= tail)", () => {
  it("el set completo nunca tiene head > tail", () => {
    const set = generateDoubleNineSet();
    for (const tileId of set) {
      const [h, t] = tileId.split("-").map(Number);
      expect(h).toBeLessThanOrEqual(t);
    }
  });

  it("genera exactamente 55 fichas únicas", () => {
    const set = generateDoubleNineSet();
    expect(set.length).toBe(55);
    expect(new Set(set).size).toBe(55);
  });
});

describe("Peor caso: todas las fichas a la derecha", () => {
  it("acomoda 54 fichas consecutivas sin desbordar el path", () => {
    let board = createEmptyBoard();
    board = placeOpeningTile(board, "0-0" as TileId);

    // Cadena artificial: cada ficha conecta por el valor libre anterior.
    // Solo se valida que el path acepte 54 colocaciones consecutivas.
    let current = board;
    for (let i = 0; i < 54; i++) {
      const freeValue = current.rightEndValue!;
      const nextValue = ((freeValue + 1) % 10) as 0;
      const tileId = `${Math.min(freeValue, nextValue)}-${Math.max(
        freeValue,
        nextValue
      )}` as TileId;
      current = placeTileAtEnd(current, tileId, "right");
    }

    expect(current.rightTiles.length).toBe(54);
    expect(totalPlacedTiles(current)).toBe(55); // 1 apertura + 54
    expect(current.rightTiles[53].slotIndex).toBe(108); // último slot válido
  });

  it("lanza error claro al intentar exceder el path", () => {
    let board = createEmptyBoard();
    board = placeOpeningTile(board, "0-0" as TileId);
    let current = board;

    expect(() => {
      for (let i = 0; i < 55; i++) {
        // 55 > 54 disponibles → debe fallar en la última iteración
        const freeValue = current.rightEndValue!;
        const nextValue = ((freeValue + 1) % 10) as 0;
        const tileId = `${Math.min(freeValue, nextValue)}-${Math.max(
          freeValue,
          nextValue
        )}` as TileId;
        current = placeTileAtEnd(current, tileId, "right");
      }
    }).toThrow();
  });
});

describe("resolveFlipped", () => {
  it("head conecta al extremo derecho → flipped true", () => {
    // tablero: rightEndValue = 5, ficha jugada "5-7"
    // head=5 conecta → flipped: true (head va hacia adentro)
    expect(resolveFlipped("5-7" as TileId, 5, "right")).toBe(true);
  });

  it("tail conecta al extremo derecho → flipped false", () => {
    // tablero: rightEndValue = 7, ficha jugada "5-7"
    // tail=7 conecta → flipped: false
    expect(resolveFlipped("5-7" as TileId, 7, "right")).toBe(false);
  });
});
