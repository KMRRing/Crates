// Xiangqi's own Xiangqi engine: no dependency, no licence to carry. A position with its legal moves (every rule of
// river-rules.js: palace, river, elephant's eye, horse's leg, cannon screen, the generals never facing), a search
// (iterative deepening, alpha-beta with a transposition table, null move, late-move reductions, quiescence) and a
// hand-tuned evaluation (material, piece-square tables, mobility, the generals' safety). uci.js speaks to it through
// river-uci.js in a worker; the tests and tools use the Engine class here directly.
//
// The board is 90 points, point = rank * 9 + file (rank 0 Red's back rank, as river-rules.js). A piece is
// type | side << 3: type 1 general, 2 advisor, 3 elephant, 4 horse, 5 chariot, 6 cannon, 7 soldier; side 0 Red, 1 Black.
// A move is from | to << 7. Scores are in centipawns from the side to move's view, a soldier before the river worth 100;
// a mate is MATE minus the plies to it.

export const MATE = 30000, INF = 32000, RULE_WIN = 20000;       // a win by the rules (a perpetual check) is worth less than a mate
const MAXPLY = 96, MAXM = 160, QPLY = 40, STACK = 2048;
const NONE = 99999, EXACT = 1, LOWER = 2, UPPER = 3;
const LF = 2;                                                            // the first moves tried are never reduced
const LMP = [0, 5, 9, 14, 20];                                          // quiet moves tried before the rest are skipped, by depth
const LMR = new Int8Array(32 * 64);                                      // late-move reductions by depth and move number
const LB = 0.6, LD = 2.2;
for (let d = 1; d < 32; d++) for (let n = 1; n < 64; n++) LMR[d * 64 + n] = Math.max(0, Math.round(LB + Math.log(d) * Math.log(n) / LD));
const K = 1, A = 2, B = 3, N = 4, R = 5, C = 6, P = 7;
export const START = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1";

// ---------- tables ----------
const FILE = new Int8Array(90), RANK = new Int8Array(90);
for (let s = 0; s < 90; s++) { FILE[s] = s % 9; RANK[s] = (s / 9) | 0; }
const onBoard = (f, r) => f >= 0 && f < 9 && r >= 0 && r < 10;
const inPalace = (f, r, side) => f >= 3 && f <= 5 && (side === 0 ? r >= 0 && r <= 2 : r >= 7 && r <= 9);
const DF = [1, -1, 0, 0], DR = [0, 0, 1, -1];
const RAY = [];                                                  // RAY[dir * 90 + point]: the points beyond it in that direction
for (let d = 0; d < 4; d++) for (let s = 0; s < 90; s++) {
  const line = [];
  for (let f = FILE[s] + DF[d], r = RANK[s] + DR[d]; onBoard(f, r); f += DF[d], r += DR[d]) line.push(r * 9 + f);
  RAY[d * 90 + s] = Int8Array.from(line);
}
const HORSE_STEPS = [[1, 2, 0, 1], [-1, 2, 0, 1], [1, -2, 0, -1], [-1, -2, 0, -1], [2, 1, 1, 0], [2, -1, 1, 0], [-2, 1, -1, 0], [-2, -1, -1, 0]];
const NMOVE = [], NATT = [];                                     // a horse's jumps with the leg each needs; and, for a point, the horses that could jump to it
const natt = Array.from({ length: 90 }, () => []);
for (let s = 0; s < 90; s++) {
  const list = [];
  for (const [df, dr, lf, lr] of HORSE_STEPS) {
    const f = FILE[s] + df, r = RANK[s] + dr;
    if (!onBoard(f, r)) continue;
    const leg = (RANK[s] + lr) * 9 + FILE[s] + lf;
    list.push(r * 9 + f, leg);
    natt[r * 9 + f].push(s, leg);
  }
  NMOVE[s] = Int8Array.from(list);
}
for (let s = 0; s < 90; s++) NATT[s] = Int8Array.from(natt[s]);
const GMOVE = [], AMOVE = [], EMOVE = [], PMOVE = [];            // by side * 90 + point
for (let side = 0; side < 2; side++) for (let s = 0; s < 90; s++) {
  const f = FILE[s], r = RANK[s], g = [], a = [], e = [], p = [];
  for (let d = 0; d < 4; d++) if (inPalace(f + DF[d], r + DR[d], side)) g.push((r + DR[d]) * 9 + f + DF[d]);
  for (const [df, dr] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    if (inPalace(f + df, r + dr, side)) a.push((r + dr) * 9 + f + df);
    const tf = f + 2 * df, tr = r + 2 * dr;
    if (onBoard(tf, tr) && (side === 0 ? tr <= 4 : tr >= 5)) e.push(tr * 9 + tf, (r + dr) * 9 + f + df);
  }
  const fwd = side === 0 ? 1 : -1, crossed = side === 0 ? r >= 5 : r <= 4;
  if (onBoard(f, r + fwd)) p.push((r + fwd) * 9 + f);
  if (crossed) { if (f > 0) p.push(r * 9 + f - 1); if (f < 8) p.push(r * 9 + f + 1); }
  GMOVE[side * 90 + s] = Int8Array.from(g); AMOVE[side * 90 + s] = Int8Array.from(a);
  EMOVE[side * 90 + s] = Int8Array.from(e); PMOVE[side * 90 + s] = Int8Array.from(p);
}

const PALACE = new Uint8Array(180), HOME = new Uint8Array(180);          // by side * 90 + point: inside that side's palace, on that side's half
for (let side = 0; side < 2; side++) for (let q = 0; q < 90; q++) { PALACE[side * 90 + q] = inPalace(FILE[q], RANK[q], side) ? 1 : 0; HOME[side * 90 + q] = (side === 0 ? RANK[q] <= 4 : RANK[q] >= 5) ? 1 : 0; }

// a 64-bit key as two 32-bit halves; the generator is fixed, so a key is the same in every run
let seed = 0x9e3779b9;
const rand32 = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return (t ^ (t >>> 14)) | 0; };
const ZLO = new Int32Array(16 * 90), ZHI = new Int32Array(16 * 90);
for (let i = 0; i < ZLO.length; i++) { ZLO[i] = rand32(); ZHI[i] = rand32(); }
const SIDE_LO = rand32(), SIDE_HI = rand32();

// ---------- evaluation tables ----------
// The weights of the evaluation, in centipawns from Red's side (rank 0 its own back rank). A piece is worth its material
// plus what its square is worth: a rank profile (how far up the board) and a file profile (how far from the centre file),
// each for the middlegame and the endgame. A soldier is worth 100 at home and more and more once across the river; a
// horse likes the centre and the enemy's palace, a cannon the central file, a chariot the open ranks; the general stays
// home (a general stepping up into the cannons' range costs). Set by hand, then fitted in the sandbox to the scores the
// engine Xiangqi played before gave quiet positions (numbers only: no table of anyone's is in these).
export const W = {
  mg: [0, 0, 125, 135, 410, 950, 450, 60], eg: [0, 0, 60, 45, 370, 780, 280, 40],        // material by type
  rankMg: [
    [],
    [65, -77, -66, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [-47, -17, 24, -5, 11, 14, 39, 4, 51, -7],
    [-21, -16, -7, -22, 6, 4, 26, -3, 28, 21],
    [-6, 15, 8, -12, 12, -17, 8, 3, 5, 28],
    [0, 0, 0, -4, 12, 74, 74, 88, 128, 38]],
  rankEg: [
    [],
    [12, 0, 5, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 6, 0, 0, 0, 0, 0],
    [-16, 8, -23, -11, 7, 17, -7, 6, 38, -10],
    [8, -41, 7, -26, -17, -24, -1, -10, -11, -23],
    [-12, -30, -20, -27, -9, 8, 1, -27, -2, 20],
    [0, 0, 0, 16, 16, 83, 115, 116, 94, 18]],
  fileMg: [[], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, -6], [-3, 30, -3, -3, -34], [9, 12, 12, -18, -30], [32, -9, 21, 3, -30], [0, 0, 0, 0, 0]],   // by distance from the centre file
  fileEg: [[], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, -6], [20, -21, -11, -13, -22], [-10, -27, -21, -36, -24], [-5, -9, -48, -15, 6], [0, 0, 0, 0, 0]],
  centreAdvisor: 65, centreElephant: 51, centreCannon: 45, crossedFile: [3, 0, -9, -24, -40],
  rookMob: 6, rookBase: 45, horseMob: 11, horseBase: 15, cannonMob: 2, cannonBase: 16,
  pin: 29, aim1: 22, aim2: 36, adv: 46, advPair: 25, ele: 25, norm: 8, tempo: 66, zoneR: 6, zoneN: 3, zoneC: -9, zoneP: 36,
};
const PSQ_MG = new Int32Array(16 * 90), PSQ_EG = new Int32Array(16 * 90);   // by piece (type | side << 3) and point: Red's positive, Black's negative, so the sums are Red minus Black
function pst(t, f, r, eg) {
  const cf = Math.abs(f - 4), ranks = eg ? W.rankEg : W.rankMg, files = eg ? W.fileEg : W.fileMg;
  let v = ranks[t][r];
  if (t === P) { if (r >= 5) v += W.crossedFile[cf]; else if (r === 4 && cf === 0) v += 4; }
  else v += files[t][cf];
  if (!eg) {
    if (t === A && f === 4 && r === 1) v += W.centreAdvisor;
    else if (t === B && f === 4 && r === 2) v += W.centreElephant;
    else if (t === C && f === 4 && r >= 2 && r <= 6) v += W.centreCannon;
  }
  return v;
}
/** Builds the piece-square sums from W (again, when the tuner changes it). */
export function buildTables() {
  for (let t = 1; t <= 7; t++) for (let s = 0; s < 90; s++) {
    const f = FILE[s], r = RANK[s], mg = W.mg[t] + pst(t, f, r, false), eg = W.eg[t] + pst(t, f, r, true), mirror = (9 - r) * 9 + f;
    PSQ_MG[t * 90 + s] = mg; PSQ_EG[t * 90 + s] = eg;
    PSQ_MG[(t | 8) * 90 + mirror] = -mg; PSQ_EG[(t | 8) * 90 + mirror] = -eg;
  }
}
buildTables();
const PHASE = [0, 0, 0, 0, 2, 4, 2, 0], PHASE_ALL = 32;
const ORDER_VALUE = [0, 0, 2, 2, 4, 9, 4, 1];                            // a victim's weight in move ordering

export const SQUARES = "abcdefghi";
export const nameOf = s => SQUARES[s % 9] + (((s / 9) | 0) + 1);
export function pointNamed(str) { const f = SQUARES.indexOf(str[0]), r = Number(str.slice(1)) - 1; return f < 0 || !(r >= 0 && r < 10) ? -1 : r * 9 + f; }
export const moveName = m => nameOf(m & 127) + nameOf(m >> 7);

const FEN_LETTER = { k: K, a: A, e: B, b: B, n: N, h: N, r: R, c: C, p: P };

/** The transposition table: buckets of two entries, three words each (key, move|depth|bound|age, score). */
class Table {
  constructor(entries) { this.resize(entries); }
  resize(entries) {
    let n = 1024; while (n < entries) n *= 2;
    this.mask = n / 2 - 1;                                                // buckets
    this.data = new Int32Array(n * 3);
    this.age = 0;
  }
  clear() { this.data.fill(0); this.age = 0; }
}

/**
 * The engine: one position and its search. Reuse one per game (the table carries over); `setFen` and `play` set the
 * position, `search` thinks, `perft` counts.
 */
export class Engine {
  constructor({ hashMb = 8 } = {}) {
    this.bd = new Int8Array(90);
    this.pl = new Int8Array(32).fill(-1);                                 // piece slots by side * 16 → point, -1 taken
    this.slotOf = new Int8Array(90).fill(-1);
    this.gsq = new Int8Array(2);
    this.stm = 0; this.lo = 0; this.hi = 0; this.mg = 0; this.eg = 0; this.phase = 0; this.attackers = 0;
    this.top = 0;
    this.kLo = new Int32Array(STACK); this.kHi = new Int32Array(STACK);
    this.chk = new Uint8Array(STACK); this.quiet = new Int16Array(STACK);
    this.uMove = new Int32Array(STACK); this.uCap = new Int8Array(STACK); this.uSlot = new Int8Array(STACK);
    this.uMg = new Int32Array(STACK); this.uEg = new Int32Array(STACK); this.uPhase = new Int8Array(STACK);
    this.mv = new Int32Array((MAXPLY + QPLY) * MAXM); this.ms = new Int32Array((MAXPLY + QPLY) * MAXM);
    this.pv = new Int32Array((MAXPLY + 2) * (MAXPLY + 2)); this.pvn = new Int32Array(MAXPLY + 2);
    this.killer1 = new Int32Array(MAXPLY + 2); this.killer2 = new Int32Array(MAXPLY + 2);
    this.history = new Int32Array(2 * 90 * 90);
    this.tt = new Table(hashMb * 1024 * 1024 / 12);
    this.tried = new Int32Array((MAXPLY + 2) * 64);
    this.att = new Int32Array(2); this.def = new Int32Array(2);
    this.ecache = new Int32Array(1 << 17);
    this.evs = new Int32Array(MAXPLY + 2); this.counter = new Int32Array(16 * 90);
    this.stopped = false; this.nodes = 0; this.nodeLimit = Infinity; this.deadline = Infinity; this.extendTo = 0;
    this.ttMove = 0; this.ttDepth = 0; this.ttBound = 0; this.ttScore = 0; this.rootScore = new Map(); this.partial = null;
    this.setFen(START);
  }

  // ----- position -----
  setFen(fen = START) {
    const [rows, side] = String(fen).trim().split(/\s+/), ranks = rows.split("/");
    if (ranks.length !== 10) throw new Error(`not a Xiangqi position: ${fen}`);
    this.bd.fill(0); this.pl.fill(-1); this.slotOf.fill(-1);
    const used = [0, 0];
    ranks.forEach((row, k) => {
      let f = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) { f += Number(ch); continue; }
        const t = FEN_LETTER[ch.toLowerCase()], s = ch === ch.toUpperCase() ? 0 : 1;
        if (!t || f > 8 || used[s] >= 16) throw new Error(`not a Xiangqi position: ${fen}`);
        const sq = (9 - k) * 9 + f++;
        this.bd[sq] = t | s << 3;
        this.pl[s * 16 + used[s]] = sq; this.slotOf[sq] = used[s]++;
      }
    });
    this.stm = side === "b" ? 1 : 0;
    this.gsq[0] = this.gsq[1] = -1;
    this.lo = this.hi = 0; this.mg = this.eg = 0; this.phase = 0; this.attackers = 0;
    for (let s = 0; s < 90; s++) {
      const p = this.bd[s];
      if (!p) continue;
      this.lo ^= ZLO[p * 90 + s]; this.hi ^= ZHI[p * 90 + s];
      this.phase += PHASE[p & 7];
      if ((p & 7) === K) this.gsq[p >> 3] = s;
      else if ((p & 7) >= N) this.attackers++;
    }
    this.recount();
    if (this.gsq[0] < 0 || this.gsq[1] < 0) throw new Error(`a Xiangqi position needs both generals: ${fen}`);
    if (this.stm) { this.lo ^= SIDE_LO; this.hi ^= SIDE_HI; }
    this.top = 0;
    this.kLo[0] = this.lo; this.kHi[0] = this.hi; this.quiet[0] = 0;
    this.chk[0] = this.attacked(this.gsq[this.stm], this.stm ^ 1) ? 1 : 0;
    this.killer1.fill(0); this.killer2.fill(0); this.history.fill(0); this.counter.fill(0);
  }
  /** The material and square sums again from the board (when the weights change). */
  recount() {
    let mg = 0, eg = 0;
    for (let s = 0; s < 90; s++) { const p = this.bd[s]; if (p) { mg += PSQ_MG[p * 90 + s]; eg += PSQ_EG[p * 90 + s]; } }
    this.mg = mg; this.eg = eg;
  }
  fen() {
    const L = ".kabnrcp";
    const rows = [];
    for (let r = 9; r >= 0; r--) {
      let row = "", gap = 0;
      for (let f = 0; f < 9; f++) {
        const p = this.bd[r * 9 + f];
        if (!p) { gap++; continue; }
        if (gap) { row += gap; gap = 0; }
        row += p >> 3 ? L[p & 7] : L[p & 7].toUpperCase();
      }
      rows.push(row + (gap || ""));
    }
    return `${rows.join("/")} ${this.stm ? "b" : "w"} - - 0 1`;
  }
  /** Plays a move in the engine's words ("h3e3") if it is legal: false when it is not. */
  play(name) {
    const m = this.parseMove(name);
    if (m < 0) return false;
    const n = this.gen(0, false);
    for (let i = 0; i < n; i++) if (this.mv[i] === m) { return this.make(m); }
    return false;
  }
  parseMove(s) {
    const g = /^([a-i](?:10|[1-9]))([a-i](?:10|[1-9]))$/.exec(String(s));
    if (!g) return -1;
    return pointNamed(g[1]) | pointNamed(g[2]) << 7;
  }
  inCheck() { return this.chk[this.top] === 1; }

  /** Whether the general standing at `g` is attacked by side `by`: chariot, cannon over a screen, horse, soldier, or the other general along an open file. */
  attacked(g, by) {
    const bd = this.bd;
    for (let d = 0; d < 4; d++) {
      const ray = RAY[d * 90 + g];
      let screen = false;
      for (let k = 0; k < ray.length; k++) {
        const p = bd[ray[k]];
        if (!p) continue;
        if (!screen) {
          if (p >> 3 === by) { const t = p & 7; if (t === R || (t === K && d >= 2)) return true; }
          screen = true;
        } else { if (p >> 3 === by && (p & 7) === C) return true; break; }
      }
    }
    const nh = NATT[g], horse = N | by << 3;
    for (let k = 0; k < nh.length; k += 2) if (bd[nh[k]] === horse && !bd[nh[k + 1]]) return true;
    const soldier = P | by << 3, f = FILE[g];
    if (by === 1) { if (g + 9 < 90 && bd[g + 9] === soldier) return true; }
    else if (g >= 9 && bd[g - 9] === soldier) return true;
    if ((f > 0 && bd[g - 1] === soldier) || (f < 8 && bd[g + 1] === soldier)) return true;
    return false;
  }

  /** Whether side `by` could take on `sq` by its pieces' paths (pins and the general aside). */
  guarded(sq, by) {
    const bd = this.bd;
    for (let d = 0; d < 4; d++) {
      const ray = RAY[d * 90 + sq];
      let screen = false;
      for (let k = 0; k < ray.length; k++) {
        const p = bd[ray[k]];
        if (!p) continue;
        if (!screen) { if (p >> 3 === by && (p & 7) === R) return true; screen = true; }
        else { if (p >> 3 === by && (p & 7) === C) return true; break; }
      }
    }
    const nh = NATT[sq], horse = N | by << 3;
    for (let k = 0; k < nh.length; k += 2) if (bd[nh[k]] === horse && !bd[nh[k + 1]]) return true;
    const soldier = P | by << 3, f = FILE[sq], r = RANK[sq];
    if (by === 0 ? r > 0 && bd[sq - 9] === soldier : r < 9 && bd[sq + 9] === soldier) return true;
    if (by === 0 ? r >= 5 : r <= 4) { if ((f > 0 && bd[sq - 1] === soldier) || (f < 8 && bd[sq + 1] === soldier)) return true; }
    if (PALACE[by * 90 + sq]) { const al = AMOVE[by * 90 + sq], adv = A | by << 3; for (let k = 0; k < al.length; k++) if (bd[al[k]] === adv) return true; }
    if (HOME[by * 90 + sq]) { const el = EMOVE[by * 90 + sq], ele = B | by << 3; for (let k = 0; k < el.length; k += 2) if (bd[el[k]] === ele && !bd[el[k + 1]]) return true; }
    return false;
  }

  // ----- moves -----
  /** Pseudo-legal moves (a general may be left attacked) into the list at `ply`; returns how many. Captures only if asked. */
  gen(ply, caps) {
    const bd = this.bd, pl = this.pl, stm = this.stm, mv = this.mv, off = ply * MAXM;
    let n = off;
    for (let s = stm * 16, end = s + 16; s < end; s++) {
      const from = pl[s];
      if (from < 0) continue;
      const t = bd[from] & 7;
      if (t === R || t === C) {
        for (let d = 0; d < 4; d++) {
          const ray = RAY[d * 90 + from];
          let k = 0;
          const len = ray.length;
          if (t === R) {
            for (; k < len; k++) {
              const to = ray[k], q = bd[to];
              if (!q) { if (!caps) mv[n++] = from | to << 7; }
              else { if (q >> 3 !== stm) mv[n++] = from | to << 7; break; }
            }
          } else {
            for (; k < len; k++) {                                         // up to the screen
              const to = ray[k];
              if (!bd[to]) { if (!caps) mv[n++] = from | to << 7; } else break;
            }
            for (k++; k < len; k++) {                                      // past it: the first piece, if the other side's
              const to = ray[k], q = bd[to];
              if (q) { if (q >> 3 !== stm) mv[n++] = from | to << 7; break; }
            }
          }
        }
      } else if (t === N) {
        const list = NMOVE[from];
        for (let k = 0; k < list.length; k += 2) {
          if (bd[list[k + 1]]) continue;
          const to = list[k], q = bd[to];
          if (!q ? !caps : q >> 3 !== stm) mv[n++] = from | to << 7;
        }
      } else if (t === B) {
        const list = EMOVE[stm * 90 + from];
        for (let k = 0; k < list.length; k += 2) {
          if (bd[list[k + 1]]) continue;
          const to = list[k], q = bd[to];
          if (!q ? !caps : q >> 3 !== stm) mv[n++] = from | to << 7;
        }
      } else {
        const list = t === P ? PMOVE[stm * 90 + from] : t === A ? AMOVE[stm * 90 + from] : GMOVE[stm * 90 + from];
        for (let k = 0; k < list.length; k++) {
          const to = list[k], q = bd[to];
          if (!q ? !caps : q >> 3 !== stm) mv[n++] = from | to << 7;
        }
      }
    }
    return n - off;
  }

  /** Makes a pseudo-legal move; false (and nothing changed) if it leaves the mover's own general attacked. */
  make(m) {
    const bd = this.bd, from = m & 127, to = m >> 7, p = bd[from], cap = bd[to], me = this.stm, i = this.top + 1;
    this.uMove[i] = m; this.uCap[i] = cap; this.uMg[i] = this.mg; this.uEg[i] = this.eg; this.uPhase[i] = this.phase;
    const slot = this.slotOf[from], capSlot = cap ? this.slotOf[to] : -1;
    bd[to] = p; bd[from] = 0;
    this.pl[me * 16 + slot] = to; this.slotOf[to] = slot; this.slotOf[from] = -1;
    let lo = this.lo ^ ZLO[p * 90 + from] ^ ZLO[p * 90 + to] ^ SIDE_LO, hi = this.hi ^ ZHI[p * 90 + from] ^ ZHI[p * 90 + to] ^ SIDE_HI;
    let mg = this.mg + PSQ_MG[p * 90 + to] - PSQ_MG[p * 90 + from], eg = this.eg + PSQ_EG[p * 90 + to] - PSQ_EG[p * 90 + from];
    if ((p & 7) === K) this.gsq[me] = to;
    this.uSlot[i] = capSlot;
    if (cap) {
      this.pl[(me ^ 1) * 16 + capSlot] = -1;
      lo ^= ZLO[cap * 90 + to]; hi ^= ZHI[cap * 90 + to];
      mg -= PSQ_MG[cap * 90 + to]; eg -= PSQ_EG[cap * 90 + to];
      this.phase -= PHASE[cap & 7];
      if ((cap & 7) >= N) this.attackers--;
    }
    this.lo = lo; this.hi = hi; this.mg = mg; this.eg = eg; this.stm = me ^ 1; this.top = i;
    if (this.attacked(this.gsq[me], me ^ 1)) { this.unmake(); return false; }
    this.kLo[i] = lo; this.kHi[i] = hi;
    this.quiet[i] = cap ? 0 : this.quiet[i - 1] + 1;
    this.chk[i] = this.attacked(this.gsq[me ^ 1], me) ? 1 : 0;
    return true;
  }
  unmake() {
    const i = this.top, m = this.uMove[i], from = m & 127, to = m >> 7, bd = this.bd, me = this.stm ^ 1, p = bd[to], cap = this.uCap[i];
    bd[from] = p; bd[to] = cap;
    const slot = this.slotOf[to];
    this.pl[me * 16 + slot] = from; this.slotOf[from] = slot;
    if ((p & 7) === K) this.gsq[me] = from;
    if (cap) {
      const cs = this.uSlot[i];
      this.pl[(me ^ 1) * 16 + cs] = to; this.slotOf[to] = cs;
      if ((cap & 7) >= N) this.attackers++;
    } else this.slotOf[to] = -1;
    this.lo ^= ZLO[p * 90 + from] ^ ZLO[p * 90 + to] ^ SIDE_LO ^ (cap ? ZLO[cap * 90 + to] : 0);
    this.hi ^= ZHI[p * 90 + from] ^ ZHI[p * 90 + to] ^ SIDE_HI ^ (cap ? ZHI[cap * 90 + to] : 0);
    this.mg = this.uMg[i]; this.eg = this.uEg[i]; this.phase = this.uPhase[i]; this.stm = me; this.top = i - 1;
  }
  makeNull() {
    const i = ++this.top;
    this.uMove[i] = 0; this.stm ^= 1;
    this.lo ^= SIDE_LO; this.hi ^= SIDE_HI;
    this.kLo[i] = this.lo; this.kHi[i] = this.hi; this.chk[i] = 0; this.quiet[i] = 0;
  }
  unmakeNull() { this.top--; this.stm ^= 1; this.lo ^= SIDE_LO; this.hi ^= SIDE_HI; }

  /** The legal moves of the side to move, as engine words. */
  legalMoves() {
    const n = this.gen(0, false), out = [];
    for (let i = 0; i < n; i++) { const m = this.mv[i]; if (this.make(m)) { this.unmake(); out.push(moveName(m)); } }
    return out;
  }
  /** Leaf positions `depth` plies on. */
  perft(depth, ply = 0) {
    if (depth === 0) return 1;
    const n = this.gen(ply, false), off = ply * MAXM;
    let total = 0;
    for (let i = 0; i < n; i++) {
      const m = this.mv[off + i];
      if (!this.make(m)) continue;
      total += depth === 1 ? 1 : this.perft(depth - 1, ply + 1);
      this.unmake();
    }
    return total;
  }
  /** Each legal move with the leaf positions below it, as UCI's "go perft" lists them. */
  divide(depth) {
    const n = this.gen(0, false), out = [];
    for (let i = 0; i < n; i++) {
      const m = this.mv[i];
      if (!this.make(m)) continue;
      out.push([moveName(m), depth <= 1 ? 1 : this.perft(depth - 1, 1)]);
      this.unmake();
    }
    return out;
  }

  // ----- evaluation -----
  /** The position's value in centipawns for the side to move. */
  /** The evaluation, kept by position: the same position comes up again and again in a search. */
  evaluate() {
    const at = (this.lo & 65535) << 1, c = this.ecache;
    if (c[at] === this.hi) return c[at + 1];
    const v = this.evalNow();
    c[at] = this.hi; c[at + 1] = v;
    return v;
  }
  evalNow() {
    const bd = this.bd, pl = this.pl, ph = this.phase > PHASE_ALL ? PHASE_ALL : this.phase;
    let total = ((this.mg * ph + this.eg * (PHASE_ALL - ph)) / PHASE_ALL) | 0;      // Red minus Black
    let dyn = 0;
    const att = this.att, defence = this.def;                                       // attacking force and defenders, by side
    const rookMob = W.rookMob, rookBase = W.rookBase, horseMob = W.horseMob, horseBase = W.horseBase, cannonMob = W.cannonMob, cannonBase = W.cannonBase;
    for (let side = 0; side < 2; side++) {
      const sgn = side ? -1 : 1, eg = this.gsq[side ^ 1], efile = FILE[eg];
      let v = 0, force = 0, adv = 0, ele = 0;
      for (let s = side * 16, end = s + 16; s < end; s++) {
        const sq = pl[s];
        if (sq < 0) continue;
        const t = bd[sq] & 7;
        // how far up the board toward the other side's palace, 0 (home) to 9
        const up = side ? 9 - RANK[sq] : RANK[sq];
        if (t === R) {
          let m = 0;
          for (let d = 0; d < 4; d++) {
            const ray = RAY[d * 90 + sq];
            for (let k = 0; k < ray.length; k++) { const q = bd[ray[k]]; if (!q) m++; else { if (q >> 3 !== side) m++; break; } }
          }
          v += (m - rookBase) * rookMob;
          force += 3;
          if (FILE[sq] === efile && this.between(sq, eg) === 1) v += W.pin;          // a chariot pinning what stands before the general
          if (up >= 6 && FILE[sq] >= 2 && FILE[sq] <= 6) v += W.zoneR;
        } else if (t === N) {
          const list = NMOVE[sq];
          let m = 0;
          for (let k = 0; k < list.length; k += 2) if (!bd[list[k + 1]] && (!bd[list[k]] || bd[list[k]] >> 3 !== side)) m++;
          v += (m - horseBase) * horseMob;
          force += 2;
          if (up >= 6 && FILE[sq] >= 2 && FILE[sq] <= 6) v += W.zoneN;
        } else if (t === C) {
          let m = 0;
          for (let d = 0; d < 4; d++) {
            const ray = RAY[d * 90 + sq];
            for (let k = 0; k < ray.length; k++) { if (bd[ray[k]]) break; m++; }
          }
          v += (m - cannonBase) * cannonMob;
          force += 2;
          if (FILE[sq] === efile) { const b = this.between(sq, eg); if (b === 1) v += W.aim1; else if (b === 2) v += W.aim2; }   // the cannon aimed at the general, a screen between
          if (up >= 6 && FILE[sq] >= 2 && FILE[sq] <= 6) v += W.zoneC;
        } else if (t === A) adv++;
        else if (t === B) ele++;
        else if (t === P && up >= 5) { force += 1; if (up >= 7 && FILE[sq] >= 3 && FILE[sq] <= 5) v += W.zoneP; }
      }
      att[side] = force; defence[side] = adv * W.adv + (adv === 2 ? W.advPair : 0) + ele * W.ele;
      dyn += sgn * v;
    }
    // defenders are worth what the other side's attack makes of them
    const norm = W.norm;
    dyn += defence[0] * (att[1] >= norm ? 1 : att[1] / norm) - defence[1] * (att[0] >= norm ? 1 : att[0] / norm);
    total += dyn | 0;
    // without a chariot, horse or cannon (nor soldiers across the river) there is little to win with
    if (total > 0 && att[0] === 0) total >>= 2;
    else if (total < 0 && att[1] === 0) total >>= 2;
    return this.stm ? W.tempo - total : total + W.tempo;
  }
  /** How many pieces stand between two points on one file. */
  between(a, b) {
    let n = 0;
    const lo = a < b ? a : b, hi = a < b ? b : a, bd = this.bd;
    for (let s = lo + 9; s < hi; s += 9) if (bd[s]) n++;
    return n;
  }
  /** The weight of the attacking pieces a side has: 3 a chariot, 2 a horse or cannon. */
  force(side) {
    let f = 0;
    for (let s = side * 16, end = s + 16; s < end; s++) {
      const q = this.pl[s];
      if (q >= 0) { const t = this.bd[q] & 7; f += t === R ? 3 : t === N || t === C ? 2 : 0; }
    }
    return f;
  }

  // ----- the table -----
  probe(ply) {
    const t = this.tt, b = (this.lo & t.mask) * 6, d = t.data, hi = this.hi;
    for (let w = 0; w < 6; w += 3) {
      if (d[b + w] === hi && d[b + w + 1] !== 0) {
        const x = d[b + w + 1];
        this.ttMove = x & 16383; this.ttDepth = ((x >> 14) & 255) - 2; this.ttBound = (x >> 22) & 3;
        let sc = d[b + w + 2];
        if (sc > 19000) sc -= ply; else if (sc < -19000) sc += ply;
        this.ttScore = sc;
        return true;
      }
    }
    return false;
  }
  store(depth, score, bound, move, ply) {
    const t = this.tt, b = (this.lo & t.mask) * 6, d = t.data, hi = this.hi, age = t.age & 63;
    if (score > 19000) score += ply; else if (score < -19000) score -= ply;
    let slot = -1, worst = 1e9;
    for (let w = 0; w < 6; w += 3) {
      const x = d[b + w + 1];
      if (x !== 0 && d[b + w] === hi) {
        if (!move) move = x & 16383;                                           // keep the move found before
        slot = w; break;
      }
      const value = x === 0 ? -1e8 : ((x >> 14) & 255) - 2 - 6 * ((age - ((x >> 24) & 63)) & 63);
      if (value < worst) { worst = value; slot = w; }
    }
    d[b + slot] = hi; d[b + slot + 1] = move | (depth + 2) << 14 | bound << 22 | age << 24; d[b + slot + 2] = score;
  }

  // ----- search -----
  /** The score of a position that has stood before in the line, by the rules: a perpetual check loses, any other repetition is a draw; NONE if it is new. */
  repetition(ply) {
    const top = this.top, lo = this.kLo[top], hi = this.kHi[top], reach = Math.min(this.quiet[top], top);
    for (let j = top - 4; j >= top - reach; j -= 2) {
      if (this.kLo[j] !== lo || this.kHi[j] !== hi) continue;
      let a = true, b = true;                                                  // a: the side to move now, who moved first since j
      for (let i = j + 1; i <= top; i++) if (!this.chk[i]) { if ((i - j) & 1) a = false; else b = false; }
      return a === b ? 0 : a ? -RULE_WIN + ply : RULE_WIN - ply;
    }
    return NONE;
  }
  checkStop() {
    if (this.nodes >= this.nodeLimit) this.stopped = true;
    else if (this.deadline !== Infinity && performance.now() >= this.deadline) this.stopped = true;
  }
  /** Moves of `ply` scored for the order they are tried: the table's move, captures by victim and attacker, killers, history. */
  scoreMoves(ply, n, ttMove, caps) {
    const mv = this.mv, ms = this.ms, bd = this.bd, off = ply * MAXM, hist = this.history, side = this.stm * 8100;
    const k1 = this.killer1[ply], k2 = this.killer2[ply], top = this.top;
    const cm = top > 0 && this.uMove[top] ? this.counter[bd[this.uMove[top] >> 7] * 90 + (this.uMove[top] >> 7)] : 0;
    for (let i = off; i < off + n; i++) {
      const m = mv[i], from = m & 127, to = m >> 7, v = bd[to];
      if (m === ttMove) ms[i] = 1 << 24;
      else if (v) ms[i] = (1 << 20) + ORDER_VALUE[v & 7] * 16 - ORDER_VALUE[bd[from] & 7];
      else if (caps) ms[i] = 0;
      else if (m === k1) ms[i] = 1 << 19;
      else if (m === k2) ms[i] = (1 << 19) - 1;
      else if (m === cm) ms[i] = (1 << 19) - 2;
      else ms[i] = hist[side + from * 90 + to];
    }
  }
  /** The best remaining move of the list, swapped into place `i`. */
  pick(i, end) {
    const ms = this.ms, mv = this.mv;
    let b = i;
    for (let j = i + 1; j < end; j++) if (ms[j] > ms[b]) b = j;
    if (b !== i) { const m = mv[b], s = ms[b]; mv[b] = mv[i]; ms[b] = ms[i]; mv[i] = m; ms[i] = s; }
    return mv[i];
  }
  bump(side, m, bonus) {
    const h = this.history, at = side * 8100 + (m & 127) * 90 + (m >> 7);
    h[at] += bonus - ((h[at] * (bonus < 0 ? -bonus : bonus)) >> 14);
  }
  setPv(ply, m, childPv) {
    const pv = this.pv, S = MAXPLY + 2, len = childPv ? this.pvn[ply + 1] : ply + 1;
    pv[ply * S + ply] = m;
    for (let k = ply + 1; k < len; k++) pv[ply * S + k] = pv[(ply + 1) * S + k];
    this.pvn[ply] = len;
  }

  qsearch(alpha, beta, ply, qd) {
    this.nodes++;
    if ((this.nodes & 1023) === 0 || this.nodes >= this.nodeLimit) this.checkStop();
    if (this.stopped) return 0;
    if (this.attackers === 0) return 0;
    if (ply >= MAXPLY + QPLY - 2) return this.evaluate();
    const inCheck = this.chk[this.top] === 1, pvNode = beta - alpha > 1;
    let ttMove = 0;
    if (this.probe(ply)) {
      ttMove = this.ttMove;
      if (!pvNode) {
        const sc = this.ttScore, bound = this.ttBound;
        if (bound === EXACT || (bound === LOWER ? sc >= beta : sc <= alpha)) return sc;
      }
    }
    let best = -INF, ev = 0;
    if (!inCheck) {
      ev = best = this.evaluate();
      if (ev >= beta) return ev;
      if (ev > alpha) alpha = ev;
    } else if (qd >= 8) return this.evaluate();
    const origAlpha = alpha, n = this.gen(ply, !inCheck), off = ply * MAXM, bd = this.bd, foe = this.stm ^ 1;
    this.scoreMoves(ply, n, ttMove, !inCheck);
    let legal = 0, bestMove = 0;
    for (let i = off; i < off + n; i++) {
      const m = this.pick(i, off + n), victim = bd[m >> 7] & 7;
      if (!inCheck) {
        if (ev + W.mg[victim] + 180 < alpha) continue;
        // a capture that gives more than it gets, onto a point the other side guards, is not worth looking at
        if (ORDER_VALUE[victim] < ORDER_VALUE[bd[m & 127] & 7] && this.guarded(m >> 7, foe)) continue;
      }
      if (!this.make(m)) continue;
      legal++;
      const score = -this.qsearch(-beta, -alpha, ply + 1, qd + 1);
      this.unmake();
      if (this.stopped) return 0;
      if (score > best) { best = score; bestMove = m; if (score > alpha) { alpha = score; if (score >= beta) break; } }
    }
    if (inCheck && legal === 0) return -MATE + ply;
    this.store(0, best, best >= beta ? LOWER : best > origAlpha ? EXACT : UPPER, bestMove, ply);
    return best;
  }

  ab(alpha, beta, depth, ply, nullOk) {
    this.nodes++;
    if ((this.nodes & 1023) === 0 || this.nodes >= this.nodeLimit) this.checkStop();
    if (this.stopped) return 0;
    const pvNode = beta - alpha > 1, top = this.top, inCheck = this.chk[top] === 1;
    if (pvNode) this.pvn[ply] = ply;
    if (this.attackers === 0 || this.quiet[top] >= 120) return 0;
    const rep = this.repetition(ply);
    if (rep !== NONE) return rep;
    if (ply >= MAXPLY - 2) return this.evaluate();
    if (-MATE + ply > alpha) alpha = -MATE + ply;
    if (MATE - ply - 1 < beta) beta = MATE - ply - 1;
    if (alpha >= beta) return alpha;
    if (inCheck && ply < this.extendTo) depth++;
    if (depth <= 0) return this.qsearch(alpha, beta, ply, 0);

    let ttMove = 0;
    if (this.probe(ply)) {
      ttMove = this.ttMove;
      if (!pvNode && this.ttDepth >= depth) {
        const sc = this.ttScore, bound = this.ttBound;
        if (bound === EXACT || (bound === LOWER ? sc >= beta : sc <= alpha)) return sc;
      }
    }
    let ev = 0, improving = false;
    if (!inCheck) {
      ev = this.evaluate();
      this.evs[ply] = ev;
      improving = ply >= 2 && this.evs[ply - 2] !== NONE && ev > this.evs[ply - 2];
    } else this.evs[ply] = NONE;
    if (!pvNode && !inCheck) {
      if (depth <= 3 && ev - (improving ? 110 : 140) * depth >= beta && beta > -MATE + 200) return ev - 130 * depth;     // so far ahead that nothing a move or two on will bring it back
      if (depth <= 2 && ev + 330 * depth <= alpha) {                           // so far behind that only a capture can help
        const q = this.qsearch(alpha, beta, ply, 0);
        if (q <= alpha || this.stopped) return q;
      }
      if (nullOk && depth >= 3 && ev >= beta && this.force(this.stm) >= 3) {
        const r = 2 + (depth >> 2) + (ev - beta > 300 ? 1 : 0);
        this.makeNull();
        const sc = -this.ab(-beta, -beta + 1, depth - 1 - r, ply + 1, false);
        this.unmakeNull();
        if (this.stopped) return 0;
        if (sc >= beta) return sc >= MATE - MAXPLY ? beta : sc;
      }
    }
    if (!ttMove && depth >= 5) {
      if (pvNode) {
        this.ab(alpha, beta, depth - 2, ply, false);                            // a shallower look to find a move to try first
        if (this.stopped) return 0;
        if (this.probe(ply)) ttMove = this.ttMove;
        this.pvn[ply] = ply;
      } else if (depth >= 7) depth--;
    }

    const n = this.gen(ply, false), off = ply * MAXM, bd = this.bd, me = this.stm;
    this.scoreMoves(ply, n, ttMove, false);
    const origAlpha = alpha, tried = this.tried, tb = ply * 64, hist = this.history, hb = me * 8100;
    const k1 = this.killer1[ply], k2 = this.killer2[ply];
    const prevTo = this.uMove[top] >> 7, counterAt = this.top > 0 && this.uMove[top] ? bd[prevTo] * 90 + prevTo : -1;
    let best = -INF, bestMove = 0, legal = 0, nq = 0, skipped = 0;
    const lmp = pvNode || inCheck || depth > 4 ? 1e9 : (improving ? LMP[depth] + 3 : LMP[depth]);
    for (let i = off; i < off + n; i++) {
      const m = this.pick(i, off + n), capture = bd[m >> 7] !== 0;
      if (!this.make(m)) continue;
      legal++;
      const gives = this.chk[this.top] === 1;
      if (!capture && !gives && !pvNode && !inCheck && legal > 1 && best > -MATE + 200 && m !== k1 && m !== k2) {
        // moves late in the order, on nodes that are not on the line, are not worth a full look
        if ((depth <= 4 && legal > lmp) || (depth <= 4 && ev + 60 + 100 * depth <= alpha)) { this.unmake(); skipped++; continue; }
      }
      let score, childPv = true;
      if (legal === 1) score = -this.ab(-beta, -alpha, depth - 1, ply + 1, true);
      else {
        let red = 0;
        if (depth >= 3 && legal > LF && !capture && !inCheck && !gives) {
          red = LMR[(depth > 31 ? 31 : depth) * 64 + (legal > 63 ? 63 : legal)];
          if (pvNode) red--;
          if (m === k1 || m === k2) red--;
          const h = hist[hb + (m & 127) * 90 + (m >> 7)];
          if (h < -2000) red++; else if (h > 6000) red--;
          if (!improving && !pvNode) red++;
          if (red < 0) red = 0;
          if (red > depth - 2) red = depth - 2;
        }
        score = -this.ab(-alpha - 1, -alpha, depth - 1 - red, ply + 1, true);
        if (score > alpha && red > 0) score = -this.ab(-alpha - 1, -alpha, depth - 1, ply + 1, true);
        if (score > alpha && score < beta) score = -this.ab(-beta, -alpha, depth - 1, ply + 1, true);
        else childPv = false;
      }
      this.unmake();
      if (this.stopped) return 0;
      if (!capture && nq < 63) tried[tb + nq++] = m;
      if (score > best) {
        best = score; bestMove = m;
        if (score > alpha) {
          alpha = score;
          if (pvNode) this.setPv(ply, m, childPv);
          if (score >= beta) {
            if (!capture) {
              if (k1 !== m) { this.killer2[ply] = k1; this.killer1[ply] = m; }
              if (counterAt >= 0) this.counter[counterAt] = m;
              const bonus = depth * depth > 400 ? 400 : depth * depth;
              this.bump(me, m, bonus);
              for (let q = 0; q < nq - 1; q++) this.bump(me, tried[tb + q], -bonus);
            }
            break;
          }
        }
      }
    }
    if (legal === 0) return -MATE + ply;
    this.store(depth, best, best >= beta ? LOWER : best > origAlpha ? EXACT : UPPER, bestMove, ply);
    return best;
  }

  /** One pass over the root moves in `order` (not those in `excluded`): { move, score, pv } for the best, or null if the search was stopped. */
  rootPass(order, excluded, depth, alpha, beta) {
    const origAlpha = alpha, S = MAXPLY + 2, rootCheck = this.chk[this.top] === 1;
    let best = -INF, bestMove = 0, tried = 0;
    this.pvn[0] = 0;
    for (let i = 0; i < order.length; i++) {
      const m = order[i];
      if (excluded.has(m)) continue;
      const capture = this.bd[m >> 7] !== 0;
      this.make(m);
      const gives = this.chk[this.top] === 1;
      let score, childPv = true;
      if (tried === 0) score = -this.ab(-beta, -alpha, depth - 1, 1, true);
      else {
        let red = 0;
        if (depth >= 3 && tried > 3 && !capture && !rootCheck && !gives) red = LMR[(depth > 31 ? 31 : depth) * 64 + (tried > 63 ? 63 : tried)] || 0;
        score = -this.ab(-alpha - 1, -alpha, depth - 1 - red, 1, true);
        if (score > alpha && red > 0) score = -this.ab(-alpha - 1, -alpha, depth - 1, 1, true);
        if (score > alpha && score < beta) score = -this.ab(-beta, -alpha, depth - 1, 1, true);
        else childPv = false;
      }
      this.unmake();
      if (this.stopped) return null;
      tried++;
      this.rootScore.set(m, score);
      if (score > best) {
        best = score; bestMove = m;
        if (score > alpha) {
          alpha = score;
          this.setPv(0, m, childPv);
          this.partial = { move: m, score, pv: Array.from(this.pv.subarray(0, this.pvn[0])) };
          if (score >= beta) break;
        }
      }
    }
    return { move: bestMove, score: best, pv: best > origAlpha ? Array.from(this.pv.subarray(0, this.pvn[0])) : [bestMove] };
  }
  /** The best move at a depth, with its aspiration window around the last depth's score when there is one. */
  rootSearch(order, excluded, depth, around) {
    let alpha = -INF, beta = INF, delta = 24;
    if (around !== null) { alpha = around - delta; beta = around + delta; }
    for (;;) {
      const r = this.rootPass(order, excluded, depth, alpha, beta);
      if (!r) return null;
      if (r.score <= alpha && alpha > -INF) {
        beta = (alpha + beta) >> 1; delta *= 2; alpha = delta > 400 ? -INF : r.score - delta;
      } else if (r.score >= beta && beta < INF) {
        delta *= 2; beta = delta > 400 ? INF : r.score + delta;
      } else return r;
    }
  }

  /**
   * Thinks about the position. Limits: depth, nodes (positions searched), movetime (milliseconds); `multipv` lines, each
   * the best of what the lines above it leave; `searchmoves`, engine words to choose among. onInfo(line) gets each line
   * of each depth as it completes. Returns { best (engine words, or null: no legal move), lines, nodes }, each line
   * { multipv, depth, cp | mate (moves, negative: mated), pv (engine words), nodes, time }.
   */
  think({ depth = 64, nodes = Infinity, movetime = Infinity, multipv = 1, searchmoves = null, onInfo = null } = {}) {
    const t0 = performance.now(), total = this.gen(0, false), legal = [];
    for (let i = 0; i < total; i++) { const m = this.mv[i]; if (this.make(m)) { this.unmake(); legal.push(m); } }
    let allowed = legal;
    if (searchmoves?.length) { const want = new Set(searchmoves.map(s => this.parseMove(s))); allowed = legal.filter(m => want.has(m)); }
    if (!allowed.length) return { best: null, lines: [], nodes: 0 };
    this.tt.age++;
    for (let i = 0; i < this.history.length; i++) this.history[i] >>= 1;
    this.killer1.fill(0); this.killer2.fill(0);
    this.nodes = 0; this.stopped = false; this.rootScore = new Map(); this.partial = null;
    const lines = [], K = Math.min(Math.max(1, multipv), allowed.length), maxDepth = Math.min(depth, MAXPLY - 10);
    let order = allowed.slice();
    const bd = this.bd;
    if (this.probe(0) && order.includes(this.ttMove)) order = [this.ttMove, ...order.filter(m => m !== this.ttMove)];
    order.sort((a, b) => (bd[b >> 7] ? ORDER_VALUE[bd[b >> 7] & 7] * 16 - ORDER_VALUE[bd[b & 127] & 7] : -1) - (bd[a >> 7] ? ORDER_VALUE[bd[a >> 7] & 7] * 16 - ORDER_VALUE[bd[a & 127] & 7] : -1));
    const nodeLimit = nodes, deadline = movetime === Infinity ? Infinity : t0 + movetime;
    let around = null, result = null;
    for (let d = 1; d <= maxDepth; d++) {
      // the first depth always completes: there is then a move and a line to give
      this.nodeLimit = d === 1 ? Infinity : nodeLimit; this.deadline = d === 1 ? Infinity : deadline;
      this.extendTo = 2 * d + 6;
      const found = [], excluded = new Set();
      let aborted = false;
      this.partial = null;
      for (let k = 0; k < K; k++) {
        const r = this.rootSearch(order, excluded, d, K === 1 && d >= 5 ? around : null);
        if (!r) { aborted = true; break; }
        found.push({ ...r, depth: d });
        excluded.add(r.move);
      }
      if (aborted) {
        if (K === 1 && d > 1 && this.partial) found.push({ ...this.partial, depth: d });   // the best move found before the stop was searched whole
        if (found.length === K || (K === 1 && found.length)) result = found;
        break;
      }
      result = found;
      around = found[0].score;
      const first = new Set(found.map(l => l.move));
      order = [...found.map(l => l.move), ...order.filter(m => !first.has(m)).sort((a, b) => (this.rootScore.get(b) ?? -INF) - (this.rootScore.get(a) ?? -INF))];
      if (onInfo) found.forEach((l, k) => onInfo(this.lineOf(l, k + 1, t0)));
      if (found.every(l => l.score >= MATE - MAXPLY) || (K === 1 && found[0].score <= -MATE + MAXPLY && d >= 4)) break;
      if (deadline !== Infinity && performance.now() - t0 > (deadline - t0) * 0.55) break;   // the next depth would not finish
      if (this.nodes >= nodeLimit) break;
    }
    const out = (result || []).map((l, k) => this.lineOf(l, k + 1, t0));
    return { best: out.length ? out[0].pv[0] : null, lines: out, nodes: this.nodes };
  }
  lineOf(l, multipv, t0) {
    const s = l.score, line = { multipv, depth: l.depth, pv: l.pv.map(moveName), nodes: this.nodes, time: Math.round(performance.now() - t0) };
    if (s >= MATE - MAXPLY) line.mate = (MATE - s + 1) >> 1;
    else if (s <= -MATE + MAXPLY) line.mate = -((MATE + s) >> 1);
    else line.cp = s;
    return line;
  }
  /** A new hash table of about this many megabytes. */
  setHash(mb) { this.tt.resize(Math.max(1, mb) * 1024 * 1024 / 12); }
  clearHash() { this.tt.clear(); this.killer1.fill(0); this.killer2.fill(0); this.history.fill(0); this.counter.fill(0); }
}
