#!/usr/bin/env bun
/**
 * L-Corner Pure Trace — visualiza el caso space=0 sin giroExtreme
 * y lo que pasa DESPUES con tiles subsiguientes.
 */
import { computeGridLayout } from "../packages/shared/src/game/grid-layout";
import type { PlacedTile } from "../packages/shared";

function makeTiles(
  top: number, bottom: number, id: string,
  side: "left" | "right", slotIndex: number,
): PlacedTile {
  return { tile: { top, bottom, id }, side, playerId: "p0", slotIndex, flipped: false };
}

function showGrid(table: string, tiles: Array<{ id: string; label: string }>, grid: ReturnType<typeof computeGridLayout>) {
  console.log(`\n${table}`);
  console.log("=".repeat(table.length));

  // Trace each tile
  for (const t of tiles) {
    const gt = grid.tiles.find((g) => g.tileId === t.id);
    if (!gt) { console.log(`  ${t.label}: NO ENCONTRADO`); continue; }
    const c = gt.cells;
    const orient = gt.orientation === "horizontal" ? "HORIZ" : "VERT";
    let info = "";
    if (gt.isDouble && gt.floats.length > 0) {
      info = ` floats:F${gt.floats[0].row}:C${gt.floats[0].col},F${gt.floats[1].row}:C${gt.floats[1].col}`;
    }
    const center = `center=(${((c[0].col + c[1].col) / 2).toFixed(1)}, ${((c[0].row + c[1].row) / 2).toFixed(1)})`;
    console.log(`  ${t.label}`);
    console.log(`    cells: F${c[0].row}:C${c[0].col}(${c[0].value}) -- F${c[1].row}:C${c[1].col}(${c[1].value})  ${center}`);
    console.log(`    ${orient}${info}`);
    if (gt.isDouble && gt.orientation === "horizontal") {
      console.log(`    ** DOBLE HORIZONTAL en newRow — falta spinner end opuesto **`);
    }
  }

  // Grid as table
  const allRows = Array.from(grid.occupied.keys())
    .map((k) => Number(k.split(":")[0]))
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => b - a);

  console.log();
  const cellW = 3;
  let header = "      ";
  for (let c = 0; c < 16; c++) header += `C${String(c).padEnd(cellW - 1, " ")}`;
  console.log(header);

  for (const r of allRows) {
    let line = `F${String(r).padStart(3, " ")} `;
    for (let c = 0; c < 16; c++) {
      const val = grid.occupied.get(`${r}:${c}`);
      line += val !== undefined ? ` ${String(val).padEnd(cellW - 1, " ")}` : " .  ";
    }
    console.log(line);
  }

  // Heads
  console.log(`\nHeads:`);
  console.log(`  left:  F${grid.leftHead?.row}:C${grid.leftHead?.col} dir=${grid.leftHead?.dir} giro=${grid.leftHead?.giroExtreme ?? false}`);
  console.log(`  right: F${grid.rightHead?.row}:C${grid.rightHead?.col} dir=${grid.rightHead?.dir} giro=${grid.rightHead?.giroExtreme ?? false}`);
}

// =========================================================================
// SECUENCIA CON [7|2] DESPUES DEL L-CORNER
// =========================================================================
console.log("═══════════════════════════════════════");
console.log("  SECUENCIA 1: [8|7] L-corner → [7|2]");
console.log("═══════════════════════════════════════\n");

// Step 0-5: same as before (double opening → reach C15 → L-corner)
// Step 6: [7|2] on right — continues from L-corner head at F-2:C15←
const seq1: PlacedTile[] = [
  makeTiles(9, 9, "t0", "left", 0),
  makeTiles(4, 9, "t1", "right", 1),
  makeTiles(5, 4, "t2", "right", 2),
  makeTiles(6, 5, "t3", "right", 3),
  makeTiles(8, 6, "t4", "right", 4),   // llega a C15
  makeTiles(7, 8, "t5", "right", 5),   // L-corner pure → F-1:C15, F-2:C15
  makeTiles(2, 7, "t6", "right", 6),   // POST L-corner: continua desde F-2:C15←
];

const grid1 = computeGridLayout(seq1);
showGrid("=== SECUENCIA 1 ===", [
  { id: "t0", label: "0.[9|9] doble inicial" },
  { id: "t1", label: "1.[9|4]" },
  { id: "t2", label: "2.[4|5]" },
  { id: "t3", label: "3.[5|6]" },
  { id: "t4", label: "4.[6|8] → head en C15" },
  { id: "t5", label: "5.[8|7] → L-CORNER PURO space=0" },
  { id: "t6", label: "6.[7|2] → POST L-corner" },
], grid1);

// Pixel positions for key tiles (CELL_PX=48)
const CELL_PX = 48;
console.log("\nPixel positions (CELL_PX=48):");
for (const id of ["t4", "t5", "t6"]) {
  const gt = grid1.tiles.find((g) => g.tileId === id)!;
  const avgCol = (gt.cells[0].col + gt.cells[1].col) / 2;
  const avgRow = (gt.cells[0].row + gt.cells[1].row) / 2;
  const x = avgCol * CELL_PX + CELL_PX / 2;
  const y = avgRow * CELL_PX + CELL_PX / 2;
  const w = gt.orientation === "horizontal" ? CELL_PX * 2 : CELL_PX;
  const h = gt.orientation === "horizontal" ? CELL_PX : CELL_PX * 2;
  const info = gt.isDouble && gt.orientation === "vertical" ? " (doble con floats)" : "";
  console.log(`  ${id}: (${x}, ${y}) w=${w} h=${h}${info}  →  rows ${y - h/2}..${y + h/2}, cols ${x - w/2}..${x + w/2}`);
}

// Check adjacency
const t4 = grid1.tiles.find((g) => g.tileId === "t4")!;
const t5 = grid1.tiles.find((g) => g.tileId === "t5")!;
const t6 = grid1.tiles.find((g) => g.tileId === "t6")!;

console.log("\nConexiones visuales:");
// t4 right cell at F0:C15(8), t5 cells[0] at F-1:C15(8) — should connect at same value 8
console.log(`  t4 right cell = F${t4.cells[1].row}:C${t4.cells[1].col}(${t4.cells[1].value})`);
console.log(`  t5 cells[0]  = F${t5.cells[0].row}:C${t5.cells[0].col}(${t5.cells[0].value})`);
console.log(`  Match: ${t4.cells[1].value === t5.cells[0].value ? "✓ MISMO VALOR" : "✗ DIFERENTE"}`);
console.log(`  t5 cells[1]  = F${t5.cells[1].row}:C${t5.cells[1].col}(${t5.cells[1].value})`);
console.log(`  t6 cells[0]  = F${t6.cells[0].row}:C${t6.cells[0].col}(${t6.cells[0].value})`);
console.log(`  Match: ${t5.cells[1].value === t6.cells[0].value ? "✓ MISMO VALOR" : "✗ DIFERENTE"}`);

// =========================================================================
// SECUENCIA 2: [8|7] L-corner → [7|7] doble
// =========================================================================
console.log("\n\n═══════════════════════════════════════");
console.log("  SECUENCIA 2: [8|7] L-corner → [7|7] doble");
console.log("═══════════════════════════════════════\n");

const seq2: PlacedTile[] = [
  makeTiles(9, 9, "t0", "left", 0),
  makeTiles(4, 9, "t1", "right", 1),
  makeTiles(5, 4, "t2", "right", 2),
  makeTiles(6, 5, "t3", "right", 3),
  makeTiles(8, 6, "t4", "right", 4),   // llega a C15
  makeTiles(7, 8, "t5", "right", 5),   // L-corner pure
  makeTiles(7, 7, "t6", "right", 6),   // DOBLE [7|7] POST L-corner
];

const grid2 = computeGridLayout(seq2);
showGrid("=== SECUENCIA 2 ===", [
  { id: "t0", label: "0.[9|9] doble inicial" },
  { id: "t1", label: "1.[9|4]" },
  { id: "t2", label: "2.[4|5]" },
  { id: "t3", label: "3.[5|6]" },
  { id: "t4", label: "4.[6|8] → head en C15" },
  { id: "t5", label: "5.[8|7] → L-CORNER PURO" },
  { id: "t6", label: "6.[7|7] → DOBLE POST L-corner" },
], grid2);

// Pixel positions for sequence 2
console.log("\nPixel positions (CELL_PX=48):");
for (const id of ["t4", "t5", "t6"]) {
  const gt = grid2.tiles.find((g) => g.tileId === id)!;
  const avgCol = (gt.cells[0].col + gt.cells[1].col) / 2;
  const avgRow = (gt.cells[0].row + gt.cells[1].row) / 2;
  const x = avgCol * CELL_PX + CELL_PX / 2;
  const y = avgRow * CELL_PX + CELL_PX / 2;
  const w = gt.orientation === "horizontal" ? CELL_PX * 2 : CELL_PX;
  const h = gt.orientation === "horizontal" ? CELL_PX : (gt.isDouble ? CELL_PX * 3 : CELL_PX * 2);
  const info = gt.isDouble && gt.orientation === "vertical" ? " (doble con floats)" : "";
  console.log(`  ${id}: (${x}, ${y}) w=${w} h=${h}${info}`);
}

// Check if the double in seq2 is correctly classified
const t6s2 = grid2.tiles.find((g) => g.tileId === "t6")!;
console.log(`\nAnalisis doble [7|7]:`);
console.log(`  orientation: ${t6s2.orientation}`);
console.log(`  cells: F${t6s2.cells[0].row}:C${t6s2.cells[0].col} -- F${t6s2.cells[1].row}:C${t6s2.cells[1].col}`);
console.log(`  floats: ${t6s2.floats.length}`);
if (t6s2.floats.length > 0) {
  console.log(`  float cells: F${t6s2.floats[0].row}:C${t6s2.floats[0].col}, F${t6s2.floats[1].row}:C${t6s2.floats[1].col}`);
}
console.log(`  Ocupa 1 celda x ${t6s2.orientation === "horizontal" ? "2 celdas (HORIZ)" : t6s2.isDouble ? "3 celdas (VERT con floats)" : "2 celdas (VERT sin floats)"}`);
