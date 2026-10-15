// Bones' computer players. Every one plays by a rule of thumb: in the block games, shed the heaviest tiles and the
// doubles (which only fit their own number) early and keep tiles that fit the ends left; in Fives and Threes, score
// what the ends allow, the most first. Medium and Hard look further: they deal the tiles they can't see among the
// others as they could lie (each hand's size, and nothing a player has knocked on: a knock on a five and a two means
// no five or two in that hand, nor in what it laid face down), play every move they may to the end of the hand in each
// deal by the rule of thumb, and choose the move that did best for their side on average: the hand's points won or
// lost (Partnership), the chips (Gaple), the points scored either way (Fives and Threes, a point for going out, nothing
// past the target). Medium deals 12 times, Hard 24. Easy plays the rule of thumb with a wobble.
import { TILES, pipsOf, isDouble, hasValue, otherEnd, legalPlays, endsOf, fivesPoints, teamsOf, teamOf } from "./bones-rules.js";

export const LEVEL_NAMES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];
const SAMPLES = { medium: 12, hard: 24 };

export function botMove(s, seat, level = "medium", rng = Math.random) {
  const plays = legalPlays(s, seat);
  if (!plays.length) {
    if (s.game === "gaple" && s.opts.stuck === "discard") return { t: "discard", tile: discardOf(s, seat) };
    return { t: "pass" };
  }
  if (plays.length === 1) return plays[0];
  if (level === "easy" || !SAMPLES[level]) return thumb(simOf(s), seat, plays, rng, 3);
  return search(s, seat, plays, SAMPLES[level], rng);
}

// ---------- a hand played quickly: the line as its two ends ----------
/** The state a playout needs: hands, the ends (and whether each is a double), passes, who's out, the scores. */
export function simOf(s) {
  const e = endsOf(s);
  return {
    game: s.game, n: s.seats, teams: teamsOf(s), opts: s.opts, hands: s.hands.map(h => h.slice()), dead: s.dead.map(d => d.slice()),
    empty: s.first == null, single: s.first != null && !s.left.length && !s.right.length, first: s.first,
    L: e?.L, R: e?.R, Ld: e?.Ld, Rd: e?.Rd, passes: s.passes, out: s.out.slice(), turn: s.turn, scores: s.scores.slice(), gained: Array(s.scores.length).fill(0),
  };
}
const options = (w, seat) => {
  const out = [];
  for (const t of w.hands[seat]) {
    if (w.empty) { out.push({ tile: t, end: "L" }); continue; }
    if (hasValue(t, w.L)) out.push({ tile: t, end: "L" });
    if (hasValue(t, w.R) && (w.R !== w.L || w.Rd !== w.Ld)) out.push({ tile: t, end: "R" });
  }
  return out;
};
/** The ends after a play, without making it. */
function after(w, p) {
  const t = p.tile, d = isDouble(t);
  if (w.empty) return { L: TILES[t][0], R: TILES[t][1], Ld: d, Rd: d, single: true };
  return p.end === "L" ? { L: otherEnd(t, w.L), R: w.R, Ld: d, Rd: w.Rd, single: false } : { L: w.L, R: otherEnd(t, w.R), Ld: w.Ld, Rd: d, single: false };
}
const total = (e, t) => (e.single ? pipsOf(t) : (e.Ld ? 2 * e.L : e.L) + (e.Rd ? 2 * e.R : e.R));

/** The rule of thumb's pick, with a wobble of the given size. */
function thumb(w, seat, list, rng, wobble = 0.5) {
  let best = list[0], bestV = -Infinity;
  for (const p of list) {
    const e = after(w, p), t = p.tile;
    let v = w.game === "fives" ? 10 * fivesPoints(total(e, t)) + 0.3 * pipsOf(t) + (isDouble(t) ? 1 : 0) : pipsOf(t) + (isDouble(t) ? 4 : 0);
    // tiles left that fit the ends this leaves: options for the next turn
    for (const x of w.hands[seat]) if (x !== t && (hasValue(x, e.L) || hasValue(x, e.R))) v += 1.5;
    v += rng() * wobble;
    if (v > bestV) { bestV = v; best = p; }
  }
  return best;
}

/** A play made in a playout: the ends, the hand, the points (Fives and Threes), going out. Returns "end" when the hand is over. */
function apply(w, seat, p) {
  const e = after(w, p);
  w.hands[seat] = w.hands[seat].filter(x => x !== p.tile);
  Object.assign(w, e);
  w.empty = false;
  w.passes = 0;
  if (w.game === "fives") {
    const pts = fivesPoints(total(e, p.tile)), k = w.teams ? teamOf(seat) : seat;
    if (pts && w.scores[k] + pts <= w.opts.target) { w.scores[k] += pts; w.gained[k] += pts; if (w.scores[k] === w.opts.target) { w.gained[k] += 100; return "end"; } }
  }
  if (!w.hands[seat].length) {
    w.out.push(seat);
    if (w.game !== "fives" || !w.teams || w.out.some(q => q !== seat && teamOf(q) === teamOf(seat))) { w.winnerOut = seat; return "end"; }
  }
  return null;
}
/** The rest of a hand by the rule of thumb, from the seat to play. */
function playout(w, rng) {
  for (let guard = 0; guard < 200; guard++) {
    const seat = w.turn, list = options(w, seat);
    if (list.length) { if (apply(w, seat, thumb(w, seat, list, rng, 0.5)) === "end") return; }
    else {
      if (w.game === "gaple" && w.opts.stuck === "discard" && w.hands[seat].length) {
        const t = w.hands[seat].reduce((a, b) => (pipsOf(b) < pipsOf(a) ? b : a));
        w.hands[seat] = w.hands[seat].filter(x => x !== t);
        w.dead[seat].push(t);
      }
      w.passes++;
      const active = w.n - w.out.length;
      if (w.passes >= active) { w.blocked = true; return; }
    }
    let q = seat;
    do q = (q + 1) % w.n; while (w.out.includes(q));
    w.turn = q;
  }
}
/** How a finished playout went for a seat's side. */
function value(w, seat) {
  const pips = w.hands.map((h, i) => h.reduce((a, t) => a + pipsOf(t), 0) + w.dead[i].reduce((a, t) => a + pipsOf(t), 0));
  if (w.game === "fives") {
    const go = !w.blocked && w.winnerOut != null && w.scores[w.teams ? teamOf(w.winnerOut) : w.winnerOut] < w.opts.target ? 1 : 0;
    if (go) w.gained[w.teams ? teamOf(w.winnerOut) : w.winnerOut] += 1;
    const mine = w.teams ? teamOf(seat) : seat;
    return w.gained.reduce((a, g, k) => a + (k === mine ? g : -g / (w.gained.length - 1)), 0);
  }
  if (w.game === "gaple") return pips.reduce((a, b) => a + b, 0) - w.n * pips[seat];
  const side = t => pips[t] + pips[t + 2];
  const win = w.blocked ? (side(0) < side(1) ? 0 : side(1) < side(0) ? 1 : -1) : teamOf(w.winnerOut);
  if (win < 0) return 0;
  const pts = w.opts.count === "all" ? side(0) + side(1) : side(1 - win);
  return win === teamOf(seat) ? pts : -pts;
}

// ---------- looking further ----------
/** What each player has shown they lack: the ends they knocked (or laid face down) on. */
function voidsOf(s) {
  const v = Array.from({ length: s.seats }, () => new Set());
  for (const l of s.log) if (l.pass) for (const x of l.ends) v[l.seat].add(x);
  return v;
}
/** The tiles this seat can't see, dealt among the others' hands, their face-down tiles and the tiles out of play, as they could lie. */
export function dealUnseen(s, seat, rng) {
  const seen = new Set([...s.hands[seat], ...s.dead[seat], ...(s.first == null ? [] : [s.first]), ...s.left.map(x => x.t), ...s.right.map(x => x.t)]);
  const pool = TILES.map((_, i) => i).filter(t => !seen.has(t)), voids = voidsOf(s);
  const holders = [];
  for (let p = 0; p < s.seats; p++) {
    if (p === seat) continue;
    holders.push({ p, kind: "hand", cap: s.hands[p].length, lack: [...voids[p]] });
    if (s.dead[p].length) holders.push({ p, kind: "dead", cap: s.dead[p].length, lack: [...voids[p]] });
  }
  if (s.boneyard.length) holders.push({ kind: "yard", cap: s.boneyard.length, lack: [] });
  for (let attempt = 0; attempt < 30; attempt++) {
    const loose = attempt === 29;                          // at the last, the knocks are let go
    for (const h of holders) h.tiles = [];
    const order = pool.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    // the tiles the fewest can hold go first
    const fits = (h, t) => h.tiles.length < h.cap && (loose || !h.lack.some(x => hasValue(t, x)));
    order.sort((a, b) => holders.filter(h => fits(h, a)).length - holders.filter(h => fits(h, b)).length);
    let ok = true;
    for (const t of order) {
      const can = holders.filter(h => fits(h, t));
      if (!can.length) { ok = false; break; }
      let r = rng() * can.reduce((a, h) => a + h.cap - h.tiles.length, 0);
      const h = can.find(x => (r -= x.cap - x.tiles.length) < 0) || can.at(-1);
      h.tiles.push(t);
    }
    if (ok) {
      const w = simOf(s);
      for (const h of holders) { if (h.kind === "hand") w.hands[h.p] = h.tiles; if (h.kind === "dead") w.dead[h.p] = h.tiles; }
      return w;
    }
  }
  return simOf(s);
}
/** Each play tried in each of `k` deals and played out; the best on average (a hair of chance between equals). */
function search(s, seat, list, k, rng) {
  const sum = list.map(() => 0);
  for (let i = 0; i < k; i++) {
    const base = dealUnseen(s, seat, rng);
    list.forEach((p, j) => {
      const w = { ...base, hands: base.hands.map(h => h.slice()), dead: base.dead.map(d => d.slice()), out: base.out.slice(), scores: base.scores.slice(), gained: base.gained.slice() };
      if (apply(w, seat, p) !== "end") {
        let q = seat;
        do q = (q + 1) % w.n; while (w.out.includes(q));
        w.turn = q;
        playout(w, rng);
      }
      sum[j] += value(w, seat);
    });
  }
  let best = 0;
  sum.forEach((v, j) => { if (v + rng() * 1e-6 > sum[best]) best = j; });
  return { t: "play", tile: list[best].tile, end: list[best].end };
}

/** Gaple's face-down tile when stuck: the one least likely to be played later, weighted by what it would count. */
function discardOf(s, seat) {
  const seen = new Set([...(s.first == null ? [] : [s.first]), ...s.left.map(x => x.t), ...s.right.map(x => x.t), ...s.hands[seat]]);
  const live = v => TILES.filter((tt, i) => !seen.has(i) && (tt[0] === v || tt[1] === v)).length;
  return s.hands[seat].reduce((a, b) => {
    const ka = (live(TILES[a][0]) + live(TILES[a][1])) * pipsOf(a), kb = (live(TILES[b][0]) + live(TILES[b][1])) * pipsOf(b);
    return kb < ka ? b : a;
  });
}
