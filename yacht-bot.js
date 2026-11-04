// Yacht's computer players (yacht.html), on three strengths. All reason with the same worth of a finished turn: the points
// a category would take, less what that category is worth left open (PAR: the points a category tends to make over the
// rest of a game), plus a share of the upper bonus for each pip over three of a face. Taking a category for less than
// its par is a loss; a 0 in Yacht costs about its par, so the computer dumps there when nothing fits.
//   Hard    expected value to the end of the turn: for every way of holding dice it averages the worth over all the
//           rolls that may follow, and over the rolls after those (a depth of the rolls still to come), and stops
//           when scoring now is worth more.
//   Medium  the same, but looking only at the very next roll, as if it would stop after it.
//   Easy    keeps the commonest face, rolls on until it has a score of 20 or more, and scores the most points, with a
//           mistake now and then.
import { scoreOf, openOf, countsOf, CATS } from "./yacht-rules.js";

export const LEVEL_NAMES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];
export const PAR = [2.1, 5.3, 8.6, 12.2, 15.7, 19.2, 17.5, 14, 17, 17, 22.5, 12];
export const TUNE = { share: 0.55 };                                      // 35 for 63 is about half a point a pip over three of a face

/** The worth of writing these dice in a category (see the top). */
export function worth(c, dice) {
  const pts = scoreOf(c, dice);
  return c < 6 ? pts + TUNE.share * (pts - 3 * (c + 1)) - PAR[c] : pts - PAR[c];
}

// Every five dice that can lie (a sorted list of faces: 252 of them), the ways of holding some of each, and what rolling
// the rest may give: built once, so the lookahead below is only arithmetic on numbers.
const MULTI = [], ID = new Map();
(function build() {
  const walk = (d, from) => {
    if (d.length === 5) { ID.set(d.join(""), MULTI.length); MULTI.push([...d]); return; }
    for (let f = from; f <= 6; f++) walk([...d, f], f);
  };
  walk([], 1);
})();
const idOf = d => ID.get([...d].sort().join(""));
const KEPT = new Map();                                                    // a kept multiset's key → [{ id, p }]: the dice it may become
function outcomesOf(kept) {
  const key = kept.join("");
  let list = KEPT.get(key);
  if (list) return list;
  const k = 5 - kept.length, map = new Map(), roll = [];
  const walk = i => {
    if (i === k) { const id = idOf([...kept, ...roll]); map.set(id, (map.get(id) || 0) + 1); return; }
    for (let f = 1; f <= 6; f++) { roll[i] = f; walk(i + 1); }
  };
  walk(0);
  list = [...map].map(([id, n]) => ({ id, p: n / 6 ** k }));
  KEPT.set(key, list);
  return list;
}
// the distinct ways of holding some of five dice: the faces kept, sorted (all five held is stopping, left out)
const HOLDS = MULTI.map(dice => {
  const seen = new Map();
  for (let m = 0; m < 31; m++) {
    const kept = dice.filter((_, i) => m & (1 << i));
    seen.set(kept.join(""), kept);
  }
  return [...seen.values()];
});

/** The worth of a turn's dice by the rolls still to come, for the categories left open. */
function valuer(sheet) {
  const open = openOf(sheet), stops = MULTI.map(d => open.reduce((b, c) => Math.max(b, worth(c, d)), -1e9));
  const memo = [stops];                                                    // memo[r][id]: the worth with r rolls left, stopping allowed
  const best = (id, r) => {
    const m = (memo[r] ||= new Float64Array(MULTI.length).fill(NaN));
    if (m[id] === m[id]) return m[id];
    let v = best(id, r - 1);
    for (const kept of HOLDS[id]) v = Math.max(v, ev(kept, r));
    return (m[id] = v);
  };
  const ev = (kept, r) => {                                               // holding `kept`, rolling the rest, r rolls left
    let e = 0;
    for (const o of outcomesOf(kept)) e += o.p * best(o.id, r - 1);
    return e;
  };
  return { stop: d => stops[idOf(d)], ev };
}

/** The hold, as a mask of the dice in their places, that keeps these faces. */
function maskFor(dice, kept) {
  const need = countsOf(kept), mask = [0, 0, 0, 0, 0];
  dice.forEach((d, i) => { if (need[d] > 0) { need[d]--; mask[i] = 1; } });
  return mask;
}
const bestCat = (open, dice) => open.reduce((b, c) => (worth(c, dice) > worth(b, dice) ? c : b), open[0]);
const MEDIUM_BLUR = 2;
function bestCatBlurred(open, dice, rng) {
  let pick = open[0], top = -1e9;
  for (const c of open) { const w = worth(c, dice) + (rng() - 0.5) * 2 * MEDIUM_BLUR; if (w > top) { top = w; pick = c; } }
  return pick;
}

export function botMove(s, seat, { level = "hard", rng = Math.random } = {}) {
  if (s.left === 3) return { t: "roll" };
  const sheet = s.sheets[seat], dice = s.dice, sorted = [...dice].sort();
  const open = openOf(sheet);
  if (level === "easy") return easy(s, dice, open, rng);
  const V = valuer(sheet), depth = level === "medium" ? 1 : s.left;
  const blur = () => (level === "medium" ? (rng() - 0.5) * 2 * MEDIUM_BLUR : 0);   // Medium misjudges what each choice is worth
  let top = V.stop(sorted) + blur(), move = null;
  if (s.left > 0) for (const kept of HOLDS[idOf(sorted)]) {
    const e = V.ev(kept, depth) + blur();
    if (e > top + 1e-9) { top = e; move = { t: "roll", hold: maskFor(dice, kept) }; }
  }
  return move || { t: "score", c: level === "medium" ? bestCatBlurred(open, sorted, rng) : bestCat(open, sorted) };
}

function easy(s, dice, open, rng) {
  const n = countsOf(dice);
  const cat = rng() < 0.2 ? open[Math.floor(rng() * open.length)] : open.reduce((b, c) => (scoreOf(c, dice) > scoreOf(b, dice) ? c : b), open[0]);
  if (s.left === 0 || scoreOf(cat, dice) >= 20) return { t: "score", c: cat };
  let face = 1;
  for (let f = 1; f <= 6; f++) if (n[f] > n[face] || (n[f] === n[face] && f > face)) face = f;
  const mask = dice.map(d => (d === face ? 1 : 0));
  return mask.every(Boolean) ? { t: "score", c: cat } : { t: "roll", hold: mask };
}

/** What the computer would write the dice in: the category and the points (the page's Hint). */
export function advise(s, seat) {
  const sorted = [...s.dice].sort(), c = bestCat(openOf(s.sheets[seat]), sorted);
  return { c, name: CATS[c].name, pts: scoreOf(c, sorted) };
}
