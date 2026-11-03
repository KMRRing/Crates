// The solver: given a game (the state solitaire-engine.js keeps, every card known) it looks for a way to win, by a
// best-first search over positions packed into bytes, and hands back the moves as the engine's own packed moves, checked
// by playing them on the engine before they are believed. Three uses: a deal is kept only if the solver wins it (the
// deal for a day and a game is the first shuffle it wins, so everyone gets the same one), a hint is the next move on a
// win from where you stand, and "no win found from here" tells you to undo.
//
// The search is bounded by a count of positions (never by time), so it comes to the same answer on every device. It is
// sound (a line it returns wins: replay checks it) and not complete (it can fail on a deal that can be won), so a deal
// it fails on is a deal not offered, never a deal said to be lost. What it leaves out, to keep the search small: in
// Klondike, taking a card back down from a foundation; and in Klondike a card of the stock is reached by turning the
// stock round the first time it comes up, not by every later pass.
import { VARIANTS, tableOf, newGame, cloneGame, whyNot, applyMut, autoStep, won, shuffled, place, pack, unpack, TAB, FND, WST, STK, CEL } from "./solitaire-engine.js";

// ---------- a binary heap of (key, node), smallest first ----------
class Heap {
  constructor(n) { this.k = new Float64Array(n + 1); this.v = new Int32Array(n + 1); this.n = 0; }
  push(key, val) {
    let i = ++this.n;
    const k = this.k, v = this.v;
    while (i > 1) {
      const p = i >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p]; i = p;
    }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, top = v[1], key = k[this.n], val = v[this.n];
    this.n--;
    let i = 1;
    for (;;) {
      let c = i << 1;
      if (c > this.n) break;
      if (c < this.n && k[c + 1] < k[c]) c++;
      if (k[c] >= key) break;
      k[i] = k[c]; v[i] = v[c]; i = c;
    }
    k[i] = key; v[i] = val;
    return top;
  }
}
const mix = x => { x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); return x ^ (x >>> 16); };
/** A position's hash is two 32-bit numbers, handed over through here (no allocation per position). */
const KEY = new Int32Array(2);
const keyOf = (a, b) => { KEY[0] = a; KEY[1] = b; };
/** The positions seen: an open-addressing table of 64-bit keys, as large as the search can fill to a third. */
class Seen {
  constructor(n) {
    let size = 1024;
    while (size < n * 3) size *= 2;
    this.mask = size - 1; this.a = new Int32Array(size); this.b = new Int32Array(size); this.used = new Uint8Array(size);
  }
  /** Adds the key in KEY; true if it was not there. */
  add() {
    const x = KEY[0], y = KEY[1];
    let i = (x ^ (y >>> 7)) & this.mask;
    while (this.used[i]) {
      if (this.a[i] === x && this.b[i] === y) return false;
      i = (i + 1) & this.mask;
    }
    this.used[i] = 1; this.a[i] = x; this.b[i] = y;
    return true;
  }
}

// ---------- the search ----------
/**
 * G: { len, hash(a), prio(a, depth), won(a), expand(a, emit) } on positions of `len` bytes; expand calls emit(child, move)
 * for each child it makes in one scratch array it reuses, and emit returns true to stop the search.
 * → { moves (the decisions, in order) | null, nodes (positions made), full (the budget ran out) }.
 */
function bestFirst(G, root, budget) {
  const len = G.len, cap = budget + 4;
  const pool = new Uint8Array(cap * len), parent = new Int32Array(cap), move = new Int32Array(cap), depth = new Uint16Array(cap);
  const heap = new Heap(cap), seen = new Seen(cap);
  pool.set(root, 0);
  parent[0] = -1;
  let count = 1, hit = -1;
  G.hash(root); seen.add();
  if (G.won(root)) return { moves: [], nodes: 1, full: false };
  heap.push(G.prio(root, 0), 0);
  let expanded = 0, full = false, bestPr = 1e9, bestAt = 0;
  const cur = new Uint8Array(len);
  let at = 0;
  const emit = (child, mv) => {
    G.hash(child);
    if (!seen.add()) return false;
    if (count >= cap) { full = true; return true; }
    pool.set(child, count * len);
    parent[count] = at; move[count] = mv; depth[count] = depth[at] + 1;
    if (G.won(child)) { hit = count; count++; return true; }
    const pr = G.prio(child, depth[count]);
    if (pr < bestPr) { bestPr = pr; bestAt = count; }
    heap.push(pr - count * 1e-7, count);
    count++;
    return false;
  };
  while (heap.n && hit < 0 && !full) {
    at = heap.pop();
    cur.set(pool.subarray(at * len, at * len + len));
    expanded++;
    G.expand(cur, emit);
  }
  const moveTo = i => { const out = []; for (; i > 0; i = parent[i]) out.push(move[i]); return out.reverse(); };
  if (hit < 0) return { moves: null, nodes: count, full: full || !!heap.n, expanded, best: moveTo(bestAt) };
  const moves = [];
  for (let i = hit; i > 0; i = parent[i]) moves.push(move[i]);
  return { moves: moves.reverse(), nodes: count, full: false, expanded };
}

// ---------- FreeCell ----------
// bytes: [0..7] the columns' lengths, [8..11] the free cells (255 empty), [12..15] the foundations, then eight columns of 20
const FC_COLS = 8, FC_AT = 16, FC_LEN = FC_AT + FC_COLS * 20, EMPTY = 255;
function freecell(s) {
  const T = tableOf("freecell"), R = T.rank, S = T.suit;
  const red = new Uint8Array(52);
  for (let c = 0; c < 52; c++) red[c] = (S[c] & 1) ^ 1;
  const scratch = new Uint8Array(FC_LEN);
  const col = (a, i, k) => a[FC_AT + i * 20 + k];
  const G = {
    len: FC_LEN,
    won: a => a[12] + a[13] + a[14] + a[15] === 52,
    hash(a) {
      let h1 = 0, h2 = 0;
      for (let i = 0; i < 8; i++) {
        const n = a[i];
        let x = n, y = n * 7 + 1;
        for (let k = 0; k < n; k++) { const c = a[FC_AT + i * 20 + k]; x = Math.imul(x, 31) + c + 1; y = Math.imul(y ^ c, 0x9E3779B1) + k; }
        h1 += mix(x); h2 += mix(y ^ 0x5bd1e995);
      }
      for (let i = 8; i < 12; i++) if (a[i] !== EMPTY) { h1 += mix(a[i] + 977); h2 += mix(a[i] * 131 + 3); }
      h1 += mix(a[12] | a[13] << 4 | a[14] << 8 | a[15] << 12);
      h2 += mix((a[12] | a[13] << 4 | a[14] << 8 | a[15] << 12) ^ 0x1234567);
      keyOf(h1, h2);
    },
    prio(a, g) {
      const found = a[12] + a[13] + a[14] + a[15];
      let blocked = 0, free = 0, empties = 0;
      for (let i = 0; i < 8; i++) {
        const n = a[i];
        if (!n) { empties++; continue; }
        // a card is in the way when a lower card lies under it; the nearer the foundation's next card, the worse
        let low = 99;
        for (let k = 0; k < n; k++) {
          const c = a[FC_AT + i * 20 + k], r = R[c];
          if (r > low) blocked++; else low = r;
        }
      }
      for (let i = 8; i < 12; i++) if (a[i] === EMPTY) free++;
      return (52 - found) * 20 + blocked * 12 - free * 6 - empties * 14 + g * 1;
    },
    expand(a, emit) {
      const b = scratch;
      let free = 0, empties = 0, firstEmpty = -1;
      for (let i = 8; i < 12; i++) if (a[i] === EMPTY) free++;
      for (let i = 0; i < 8; i++) if (!a[i]) { empties++; if (firstEmpty < 0) firstEmpty = i; }
      const child = (mv) => { closeFc(b); return emit(b, mv); };
      // a column's top card or a cell's card going to the foundation, a column, an empty column
      for (let i = 0; i < 8; i++) {
        const n = a[i];
        if (!n) continue;
        const top = a[FC_AT + i * 20 + n - 1];
        // to the foundation
        if (a[12 + S[top]] === R[top]) {
          b.set(a); b[i] = n - 1; b[12 + S[top]]++;
          if (child(pack({ f: place(TAB, i), t: place(FND, S[top]), n: 1 }))) return;
        }
        // the run at the top: its length
        let run = 1;
        while (run < n) {
          const c = a[FC_AT + i * 20 + n - 1 - run], d = a[FC_AT + i * 20 + n - run];
          if (R[c] !== R[d] + 1 || red[c] === red[d]) break;
          run++;
        }
        // onto another column
        for (let j = 0; j < 8; j++) {
          if (j === i || !a[j]) continue;
          const tj = a[FC_AT + j * 20 + a[j] - 1];
          const want = R[tj] - 1;                           // the rank the run's lowest-in-the-pile card must have
          const m = want - R[top] + 1;                      // how deep in the run that card is
          if (m < 1 || m > run) continue;
          const card = a[FC_AT + i * 20 + n - m];
          if (red[card] === red[tj]) continue;
          if (m > (free + 1) * 2 ** empties) continue;
          b.set(a);
          b[i] = n - m; b[j] = a[j] + m;
          for (let k = 0; k < m; k++) b[FC_AT + j * 20 + a[j] + k] = a[FC_AT + i * 20 + n - m + k];
          if (child(pack({ f: place(TAB, i), t: place(TAB, j), n: m }))) return;
        }
        // into the first empty column (a column's whole run into one is no move at all)
        if (firstEmpty >= 0) {
          const cap = (free + 1) * 2 ** (empties - 1);
          for (let m = 1; m <= run && m <= cap; m++) {
            if (m === n) continue;
            b.set(a);
            b[i] = n - m; b[firstEmpty] = m;
            for (let k = 0; k < m; k++) b[FC_AT + firstEmpty * 20 + k] = a[FC_AT + i * 20 + n - m + k];
            if (child(pack({ f: place(TAB, i), t: place(TAB, firstEmpty), n: m }))) return;
          }
        }
        // to a free cell
        if (free) {
          let slot = 8;
          while (a[slot] !== EMPTY) slot++;
          b.set(a); b[i] = n - 1; b[slot] = top;
          if (child(pack({ f: place(TAB, i), t: place(CEL, slot - 8), n: 1 }))) return;
        }
      }
      for (let ci = 8; ci < 12; ci++) {
        const c = a[ci];
        if (c === EMPTY) continue;
        if (a[12 + S[c]] === R[c]) {
          b.set(a); b[ci] = EMPTY; b[12 + S[c]]++;
          if (child(pack({ f: place(CEL, ci - 8), t: place(FND, S[c]), n: 1 }))) return;
        }
        for (let j = 0; j < 8; j++) {
          if (!a[j]) continue;
          const tj = a[FC_AT + j * 20 + a[j] - 1];
          if (R[tj] !== R[c] + 1 || red[tj] === red[c]) continue;
          b.set(a); b[ci] = EMPTY; b[FC_AT + j * 20 + a[j]] = c; b[j] = a[j] + 1;
          if (child(pack({ f: place(CEL, ci - 8), t: place(TAB, j), n: 1 }))) return;
        }
        if (firstEmpty >= 0) {
          b.set(a); b[ci] = EMPTY; b[firstEmpty] = 1; b[FC_AT + firstEmpty * 20] = c;
          if (child(pack({ f: place(CEL, ci - 8), t: place(TAB, firstEmpty), n: 1 }))) return;
        }
      }
    },
  };
  /** Cards that can go up and no other will want (the engine's "safe" rule), until none can. */
  function closeFc(b) {
    for (let again = true; again;) {
      again = false;
      for (let i = 0; i < 12; i++) {
        let c;
        if (i < 8) { if (!b[i]) continue; c = b[FC_AT + i * 20 + b[i] - 1]; } else { c = b[i]; if (c === EMPTY) continue; }
        const su = S[c], r = R[c];
        if (b[12 + su] !== r) continue;
        if (r > 1 && (b[12 + (su & 1 ? 0 : 1)] < r || b[12 + (su & 1 ? 2 : 3)] < r)) continue;
        if (i < 8) b[i]--; else b[i] = EMPTY;
        b[12 + su]++;
        again = true;
      }
    }
  }
  // the root, from the engine's game
  const root = new Uint8Array(FC_LEN);
  s.cols.forEach((c, i) => { root[i] = c.length; c.forEach((x, k) => { root[FC_AT + i * 20 + k] = x; }); });
  s.cells.forEach((c, i) => { root[8 + i] = c < 0 ? EMPTY : c; });
  s.found.forEach((n, i) => { root[12 + i] = n; });
  closeFc(root);
  return { G, root, decide: x => x };
}

// ---------- Klondike ----------
// bytes: [0..6] the columns' lengths, [7..13] their cards face down, [14..17] the foundations, [18] the cards in the stock
// and waste, [19] how many of them are in the waste (the pointer), [20..43] those cards (the waste from the bottom to its
// top, then the stock from its top down), then seven columns of 20
const KL_AT = 44, KL_LEN = KL_AT + 7 * 20;
function klondike(s, draw) {
  const T = tableOf(s.v), R = T.rank, S = T.suit;
  const red = new Uint8Array(52);
  for (let c = 0; c < 52; c++) red[c] = (S[c] & 1) ^ 1;
  const scratch = new Uint8Array(KL_LEN);
  const seen = new Uint8Array(52);
  const G = {
    len: KL_LEN,
    won: a => a[14] + a[15] + a[16] + a[17] === 52,
    hash(a) {
      let h1 = 0, h2 = 0;
      for (let i = 0; i < 7; i++) {
        const n = a[i];
        let x = n * 16 + a[7 + i], y = n * 7 + a[7 + i];
        for (let k = 0; k < n; k++) { const c = a[KL_AT + i * 20 + k]; x = Math.imul(x, 31) + c + 1; y = Math.imul(y ^ c, 0x9E3779B1) + k; }
        h1 += mix(x); h2 += mix(y ^ 0x5bd1e995);
      }
      const f = a[14] | a[15] << 4 | a[16] << 8 | a[17] << 12;
      h1 += mix(f); h2 += mix(f ^ 0x1234567);
      const N = a[18];
      if (draw === 1) {            // turning the stock over is free, so only the cyclic order counts
        for (let k = 0; k < N; k++) { const c = a[20 + k], d = a[20 + (k + 1) % N]; h1 += mix(c * 64 + d + 1); h2 += mix((c * 64 + d) * 3 + 77); }
      } else {
        let x = a[19] + 1, y = N;
        for (let k = 0; k < N; k++) { x = Math.imul(x, 33) + a[20 + k] + 1; y = Math.imul(y ^ a[20 + k], 0x9E3779B1) + k; }
        h1 += mix(x); h2 += mix(y);
      }
      keyOf(h1, h2);
    },
    prio(a, g) {
      const found = a[14] + a[15] + a[16] + a[17];
      let hidden = 0, empties = 0;
      for (let i = 0; i < 7; i++) { hidden += a[7 + i]; if (!a[i]) empties++; }
      return hidden * 60 + (52 - found) * 8 - empties * 10 + g * 2;
    },
    expand(a, emit) {
      const b = scratch;
      let firstEmpty = -1;
      for (let i = 0; i < 7; i++) if (!a[i]) { firstEmpty = i; break; }
      const child = mv => { closeKl(b); return emit(b, mv); };
      // flips the card a column's removal uncovers
      const flip = i => { if (b[i] && b[7 + i] >= b[i]) b[7 + i] = b[i] - 1; if (!b[i]) b[7 + i] = 0; };
      for (let i = 0; i < 7; i++) {
        const n = a[i];
        if (!n) continue;
        const top = a[KL_AT + i * 20 + n - 1];
        if (a[14 + S[top]] === R[top]) {
          b.set(a); b[i] = n - 1; b[14 + S[top]]++; flip(i);
          if (child(pack({ f: place(TAB, i), t: place(FND, S[top]), n: 1 }))) return;
        }
        // every run that can move: from the card at k to the top
        for (let k = n - 1; k >= a[7 + i]; k--) {
          const c = a[KL_AT + i * 20 + k];
          if (k < n - 1) { const d = a[KL_AT + i * 20 + k + 1]; if (R[c] !== R[d] + 1 || red[c] === red[d]) break; }
          const m = n - k;
          // a run that leaves face-up cards behind only moves to let one of them go up (or the pile beside it be dug)
          if (k > a[7 + i] && !(k > 0 && a[14 + S[a[KL_AT + i * 20 + k - 1]]] === R[a[KL_AT + i * 20 + k - 1]])) continue;
          for (let j = 0; j < 7; j++) {
            if (j === i || !a[j]) continue;
            const tj = a[KL_AT + j * 20 + a[j] - 1];
            if (R[tj] !== R[c] + 1 || red[tj] === red[c]) continue;
            b.set(a);
            b[i] = k; b[j] = a[j] + m;
            for (let q = 0; q < m; q++) b[KL_AT + j * 20 + a[j] + q] = a[KL_AT + i * 20 + k + q];
            flip(i);
            if (child(pack({ f: place(TAB, i), t: place(TAB, j), n: m }))) return;
          }
          if (firstEmpty >= 0 && R[c] === 12 && k > 0 && k === a[7 + i]) {
            b.set(a);
            b[i] = k; b[firstEmpty] = m;
            for (let q = 0; q < m; q++) b[KL_AT + firstEmpty * 20 + q] = a[KL_AT + i * 20 + k + q];
            flip(i);
            if (child(pack({ f: place(TAB, i), t: place(TAB, firstEmpty), n: m }))) return;
          }
        }
      }
      // a card of the stock or waste, after as many turns as it takes to bring it up
      const N = a[18], p = a[19];
      if (!N) return;
      seen.fill(0);
      const tryAt = q => {                     // the waste holds q cards, its top the card at q - 1
        const c = a[20 + q - 1];
        if (seen[c]) return false;
        seen[c] = 1;
        const dests = [];
        if (a[14 + S[c]] === R[c]) dests.push(place(FND, S[c]));
        for (let j = 0; j < 7; j++) {
          if (!a[j]) continue;
          const tj = a[KL_AT + j * 20 + a[j] - 1];
          if (R[tj] === R[c] + 1 && red[tj] !== red[c]) dests.push(place(TAB, j));
        }
        if (firstEmpty >= 0 && R[c] === 12) dests.push(place(TAB, firstEmpty));
        for (const t of dests) {
          b.set(a);
          // the card leaves the cycle; the waste ends one card shorter
          for (let k = q - 1; k < N - 1; k++) b[20 + k] = a[20 + k + 1];
          b[18] = N - 1; b[19] = q - 1;
          if (kindOfPlace(t) === FND) b[14 + S[c]]++; else { b[t] = a[t] + 1; b[KL_AT + t * 20 + a[t]] = c; }
          if (child(pack({ f: place(WST), t, n: 1 }) | ((c + 1) << 20))) return true;
        }
        return false;
      };
      if (p > 0 && tryAt(p)) return;
      let pos = p;
      for (let guard = 0; guard < 60; guard++) {                      // the rest of this pass, then the stock turned over once
        if (pos >= N) break;
        pos = Math.min(pos + draw, N);
        if (tryAt(pos)) return;
      }
      if (p > 0) {
        pos = 0;
        for (let guard = 0; guard < 60; guard++) {
          pos = Math.min(pos + draw, N);
          if (tryAt(pos)) return;
          if (pos >= N) break;
        }
      }
    },
  };
  const kindOfPlace = pl => pl >> 4;
  function closeKl(b) {
    for (let again = true; again;) {
      again = false;
      for (let i = -1; i < 7; i++) {
        let c;
        if (i < 0) { if (!b[19]) continue; c = b[20 + b[19] - 1]; } else { if (!b[i]) continue; c = b[KL_AT + i * 20 + b[i] - 1]; }
        const su = S[c], r = R[c];
        if (b[14 + su] !== r) continue;
        if (r > 1 && (b[14 + (su & 1 ? 0 : 1)] < r || b[14 + (su & 1 ? 2 : 3)] < r)) continue;
        if (i < 0) { const N = b[18], p = b[19]; for (let k = p - 1; k < N - 1; k++) b[20 + k] = b[20 + k + 1]; b[18] = N - 1; b[19] = p - 1; }
        else { b[i]--; if (b[7 + i] >= b[i] && b[i]) b[7 + i] = b[i] - 1; if (!b[i]) b[7 + i] = 0; }
        b[14 + su]++;
        again = true;
      }
    }
  }
  const root = new Uint8Array(KL_LEN);
  s.cols.forEach((c, i) => { root[i] = c.length; root[7 + i] = s.down[i]; c.forEach((x, k) => { root[KL_AT + i * 20 + k] = x; }); });
  s.found.forEach((n, i) => { root[14 + i] = n; });
  const cyc = [...s.waste, ...s.stock.slice().reverse()];
  root[18] = cyc.length; root[19] = s.waste.length;
  cyc.forEach((c, k) => { root[20 + k] = c; });
  closeKl(root);
  return { G, root };
}

// ---------- Spider ----------
// bytes: [0..9] the columns' lengths, [10..19] their cards face down, [20] the deals left in the stock, [21] the runs taken
// off, then every column's cards one after another
const SP_AT = 22, SP_LEN = SP_AT + 104;
function spider(s) {
  // a card is its face here (rank * 4 + suit): the cards of one face are the same card, so positions that differ only in
  // which of them is which are one position
  const id = s.v, T = tableOf(id), F = c => T.rank[c] * 4 + T.suit[c];
  const R = new Uint8Array(52), S = new Uint8Array(52);
  for (let f = 0; f < 52; f++) { R[f] = f >> 2; S[f] = f & 3; }
  // the rows of the stock, as the deals will put them: rows[r][i] goes on column i
  const rows = [];
  for (let r = 0; r * 10 < s.stock.length; r++) rows.push(Array.from({ length: 10 }, (_, i) => F(s.stock[s.stock.length - 1 - r * 10 - i])));
  const dealsAtRoot = rows.length;
  const scratch = new Uint8Array(SP_LEN), offs = new Int32Array(11), boffs = new Int32Array(11);
  const G = {
    len: SP_LEN,
    won: a => a[21] === 8,
    hash(a) {
      let h1 = 0, h2 = 0, off = SP_AT;
      for (let i = 0; i < 10; i++) {
        const n = a[i];
        let x = n * 16 + a[10 + i], y = n * 7 + a[10 + i];
        for (let k = 0; k < n; k++) { const c = a[off + k]; x = Math.imul(x, 31) + c + 1; y = Math.imul(y ^ c, 0x9E3779B1) + k; }
        off += n;
        h1 += mix(x); h2 += mix(y ^ 0x5bd1e995);
      }
      const f = a[20] | a[21] << 4;
      h1 += mix(f); h2 += mix(f ^ 0x1234567);
      keyOf(h1, h2);
    },
    prio(a, g) {
      let off = SP_AT, hidden = 0, broken = 0, mixed = 0, chain = 0, chains = 0, empties = 0;
      for (let i = 0; i < 10; i++) {
        const n = a[i];
        hidden += a[10 + i];
        if (!n) empties++;
        for (let k = 0; k < n; k++) {
          const c = a[off + k], r = R[c];
          if (k > a[10 + i] - 1 && k > 0) { const d = a[off + k - 1]; if (R[d] !== r + 1) broken++; else if (S[d] !== S[c]) mixed++; }
          if (k >= a[10 + i]) { if (k > a[10 + i] && R[a[off + k - 1]] === r + 1 && S[a[off + k - 1]] === S[c]) chain++; else chain = 1; chains += chain; }
        }
        chain = 0;
        off += n;
      }
      return (8 - a[21]) * 400 + hidden * 40 + broken * 5 + mixed * 10 - chains * 3 + a[20] * 20 - empties * 8 + g;
    },
    expand(a, emit) {
      const b = scratch;
      let off = SP_AT;
      for (let i = 0; i < 10; i++) { offs[i] = off; off += a[i]; }
      offs[10] = off;
      let anyEmpty = false;
      for (let i = 0; i < 10; i++) if (!a[i]) anyEmpty = true;
      // builds the child with column i cut to `keepI` cards and column j given `add` more (cards from i's tail), then takes runs
      const make = (i, j, m, mv) => {
        const n = a[i];
        b.set(a.subarray(0, SP_AT));
        b[i] = n - m; b[j] = a[j] + m;
        let w = SP_AT;
        for (let q = 0; q < 10; q++) {
          const len = q === i ? n - m : a[q];
          for (let k = 0; k < len; k++) b[w++] = a[offs[q] + k];
          if (q === j) for (let k = 0; k < m; k++) b[w++] = a[offs[i] + n - m + k];
        }
        if (b[i] && b[10 + i] >= b[i]) b[10 + i] = b[i] - 1;
        if (!b[i]) b[10 + i] = 0;
        takeRunsSp(b);
        return emit(b, mv);
      };
      let firstEmpty = -1;
      for (let i = 0; i < 10; i++) if (!a[i]) { firstEmpty = i; break; }
      for (let i = 0; i < 10; i++) {
        const n = a[i];
        if (!n) continue;
        const o = offs[i];
        // the run at the top: the same suit, each a rank below the last, face up
        let run = 1;
        while (run < n - a[10 + i]) {
          const c = a[o + n - 1 - run], d = a[o + n - run];
          if (R[c] !== R[d] + 1 || S[c] !== S[d]) break;
          run++;
        }
        for (let m = run; m >= 1; m--) {
          const lead = a[o + n - m];
          // a run that can join one of its own suit does that, and goes onto another suit only when it can't
          let joins = false;
          for (let j = 0; j < 10; j++) if (j !== i && a[j]) { const tj = a[offs[j] + a[j] - 1]; if (R[tj] === R[lead] + 1 && S[tj] === S[lead]) joins = true; }
          const only = joins;
          for (let j = 0; j < 10; j++) {
            if (j === i || !a[j]) continue;
            const tj = a[offs[j] + a[j] - 1];
            if (R[tj] !== R[lead] + 1) continue;
            if (only && S[tj] !== S[lead]) continue;
            if (make(i, j, m, pack({ f: place(TAB, i), t: place(TAB, j), n: m }))) return;
          }
          if (firstEmpty >= 0 && m < n) if (make(i, firstEmpty, m, pack({ f: place(TAB, i), t: place(TAB, firstEmpty), n: m }))) return;
        }
      }
      if (a[20] > 0 && !anyEmpty) {
        const row = rows[dealsAtRoot - a[20]];
        b.set(a.subarray(0, SP_AT));
        b[20] = a[20] - 1;
        let w = SP_AT;
        for (let q = 0; q < 10; q++) {
          for (let k = 0; k < a[q]; k++) b[w++] = a[offs[q] + k];
          b[w++] = row[q];
          b[q] = a[q] + 1;
        }
        takeRunsSp(b);
        if (emit(b, pack({ f: place(STK), t: place(STK), n: 10 }))) return;
      }
    },
  };
  /** Any column ending in a king-to-ace run of one suit gives it up (the cards are rewritten column by column). */
  function takeRunsSp(b) {
    for (let again = true; again;) {
      again = false;
      let off = SP_AT;
      for (let i = 0; i < 10; i++) {
        const n = b[i];
        if (n >= 13 && n - 13 >= b[10 + i]) {
          const suit = S[b[off + n - 1]];
          let ok = true;
          for (let k = 0; k < 13; k++) { const c = b[off + n - 1 - k]; if (R[c] !== k || S[c] !== suit) { ok = false; break; } }
          if (ok) {
            // close the gap
            b.copyWithin(off + n - 13, off + n, SP_AT + 104);
            b[i] = n - 13; b[21]++;
            if (b[i] && b[10 + i] >= b[i]) b[10 + i] = b[i] - 1;
            if (!b[i]) b[10 + i] = 0;
            again = true;
            break;
          }
        }
        off += n;
      }
    }
  }
  const root = new Uint8Array(SP_LEN);
  let w = SP_AT;
  s.cols.forEach((c, i) => { root[i] = c.length; root[10 + i] = s.down[i]; for (const x of c) root[w++] = F(x); });
  root[20] = dealsAtRoot; root[21] = s.runs.length;
  return { G, root };
}

// ---------- asking ----------
// What a search may make before it gives up, in positions (never in time: the same on every device). Making a deal
// tries many shuffles at a small budget, since the shuffles a search wins mostly fall at once; a hint, which has one
// position and may wait a moment, gets a large one. Four suits are not here: the search wins about one deal in forty
// of them, too few to find one while the player waits, so a four-suit deal is the day's shuffle as it falls.
const DEAL_BUDGET = { klondike1: 15000, klondike3: 15000, freecell: 40000, spider1: 12000, spider2: 30000 };
const HINT_BUDGET = { klondike1: 100000, klondike3: 100000, freecell: 100000, spider1: 100000, spider2: 150000, spider4: 150000 };
/** Whether a game's deals are checked by the solver (all but four-suit Spider). */
export const certifies = id => id in DEAL_BUDGET;
export const hintBudget = id => HINT_BUDGET[id];

/**
 * The decisions as the engine's own moves, with the turns of the stock and the cards that go up on their own spelled out;
 * null if the engine won't have them or they don't win. partial: the moves as far as the engine takes them, won or not.
 */
export function lineFor(s0, decisions, partial = false) {
  const V = VARIANTS[s0.v], s = cloneGame(s0), line = [];
  const push = (m, auto = false) => { if (whyNot(s, m)) return false; line.push(pack(m, auto)); applyMut(s, m); return true; };
  const close = () => { for (let m; (m = autoStep(s, "safe"));) push(m, true); };
  const fail = () => (partial ? line : null);
  close();
  for (const x of decisions) {
    const card = (x >> 20) - 1, m = unpack(x & 0xFFFFF);
    if (card >= 0) {
      for (let guard = 0; s.waste[s.waste.length - 1] !== card; guard++) {
        if (guard > 120) return fail();
        const turn = s.stock.length ? { f: place(STK), t: place(WST), n: Math.min(V.draw, s.stock.length) } : { f: place(WST), t: place(STK), n: s.waste.length };
        if (!push(turn)) return fail();
      }
    }
    if (!push({ f: m.f, t: m.t, n: m.n })) return fail();
    close();
  }
  return partial || won(s) ? line : null;
}

/**
 * Looks for a win from a game (any position). → { line: the packed moves that win | null, nodes, full (the budget ran out
 * before the search did, so "no win found" says nothing certain about the position), hint (when there is no win: the
 * moves towards the position the search liked best, a suggestion and no promise) }.
 */
export function solve(s, budget = HINT_BUDGET[s.v]) {
  if (won(s)) return { line: [], nodes: 0, full: false };
  const V = VARIANTS[s.v];
  const setup = V.game === "freecell" ? freecell(s) : V.game === "klondike" ? klondike(s, V.draw) : spider(s);
  const r = bestFirst(setup.G, setup.root, budget);
  if (!r.moves) return { line: null, nodes: r.nodes, full: r.full, hint: r.best?.length ? lineFor(s, r.best, true) : null };
  return { line: lineFor(s, r.moves), nodes: r.nodes, full: false };
}

/**
 * The deal for a game and a key (a day, a seed): the first shuffle of that key (try 0, 1, 2…) the solver wins, so the same
 * for everyone and always winnable. → { order, tryNo, certified, line (the win found), nodes (all the tries') }. A
 * four-suit game's is try 0, uncertified. onTry(tryNo) says each try as it begins.
 */
export function makeDeal(id, key, { tries = 80, onTry = null } = {}) {
  if (!certifies(id)) return { order: shuffled(id, key, 0), tryNo: 0, certified: false, line: null, nodes: 0 };
  let nodes = 0;
  for (let tryNo = 0; tryNo < tries; tryNo++) {
    onTry?.(tryNo);
    const order = shuffled(id, key, tryNo), r = solve(newGame(id, order), DEAL_BUDGET[id]);
    nodes += r.nodes;
    if (r.line) return { order, tryNo, certified: true, line: r.line, nodes };
  }
  return { order: shuffled(id, key, 0), tryNo: 0, certified: false, line: null, nodes };
}
