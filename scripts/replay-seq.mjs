#!/usr/bin/env bun
/**
 * Replay a specific tile sequence through the algorithm.
 * Tests each move by feeding exact tiles and verifying action choices.
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
    this.f0Dir = { left: null, right: null };
  }
  ensureRow(k) { if (!this.rows[k]) this.rows[k] = new Array(COLS).fill(null); return this.rows[k]; }
  newRow(dir) {
    if (dir === 'up') { let n = 1; while (this.rows[`F${n}`]) n++; this.rows[`F${n}`] = new Array(COLS).fill(null); return `F${n}`; }
    if (dir === 'down') { let n = 1; while (this.rows[`F${-n}`]) n++; this.rows[`F${-n}`] = new Array(COLS).fill(null); return `F${-n}`; }
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

  getExtremeSide(row, col, dir) {
    if (row !== 'F0') return null;
    if (col < 7 || (col === 7 && dir === '\u2190')) return 'left';
    if (col > 7 || (col === 7 && dir === '\u2192')) return 'right';
    return 'left';
  }

  decideVerticalDir(side) {
    if (!side || side === 'center') return 'up';
    if (side === 'left') {
      if (this.f0Dir.left !== null) return this.f0Dir.left;
      if (this.f0Dir.right !== null) {
        this.f0Dir.left = this.f0Dir.right === 'up' ? 'down' : 'up';
        return this.f0Dir.left;
      }
      this.f0Dir.left = 'up'; return 'up';
    }
    if (side === 'right') {
      if (this.f0Dir.right !== null) return this.f0Dir.right;
      if (this.f0Dir.left !== null) {
        this.f0Dir.right = this.f0Dir.left === 'up' ? 'down' : 'up';
        return this.f0Dir.right;
      }
      this.f0Dir.right = 'down'; return 'down';
    }
    return 'up';
  }

  init() {
    this.ensureRow('F0'); this.ensureRow('F-1'); this.ensureRow('F1');
    this.setCell('F0', 7, 9); this.setCell('F-1', 7, 9); this.setCell('F1', 7, 9);
    this.markPlayed(9, 9);
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

function _isNewRow(board, row) {
  const cells = board.rows[row];
  if (!cells) return false;
  let count = 0;
  for (let i = 0; i < COLS; i++) { if (cells[i] !== null) { count++; if (count > 1) return false; } }
  return count === 1;
}

function filterExt(board, ext) {
  board.openEnds = board.openEnds.filter(e =>
    !(e.row === ext.row && e.col === ext.col && e.dir === ext.dir)
  );
}

function setNewEnds(board, newEnds) {
  for (const ne of newEnds) board.openEnds.push(ne);
}

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
    const vertDir = board.decideVerticalDir(side);
    const off1 = vertDir === 'up' ? 1 : -1;
    const off2 = vertDir === 'up' ? 2 : -2;
    const nr1 = `F${ri + off1}`;
    const nr2 = `F${ri + off2}`;
    board.ensureRow(nr1); board.ensureRow(nr2);
    const nd = edgeDir(nr2, col);
    if (!board.setCell(nr1, col, val)) return { ok: false, msg: 'colision' };
    if (!board.setCell(nr2, col, val)) return { ok: false, msg: 'colision' };
    filterExt(board, ext);
    setNewEnds(board, [{ val, row: nr2, col, dir: nd, side }]);
    return { ok: true, act: `L-CORNER-DOB ${row}:C${col}\u2192${nr1}:C${col}\u2192${nr2}:C${col}`, tag: 'dob-L0' };
  }
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

function _newRow(board, cv, fv, ext) {
  const { row, col, dir, side } = ext;
  const c_borde = col + (dir === '\u2192' ? 1 : -1);
  if (c_borde < 0 || c_borde >= COLS) return { ok: false, msg: 'out' };
  const vertDir = board.decideVerticalDir(side);
  const ri = Number(row.slice(1));
  const nri = vertDir === 'up' ? ri + 1 : ri - 1;
  const nr = `F${nri}`;
  board.ensureRow(nr);
  const nd = c_borde === 0 ? '\u2190' : '\u2192';
  if (!board.setCell(row, c_borde, cv)) return { ok: false, msg: 'colision' };
  if (!board.setCell(nr, c_borde, fv)) return { ok: false, msg: 'colision' };
  filterExt(board, ext);
  setNewEnds(board, [{ val: fv, row: nr, col: c_borde, dir: nd, side, giroExtreme: true }]);
  return { ok: true, act: `${row}:C${c_borde}\u2192${nr}:C${c_borde}`, tag: '=1' };
}

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

function _lcorner(board, cv, fv, ext, step) {
  const { row, col, dir, side } = ext;
  const vertDir = board.decideVerticalDir(side);
  const ri = Number(row.slice(1));
  const off1 = vertDir === 'up' ? 1 : -1;
  const off2 = vertDir === 'up' ? 2 : -2;
  const nr1 = `F${ri + off1}`;
  const nr2 = `F${ri + off2}`;
  board.ensureRow(nr1); board.ensureRow(nr2);
  const nd = edgeDir(nr2, col);
  if (!board.setCell(nr1, col, cv)) return { ok: false, msg: 'colision' };
  if (!board.setCell(nr2, col, fv)) return { ok: false, msg: 'colision' };
  filterExt(board, ext);
  setNewEnds(board, [{ val: fv, row: nr2, col, dir: nd, side }]);
  return { ok: true, act: `L-CORNER ${row}:C${col}\u2192${nr1}:C${col}\u2192${nr2}:C${col}`, tag: '=0' };
}

// ======================== PLACE ========================
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
    r = _doubleFromGiro(board, A, ext, step);
  } else if (dbl && space === 0) {
    r = _double(board, A, ext, step, space);
  } else if (dbl && space === 1) {
    r = _newRow(board, connVal, freeVal, ext);
  } else if (dbl && space >= 2 && _isNewRow(board, ext.row)) {
    r = _horiz(board, connVal, freeVal, ext, step);
    if (r.ok) {
      const c1 = col + step;
      const oppDir = oppositeDir(dir);
      if (c1 + (oppDir === '\u2192' ? 1 : -1) >= 0 &&
          c1 + (oppDir === '\u2192' ? 1 : -1) < COLS &&
          board.getCell(row, c1 + (oppDir === '\u2192' ? 1 : -1)) === null) {
        board.openEnds.push({ val: connVal, row, col: c1, dir: oppDir, side });
      }
    }
  } else if (dbl) {
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
    board.seq.push({ a: A, b: B, connVal, freeVal, extRow: row, extCol: col, extDir: dir, extSide: side, act: r.act, tag: r.tag, space });
  }
  return r;
}

// ======================== REPLAY ========================
const SEQUENCE = [
  { a: 7, b: 9 },
  { a: 7, b: 7 },
  { a: 5, b: 9 },
  { a: 5, b: 5 },
  { a: 4, b: 7 },
  { a: 4, b: 4 },
  { a: 5, b: 6 },
  { a: 6, b: 6 },
  { a: 4, b: 5 },
  { a: 6, b: 8 },
  { a: 8, b: 8 },
  { a: 0, b: 8 },
  { a: 0, b: 0 },
  { a: 0, b: 4 },
  { a: 4, b: 6 },
  { a: 0, b: 6 },
  { a: 0, b: 9 },
  { a: 4, b: 9 },
  { a: 3, b: 4 },
  { a: 3, b: 3 },
  { a: 3, b: 9 },
  { a: 6, b: 9 },
  { a: 5, b: 8 },
  { a: 3, b: 8 },
  { a: 1, b: 3 },
  { a: 1, b: 1 },
  { a: 1, b: 6 },
  { a: 2, b: 6 },
  { a: 2, b: 2 },
  { a: 0, b: 2 },
  { a: 0, b: 7 },
  { a: 2, b: 7 },
  { a: 2, b: 9 },
  { a: 1, b: 2 },
  { a: 1, b: 4 },
  { a: 4, b: 8 },
  { a: 1, b: 8 },
  { a: 1, b: 9 },
  { a: 8, b: 9 },
];

console.log('=== REPLAY: Algorithm decisions ===\n');

const B = new Board();
B.init();

let prevExt = 'F0:C7(→)'; // start
for (let i = 0; i < SEQUENCE.length; i++) {
  const { a, b } = SEQUENCE[i];
  const n = i + 1;
  
  const cand = B.openEnds.filter(e => e.val === a || e.val === b);
  if (!cand.length) {
    console.log(` #${n}. [${a}|${b}] ERROR: sin extremo`);
    console.log(`      Extremos disponibles:`);
    B.openEnds.forEach(e => console.log(`        ${e.val} -> ${e.row}:C${e.col}(${e.dir})`));
    break;
  }
  
  // Show candidate extremes
  const ext = cand.sort((a, b) => B.countFree(b.row, b.col, b.dir) - B.countFree(a.row, a.col, a.dir))[0];
  const connVal = ext.val === a ? a : b;
  const freeVal = connVal === a ? b : a;
  const dbl = a === b;
  const space = B.countFree(ext.row, ext.col, ext.dir);
  const step = ext.dir === '\u2192' ? 1 : -1;

  const routeInfo = [];
  if (dbl && space === 0 && ext.giroExtreme) routeInfo.push('dbl+space=0+giroExtreme → _doubleFromGiro');
  else if (dbl && space === 0) routeInfo.push('dbl+space=0 → _double(L-CORNER-DOB)');
  else if (dbl && space === 1) routeInfo.push('dbl+space=1 → _newRow');
  else if (dbl && space >= 2 && _isNewRow(B, ext.row)) routeInfo.push('dbl+space>=2+_isNewRow → _horiz(spinner)');
  else if (dbl) routeInfo.push('dbl → _double');
  else if (space >= 2) routeInfo.push('space>=2 → _horiz');
  else if (space === 1) routeInfo.push('space=1 → _newRow');
  else if (ext.giroExtreme) routeInfo.push('space=0+giroExtreme → _lcornerFromGiro');
  else routeInfo.push('space=0 → _lcorner');

  const result = place(B, a, b);
  
  const connInfo = `${connVal}->${ext.row}:C${ext.col}(${ext.dir})`;
  const actionStr = result.ok ? result.act : `FAIL: ${result.msg}`;
  const tagMap = { '\u22652': 'misma fila', '=1': 'giro vert', '=0': 'L-CORNER', 'dob': 'doble', 'dob-L0': 'dob-L-0' };
  const tag = tagMap[result.tag] || result.tag;
  
  console.log(` #${n}. [${a}|${b}] conn=${connInfo} space=${space}`);
  console.log(`    Ruta: ${routeInfo[0]}`);
  console.log(`    Accion: ${actionStr} [${tag}]`);
  if (!result.ok) {
    console.log(`    *** FALLO ***`);
    B.print();
    break;
  }
}

console.log('\n=== TABLERO FINAL ===');
B.print();

console.log(`\nExtremos finales:`);
B.openEnds.forEach(e => console.log(`  ${e.val} -> ${e.row}:C${e.col}(${e.dir})`));

console.log(`\nF0 DIRECTION: left=${B.f0Dir.left}, right=${B.f0Dir.right}`);

const used = [...B.playedSet].map(k => k.split('-').map(Number));
console.log(`\nDobles jugados: ${used.filter(([a, b]) => a === b).length}`);
console.log(`Fichas: ${B.playedSet.size}/40`);

// Show unresolved extremes for analysis
console.log(`\n=== ANALISIS DE EXTREMOS ==`);
B.openEnds.forEach(e => {
  const space = B.countFree(e.row, e.col, e.dir);
  const step = e.dir === '\u2192' ? 1 : -1;
  const borde = e.col + step;
  const atEdge = borde < 0 || borde >= COLS;
  console.log(`  ${e.val} en ${e.row}:C${e.col}(${e.dir}) space=${space} atEdge=${atEdge} side=${e.side}`);
});
