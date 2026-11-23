// L'Attaque's computer player. It sees what its side has seen: its own pieces, where the other side's stand, which of them
// have moved (so are no Bomb or Flag) and which an attack or a Scout's run has shown. It plays by sampling: it deals the
// other side's hidden pieces many times over, each deal one the board allows (the Flag and Bombs among the pieces that never
// moved, the Flag likelier at the back and among neighbours, Bombs likelier beside it), searches each deal as if it could see
// it, and plays the move that does best across them all (Perfect Information Monte Carlo). An attack on a hidden piece is
// then worth what it wins or loses on average. The search is a short look-ahead with every winning attack followed to its
// end, judged by the pieces left (a hidden piece counts a little more than a shown one, so it neither shows its strong pieces
// for nothing nor leaves the other side's unknown) and by how close each side's movers are to the other's Flag.
import { ARMY, N, SIZE, LAKE, COUNT, FLAG, SPY, SCOUT, MINER, MARSHAL, BOMB, movable, fight, sideOf, depthFrom, movesOf } from "./attaque-board.js";

export const LEVEL_NAMES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];
/** depth: moves looked ahead after its own; samples: deals of the hidden pieces; noise: points of randomness on each move's
 *  worth; wild: the chance of any move at all; quiet: whether winning attacks are followed past the depth; budget: nodes. */
export const LEVELS = {
  easy: { depth: 0, samples: 5, noise: 40, wild: 0.12, quiet: false, budget: 6e4 },
  medium: { depth: 1, samples: 12, noise: 5, wild: 0, quiet: true, budget: 6e5 },
  hard: { depth: 2, samples: 24, noise: 0, wild: 0, quiet: true, budget: 2.5e6 },
};
export const levelOf = name => LEVELS[name] || LEVELS.medium;

const VALUE = [0, 0, 10, 0, 15, 25, 45, 80, 140, 220, 340, 14];   // the Spy and the Miner are worth what the board makes them
const WIN = 100000, INF = 1e9;
const DR = [-SIZE, SIZE, -1, 1];

// ---------- the other side's hidden pieces, dealt ----------
/**
 * One deal of the hidden pieces the view allows: every kind, Int8Array(80). view: { side (whose view; the side to move if not
 * given), p (kind -1 where unknown) }. The kinds still hidden are an army less every piece shown or taken (a taken piece was
 * shown in its fight).
 */
export function sample(view, rng) {
  const p = view.p, them = 1 - (view.side ?? p.t), lo = them * ARMY, kind = Int8Array.from(p.kind);
  const left = COUNT.slice(), hidden = [];
  for (let id = lo; id < lo + ARMY; id++) {
    if (kind[id] >= 0) left[kind[id]]--;
    else if (p.pos[id] >= 0) hidden.push(id);
  }
  const still = hidden.filter(id => !p.moved[id]);
  const pickBy = (list, w) => {
    let sum = 0;
    const ws = list.map(id => { const v = w(id); sum += v; return v; });
    let x = rng() * sum;
    for (let j = 0; j < list.length; j++) { x -= ws[j]; if (x <= 0) return j; }
    return list.length - 1;
  };
  const near = (a, b) => Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE)) + Math.abs((a % SIZE) - (b % SIZE)) === 1;
  const stillAround = sq => { let n = 0; for (const id of still) if (near(p.pos[id], sq)) n++; return n; };
  let flagAt = -1;
  if (left[FLAG] > 0 && still.length) {
    const j = pickBy(still, id => {
      const sq = p.pos[id], d = Math.min(3, depthFrom(them, sq)), c = sq % SIZE;
      return [8, 2.5, 0.5, 0.15][d] * (1 + 0.5 * stillAround(sq)) * (c === 0 || c === SIZE - 1 ? 1.4 : 1);
    });
    const id = still.splice(j, 1)[0];
    kind[id] = FLAG; left[FLAG]--; flagAt = p.pos[id];
  }
  for (let n = left[BOMB]; n > 0 && still.length; n--) {
    const j = pickBy(still, id => { const sq = p.pos[id]; return [1.2, 1.3, 1.1, 0.5][Math.min(3, depthFrom(them, sq))] * (flagAt >= 0 && near(sq, flagAt) ? 3 : 1); });
    kind[still.splice(j, 1)[0]] = BOMB; left[BOMB]--;
  }
  const rest = [];
  for (let k = 0; k < COUNT.length; k++) for (let n = 0; n < left[k]; n++) rest.push(k);
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  let r = 0;
  for (const id of hidden) if (kind[id] < 0) kind[id] = rest[r++] ?? 4;
  return kind;
}

// ---------- the search, on one deal ----------
function searcher(L) {
  const kind = new Int8Array(2 * ARMY), pos = new Int8Array(2 * ARMY), seen = new Uint8Array(2 * ARMY), board = new Int8Array(N);
  const stack = [];
  let nodes = 0, flagTaken = -1;

  function load(kinds, p) {
    kind.set(kinds); pos.set(p.pos); seen.set(p.seen); board.set(p.board);
    flagTaken = -1;
  }

  function gen(side, out, attacksOnly = false) {
    out.length = 0;
    const lo = side * ARMY;
    for (let id = lo; id < lo + ARMY; id++) {
      const sq = pos[id], k = kind[id];
      if (sq < 0 || !movable(k)) continue;
      for (let d = 0; d < 4; d++) {
        let t = sq;
        for (;;) {
          if ((d === 0 && t < SIZE) || (d === 1 && t >= N - SIZE) || (d === 2 && t % SIZE === 0) || (d === 3 && t % SIZE === SIZE - 1)) break;
          t += DR[d];
          if (LAKE[t]) break;
          const o = board[t];
          if (o >= 0) {
            if (sideOf(o) !== side && (!attacksOnly || fight(k, kind[o]) > 0)) out.push(sq * 100 + t);
            break;
          }
          if (!attacksOnly) out.push(sq * 100 + t);
          if (k !== SCOUT) break;
        }
      }
    }
    return out;
  }

  function make(code) {
    const f = (code / 100) | 0, t = code % 100, a = board[f], d = board[t];
    stack.push(a, d, f, t, seen[a], d >= 0 ? seen[d] : 0);
    board[f] = -1;
    if (d < 0) {
      board[t] = a; pos[a] = t;
      if (Math.abs(f - t) !== 1 && Math.abs(f - t) !== SIZE) seen[a] = 1;
      return;
    }
    seen[a] = 1; seen[d] = 1;
    const r = fight(kind[a], kind[d]);
    if (r > 0) { pos[d] = -1; board[t] = a; pos[a] = t; if (kind[d] === FLAG) flagTaken = sideOf(a); }
    else if (r < 0) pos[a] = -1;
    else { pos[a] = -1; pos[d] = -1; board[t] = -1; }
  }
  function unmake() {
    const sd = stack.pop(), sa = stack.pop(), t = stack.pop(), f = stack.pop(), d = stack.pop(), a = stack.pop();
    board[f] = a; pos[a] = f; seen[a] = sa;
    if (d >= 0) { board[t] = d; pos[d] = t; seen[d] = sd; if (kind[d] === FLAG) flagTaken = -1; }
    else board[t] = -1;
  }

  /** The board's worth to `side`: pieces (a hidden one a tenth more), and its movers' reach toward the other side's Flag. */
  function evaluate(side) {
    const marshal = [0, 0], miners = [0, 0], bombs = [0, 0], flag = [-1, -1];
    for (let id = 0; id < 2 * ARMY; id++) {
      if (pos[id] < 0) continue;
      const s = sideOf(id), k = kind[id];
      if (k === MARSHAL) marshal[s] = 1; else if (k === MINER) miners[s]++; else if (k === BOMB) bombs[s]++; else if (k === FLAG) flag[s] = pos[id];
    }
    const score = [0, 0], reach = [99, 99];
    for (let id = 0; id < 2 * ARMY; id++) {
      const sq = pos[id];
      if (sq < 0) continue;
      const s = sideOf(id), o = 1 - s, k = kind[id];
      let v = k === SPY ? (marshal[o] ? 90 : 12) : k === MINER ? 22 + (bombs[o] ? 14 * Math.max(0, 4 - miners[s]) : 0) : VALUE[k];
      if (!seen[id]) v *= 1.1;
      if (movable(k)) {
        v += 0.3 * depthFrom(s, sq);
        if (k !== SCOUT && flag[o] >= 0) {
          const dist = Math.abs(((sq / SIZE) | 0) - ((flag[o] / SIZE) | 0)) + Math.abs((sq % SIZE) - (flag[o] % SIZE));
          if (dist < reach[s]) reach[s] = dist;
        }
      }
      score[s] += v;
    }
    score[0] += 60 / (1 + reach[0]); score[1] += 60 / (1 + reach[1]);
    return score[side] - score[1 - side];
  }

  const lists = [];
  const listAt = ply => (lists[ply] ||= []);
  /** Winning attacks followed to their end: the side to move may stand or take. */
  function quiesce(side, alpha, beta, ply) {
    nodes++;
    const stand = evaluate(side);
    if (stand >= beta || ply > 12) return stand;
    if (stand > alpha) alpha = stand;
    const ms = gen(side, listAt(ply), true);
    for (let i = 0; i < ms.length; i++) {
      make(ms[i]);
      const v = flagTaken === side ? WIN - ply : -quiesce(1 - side, -beta, -alpha, ply + 1);
      unmake();
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }
  function search(side, depth, alpha, beta, ply) {
    if (depth <= 0) { if (L.quiet) return quiesce(side, alpha, beta, ply); nodes++; return evaluate(side); }
    nodes++;
    const ms = gen(side, listAt(ply));
    if (!ms.length) return -(WIN - ply) / 2;                     // no move: lost (a little less sure than a taken Flag)
    // attacks first, the likeliest winners first
    ms.sort((x, y) => order(y) - order(x));
    let best = -INF;
    for (let i = 0; i < ms.length; i++) {
      make(ms[i]);
      const v = flagTaken === side ? WIN - ply : -search(1 - side, depth - 1, -beta, -alpha, ply + 1);
      unmake();
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }
  function order(code) {
    const a = board[(code / 100) | 0], d = board[code % 100];
    if (d < 0) return 0;
    const r = fight(kind[a], kind[d]);
    return r > 0 ? 1000 + VALUE[kind[d]] : r === 0 ? 500 : -1;
  }
  /** Each root move's worth on this deal, from the side to move's view. */
  function root(side, roots, out) {
    for (let i = 0; i < roots.length; i++) {
      make(roots[i]);
      out[i] += flagTaken === side ? WIN : -search(1 - side, L.depth, -INF, INF, 1);
      unmake();
    }
  }
  return { load, root, get nodes() { return nodes; } };
}

/**
 * The computer's move: { code, score } (score its best average worth). view: viewOf(state, side) ({ p, banned, last });
 * level: "easy" | "medium" | "hard"; rng: the seeded randomness the deals and the noise come from.
 */
export function think(view, level = "medium", { rng = Math.random } = {}) {
  const L = levelOf(level), me = view.p.t;
  const roots = movesOf(view.p, me, view.banned ?? -1);
  if (!roots.length) return { code: null, score: -WIN };
  if (roots.length === 1) return { code: roots[0], score: 0 };
  if (L.wild && rng() < L.wild) return { code: roots[Math.floor(rng() * roots.length)], score: 0 };
  const S = searcher(L), totals = new Float64Array(roots.length);
  let n = 0;
  for (; n < L.samples; n++) {
    S.load(sample(view, rng), view.p);
    S.root(me, roots, totals);
    if (S.nodes > L.budget) { n++; break; }
  }
  // going straight back where it came from is a little worse than it looks: it is how two sides end up shuffling forever
  const back = view.last >= 0 ? (view.last % 100) * 100 + Math.floor(view.last / 100) : -1;
  let best = 0, bestV = -INF;
  for (let i = 0; i < roots.length; i++) {
    const v = totals[i] / n - (roots[i] === back ? 4 : 0) + (L.noise ? (rng() - 0.5) * 2 * L.noise : rng() * 1e-3);
    if (v > bestV) { bestV = v; best = i; }
  }
  return { code: roots[best], score: bestV };
}
