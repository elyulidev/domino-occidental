# BOARD_LAYOUT_SPEC.md — Sistema de Tablero — Dominó Occidental Doble 9

> **Propósito**: Especificación inequívoca del sistema de coordenadas, tamaño de fichas,
> camino predefinido (snake path) y casos de esquina. Toda decisión de renderizado debe
> derivarse de este documento. No existe lógica de tablero que no esté descrita aquí.

---

## 1. Sistema de Coordenadas (tipo ajedrez)

El tablero es una cuadrícula indexada en dos dimensiones:

```
Columnas (eje X):  A  B  C  D  E  F  G  H
Índice interno:    0  1  2  3  4  5  6  7   ← 8 columnas fijas, nunca cambia

Filas (eje Y):     0  1  2  3  4  5  ... 14   ← 15 filas reservadas (ver §6)
```

Una **posición** en el tablero es el par `(col: 0..7, row: 0..14)`.
Notación legible: `A1` = (0, 0), `H3` = (7, 2), `D8` = (3, 7).

**El tablero NO crece dinámicamente durante la partida.**
Las 15 filas se reservan al inicio y se llenan a medida que se juegan fichas.

---

## 2. Tamaño de Ficha — Regla de las 4 Celdas de Renderizado

Cada posición lógica de la cuadrícula se renderiza como **4 celdas de píxeles** (2 por mitad).
Esto garantiza espacio suficiente para mostrar los puntos y evitar colisiones visuales
en cualquier orientación, incluyendo las esquinas.

```
FICHA HORIZONTAL (dirección →  o  ←):

  ┌──────┬──────╦──────┬──────┐
  │  c0  │  c1  ║  c2  │  c3  │
  └──────┴──────╩──────┴──────┘
   ←──── head ────╫──── tail ────→
         (2 celdas)║(2 celdas)
                   ║
              doble línea = separación visual entre mitades


FICHA VERTICAL (dirección ↓ o ↑):

  ┌──────┬──────┐
  │  c0  │  c1  │  ← head (2 celdas)
  ├══════╪══════╡
  │  c2  │  c3  │  ← tail (2 celdas)
  └──────┴──────┘
```

> **Invariante 1**: Dos fichas distintas jamás comparten ninguna de sus 4 celdas de renderizado.
> El sistema de posicionamiento debe garantizar esto para TODA orientación, incluidas las esquinas.

### Mapa de celdas por slot

Dado un slot en posición `(col, row)` con orientación horizontal:

```
Celda c0 → pixel_x = col * TILE_W,           pixel_y = row * TILE_H
Celda c1 → pixel_x = col * TILE_W + HALF_W,  pixel_y = row * TILE_H
Celda c2 → pixel_x = col * TILE_W + HALF_W,  pixel_y = row * TILE_H   ← separador interno
Celda c3 → pixel_x = col * TILE_W + TILE_W,  pixel_y = row * TILE_H

// Valores recomendados:
const CELL_PX  = 24;    // píxeles por celda de renderizado
const HALF_W   = CELL_PX * 2;   // ancho de cada mitad
const TILE_W   = CELL_PX * 4;   // ancho total de ficha horizontal
const TILE_H   = CELL_PX * 2;   // alto de ficha horizontal (2 celdas de alto para aspecto visual)
```

---

## 3. El Camino Predefinido (Snake Path)

### 3.1 Concepto

El camino es un **array inmutable de 109 `PathSlot`** generado UNA SOLA VEZ al iniciar
la partida, ANTES de que se juegue ninguna ficha.

Cada `PathSlot` describe dónde y cómo se renderizará la ficha que ocupe ese índice.
No hay cálculo de posición en tiempo de jugada: solo se busca el slot por índice.

### 3.2 Dirección del camino por fila

```
Fila  0:  col 0→1→2→3→4→5→6→7   (dirección RIGHT)
Fila  1:  col 7→6→5→4→3→2→1→0   (dirección LEFT)
Fila  2:  col 0→1→2→3→4→5→6→7   (dirección RIGHT)
Fila  3:  col 7→6→5→4→3→2→1→0   (dirección LEFT)
...
Fila 14:  col 0→1→2→3→4→5→6→7   (dirección RIGHT, 14 es par)

Regla: fila par → RIGHT (A→H), fila impar → LEFT (H→A)
```

### 3.3 Índice de apertura y extensión de extremos

```
PATH[0]   ... PATH[53]  → slots del EXTREMO IZQUIERDO (hasta 54 fichas)
PATH[54]                → FICHA DE APERTURA (doble mayor disponible)
PATH[55]  ... PATH[108] → slots del EXTREMO DERECHO (hasta 54 fichas)

Extremo IZQUIERDO: crece ocupando PATH[53], PATH[52], PATH[51]... (decreciente)
Extremo DERECHO:   crece ocupando PATH[55], PATH[56], PATH[57]... (creciente)
```

> **Invariante 2**: La ficha de apertura ocupa SIEMPRE el slot 54. Jamás otro.

> **Invariante 3**: El extremo derecho solo avanza hacia índices crecientes (55, 56...).
> El extremo izquierdo solo avanza hacia índices decrecientes (53, 52...).

### 3.4 Algoritmo de generación del path

```typescript
export function generateSnakePath(
  cols: number = 8,
  totalSlots: number = 109
): PathSlot[] {
  const path: PathSlot[] = [];
  let col = 0;
  let row = 0;
  let direction: 'right' | 'left' = 'right';

  for (let i = 0; i < totalSlots; i++) {
    const isRightCorner = direction === 'right' && col === cols - 1;
    const isLeftCorner  = direction === 'left'  && col === 0;
    const isCorner      = isRightCorner || isLeftCorner;

    path.push({
      index: i,
      col,
      row,
      direction,
      isCorner,
      cornerWall: isRightCorner ? 'right' : isLeftCorner ? 'left' : null,
    });

    if (isCorner) {
      // Al llegar a una pared: avanzar a la siguiente fila, invertir dirección.
      // La columna NO cambia en este paso: el primer slot de la nueva fila
      // está en la misma columna que el último slot de la fila anterior.
      row      += 1;
      direction = direction === 'right' ? 'left' : 'right';
    } else {
      col += direction === 'right' ? 1 : -1;
    }
  }

  return path;
}
```

**Resultado para los primeros 20 slots** (verificación):

```
Slot  0: col=0, row=0, dir=right, isCorner=false  → A1
Slot  1: col=1, row=0, dir=right, isCorner=false  → B1
...
Slot  7: col=7, row=0, dir=right, isCorner=TRUE   → H1  ← ESQUINA PARED DERECHA
Slot  8: col=7, row=1, dir=left,  isCorner=false  → H2
Slot  9: col=6, row=1, dir=left,  isCorner=false  → G2
...
Slot 15: col=0, row=1, dir=left,  isCorner=TRUE   → A2  ← ESQUINA PARED IZQUIERDA
Slot 16: col=0, row=2, dir=right, isCorner=false  → A3
...
```

> **Nota sobre el slot 8**: El primer slot de la fila 1 está en `col=7` (H), la misma
> columna que el slot 7. Esto es CORRECTO e INTENCIONAL. El slot 7 es la esquina del
> extremo derecho y el slot 8 es el inicio del recorrido en la dirección opuesta,
> ambos en la columna H. El renderizado distingue visualmente estos dos casos (ver §4).

---

## 4. Esquinas — Dos Casos Exactos

Una esquina es cualquier slot donde `isCorner === true`.
Los slots de esquina son: 7, 15, 23, 31, 39, 47, 55, 63, 71, 79, 87, 95, 103 (cada 8).

En cada esquina, la ficha que se coloca tiene DOS modos de renderizado posibles,
determinados en el momento de la jugada según el tipo de ficha colocada.

---

### 4a. CASO NORMAL — Ficha no doble en la esquina

La ficha hace un **giro en L**. Las 4 celdas se distribuyen:
- 2 celdas en la dirección de la fila actual (mitad `head`)
- 2 celdas en la dirección de la nueva fila (mitad `tail`)

```
ESQUINA PARED DERECHA (slot en col=7, ejemplo fila 0→1):

  Fila 0:  ... [E] [F] [G|   ←── mitad HEAD del slot 7 (2 celdas en fila 0)
                         |
  Fila 1:       [H2→G] ...   ←── mitad TAIL del slot 7 (2 celdas en fila 1)

Representación de celdas del slot 7:
  c0 = (col*TILE_W,          row_0*TILE_H)   ← head, celda izquierda
  c1 = (col*TILE_W + HALF_W, row_0*TILE_H)   ← head, celda derecha
  c2 = (col*TILE_W + HALF_W, row_1*TILE_H)   ← tail, celda superior (nueva fila)
  c3 = (col*TILE_W + HALF_W, row_1*TILE_H + HALF_H) ← tail, celda inferior

Orientación = 'corner-right' (giro hacia abajo en pared derecha)
```

```
ESQUINA PARED IZQUIERDA (slot en col=0, ejemplo fila 1→2):

  Fila 1:  ... [B] [A|   ←── mitad HEAD del slot (2 celdas en fila 1)
                    |
  Fila 2:  [A2→B] ...    ←── mitad TAIL del slot (2 celdas en fila 2)

Orientación = 'corner-left' (giro hacia abajo en pared izquierda)
```

---

### 4b. CASO CON DOBLE — Doble en la esquina (⊥ perpendicular)

Cuando la ficha en la esquina ES un doble `[V|V]`, se coloca **perpendicular**
a la dirección del camino. Ocupa un bloque **2×2** celdas centrado en la pared:

```
DOBLE EN ESQUINA PARED DERECHA (ejemplo: [8|8] en col=7, fila 0→1):

  Fila 0:  ... [G|8→]
                   ┌──────┬──────┐
                   │  8   │  8   │  ← head del doble (2 celdas, fila 0 parte inferior)
                   ├══════╪══════╡  ← separador interno
                   │  8   │  8   │  ← tail del doble (2 celdas, fila 1 parte superior)
                   └──────┴──────┘
  Fila 1:               [←8|G] ...

El doble se centra en la intersección entre fila 0 y fila 1, en la columna de la pared.
```

**Celdas del bloque perpendicular (slot en col=7, pared derecha):**

```typescript
const cornerX = col * TILE_W + HALF_W;   // centrado en la columna
const cornerY = row * TILE_H + HALF_H;   // centrado entre filas

c0 = (cornerX,          cornerY)           // head, arriba-izquierda
c1 = (cornerX + HALF_W, cornerY)           // head, arriba-derecha
c2 = (cornerX,          cornerY + HALF_H)  // tail, abajo-izquierda
c3 = (cornerX + HALF_W, cornerY + HALF_H)  // tail, abajo-derecha
```

> **Regla crítica**: Un doble en esquina usa `renderOrientation: 'perpendicular'`.
> Un no-doble en esquina usa `renderOrientation: 'corner-right'` o `'corner-left'`.
> Esta distinción se determina en `applyAction()` cuando se coloca la ficha.

**¿Cómo detectar si una ficha es doble?**

```typescript
function isDouble(tileId: TileId): boolean {
  const [head, tail] = tileId.split('-').map(Number);
  return head === tail;
}
```

---

### 4c. Tabla resumen de orientaciones de renderizado

| Situación | `isCorner` | Es doble | `renderOrientation` |
|---|---|---|---|
| Tramo recto, fila va RIGHT | false | cualquiera | `'horizontal'` |
| Tramo recto, fila va LEFT | false | cualquiera | `'horizontal-flipped'` |
| Esquina pared derecha, no doble | true | false | `'corner-right'` |
| Esquina pared izquierda, no doble | true | false | `'corner-left'` |
| Esquina pared derecha, **doble** | true | **true** | `'perpendicular'` |
| Esquina pared izquierda, **doble** | true | **true** | `'perpendicular'` |

> La orientación `'perpendicular'` es idéntica para ambas paredes: el doble es siempre
> un bloque 2×2 centrado en la intersección. La distinción left/right no cambia su forma.

---

## 5. La Ficha `flipped`

Una ficha tiene dos mitades: `head` y `tail`. En `TileId`, siempre `head ≤ tail` (forma canónica).

Cuando se coloca una ficha, el lado que conecta al extremo del tablero puede ser
cualquiera de las dos mitades. El campo `flipped` registra esto:

```typescript
// Ejemplo: tablero tiene extremo derecho = 7, se juega la ficha "5-7"
// La mitad con valor 7 debe estar hacia adentro (conectando con el extremo)
// La ficha canónica es [5|7], la mitad 7 está en `tail`
// → se coloca con head=5 afuera y tail=7 adentro → flipped: false

// Ejemplo: tablero tiene extremo derecho = 5, se juega la ficha "5-7"  
// La mitad con valor 5 debe estar hacia adentro
// La ficha canónica es [5|7], la mitad 5 está en `head`
// → se coloca con tail=7 afuera y head=5 adentro → flipped: true
```

```typescript
function resolveFlipped(
  tileId: TileId,
  connectingValue: PipValue,
  end: 'left' | 'right'
): boolean {
  const [head, tail] = tileId.split('-').map(Number) as [PipValue, PipValue];
  // connecting value debe quedar "hacia adentro" (pegado al extremo actual)
  if (end === 'right') {
    // para extremo derecho, la cabeza visible debe ser la que NO conecta
    return head === connectingValue; // si head conecta, head va adentro → flipped
  } else {
    return tail === connectingValue;
  }
}
```

> **Invariante 4**: Para fichas en tramos rectos, `flipped` determina cuál mitad
> se renderiza a la izquierda/arriba (head visual) y cuál a la derecha/abajo (tail visual).
> Para fichas dobles, `flipped` es irrelevante (ambas mitades son iguales) pero debe
> almacenarse de todas formas para consistencia del tipo.

---

## 6. Dimensiones del Tablero y Peores Casos

### Casos extremos que el sistema DEBE acomodar

```
Set doble-9: 55 fichas totales
Ficha de apertura: 1 ficha en slot 54

PEOR CASO "todo a la derecha":
  Fichas en extremo derecho: 54
  Slots usados: 55, 56, 57, ..., 108  (54 slots)
  Filas usadas desde slot 54: 54 / 8 = 6.75 → 7 filas adicionales

PEOR CASO "todo a la izquierda":
  Fichas en extremo izquierdo: 54
  Slots usados: 53, 52, 51, ..., 0   (54 slots)
  Filas usadas antes de slot 54: 54 / 8 = 6.75 → 7 filas anteriores

CASO PARTIDA BALANCEADA (típico):
  ~27 fichas por extremo
  ~4 filas adicionales en cada dirección
```

### Dimensiones pre-reservadas

```
Slots totales: 109  (0..108)
Columnas:        8  (A..H, índices 0..7)
Filas:          15  (índices 0..14)

Slot 54 está en:
  fila  = floor(54 / 8) = 6
  col   = 54 % 8 = 6  → columna G (índice 6)
  (pero el path zigzagea, entonces el cálculo real es el del algoritmo §3.4)

Board mínimo reservado:
  8 columnas × 15 filas = 120 slots ≥ 109 necesarios ✓
```

> **Invariante 5**: La cuadrícula siempre se pre-reserva en **8 × 15 slots**.
> Aunque la partida use 20 fichas, el espacio de 120 slots existe desde el inicio.
> El renderizado puede ocultar filas vacías, pero el cálculo de posiciones usa siempre
> la cuadrícula completa de 15 filas.

---

## 7. TypeScript — Tipos Completos y Definitivos

```typescript
// ─── Primitivos ──────────────────────────────────────────────────────────────

export type PipValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** Siempre en forma canónica: head ≤ tail. Ejemplo: "3-7", "0-0", "9-9" */
export type TileId = `${PipValue}-${PipValue}`;

export type ColIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;  // A=0 ... H=7

// ─── Path ────────────────────────────────────────────────────────────────────

export type SlotDirection = 'right' | 'left';
export type CornerWall    = 'right' | 'left' | null;

export type PathSlot = {
  index:      number;         // posición absoluta en el path (0..108)
  col:        ColIndex;       // columna en la cuadrícula
  row:        number;         // fila en la cuadrícula (0..14)
  direction:  SlotDirection;  // dirección de avance del camino en este punto
  isCorner:   boolean;        // true si es el último slot de una fila (punto de giro)
  cornerWall: CornerWall;     // qué pared toca; null si no es esquina
};

// ─── Renderizado ─────────────────────────────────────────────────────────────

export type TileRenderOrientation =
  | 'horizontal'         // tramo recto, fila va RIGHT, ficha de izquierda a derecha
  | 'horizontal-flipped' // tramo recto, fila va LEFT, ficha de derecha a izquierda
  | 'corner-right'       // giro en pared derecha, ficha no doble (forma L)
  | 'corner-left'        // giro en pared izquierda, ficha no doble (forma L invertida)
  | 'perpendicular';     // doble en cualquier esquina (bloque 2×2, forma ⊥)

// ─── Fichas colocadas ────────────────────────────────────────────────────────

export type PlacedTile = {
  tileId:            TileId;
  slotIndex:         number;              // índice en PATH (0..108)
  slot:              PathSlot;            // referencia al slot (pre-computado)
  flipped:           boolean;             // true si tail conecta al extremo (ver §5)
  renderOrientation: TileRenderOrientation;
};

// ─── Estado del tablero ──────────────────────────────────────────────────────

export type BoardState = {
  /** Path completo, pre-computado al inicio. NUNCA se modifica. */
  readonly path: PathSlot[];             // exactamente 109 elementos

  /** Ficha de apertura. Null antes de que se juegue la primera ficha. */
  openingTile: PlacedTile | null;

  /** Fichas del extremo derecho, en orden de colocación [más antigua → más nueva]. */
  rightTiles: PlacedTile[];

  /** Fichas del extremo izquierdo, en orden de colocación [más antigua → más nueva]. */
  leftTiles: PlacedTile[];

  /** Valor de conexión en el extremo derecho. Null si no se han jugado fichas. */
  rightEndValue: PipValue | null;

  /** Valor de conexión en el extremo izquierdo. Null si no se han jugado fichas. */
  leftEndValue: PipValue | null;
};

// ─── Helpers derivados ───────────────────────────────────────────────────────

/** Slot donde se colocaría la PRÓXIMA ficha en el extremo derecho. */
export function nextRightSlotIndex(board: BoardState): number {
  if (!board.openingTile) return 54; // la apertura va aquí
  return 54 + board.rightTiles.length + 1;
}

/** Slot donde se colocaría la PRÓXIMA ficha en el extremo izquierdo. */
export function nextLeftSlotIndex(board: BoardState): number {
  if (!board.openingTile) throw new Error('No opening tile placed yet');
  return 54 - board.leftTiles.length - 1;
}

/** Total de fichas actualmente en el tablero (apertura + ambos extremos). */
export function totalPlacedTiles(board: BoardState): number {
  return (board.openingTile ? 1 : 0)
       + board.rightTiles.length
       + board.leftTiles.length;
}

/** Determina la orientación de renderizado de una ficha al colocarla. */
export function resolveRenderOrientation(
  slot: PathSlot,
  tileId: TileId
): TileRenderOrientation {
  if (!slot.isCorner) {
    return slot.direction === 'right' ? 'horizontal' : 'horizontal-flipped';
  }
  // Es esquina: distinguir doble vs no doble
  if (isDouble(tileId)) {
    return 'perpendicular';
  }
  return slot.cornerWall === 'right' ? 'corner-right' : 'corner-left';
}

export function isDouble(tileId: TileId): boolean {
  const [h, t] = tileId.split('-').map(Number);
  return h === t;
}
```

---

## 8. Invariantes Absolutas — Checklist para la IA

La IA de código NUNCA debe generar lógica que viole estos invariantes:

| # | Invariante | Consecuencia de violación |
|---|---|---|
| **I1** | Dos fichas no comparten ninguna celda de renderizado | Colisión visual |
| **I2** | La ficha de apertura siempre ocupa el slot 54 | Cadena rota |
| **I3** | `rightTiles` crece por slots 55, 56, 57... en orden | Path desordenado |
| **I4** | `leftTiles` crece por slots 53, 52, 51... en orden | Path desordenado |
| **I5** | Doble en esquina → `renderOrientation: 'perpendicular'` | Visual incorrecto |
| **I6** | No-doble en esquina → `'corner-right'` o `'corner-left'` (nunca `'horizontal'`) | Visual incorrecto |
| **I7** | El path tiene exactamente 109 slots (0..108), nunca más, nunca menos | Desbordamiento |
| **I8** | La cuadrícula siempre se reserva como 8×15 desde el inicio | Slots inválidos |
| **I9** | `TileId` siempre tiene `head ≤ tail` (forma canónica) | Duplicados en set |
| **I10** | Un slot usado no puede volver a usarse (inmutabilidad del path asignado) | Ficha duplicada |

---

## 9. Casos Límite Explícitos que el Sistema DEBE Manejar

### 9.1 Todas las fichas a la derecha (worst case right)

```
board.openingTile  → slot 54
board.rightTiles   → slots 55..108  (54 fichas, filas 6..13 del grid)
board.leftTiles    → [] (vacío)
board.leftEndValue → igual al tail/head libre de la ficha de apertura
```

El tablero renderiza filas 0..13 activas (la fila 14 existe pero vacía).
`nextLeftSlotIndex()` retorna 53 (disponible pero nunca usado en este caso).

### 9.2 Todas las fichas a la izquierda (worst case left)

```
board.openingTile  → slot 54
board.leftTiles    → slots 53..0   (54 fichas, filas 0..6 del grid)
board.rightTiles   → []
board.rightEndValue → igual al tail/head libre de la ficha de apertura
```

### 9.3 Doble en la primera esquina (slot 61 = col H, fila 7)

```
PATH[61] = { col: 7, row: 7, isCorner: true, cornerWall: 'right' }
ficha jugada: "9-9" → isDouble("9-9") = true
→ renderOrientation: 'perpendicular'
→ render como bloque 2×2 centrado en intersección (row 7 ↔ row 8) en col 7
```

### 9.4 No-doble en la primera esquina (slot 61)

```
ficha jugada: "7-9" → isDouble("7-9") = false
→ renderOrientation: 'corner-right'
→ render como L: head en fila 7 (cols H, 2 celdas), tail en fila 8 (col H, 2 celdas)
```

---

## 10. Lo que está FUERA de este spec

Los siguientes temas tienen sus propios documentos y NO deben mezclarse con la lógica del tablero:

- Reglas de jugada válida (`DOMINO_RULES.md`) — qué fichas se pueden colocar y dónde
- Gestión de manos y boneyard (`game-state.ts`) — qué fichas tiene cada jugador
- Puntuación y condición de victoria (`scoring.ts`) — cómo se cuentan los puntos
- Comunicación WebSocket (`game-room.ts`) — sincronización entre jugadores
- Animaciones de colocación — responsabilidad del componente React, no del motor

---

*Este documento es la fuente de verdad para todo lo relacionado con el tablero.*
*Versión: 1.0 — Generado a partir del diagrama manual de diseño del tablero.*
