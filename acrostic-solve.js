// Acrostic's solvers (README, Classics: Acrostic), pure, for the generator (acrostic-make.js) and the tests:
//  - fills(P): how many ways the letters fit, counting to two. Every answer must be a word of the clue bank beginning
//    (or for a telestich ending) with its letter of the spine, and every word of the text a word of the wider list
//    (or the text's own word, its names included); the clues are not read at all. One way only means a solver is never
//    left choosing between two readings that both make words: the clues are how you get in, never a coin toss.
//  - solve(P, skill): a person working the puzzle, step by step, the cheapest step first: reading a word of the text
//    off its pattern, an answer off its pattern, the source off the spine, a clue cracked with the letters it has, or
//    cold. Skill 1 cracks only easy clues for common words, 2 a harder clue or a rarer word, 3 both. The puzzle's
//    level is the least skill that finishes it, as a sudoku's is the hardest technique it needs.
import { owners, runsOf, labelOf } from "./acrostic-engine.js";
import { answers, lexicon, Lexicon, code, ALL } from "./acrostic-words.js";

const bit = c => 1 << c;
const popcount = m => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
const only = m => 31 - Math.clz32(m);                      // the letter of a mask with one bit

/** The pieces both solvers read: who owns each square, the text's words, the spine's squares. */
export function shape(P) {
  const own = owners(P), runs = runsOf(P.layout), N = P.cells.length;
  const runOf = new Int32Array(N).fill(-1), posIn = new Int32Array(N);
  runs.forEach((r, i) => r.forEach((c, p) => { runOf[c] = i; posIn[c] = p; }));
  const spineAt = P.answers.map(a => (P.spine.at === "last" ? a.cells.at(-1) : a.cells[0]));
  return { own, runs, runOf, posIn, spineAt, N };
}

// ---------- one way only ----------
/**
 * The number of ways the letters fit (0, 1 or 2: it stops at two), or null when the search ran past `budget` nodes.
 * `two` is the second fill when there is one, for a generator to move the squares it differs in.
 */
export function fills(P, { budget = 4000 } = {}) {
  const { own, runs, runOf, posIn, spineAt, N } = shape(P);
  const W = answers(), at = P.spine.at === "last" ? "last" : "first";
  const truth = Uint8Array.from(P.cells, code);
  const lex = runs.map(r => (r.length <= 15 ? lexicon(r.length, "proof") : null));
  const own_ = runs.map(r => Uint8Array.from(r, c => truth[c]));        // the text's own word: always a word here
  const k = P.answers.length;
  const dom0 = P.answers.map((a, i) => (W.byEnd[at].get(truth[spineAt[i]]) || []).filter(id => W.list[id].n === a.cells.length));
  const mask0 = new Int32Array(N).fill(ALL);
  let nodes = 0, count = 0, two = null, over = false;

  const ownFits = (r, mask) => { const cs = runs[r], w = own_[r]; for (let p = 0; p < cs.length; p++) if (!(mask[cs[p]] & bit(w[p]))) return false; return true; };
  /** Narrows the squares and the answers' words until nothing more follows; false on a contradiction. */
  function settle(dom, mask, ansQ, runQ) {
    const inA = new Uint8Array(k), inR = new Uint8Array(runs.length);
    for (const a of ansQ) inA[a] = 1;
    for (const r of runQ) inR[r] = 1;
    const qa = [...ansQ], qr = [...runQ];
    while (qa.length || qr.length) {
      while (qa.length) {
        const a = qa.pop(); inA[a] = 0;
        const cells = P.answers[a].cells, n = cells.length;
        const keep = dom[a].filter(id => { const cs = W.list[id].codes; for (let i = 0; i < n; i++) if (!(mask[cells[i]] & bit(cs[i]))) return false; return true; });
        if (!keep.length) return false;
        dom[a] = keep;
        for (let i = 0; i < n; i++) {
          let u = 0;
          for (const id of keep) { u |= bit(W.list[id].codes[i]); if (u === mask[cells[i]]) break; }
          const c = cells[i];
          if (u !== mask[c]) { mask[c] &= u; const r = runOf[c]; if (r >= 0 && !inR[r]) { inR[r] = 1; qr.push(r); } }
        }
      }
      while (qr.length && !qa.length) {
        const r = qr.pop(); inR[r] = 0;
        const L = lex[r], cs = runs[r];
        if (!L) continue;                                     // no list this long: the word stands on its answers alone
        const masks = cs.map(c => mask[c]);
        if (masks.every(m => m === ALL)) continue;
        const set = L.match(masks), mine = ownFits(r, mask), any = L.count(set, 1) > 0;
        if (!any && !mine) return false;
        for (let p = 0; p < cs.length; p++) {
          const c = cs[p];
          let m = (any ? L.letters(set, p) : 0) | (mine ? bit(own_[r][p]) : 0);
          m &= mask[c];
          if (!m) return false;
          if (m !== mask[c]) { mask[c] = m; const a = own[c].a; if (!inA[a]) { inA[a] = 1; qa.push(a); } }
        }
      }
    }
    return true;
  }
  function done(dom, mask) {
    for (let r = 0; r < runs.length; r++) {
      const cs = runs[r], L = lex[r];
      if (!L) continue;
      const word = cs.map(c => String.fromCharCode(65 + only(mask[c]))).join("");
      if (!L.has(word) && !ownFits(r, mask)) return false;
    }
    return true;
  }
  function search(dom, mask) {
    if (++nodes > budget) { over = true; return; }
    let pick = -1;
    for (let a = 0; a < k; a++) if (dom[a].length > 1 && (pick < 0 || dom[a].length < dom[pick].length)) pick = a;
    if (pick < 0) {
      if (done(dom, mask)) { count++; if (count === 2) two = mask.slice(); }
      return;
    }
    // the true word last: a second fill, if there is one, turns up before the search spends itself on the first
    const cells = P.answers[pick].cells, order = [...dom[pick]].sort((x, y) => (W.list[x].word === P.answers[pick].word) - (W.list[y].word === P.answers[pick].word));
    for (const id of order) {
      const d2 = dom.slice(), m2 = mask.slice();
      d2[pick] = [id];
      const cs = W.list[id].codes;
      const touched = [];
      for (let i = 0; i < cells.length; i++) { m2[cells[i]] = bit(cs[i]); if (runOf[cells[i]] >= 0) touched.push(runOf[cells[i]]); }
      if (settle(d2, m2, [], [...new Set(touched)])) search(d2, m2);
      if (count >= 2 || over) return;
    }
  }
  const dom = dom0.map(d => d.slice()), mask = mask0.slice();
  if (settle(dom, mask, dom.map((_, a) => a), runs.map((_, r) => r))) search(dom, mask);
  if (over && count < 2) return { count: null, nodes };
  return { count, nodes, two: two ? Array.from(two, m => String.fromCharCode(65 + only(m))).join("") : null };
}

// ---------- a person solving it ----------
// Seconds a step takes a person of middling speed: reading, then writing the letters in (WRITE a letter).
const COST = { word: 3, pattern: 6, spine: 10, recall: 18, crack: 9, cold: 16, stuck: 55 }, WRITE = 0.6;
/** How hard clue `a` is to crack cold: 1 an easy clue for a common word, 2 a harder clue or a rarer word, 3 both. */
export function clueLevel(P, a) {
  const ans = P.answers[a];
  return Math.min(3, (ans.d || 1) + (ans.tier >= 1 ? 1 : 0));
}

/**
 * A person at `skill` (1 to 3) working the puzzle, the cheapest step first, from `start` (an entry: letters already
 * in). read(a): whether they can read clue a (a team's half, a twist's withheld clues); `push`: when stuck, crack the
 * easiest clue left anyway, slowly, as a person eventually does (the computer player); else stop. Returns { solved,
 * steps: [{ kind, a, cells, secs }], secs, known (the entry it reached), most (the hardest clue it cracked with fewer than
 * a third of its letters, as a level) }.
 */
export function solve(P, skill, { read = () => true, push = false, start = null, maxSteps = 400 } = {}) {
  const { own, runs, runOf, spineAt, N } = shape(P);
  const known = start ? [...start].map(ch => (ch === "." ? null : ch)) : new Array(N).fill(null);
  const steps = [];
  let left = known.filter(x => x == null).length, secs = 0, most = 0;
  const commonRun = runs.map(r => lexicon(r.length, "common"));
  const commonAns = P.answers.map(a => lexicon(a.cells.length, "common"));
  const truthOf = cells => cells.map(c => P.cells[c]).join("");
  const spineWords = [];
  {   // the spine's words, as the answers' squares that spell each
    let i = 0;
    for (const w of P.spine.text.split(/\s+/)) { const n = w.replace(/[^A-Za-z]/g, "").length; if (n) spineWords.push(spineAt.slice(i, i + n)); i += n; }
  }
  const lv = P.answers.map((_, a) => (read(a) ? clueLevel(P, a) : Infinity));
  const knownIn = cells => { let n = 0; for (const c of cells) if (known[c]) n++; return n; };
  /** The one word a pattern leaves in a lexicon, or null (none, or more than one). */
  const sole = (L, cells) => {
    if (!L) return null;
    const set = L.match(cells.map(c => (known[c] ? bit(code(known[c])) : ALL)));
    return L.count(set, 2) === 1 ? L.words[L.list(set, 1)[0]] : null;
  };
  // what each word of the text and each answer offers, worked out again only when one of its squares changes
  const runOffer = new Array(runs.length).fill(null), ansOffer = new Array(P.answers.length).fill(null);
  const dirtyR = new Set(runs.keys()), dirtyA = new Set(P.answers.keys());
  const effective = (a, kn, n) => lv[a] - (kn * 3 >= n ? 1 : 0) - (kn * 3 >= 2 * n ? 1 : 0);
  while (left > 0 && steps.length < maxSteps) {
    for (const r of dirtyR) {
      const cs = runs[r], kn = knownIn(cs);
      runOffer[r] = null;
      if (!kn || kn === cs.length || cs.length < 2) continue;
      // a reader completes a word the pattern leaves only one way (and only when that way is the text's)
      const w = sole(commonRun[r], cs);
      if (w && w === truthOf(cs)) runOffer[r] = { cost: COST.word + 0.3 * (cs.length - kn), cells: cs, kind: "word", a: -1 };
    }
    dirtyR.clear();
    for (const a of dirtyA) {
      const ans = P.answers[a], cs = ans.cells, n = cs.length, kn = knownIn(cs);
      ansOffer[a] = null;
      if (kn === n) continue;
      const eff = effective(a, kn, n);
      if (eff <= skill) ansOffer[a] = { cost: (kn ? COST.crack : COST.cold) + 4 * Math.max(0, eff - 1), cells: cs, kind: kn * 3 < n ? "cold" : "crack", a };
      if (kn && (!ansOffer[a] || ansOffer[a].cost > COST.pattern) && sole(commonAns[a], cs) === ans.word) ansOffer[a] = { cost: COST.pattern, cells: cs, kind: "pattern", a };
    }
    dirtyA.clear();
    // every step open now, with what it costs: the cheapest is taken, then the board is looked at afresh
    let best = null;
    const offer = o => { if (o && (!best || o.cost < best.cost)) best = o; };
    runOffer.forEach(offer);
    ansOffer.forEach(offer);
    for (const cells of spineWords) {
      const kn = knownIn(cells);
      if (kn < cells.length && kn >= 2 && kn * 5 >= cells.length * 3) offer({ cost: COST.spine, cells, kind: "spine", a: -1 });
    }
    if (P.famous && (N - left) * 5 >= N * 3) offer({ cost: COST.recall, cells: [...known.keys()], kind: "recall", a: -1 });
    if (!best && push) {
      // stuck: the clue nearest to hand is worked out the long way
      let a0 = -1, e0 = Infinity;
      P.answers.forEach((ans, a) => {
        const n = ans.cells.length, kn = knownIn(ans.cells);
        if (kn === n) return;
        const eff = Math.min(lv[a], 4) - (kn * 3 >= n ? 1 : 0) - (kn * 3 >= 2 * n ? 1 : 0);
        if (eff < e0) { e0 = eff; a0 = a; }
      });
      if (a0 >= 0) best = { cost: COST.stuck + 20 * Math.max(0, e0 - skill), cells: P.answers[a0].cells, kind: "stuck", a: a0 };
    }
    if (!best) break;
    if (best.kind === "cold" || best.kind === "stuck") most = Math.max(most, lv[best.a] === Infinity ? 4 : lv[best.a]);
    const fresh = best.cells.filter(c => known[c] == null);
    for (const c of fresh) { known[c] = P.cells[c]; if (runOf[c] >= 0) dirtyR.add(runOf[c]); dirtyA.add(own[c].a); }
    left -= fresh.length;
    const s = best.cost + WRITE * fresh.length;
    secs += s;
    steps.push({ kind: best.kind, a: best.a, cells: fresh, secs: s });
  }
  return { solved: left === 0, steps, secs, known: known.map(x => x || ".").join(""), most };
}

/** The least skill that finishes the puzzle (1 to 3; 4 when none does), and how it went at that skill. */
export function grade(P, opts = {}) {
  for (const skill of [1, 2, 3]) {
    const r = solve(P, skill, opts);
    if (r.solved) return { level: skill, steps: r.steps.length, cold: r.steps.filter(s => s.kind === "cold").length, secs: Math.round(r.secs) };
  }
  return { level: 4, steps: 0, cold: 0, secs: 0 };
}

// ---------- the computer player ----------
// Three computers, as fast as a person who knows that much: the easy one cracks easy clues and works slowly, the hard
// one cracks anything and works quickly. Each always finishes: stuck, it works the nearest clue out the long way.
export const RIVALS = { 1: { skill: 1, pace: 1.6 }, 2: { skill: 2, pace: 1 }, 3: { skill: 3, pace: 0.62 } };
/** A rival's run as a schedule: [[ms from the start, [squares]]], each step's letters in at that moment. */
export function rivalPlan(P, level) {
  const { skill, pace } = RIVALS[level];
  const r = solve(P, skill, { push: true });
  let t = 0;
  return r.steps.map(s => { t += s.secs * pace * 1000; return [Math.round(t), s.cells]; });
}

// ---------- playing together ----------
/**
 * A team match's split: which seat holds each clue, so that the two halves together finish it and neither half alone
 * does (a person of the highest skill, reading only their own clues, gets stuck). Returns { split, alone: the share of
 * the squares each half reaches by itself }; the halves are as even as the clues allow.
 */
export function splitFor(P, rand = Math.random, tries = 40) {
  const k = P.answers.length, N = P.cells.length;
  let best = null;
  for (let t = 0; t < tries; t++) {
    // the clues in turn first (A, C, E… and B, D, F…), then shuffled halves
    const order = [...Array(k).keys()];
    if (t) for (let i = k - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const split = new Array(k);
    order.forEach((a, i) => { split[a] = i % 2; });
    const alone = [0, 1].map(seat => { const r = solve(P, 3, { read: a => split[a] === seat }); return Math.round(100 * (N - (r.known.split(".").length - 1)) / N) / 100; });
    const score = Math.max(...alone);
    if (!best || score < best.score) best = { split, alone, score };
    if (score < 1) break;
  }
  return { split: best.split, alone: best.alone };
}
/**
 * The Half twist's clues left blank: about half, chosen so the puzzle still finishes at `skill` with only the rest (the
 * blank ones come from the text alone). null if no such half turns up.
 */
export function uncluedFor(P, skill, rand = Math.random) {
  const k = P.answers.length, want = Math.floor(k / 2);
  // clues taken away one at a time, in a random order, each only if the puzzle still finishes without it
  const order = [...Array(k).keys()];
  for (let i = k - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const blankSet = new Set();
  for (const a of order) {
    if (blankSet.size >= want) break;
    blankSet.add(a);
    if (!solve(P, skill, { read: x => !blankSet.has(x) }).solved) blankSet.delete(a);
  }
  return blankSet.size >= Math.max(2, Math.ceil(k / 3)) ? [...blankSet].sort((a, b) => a - b) : null;
}
export { labelOf };
