#!/usr/bin/env bun
/**
 * Board Layout Simulator — domino doble-9
 * Algoritmo V2: algoritmo_mejorado.md.
 *   - F1,F2,F3... = ARRIBA, F-1,F-2,F-3... = ABAJO
 *   - Space=0: tile en 2 filas nuevas misma columna (vertical)
 *   - Doble space=0: 2 celdas verticales SIN floats
 *   - Decision arriba/abajo segun F0 (evitar colisiones)
 *
 * Uso: bun run scripts/board-sim.mjs
 */
const COLS = 16;

function makeSet() {
  const t = [];
  for (let a = 0; a <= 9; a++) for (let b = a; b <= 9; b++) t.push([a, b]);
  return t;
}
const ALL_TILES = makeSet();

function rowDir(k) {
  return Math.abs(Number(k.slice(1))) % 2 === 0 ? '\u2192' : '\u2190';
}

function oppositeDir(d) { return d === '\u2192' ? '\u2190' : '\u2192'; }

/** Direccion efectiva de un extremo: el serpentino de la fila, salvo en bordes donde apunta hacia adentro. */
function edgeDir(row, col) {
  const d = rowDir(row);
  if (col === 0 && d === '\u2190') return '\u2192';
  if (col === 15 && d === '\u2192') return '\u2190';
  return d;
}

class Board {
  constructor() {
    this.rows = {};
    this.openEnds = [];
    this.playedSet = new Set();
    this._nextRow = 1;
    this.seq = [];
    // F0 direction tracking: once left/right decides up/down, the other side goes opposite
    this.f0Dir = { left: null, right: null }; // 'up' or 'down'
  }
  ensureRow(k) { if (!this.rows[k]) this.rows[k] = new Array(COLS).fill(null); return this.rows[k]; }

  /**
   * Crea una nueva fila en la dirección especificada.
   * @param {'up'|'down'|null} dir - 'up' → F1,F2,F3..., 'down' → F-1,F-2,F-3..., null → alterna
   */
  newRow(dir) {
    if (dir === 'up') {
      let n = 1;
      while (this.rows[`F${n}`]) n++;
      this.rows[`F${n}`] = new Array(COLS).fill(null);
      return `F${n}`;
    }
    if (dir === 'down') {
      let n = 1;
      while (this.rows[`F${-n}`]) n++;
      this.rows[`F${-n}`] = new Array(COLS).fill(null);
      return `F${-n}`;
    }
    // Auto: alterna empezando por F1 (arriba)
    while (true) {
      const t = this._nextRow++;
      const k = t % 2 === 1 ? `F${Math.ceil(t / 2)}` : `F${-t / 2}`;
      if (!this.rows[k]) { this.rows[k] = new Array(COLS).fill(null); return k; }
    }
  }

  setCell(r, c, v) {
    this.ensureRow(r);
    if (c < 0 || c >= COLS || this.rows[r][c] !== null) return false;
    this.rows[r][c] = v;
    return true;
  }
  getCell(r, c) { return this.rows[r] && c >= 0 && c < COLS ? this.rows[r][c] : null; }

  countFree(r, c, d) {
    let col = c + (d === '\u2192' ? 1 : -1);
    let n = 0;
    while (col >= 0 && col < COLS && this.getCell(r, col) === null) { n++; col += (d === '\u2192' ? 1 : -1); }
    return n;
  }

  markPlayed(a, b) { this.playedSet.add(`${Math.min(a, b)}-${Math.max(a, b)}`); }
  isPlayed(a, b) { return this.playedSet.has(`${Math.min(a, b)}-${Math.max(a, b)}`); }
  getAvailable() { return ALL_TILES.filter(([a, b]) => !this.isPlayed(a, b)); }

  /** Determina el lado F0 de un extremo (left/right/null). */
  getExtremeSide(row, col, dir) {
    if (row !== 'F0') return null; // inherited from parent extreme when creating
    // F0 extremes: based on direction from center
    if (col < 7 || (col === 7 && dir === '\u2190')) return 'left';
    if (col > 7 || (col === 7 && dir === '\u2192')) return 'right';
    return 'left'; // default fallback for center
  }

  /** Decide direccion vertical (up/down) segun regla F0. */
  decideVerticalDir(side) {
    if (!side || side === 'center') return 'up'; // default

    if (side === 'left') {
      if (this.f0Dir.left !== null) return this.f0Dir.left;
      if (this.f0Dir.right !== null) {
        this.f0Dir.left = this.f0Dir.right === 'up' ? 'down' : 'up';
        return this.f0Dir.left;
      }
      // Neither decided → default 'up'
      this.f0Dir.left = 'up';
      return 'up';
    }

    if (side === 'right') {
      if (this.f0Dir.right !== null) return this.f0Dir.right;
      if (this.f0Dir.left !== null) {
        this.f0Dir.right = this.f0Dir.left === 'up' ? 'down' : 'up';
        return this.f0Dir.right;
      }
      // Neither decided → default 'down' (opposite of left's default)
      this.f0Dir.right = 'down';
      return 'down';
    }

    return 'up';
  }

  init() {
    this.ensureRow('F0'); this.ensureRow('F-1'); this.ensureRow('F1');
    this.setCell('F0', 7, 9); this.setCell('F-1', 7, 9); this.setCell('F1', 7, 9);
    this.markPlayed(9, 9);
    // Side: left and right extremes from F0 center
    this.openEnds.push({ val: 9, row: 'F0', col: 7, dir: '\u2190', side: 'left' });
    this.openEnds.push({ val: 9, row: 'F0', col: 7, dir: '\u2192', side: 'right' });
  }

  print() {
    const keys = Object.keys(this.rows).sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)));
    for (const k of keys) {
      const cells = this.rows[k].map((c, i) => c !== null ? `${c}`.padStart(2, ' ') : ' .').join('');
      console.log(`${k}(${rowDir(k)}) ${cells}`);
    }
  }
}

// ======================== ALGORITHM ========================
/** Chequea si una fila tiene solo 1 celda ocupada (recien creada por giro/L-corner). */
function _isNewRow(board, row) {
  const cells = board.rows[row];
  if (!cells) return false;
  let count = 0;
  for (let i = 0; i < COLS; i++) { if (cells[i] !== null) { count++; if (count > 1) return false; } }
  return count === 1;
}

function place(board, A, B) {
  if (board.isPlayed(A, B)) return { ok: false, msg: 'repetida' };
  const cand = board.openEnds.filter(e => e.val === A || e.val === B);
  if (!cand.length) return { ok: false, msg: 'sin extremo' };
  const ext = cand.sort((a, b) => board.countFree(b.row, b.col, b.dir) - board.countFree(a.row, a.col, a.dir))[0];
  const connVal = ext.val === A ? A : B;
  const freeVal = connVal === A ? B : A;
  const dbl = A === B;
  const { row, col, dir, side } = ext;
  const space = board.countFree(row, col, dir);
  const step = dir === '\u2192' ? 1 : -1;

  let r;
  if (dbl && space === 0 && ext.giroExtreme) {
    // Doble desde giro: 1 fila nueva (connVal ya esta en el extreme)
    r = _doubleFromGiro(board, A, ext, step);
  } else if (dbl && space === 0) {
    // Doble L-corner: 2 celdas verticales, sin floats
    r = _double(board, A, ext, step, space);
  } else if (dbl && space === 1) {
    // Doble en giro: actua como ficha normal en _newRow (conexion, 2 celdas)
    r = _newRow(board, connVal, freeVal, ext);
  } else if (dbl && space >= 2 && _isNewRow(board, ext.row)) {
    // Doble como primera ficha en fila nueva: horizontal, sin floats
    r = _horiz(board, connVal, freeVal, ext, step);
    if (r.ok) {
      // Spinner: agregar extremo opuesto en c1
      const c1 = col + step;
      const oppDir = oppositeDir(dir);
      if (c1 + (oppDir === '\u2192' ? 1 : -1) >= 0 &&
          c1 + (oppDir === '\u2192' ? 1 : -1) < COLS &&
          board.getCell(row, c1 + (oppDir === '\u2192' ? 1 : -1)) === null) {
        board.openEnds.push({ val: connVal, row, col: c1, dir: oppDir, side });
      }
    }
  } else if (dbl) {
    // Doble normal (space>=2 en fila establecida)
    r = _double(board, A, ext, step, space);
  } else if (space >= 2) {
    r = _horiz(board, connVal, freeVal, ext, step);
  } else if (space === 1) {
    r = _newRow(board, connVal, freeVal, ext);
  } else if (ext.giroExtreme) {
    r = _lcornerFromGiro(board, connVal, freeVal, ext, step);
  } else {
    r = _lcorner(board, connVal, freeVal, ext, step);
  }

  if (r.ok) {
    board.markPlayed(A, B);
    board.seq.push({
      a: A, b: B, connVal, freeVal,
      extRow: row, extCol: col, extDir: dir, extSide: side,
      act: r.act, tag: r.tag, space
    });
  }
  return r;
}

function filterExt(board, ext) {
  board.openEnds = board.openEnds.filter(e =>
    !(e.row === ext.row && e.col === ext.col && e.dir === ext.dir)
  );
}

function setNewEnds(board, newEnds) {
  for (const ne of newEnds) {
    board.openEnds.push(ne);
  }
}

// ---- DOBLES ----
// Doble desde giro: solo 1 fila nueva (freeVal = val), connVal ya en extreme
function _doubleFromGiro(board, val, ext, step) {
  const { row, col, dir, side } = ext;
  const vertDir = board.decideVerticalDir(side);
  const ri = Number(row.slice(1));
  const off1 = vertDir === 'up' ? 1 : -1;
  const nr1 = `F${ri + off1}`;
  board.ensureRow(nr1);
  if (!board.setCell(nr1, col, val)) return { ok: false, msg: 'colision' };

  const nd = edgeDir(nr1, col);
  filterExt(board, ext);
  setNewEnds(board, [{ val, row: nr1, col, dir: nd, side }]);
  return { ok: true, act: `DOB-VERT ${row}:C${col}\u2192${nr1}:C${col}`, tag: 'dob-v0' };
}

function _double(board, val, ext, step, space) {
  const { row, col, dir, side } = ext;
  const ri = Number(row.slice(1));

  if (space === 0) {
    // Doble L-corner: 2 celdas verticales en filas adyacentes, SIN floats
    const vertDir = board.decideVerticalDir(side);
    const off1 = vertDir === 'up' ? 1 : -1;
    const off2 = vertDir === 'up' ? 2 : -2;
    const nr1 = `F${ri + off1}`;
    const nr2 = `F${ri + off2}`;
    board.ensureRow(nr1);
    board.ensureRow(nr2);
    const nd = edgeDir(nr2, col);

    if (!board.setCell(nr1, col, val)) return { ok: false, msg: 'colision' };
    if (!board.setCell(nr2, col, val)) return { ok: false, msg: 'colision' };

    filterExt(board, ext);
    setNewEnds(board, [
      { val, row: nr2, col, dir: nd, side }
    ]);
    return { ok: true, act: `L-CORNER-DOB ${row}:C${col}\u2192${nr1}:C${col}\u2192${nr2}:C${col}`, tag: 'dob-L0' };
  }

  // Doble normal (espacio >= 1): 1 celda horizontal + floats arriba/abajo
  const nc = col + step;
  if (nc < 0 || nc >= COLS) return { ok: false, msg: 'fuera' };
  if (!board.setCell(row, nc, val)) return { ok: false, msg: 'colision' };
  board.ensureRow(`F${ri - 1}`); board.ensureRow(`F${ri + 1}`);
  board.setCell(`F${ri - 1}`, nc, val);
  board.setCell(`F${ri + 1}`, nc, val);

  filterExt(board, ext);
  const newEnds = [];
  if (nc - 1 >= 0 && board.getCell(row, nc - 1) === null)
    newEnds.push({ val, row, col: nc, dir: '\u2190', side });
  if (nc + 1 < COLS && board.getCell(row, nc + 1) === null)
    newEnds.push({ val, row, col: nc, dir: '\u2192', side });
  setNewEnds(board, newEnds);
  return { ok: true, act: `${row}:C${nc}`, tag: 'dob' };
}

// ---- ESPACIO >= 2: misma fila ----
function _horiz(board, cv, fv, ext, step) {
  const { row, col, dir, side } = ext;
  const c1 = col + step, c2 = col + 2 * step;
  if (c1 < 0 || c1 >= COLS || c2 < 0 || c2 >= COLS) return { ok: false, msg: 'out' };
  board.setCell(row, c1, cv);
  board.setCell(row, c2, fv);

  filterExt(board, ext);
  setNewEnds(board, [{ val: fv, row, col: c2, dir, side }]);
  return { ok: true, act: `${row}:C${c1}-C${c2}`, tag: '\u22652' };
}

// ---- ESPACIO = 1: giro mixto vertical ----
function _newRow(board, cv, fv, ext) {
  const { row, col, dir, side } = ext;
  const c_borde = col + (dir === '\u2192' ? 1 : -1);
  if (c_borde < 0 || c_borde >= COLS) return { ok: false, msg: 'out' };

  // Determinar direccion vertical segun F0
  const vertDir = board.decideVerticalDir(side);
  // La ficha se coloca VERTICALMENTE: freeVal en fila adyacente (ri+/-1),
  // misma columna. El extremo apunta al borde (dead end) para forzar
  // que la siguiente conexion tambien sea vertical (nunca adyacente/horizontal).
  const ri = Number(row.slice(1));
  const nri = vertDir === 'up' ? ri + 1 : ri - 1;
  const nr = `F${nri}`;
  board.ensureRow(nr);
  const nd = c_borde === 0 ? '\u2190' : '\u2192'; // dead end: apunta al borde

  if (!board.setCell(row, c_borde, cv)) return { ok: false, msg: 'colision' };
  if (!board.setCell(nr, c_borde, fv)) return { ok: false, msg: 'colision' };

  filterExt(board, ext);
  setNewEnds(board, [{ val: fv, row: nr, col: c_borde, dir: nd, side, giroExtreme: true }]);
  return { ok: true, act: `${row}:C${c_borde}\u2192${nr}:C${c_borde}`, tag: '=1' };
}

// ---- ESPACIO = 0 desde giro: conexion vertical (1 fila nueva, solo freeVal) ----
// La ficha se coloca VERTICALMENTE. connVal ya esta en la celda del extreme (giro).
// Solo colocamos freeVal en la fila adyacente arriba/abajo.
function _lcornerFromGiro(board, cv, fv, ext, step) {
  const { row, col, dir, side } = ext;
  const vertDir = board.decideVerticalDir(side);
  const ri = Number(row.slice(1));
  const off1 = vertDir === 'up' ? 1 : -1;
  const nr1 = `F${ri + off1}`;
  board.ensureRow(nr1);
  if (!board.setCell(nr1, col, fv)) return { ok: false, msg: 'colision' };

  const nd = edgeDir(nr1, col);
  filterExt(board, ext);
  setNewEnds(board, [{ val: fv, row: nr1, col, dir: nd, side }]);
  return { ok: true, act: `VERT-DIR ${row}:C${col}\u2192${nr1}:C${col}`, tag: '=0-v' };
}

// ---- ESPACIO = 0: L-Corner Puro (2 filas adyacentes, misma columna) ----
function _lcorner(board, cv, fv, ext, step) {
  const { row, col, dir, side } = ext;
  const vertDir = board.decideVerticalDir(side);
  const ri = Number(row.slice(1));
  const off1 = vertDir === 'up' ? 1 : -1;
  const off2 = vertDir === 'up' ? 2 : -2;
  const nr1 = `F${ri + off1}`;
  const nr2 = `F${ri + off2}`;
  board.ensureRow(nr1);
  board.ensureRow(nr2);
  const nd = edgeDir(nr2, col);

  if (!board.setCell(nr1, col, cv)) return { ok: false, msg: 'colision' };
  if (!board.setCell(nr2, col, fv)) return { ok: false, msg: 'colision' };

  filterExt(board, ext);
  setNewEnds(board, [{ val: fv, row: nr2, col, dir: nd, side }]);
  return { ok: true, act: `L-CORNER ${row}:C${col}\u2192${nr1}:C${col}\u2192${nr2}:C${col}`, tag: '=0' };
}

// ======================== AUTO-PLAY ========================
function autoPlay(board) {
  let stuck = 0;

  while (board.playedSet.size < 40) {
    const avail = board.getAvailable();
    const ends = board.openEnds;

    let best = null;
    let bestScore = -Infinity;

    for (const [a, b] of avail) {
      for (const e of ends) {
        if (e.val !== a && e.val !== b) continue;
        const space = board.countFree(e.row, e.col, e.dir);
        const dbl = a === b;

        let score = 0;
        score += space * 100;
        if (dbl) score += 10000;  // preferir dobles
        if (space >= 2) score += 300;
        score += Math.random() * 50;

        if (score > bestScore) {
          bestScore = score;
          best = { a, b };
        }
      }
    }

    if (!best) { stuck++; if (stuck > 2) return false; continue; }

    const r = place(board, best.a, best.b);
    if (r.ok) { stuck = 0; }
    else { stuck++; if (stuck > 3) { console.log(`  STUCK en #${board.playedSet.size + 1}`); return false; } }
  }
  return true;
}

// ======================== RUN ========================
const B = new Board();
B.init();
console.log('\n=== GENERANDO JUEGO AUTOMATICO CON TODOS LOS DOBLES (doble-9) ===\n');

const ok = autoPlay(B);

if (!ok) {
  console.log('Fallo la generacion');
  process.exit(1);
}

console.log('Juego generado exitosamente!\n');

// Tablero
console.log('TABLERO');
console.log('-------');
B.print();

// Secuencia
console.log('\nSECUENCIA COMPLETA');
console.log('-----------------');
console.log(' #  Ficha    Conexion              Accion');
console.log('--- -------- --------------------- ------------------------------------');

B.seq.forEach((s, i) => {
  const n = i + 1;
  const tile = `[${s.a}|${s.b}]`.padEnd(8, ' ');
  const conn = `${s.connVal}->${s.extRow}:C${s.extCol}(${s.extDir})`.padEnd(22, ' ');
  const tagMap = { '\u22652': 'misma fila', '=1': 'giro vert', '=0': 'L-CORNER', 'dob': 'doble', 'dob-L0': 'dob-L-0' };
  const tag = tagMap[s.tag] || s.tag;
  console.log(` ${String(n).padStart(2)}. ${tile} ${conn} ${s.act}  [${tag}]`);
});

  // Extremos finales
  console.log('\nEXTREMOS FINALES');
B.openEnds.forEach(e => console.log(`  ${e.val} -> ${e.row}:C${e.col}(${e.dir}) side=${e.side}`));

// F0 direction decision
console.log(`\nF0 DIRECTION: left=${B.f0Dir.left}, right=${B.f0Dir.right}`);

// Estadisticas
const used = [...B.playedSet].map(k => k.split('-').map(Number));
const sums = used.map(([a, b]) => a + b);
const totalPips = sums.reduce((s, v) => s + v, 0);
console.log(`\nESTADISTICAS`);
console.log(`  Total fichas: ${B.playedSet.size}/55 del set doble-9`);
console.log(`  Fichas sin usar (pozo): ${55 - B.playedSet.size}`);
console.log(`  Suma total de pips: ${totalPips}`);
console.log(`  Valor promedio: ${(totalPips / B.playedSet.size).toFixed(1)}`);
console.log(`  Dobles jugados: ${used.filter(([a, b]) => a === b).length}`);
console.log(`  Filas usadas: ${Object.keys(B.rows).length}`);
console.log(`  L-Corners: ${B.seq.filter(s => s.tag === '=0' || s.tag === 'dob-L0').length}`);
  console.log(`  Nuevas filas (space=1): ${B.seq.filter(s => s.tag === '=1').length}`);
  console.log(`  Vert-Dir (pos-giro): ${B.seq.filter(s => s.tag === '=0-v' || s.tag === 'dob-v0').length}`);
  console.log(`  Misma fila (space>=2): ${B.seq.filter(s => s.tag === '\u22652').length}`);
  
// Listar dobles jugados (incluye [9|9] inicial)
const doblesSeq = B.seq.filter(s => s.a === s.b);
const totalDobles = doblesSeq.length + 1; // +1 por [9|9] inicial
console.log(`\nDOBLES JUGADOS (${totalDobles}/10):`);
console.log(`  #0  [9|9] en F0:C7(→) — INICIAL (mula mayor)`);
doblesSeq.forEach(s => console.log(`  #${B.seq.indexOf(s) + 1} [${s.a}|${s.b}] en ${s.extRow}:C${s.extCol}(${s.extDir}) — ${s.act}`));

// Verificar fichas no repetidas
const seqKeys = B.seq.map(s => `${Math.min(s.a, s.b)}-${Math.max(s.a, s.b)}`);
const uniqueKeys = new Set(seqKeys);
if (seqKeys.length === uniqueKeys.size) {
  console.log('\nVERIFICACION: 0 fichas repetidas');
} else {
  console.log(`\nFICHAS REPETIDAS: ${seqKeys.length - uniqueKeys.size}`);
}
