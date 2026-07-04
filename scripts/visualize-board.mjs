#!/usr/bin/env bun
const COLS = 16;

function makeSet() {
  const t = [];
  for (let a = 0; a <= 9; a++) for (let b = a; b <= 9; b++) t.push([a, b]);
  return t;
}
const ALL_TILES = makeSet();
function rowDir(k) { return Math.abs(Number(k.slice(1))) % 2 === 0 ? '→' : '←'; }

class Board {
  constructor() {
    this.rows = {};
    this.openEnds = [];
    this.playedSet = new Set();
    this._nextRow = 1;
    this.seq = [];
  }
  ensureRow(k) { if (!this.rows[k]) this.rows[k] = new Array(COLS).fill(null); return this.rows[k]; }
  newRow() {
    while (true) {
      const t = this._nextRow++;
      const k = t % 2 === 1 ? `F${-Math.ceil(t / 2)}` : `F${t / 2}`;
      if (!this.rows[k]) { this.rows[k] = new Array(COLS).fill(null); return k; }
    }
  }
  setCell(r, c, v) { this.ensureRow(r); if (c < 0 || c >= COLS || this.rows[r][c] !== null) return false; this.rows[r][c] = v; return true; }
  getCell(r, c) { return this.rows[r] && c >= 0 && c < COLS ? this.rows[r][c] : null; }
  countFree(r, c, d) {
    let col = c + (d === '→' ? 1 : -1);
    let n = 0;
    while (col >= 0 && col < COLS && this.getCell(r, col) === null) { n++; col += (d === '→' ? 1 : -1); }
    return n;
  }
  markPlayed(a, b) { this.playedSet.add(`${Math.min(a,b)}-${Math.max(a,b)}`); }
  isPlayed(a, b) { return this.playedSet.has(`${Math.min(a,b)}-${Math.max(a,b)}`); }
  getAvailable() { return ALL_TILES.filter(([a, b]) => !this.isPlayed(a, b)); }
  init() {
    this.ensureRow('F0'); this.ensureRow('F-1'); this.ensureRow('F1');
    this.setCell('F0', 7, 9); this.setCell('F-1', 7, 9); this.setCell('F1', 7, 9);
    this.markPlayed(9, 9);
    this.openEnds.push({ val: 9, row: 'F0', col: 7, dir: '←' });
    this.openEnds.push({ val: 9, row: 'F0', col: 7, dir: '→' });
  }
}

function place(board, A, B) {
  if (board.isPlayed(A, B)) return { ok: false, msg: 'repetida' };
  const cand = board.openEnds.filter(e => e.val === A || e.val === B);
  if (!cand.length) return { ok: false, msg: 'sin extremo' };
  const ext = cand.sort((a, b) => board.countFree(b.row, b.col, b.dir) - board.countFree(a.row, a.col, a.dir))[0];
  const connVal = ext.val === A ? A : B;
  const freeVal = connVal === A ? B : A;
  const dbl = A === B;
  const { row, col, dir } = ext;
  const space = board.countFree(row, col, dir);
  const step = dir === '→' ? 1 : -1;
  let r;
  if (dbl) r = _double(board, A, row, col, dir, step, space);
  else if (space >= 2) r = _horiz(board, connVal, freeVal, row, col, dir, step);
  else if (space === 1) r = _newRow(board, connVal, freeVal, row, col, dir);
  else r = _lcorner(board, connVal, freeVal, row, col, dir, step);
  if (r.ok) {
    board.markPlayed(A, B);
    board.seq.push({ a: A, b: B, connVal, freeVal, extRow: row, extCol: col, extDir: dir, act: r.act, tag: r.tag, space });
  }
  return r;
}
function _double(board, val, row, col, dir, step, space) {
  const ri = Number(row.slice(1));
  board.ensureRow(`F${ri - 1}`); board.ensureRow(`F${ri + 1}`);
  if (space === 0) {
    const nr = board.newRow();
    board.setCell(nr, col, val);
    const nri = Number(nr.slice(1));
    board.ensureRow(`F${nri - 1}`); board.ensureRow(`F${nri + 1}`);
    board.setCell(`F${nri - 1}`, col, val); board.setCell(`F${nri + 1}`, col, val);
    board.openEnds = board.openEnds.filter(e => !(e.row === row && e.col === col && e.dir === dir));
    if (col - 1 >= 0 && board.getCell(nr, col - 1) === null) board.openEnds.push({ val, row: nr, col, dir: '←' });
    if (col + 1 < COLS && board.getCell(nr, col + 1) === null) board.openEnds.push({ val, row: nr, col, dir: '→' });
    return { ok: true, act: `L-CORNER ${row}:C${col}→${nr}:C${col}`, tag: 'dob-L0' };
  }
  const nc = col + step;
  if (nc < 0 || nc >= COLS) return { ok: false, msg: 'fuera' };
  if (!board.setCell(row, nc, val)) return { ok: false, msg: 'colision' };
  board.setCell(`F${ri - 1}`, nc, val); board.setCell(`F${ri + 1}`, nc, val);
  board.openEnds = board.openEnds.filter(e => !(e.row === row && e.col === col && e.dir === dir));
  if (nc - 1 >= 0 && board.getCell(row, nc - 1) === null) board.openEnds.push({ val, row, col: nc, dir: '←' });
  if (nc + 1 < COLS && board.getCell(row, nc + 1) === null) board.openEnds.push({ val, row, col: nc, dir: '→' });
  return { ok: true, act: `${row}:C${nc}`, tag: 'dob' };
}
function _horiz(board, cv, fv, row, col, dir, step) {
  const c1 = col + step, c2 = col + 2 * step;
  if (c1 < 0 || c1 >= COLS || c2 < 0 || c2 >= COLS) return { ok: false, msg: 'out' };
  board.setCell(row, c1, cv); board.setCell(row, c2, fv);
  board.openEnds = board.openEnds.filter(e => !(e.row === row && e.col === col && e.dir === dir));
  board.openEnds.push({ val: fv, row, col: c2, dir });
  return { ok: true, act: `${row}:C${c1}-C${c2}`, tag: '>=2' };
}
function _newRow(board, cv, fv, row, col, dir) {
  const nr = board.newRow(); const nd = rowDir(nr);
  const c_borde = col + (dir === '→' ? 1 : -1);
  if (c_borde < 0 || c_borde >= COLS) return { ok: false, msg: 'out' };
  if (!board.setCell(row, c_borde, cv)) return { ok: false, msg: 'colision' };
  if (!board.setCell(nr, c_borde, fv)) return { ok: false, msg: 'colision' };
  board.openEnds = board.openEnds.filter(e => !(e.row === row && e.col === col && e.dir === dir));
  board.openEnds.push({ val: fv, row: nr, col: c_borde, dir: nd });
  return { ok: true, act: `${row}:C${c_borde}→${nr}:C${c_borde}`, tag: '=1' };
}
function _lcorner(board, cv, fv, row, col, dir, step) {
  const nr = board.newRow(); const nd = rowDir(nr);
  board.setCell(nr, col, fv);
  board.openEnds = board.openEnds.filter(e => !(e.row === row && e.col === col && e.dir === dir));
  board.openEnds.push({ val: fv, row: nr, col, dir: nd });
  return { ok: true, act: `L-CORNER ${row}:C${col}→${nr}:C${col}`, tag: '=0' };
}

function autoPlay(board) {
  let stuck = 0;
  while (board.playedSet.size < 40) {
    const avail = board.getAvailable();
    const ends = board.openEnds;
    let best = null, bestScore = -Infinity;
    for (const [a, b] of avail) {
      for (const e of ends) {
        if (e.val !== a && e.val !== b) continue;
        const space = board.countFree(e.row, e.col, e.dir);
        const dbl = a === b;
        let score = 0;
        score += space * 100;
        if (!dbl) score += 2000;
        if (space >= 2) score += 500;
        if (space === 0 && dbl) score -= 1000;
        score += Math.random() * 10;
        if (score > bestScore) { bestScore = score; best = { a, b }; }
      }
    }
    if (!best) { stuck++; if (stuck > 2) return false; continue; }
    const r = place(board, best.a, best.b);
    if (r.ok) stuck = 0; else { stuck++; if (stuck > 3) return false; }
  }
  return true;
}

const board = new Board();
board.init();
const ok = autoPlay(board);
if (!ok) { console.log('Falló generación'); process.exit(1); }

const sortedRows = Object.keys(board.rows).sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)));

// ===== OUTPUT =====
console.log(`\n  JUEGO COMPLETO — 40 fichas únicas (doble-9) | Algoritmo mejorado (algoritmo_mejorado.md)`);
console.log(`  =========================================================================================\n`);

// Grid
console.log('  GRID DE VALORES (16 columnas × N filas)');
console.log('  ─────────────────────────────────────────────────────────────────────────────────────');
console.log('  Col: C0  C1  C2  C3  C4  C5  C6  C7  C8  C9  C10 C11 C12 C13 C14 C15');
console.log('  ─────────────────────────────────────────────────────────────────────────────────────');
for (const r of sortedRows) {
  const cells = board.rows[r];
  const vals = cells.map((c, i) => c !== null ? String(c).padStart(2,' ') : '··').join('  ');
  console.log(`  ${r}(${rowDir(r)}) ${vals}`);
}
console.log('  ─────────────────────────────────────────────────────────────────────────────────────\n');

// Sequence
console.log('  SECUENCIA DE COLOCACIÓN');
console.log('  ────────────────────────────────────────────────────────────────────────────────');
console.log('   #  Ficha     Ori  Posición fichas                Caso              Espacio');
console.log('  ────────────────────────────────────────────────────────────────────────────────');
board.seq.forEach((s, i) => {
  const n = i + 1;
  const tagLabel = s.tag === '>=2' ? 'Misma fila' : s.tag === '=1' ? 'Giro Mixto Vert' : s.tag === '=0' ? 'L-Corner Puro' : s.tag;
  const dir = s.extDir === '→' ? '>' : '<';
  const tile = `[${s.a}|${s.b}]`;
  console.log(`  ${String(n).padStart(2)}  ${tile.padEnd(7)} ${dir}  ${s.act.padEnd(31)} ${tagLabel.padEnd(16)} space=${s.space}`);
});
console.log('  ────────────────────────────────────────────────────────────────────────────────');

// Fichas dibujadas en su posición (versión texto compacto)
console.log('  FICHAS [a|b] EN POSICIÓN (lectura: cada ficha está donde fue colocada)\n');

// Build tile-to-row mapping for display
// We want to group tiles by row and show them in order with their grid position
const tilesByRow = {};
for (const r of sortedRows) tilesByRow[r] = [];

// Apertura
tilesByRow['F0'].push({ tile: '[9|9]', col: 'C7', isDouble: true, tag: 'apertura' });
tilesByRow['F-1'].push({ tile: '[9|9]', col: 'C7', isDouble: true, tag: 'float-sup', note: 'float' });
tilesByRow['F1'].push({ tile: '[9|9]', col: 'C7', isDouble: true, tag: 'float-inf', note: 'float' });

for (const s of board.seq) {
  const tileStr = `[${s.a}|${s.b}]`;
  if (s.tag === '>=2') {
    const c1 = s.extCol + (s.extDir === '→' ? 1 : -1);
    const c2 = c1 + (s.extDir === '→' ? 1 : -1);
    tilesByRow[s.extRow].push({ tile: tileStr, col: `C${Math.min(c1,c2)}-C${Math.max(c1,c2)}`, isDouble: false, tag: 'H' });
  } else if (s.tag === '=1') {
    const c_borde = s.extCol + (s.extDir === '→' ? 1 : -1);
    const parts = s.act.split('→');
    const nr = parts[1].split(':')[0];
    tilesByRow[s.extRow].push({ tile: tileStr, col: `C${c_borde}`, isDouble: false, tag: 'V-conn' });
    tilesByRow[nr].push({ tile: tileStr, col: `C${c_borde}`, isDouble: false, tag: 'V-free' });
  } else if (s.tag === '=0') {
    const parts = s.act.split('→');
    const nr = parts[1].split(':')[0];
    tilesByRow[s.extRow].push({ tile: tileStr, col: `C${s.extCol}`, isDouble: false, tag: 'V-conn' });
    tilesByRow[nr].push({ tile: tileStr, col: `C${s.extCol}`, isDouble: false, tag: 'V-free' });
  }
}

for (const r of sortedRows) {
  const tiles = tilesByRow[r];
  if (tiles.length === 0) continue;
  // Sort tiles by column
  tiles.sort((a, b) => a.col.localeCompare(b.col, undefined, { numeric: true }));
  const dir = rowDir(r);
  console.log(`  ${r} (${dir}):`);
  for (const t of tiles) {
    const note = t.isDouble ? ' (doble)' : t.tag === 'V-conn' ? ' (vert.superior)' : t.tag === 'V-free' ? ' (vert.inferior)' : t.tag === 'float' ? ' (float)' : '';
    console.log(`    ${t.tile.padEnd(7)} en ${t.col}${note}`);
  }
  console.log('');
}

// Stats
const used = [...board.playedSet].map(k => k.split('-').map(Number));
const sums = used.map(([a, b]) => a + b);
const totalPips = sums.reduce((s, v) => s + v, 0);
const seqTags = board.seq.map(s => s.tag);

console.log('  ESTADÍSTICAS');
console.log('  ────────────────────────────────────────────────────');
console.log(`  Fichas colocadas:       ${board.playedSet.size}/55 del set doble-9`);
console.log(`  Fichas en pozo:         ${55 - board.playedSet.size}`);
console.log(`  Suma total de pips:     ${totalPips}`);
console.log(`  Dobles jugados:         ${used.filter(([a, b]) => a === b).length}`);
console.log(`  Filas usadas:           ${sortedRows.length}`);
console.log(`  Misma fila (≥2):        ${seqTags.filter(t => t === '>=2').length}`);
console.log(`  Giro vertical (=1):     ${seqTags.filter(t => t === '=1').length}`);
console.log(`  L-Corner (=0):         ${seqTags.filter(t => t === '=0').length}`);
const uniqueCheck = new Set(board.seq.map(s => `${Math.min(s.a,s.b)}-${Math.max(s.a,s.b)}`));
console.log(`  Fichas repetidas:       ${board.seq.length - uniqueCheck.size}`);
console.log('');

// Open ends
console.log('  Extremos abiertos:');
board.openEnds.forEach(e => console.log(`    ${e.val} → ${e.row}:C${e.col} (${e.dir})`));
console.log('');
