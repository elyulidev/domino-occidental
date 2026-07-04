/**
 * board-path.ts
 *
 * Implementación de referencia del sistema de coordenadas del tablero.
 * Ver BOARD_LAYOUT_SPEC.md para la justificación completa de cada decisión.
 *
 * Esta es la ÚNICA fuente de verdad para generación de path, resolución de
 * esquinas y cálculo de orientación. No duplicar esta lógica en otro lugar.
 */

// ─── Primitivos ──────────────────────────────────────────────────────────────

export type PipValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** Siempre en forma canónica: head ≤ tail. Ejemplo: "3-7", "0-0", "9-9" */
export type TileId = `${PipValue}-${PipValue}`;

export type ColIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7; // A=0 ... H=7

export const BOARD_COLS = 8;
export const BOARD_ROWS = 15;
export const TOTAL_SLOTS = 109;
export const OPENING_SLOT_INDEX = 54;

export const CELL_PX = 24;
export const HALF_W = CELL_PX * 2;
export const HALF_H = CELL_PX * 2;
export const TILE_W = CELL_PX * 4;
export const TILE_H = CELL_PX * 2;

// ─── Path ────────────────────────────────────────────────────────────────────

export type SlotDirection = "right" | "left";
export type CornerWall = "right" | "left" | null;

export type PathSlot = {
  index: number;
  col: ColIndex;
  row: number;
  direction: SlotDirection;
  isCorner: boolean;
  cornerWall: CornerWall;
};

export type TileRenderOrientation =
  | "horizontal"
  | "horizontal-flipped"
  | "corner-right"
  | "corner-left"
  | "perpendicular";

export type PlacedTile = {
  tileId: TileId;
  slotIndex: number;
  slot: PathSlot;
  flipped: boolean;
  renderOrientation: TileRenderOrientation;
};

export type BoardState = {
  readonly path: PathSlot[];
  openingTile: PlacedTile | null;
  rightTiles: PlacedTile[];
  leftTiles: PlacedTile[];
  rightEndValue: PipValue | null;
  leftEndValue: PipValue | null;
};

// ─── Generación del path (snake) ──────────────────────────────────────────────

/**
 * Genera el camino serpenteante completo. Determinista: misma salida siempre
 * para los mismos parámetros. Se llama UNA VEZ al iniciar la partida.
 */
export function generateSnakePath(
  cols: number = BOARD_COLS,
  totalSlots: number = TOTAL_SLOTS
): PathSlot[] {
  const path: PathSlot[] = [];
  let col = 0;
  let row = 0;
  let direction: SlotDirection = "right";

  for (let i = 0; i < totalSlots; i++) {
    const isRightCorner = direction === "right" && col === cols - 1;
    const isLeftCorner = direction === "left" && col === 0;
    const isCorner = isRightCorner || isLeftCorner;

    path.push({
      index: i,
      col: col as ColIndex,
      row,
      direction,
      isCorner,
      cornerWall: isRightCorner ? "right" : isLeftCorner ? "left" : null,
    });

    if (isCorner) {
      row += 1;
      direction = direction === "right" ? "left" : "right";
    } else {
      col += direction === "right" ? 1 : -1;
    }
  }

  return path;
}

// ─── Helpers de fichas ─────────────────────────────────────────────────────────

export function isDouble(tileId: TileId): boolean {
  const [h, t] = tileId.split("-").map(Number);
  return h === t;
}

export function parseTileId(tileId: TileId): [PipValue, PipValue] {
  const [h, t] = tileId.split("-").map(Number);
  return [h as PipValue, t as PipValue];
}

export function toCanonicalTileId(a: PipValue, b: PipValue): TileId {
  const [h, t] = a <= b ? [a, b] : [b, a];
  return `${h}-${t}` as TileId;
}

/** Genera las 55 fichas únicas del set doble-9. */
export function generateDoubleNineSet(): TileId[] {
  const tiles: TileId[] = [];
  for (let a = 0; a <= 9; a++) {
    for (let b = a; b <= 9; b++) {
      tiles.push(`${a}-${b}` as TileId);
    }
  }
  return tiles; // 55 fichas
}

// ─── Resolución de orientación de renderizado ─────────────────────────────────

export function resolveRenderOrientation(
  slot: PathSlot,
  tileId: TileId
): TileRenderOrientation {
  if (!slot.isCorner) {
    return slot.direction === "right" ? "horizontal" : "horizontal-flipped";
  }
  if (isDouble(tileId)) {
    return "perpendicular";
  }
  return slot.cornerWall === "right" ? "corner-right" : "corner-left";
}

/**
 * Determina si la ficha debe renderizarse "volteada": cuál mitad (head/tail)
 * queda hacia el interior de la cadena (conectando con el extremo existente).
 */
export function resolveFlipped(
  tileId: TileId,
  connectingValue: PipValue,
  end: "left" | "right"
): boolean {
  const [head, tail] = parseTileId(tileId);
  if (end === "right") {
    return head === connectingValue;
  }
  return tail === connectingValue;
}

// ─── Cálculo de píxeles para renderizado ──────────────────────────────────────

export type TileCells = {
  c0: { x: number; y: number };
  c1: { x: number; y: number };
  c2: { x: number; y: number };
  c3: { x: number; y: number };
};

/**
 * Calcula las 4 esquinas de celdas de píxeles para una ficha colocada,
 * según su slot y orientación de renderizado. Esta es la única función
 * que el componente de renderizado (React/SVG/Canvas) debe consultar
 * para posicionar una ficha.
 */
export function computeTileCells(placed: PlacedTile): TileCells {
  const { slot, renderOrientation } = placed;
  const baseX = slot.col * TILE_W;
  const baseY = slot.row * TILE_H;

  switch (renderOrientation) {
    case "horizontal":
    case "horizontal-flipped":
      return {
        c0: { x: baseX, y: baseY },
        c1: { x: baseX + HALF_W, y: baseY },
        c2: { x: baseX + HALF_W, y: baseY },
        c3: { x: baseX + TILE_W, y: baseY },
      };

    case "corner-right":
      // giro en L: head en fila actual (2 celdas horizontales),
      // tail en fila siguiente (2 celdas verticales), columna fija = pared.
      return {
        c0: { x: baseX, y: baseY },
        c1: { x: baseX + HALF_W, y: baseY },
        c2: { x: baseX + HALF_W, y: baseY + TILE_H },
        c3: { x: baseX + HALF_W, y: baseY + TILE_H + HALF_H },
      };

    case "corner-left":
      return {
        c0: { x: baseX + HALF_W, y: baseY },
        c1: { x: baseX, y: baseY },
        c2: { x: baseX, y: baseY + TILE_H },
        c3: { x: baseX, y: baseY + TILE_H + HALF_H },
      };

    case "perpendicular": {
      // doble en esquina: bloque 2x2 centrado en la intersección col/fila.
      const cornerX = baseX + HALF_W / 2;
      const cornerY = baseY + HALF_H / 2;
      return {
        c0: { x: cornerX, y: cornerY },
        c1: { x: cornerX + HALF_W, y: cornerY },
        c2: { x: cornerX, y: cornerY + HALF_H },
        c3: { x: cornerX + HALF_W, y: cornerY + HALF_H },
      };
    }
  }
}

// ─── Estado del tablero: inicialización y mutaciones ──────────────────────────

export function createEmptyBoard(): BoardState {
  return {
    path: generateSnakePath(),
    openingTile: null,
    rightTiles: [],
    leftTiles: [],
    rightEndValue: null,
    leftEndValue: null,
  };
}

export function nextRightSlotIndex(board: BoardState): number {
  if (!board.openingTile) return OPENING_SLOT_INDEX;
  return OPENING_SLOT_INDEX + board.rightTiles.length + 1;
}

export function nextLeftSlotIndex(board: BoardState): number {
  if (!board.openingTile) {
    throw new Error("No opening tile placed yet");
  }
  return OPENING_SLOT_INDEX - board.leftTiles.length - 1;
}

export function totalPlacedTiles(board: BoardState): number {
  return (
    (board.openingTile ? 1 : 0) +
    board.rightTiles.length +
    board.leftTiles.length
  );
}

/**
 * Coloca la ficha de apertura (siempre en el slot 54). Lanza si ya existe.
 */
export function placeOpeningTile(
  board: BoardState,
  tileId: TileId
): BoardState {
  if (board.openingTile) {
    throw new Error("Opening tile already placed");
  }
  const slot = board.path[OPENING_SLOT_INDEX];
  const [head, tail] = parseTileId(tileId);

  const placed: PlacedTile = {
    tileId,
    slotIndex: OPENING_SLOT_INDEX,
    slot,
    flipped: false,
    renderOrientation: resolveRenderOrientation(slot, tileId),
  };

  return {
    ...board,
    openingTile: placed,
    leftEndValue: head,
    rightEndValue: tail,
  };
}

/**
 * Coloca una ficha en el extremo indicado. Asume que la jugada ya fue
 * validada externamente (no revalida reglas de juego, solo gestiona el path).
 */
export function placeTileAtEnd(
  board: BoardState,
  tileId: TileId,
  end: "left" | "right"
): BoardState {
  if (!board.openingTile) {
    throw new Error("Cannot place at end before opening tile is placed");
  }

  const connectingValue =
    end === "right" ? board.rightEndValue! : board.leftEndValue!;
  const flipped = resolveFlipped(tileId, connectingValue, end);
  const [head, tail] = parseTileId(tileId);
  const newFreeValue = flipped ? tail : head; // la mitad que queda libre

  const slotIndex =
    end === "right" ? nextRightSlotIndex(board) : nextLeftSlotIndex(board);

  if (slotIndex < 0 || slotIndex >= TOTAL_SLOTS) {
    throw new Error(
      `Path exhausted: slotIndex ${slotIndex} out of bounds [0, ${TOTAL_SLOTS})`
    );
  }

  const slot = board.path[slotIndex];
  const placed: PlacedTile = {
    tileId,
    slotIndex,
    slot,
    flipped,
    renderOrientation: resolveRenderOrientation(slot, tileId),
  };

  if (end === "right") {
    return {
      ...board,
      rightTiles: [...board.rightTiles, placed],
      rightEndValue: newFreeValue,
    };
  } else {
    return {
      ...board,
      leftTiles: [placed, ...board.leftTiles],
      leftEndValue: newFreeValue,
    };
  }
}
