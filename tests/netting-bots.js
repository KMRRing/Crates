// Players for Netting's tests and tuning (not a test): they choose a move from the pure rules, so a level can be played
// out without a page. random plays anything; loopy only chases loops; balance only spreads net debt; greedy takes the
// best move now; planner keeps room where the busy issuers are; lookahead looks one move further.
import { book, moves, net, progress, newGame } from "../netting-engine.js";

function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rng = seed => { let k = 0; return () => draw(seed ^ 0xB07, k++); };
const risk = s => { let r = 0; for (let i = 0; i < s.cap.length; i++) { const u = Math.max(0, net(s, i)) / s.cap[i]; r += u * u; } return r; };
function value(lvl, s0, mv) {
  const r = book(lvl, s0, mv), s = r.state;
  let v = progress(lvl, s) - progress(lvl, s0);
  if (s.status === "won") v += 1e6 - s.booked;
  if (s.lives < s0.lives) v -= 1e4;
  if (s.status === "lost") v -= 1e6;
  return v - risk(s) * 0.8 - (mv.line ? 0.5 : 0) - (mv.via != null ? 0.05 : 0);
}
const best = (list, score) => { let b = null, bv = -Infinity; for (const x of list) { const v = score(x); if (v > bv) { bv = v; b = x; } } return b; };

export const BOTS = {
  random: (lvl, s, r) => { const m = moves(lvl, s); return m[Math.floor(r() * m.length)]; },
  greedy: (lvl, s, r) => best(moves(lvl, s).filter(x => !x.line), x => value(lvl, s, x) + r() * 1e-3) || moves(lvl, s)[0],
  loopy: (lvl, s, r) => best(moves(lvl, s).filter(x => !x.line), x => book(lvl, s, x).gain + r() * 1e-3) || moves(lvl, s)[0],
  balance: (lvl, s, r) => best(moves(lvl, s).filter(x => !x.line), x => {
    const t = book(lvl, s, x).state;
    let q = 0;
    for (let i = 0; i < t.cap.length; i++) q += net(t, i) ** 2;
    return -(q + r() * 1e-3 + (t.lives < s.lives ? 1e4 : 0));
  }) || moves(lvl, s)[0],
  planner: (lvl, s, r) => {
    const N = s.cap.length, w = lvl.weights || new Array(N).fill(1), tot = w.reduce((a, b) => a + b, 0), per = (lvl.handSize || 3) * ((1 + (lvl.amount || 3)) / 2);
    return best(moves(lvl, s).filter(x => !x.line), x => {
      const rr = book(lvl, s, x), t = rr.state;
      let pen = 0;
      for (let i = 0; i < N; i++) { const over = net(t, i) + per * w[i] / tot * 1.9 - t.cap[i]; if (over > 0) pen += over * over; }
      return Math.sqrt(rr.gain) * 3 - pen * 1000 - (t.lives < s.lives ? 1e4 : 0) + r() * 1e-3 - (x.via != null ? 0.05 : 0);
    }) || moves(lvl, s)[0];
  },
  lookahead: (lvl, s, r) => {
    const scored = moves(lvl, s).map(x => [value(lvl, s, x) + r() * 1e-3, x]).sort((a, b) => b[0] - a[0]).slice(0, 10);
    return best(scored, ([v1, x]) => {
      const t = book(lvl, s, x).state;
      let v2 = 0;
      if (t.status === "play") { v2 = -Infinity; for (const y of moves(lvl, t)) v2 = Math.max(v2, value(lvl, t, y)); if (v2 === -Infinity) v2 = -1e6; }
      return v1 + v2 * 0.9;
    })?.[1];
  },
};

/** Plays a level to its end with a bot, from a fresh game or a given one; `max` moves at most. */
export function play(lvl, seed, bot, from, max = 400) {
  let s = from || newGame(lvl, seed);
  const r = rng(seed), f = BOTS[bot];
  for (let i = 0; i < max && s.status === "play"; i++) {
    const m = f(lvl, s, r);
    if (!m) { s = { ...s, status: "lost", why: "No legal move." }; break; }
    s = book(lvl, s, m).state;
  }
  return s;
}
