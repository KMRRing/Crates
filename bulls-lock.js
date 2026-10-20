// Lock: the code-breaking puzzle with nothing left to chance. A code of three or four different digits, and a few clue
// rows, each a guess scored as Bulls and Cows scores it ("one right and in its place, one right but elsewhere"), that
// leave exactly one code: you reason it out and open the lock, guessing nothing. Pure (no page), tested by tests/bulls.mjs.
//
// The generator hides a code, adds clues (random guesses scored against it) while each still rules codes out, until one
// code is left, then drops every clue the others don't need, so each clue matters (and any clues split between players
// leave each of them short). Uniqueness is counted, not assumed: every code of the size is tried against the clues.
// Difficulty is the reasoning a person needs, measured by a solver that knows what a person writes down: which digits
// are in the code, which are out, and which digits each place can still hold. Each round it reads every clue alone
// against what the round before settled (anything no code fitting that clue allows is ruled out); when no clue alone
// says more, it reads two clues together, then three. The most clues it had to read at once, and the rounds it took,
// are the grade.
import { rng, mix, randomSeed } from "./bulls-engine.js";

export const LOCK_LEVELS = {
  easy: { label: "Easy", digits: 3, about: "3 digits; each clue says something by itself" },
  medium: { label: "Medium", digits: 3, about: "3 digits; clues read in turn, or two together" },
  hard: { label: "Hard", digits: 4, about: "4 digits; two clues read together" },
  expert: { label: "Expert", digits: 4, about: "4 digits; three clues read together" },
};
/** Whether a grade ({ digits, step: most clues read at once, rounds }) is the level's. */
const FOR = {
  easy: g => g.digits === 3 && g.step === 1 && g.rounds <= 2,
  medium: g => g.digits === 3 && ((g.step === 1 && g.rounds >= 3) || g.step === 2),
  hard: g => g.digits === 4 && g.step === 2,
  expert: g => g.digits === 4 && g.step === 3,
};
export const TRIES = 120;                          // locks tried for a level before the nearest is taken (Expert, the rarest, hits about one in twenty)
export const WRONG = 30;                      // seconds added for a wrong code tried
export const HINT = 30;                       // and for a hint

// ---------- codes of different digits ----------
const CODES = new Map();
/** Every code of p different digits: [{ d: digits, mask: which digits it holds }]. */
export function lockCodes(p) {
  if (CODES.has(p)) return CODES.get(p);
  const out = [], d = [];
  const walk = () => {
    if (d.length === p) { out.push({ d: d.slice(), mask: d.reduce((m, x) => m | (1 << x), 0) }); return; }
    for (let x = 0; x < 10; x++) if (!d.includes(x)) { d.push(x); walk(); d.pop(); }
  };
  walk();
  CODES.set(p, out);
  return out;
}
/** A guess scored against a code of different digits: [bulls, cows]. */
export function scoreLock(g, code) {
  let b = 0, t = 0;
  for (let k = 0; k < g.length; k++) { if (g[k] === code[k]) b++; if (code.includes(g[k])) t++; }
  return [b, t - b];
}
const fitsClue = (code, clue) => { const [b, c] = scoreLock(clue.g, code); return b === clue.b && c === clue.c; };
/** The codes every clue allows (stopping at `upTo`: two is enough to know an answer isn't unique). */
export function answers(p, clues, upTo = Infinity) {
  const out = [];
  for (const x of lockCodes(p)) if (clues.every(cl => fitsClue(x.d, cl))) { out.push(x.d); if (out.length >= upTo) break; }
  return out;
}

// ---------- what a person knows: digits in, digits out, and what each place can hold ----------
// K = { dom: [a bitmask of the digits each place can hold], inn: a bitmask of the digits known to be in }
const fresh = p => ({ dom: new Array(p).fill(1023), inn: 0 });
const allows = (K, x) => x.d.every((v, k) => (K.dom[k] >> v) & 1) && (x.mask & K.inn) === K.inn;
/** What the clues read together force, on top of K: the places' digits narrowed, digits found in. null if nothing fits. */
function forcedBy(p, K, clues) {
  const dom = new Array(p).fill(0);
  let inn = 1023, any = false;
  for (const x of lockCodes(p)) {
    if (!allows(K, x) || !clues.every(cl => fitsClue(x.d, cl))) continue;
    any = true;
    for (let k = 0; k < p; k++) dom[k] |= 1 << x.d[k];
    inn &= x.mask;
  }
  return any ? { dom, inn } : null;
}
const sameK = (A, B) => A.inn === B.inn && A.dom.every((m, k) => m === B.dom[k]);
const meet = (A, B) => ({ dom: A.dom.map((m, k) => m & B.dom[k]), inn: A.inn | B.inn });
const settled = (p, K) => { let n = 0; for (const x of lockCodes(p)) if (allows(K, x) && ++n > 1) return false; return n === 1; };
/** Every way to pick `size` of n clues, as lists of indices. */
function groups(n, size) {
  const out = [], pick = [];
  const walk = from => { if (pick.length === size) { out.push(pick.slice()); return; } for (let i = from; i < n; i++) { pick.push(i); walk(i + 1); pick.pop(); } };
  walk(0);
  return out;
}

/**
 * The grade of a set of clues: { digits, step (the most clues read at once at any point: 1, 2 or 3; 4 if even three
 * at once stall), rounds }. A round reads every clue (or pair, or triple) against what the round before settled.
 */
export function gradeLock(p, clues) {
  let K = fresh(p), rounds = 0, step = 1;
  while (!settled(p, K)) {
    if (++rounds > 40) return { digits: p, step: 4, rounds };
    let next = K, size = 1;
    for (; size <= 3; size++) {
      for (const set of groups(clues.length, size)) { const f = forcedBy(p, K, set.map(i => clues[i])); if (f) next = meet(next, f); }
      if (!sameK(next, K)) break;
    }
    if (size > 3) return { digits: p, step: 4, rounds };
    step = Math.max(step, size);
    K = next;
  }
  return { digits: p, step, rounds };
}

// ---------- making a lock ----------
/** One lock from a seed: a code of p digits and the fewest clues (every one needed) that leave only it. */
function draw(p, seed) {
  const r = rng(seed), all = lockCodes(p), secret = all[Math.floor(r() * all.length)].d;
  let left = all.map(x => x.d), clues = [];
  for (let tries = 0; left.length > 1 && tries < 400; tries++) {
    const g = all[Math.floor(r() * all.length)].d, [b, c] = scoreLock(g, secret);
    if (b === p) continue;                                    // a clue that is the answer gives it away
    const next = left.filter(d => { const [bb, cc] = scoreLock(g, d); return bb === b && cc === c; });
    if (next.length === left.length) continue;               // a clue that says nothing new isn't dealt
    clues.push({ g, b, c });
    left = next;
  }
  const order = clues.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  for (const i of order) {
    const rest = clues.filter((cl, k) => cl && k !== i);
    if (answers(p, rest, 2).length === 1) clues[i] = null;
  }
  return { secret, clues: clues.filter(Boolean) };
}
/**
 * The lock for a level and a seed, the same on every device: tried until one grades as the level asks (TRIES at
 * most, then the nearest: the most clues read at once, then the most rounds), and always with exactly one answer.
 * minClues: at least this many clues (a team gets one each at the least). `tries` says how many locks it took: the
 * work, which a test can hold it to where a clock would measure the machine.
 */
export function makeLock(level = "medium", seed = randomSeed(), { minClues = 0 } = {}) {
  const L = LOCK_LEVELS[level] || LOCK_LEVELS.medium, want = FOR[level] || FOR.medium, p = L.digits;
  let best = null;
  for (let t = 0; t < TRIES; t++) {
    const lock = draw(p, mix(seed, t));
    if (lock.clues.length < Math.max(2, minClues) || answers(p, lock.clues, 2).length !== 1) continue;
    const grade = gradeLock(p, lock.clues);
    if (grade.step > 3) continue;                            // beyond what a person reads at once
    const out = { level, seed, p, secret: lock.secret, clues: lock.clues, grade, tries: t + 1 };
    if (want(grade)) return out;
    const near = x => (x.grade.step === 3 ? 30 : x.grade.step * 10) + Math.min(9, x.grade.rounds);
    if (!best || near(out) > near(best)) best = out;
  }
  return best && { ...best, tries: TRIES };                  // every try spent: the nearest
}

// ---------- hints: the solver's steps, in a person's order ----------
const PLACES = ["first", "second", "third", "fourth"];
const digitsOf = mask => [...Array(10).keys()].filter(d => (mask >> d) & 1);
const list = (xs, word) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${word} ${xs.at(-1)}`);
/**
 * The deductions that open the lock, one at a time, in the order a person would make them: of the clues read alone
 * (then two together, then three), the one that says the most about what's known (a place settled outweighs a digit
 * found, which outweighs digits ruled out, which outweigh a digit kept out of a place). Each step: { clues: [indices],
 * out: [digits ruled out], in: [digits found in], at: [[place, digit]] (places settled), not: [[place, digit]] (a
 * digit ruled out of a place), text }.
 */
export function lockSteps(p, clues) {
  const steps = [];
  let K = fresh(p);
  while (!settled(p, K) && steps.length < 60) {
    let found = null;
    for (let size = 1; size <= 3 && !found; size++) for (const set of groups(clues.length, size)) {
      const f = forcedBy(p, K, set.map(i => clues[i]));
      if (!f || sameK(meet(K, f), K)) continue;
      const step = describe(K, meet(K, f), set), weight = 1000 * step.at.length + 100 * step.in.length + 10 * step.out.length + step.not.length;
      if (!found || weight > found.weight) found = { step, weight, next: meet(K, f) };
    }
    if (!found) break;
    steps.push(found.step);
    K = found.next;
  }
  return steps;
}
function describe(K, next, set) {
  const wasAnywhere = K.dom.reduce((m, x) => m | x, 0), isAnywhere = next.dom.reduce((m, x) => m | x, 0);
  const out = digitsOf(wasAnywhere & ~isAnywhere), at = [], not = [];
  next.dom.forEach((m, k) => {
    const ds = digitsOf(m);
    if (ds.length === 1 && digitsOf(K.dom[k]).length > 1) at.push([k, ds[0]]);
    else for (const d of digitsOf(K.dom[k] & ~m)) if (!out.includes(d)) not.push([k, d]);
  });
  const inn = digitsOf(next.inn & ~K.inn).filter(d => !at.some(([, x]) => x === d));   // a digit placed is in, without saying so
  const says = [];
  if (at.length) says.push(at.map(([k, d]) => `the ${PLACES[k]} digit is ${d}`).join(", "));
  if (inn.length) says.push(`${list(inn, "and")} ${inn.length > 1 ? "are" : "is"} in the code`);
  if (out.length) says.push(`${list(out, "and")} ${out.length > 1 ? "aren't" : "isn't"} in it`);
  if (!says.length) {                                        // only places narrowed: said of the digit narrowed most
    const by = new Map();
    for (const [k, d] of not) by.set(d, [...(by.get(d) || []), k]);
    const [d, ks] = [...by].sort((a, b) => b[1].length - a[1].length)[0];
    const still = next.dom.flatMap((m, k) => ((m >> d) & 1 ? [k] : []));
    says.push(still.length === 1 && !((next.inn >> d) & 1) ? `if ${d} is in the code, it's ${PLACES[still[0]]}` : `${d} isn't ${list(ks.map(k => PLACES[k]), "or")}`);
  }
  const who = set.length === 1 ? `Clue ${set[0] + 1}` : `Clues ${list(set.map(i => i + 1), "and")} together`;
  const text = `${who}: ${says.join("; ")}.`;
  return { clues: set, out, in: inn, at, not, text };
}

// ---------- together: the clues shared out ----------
/**
 * The clues dealt among n players, each a list of clue indices: dealt round in a seeded order, every player one at
 * the least (where there are fewer clues than players, clues go round again), and no player's alone enough to open it.
 */
export function shareClues(lock, n, seed = lock.seed) {
  const k = lock.clues.length, order = [...Array(k).keys()], r = rng(mix(seed, 0x5BA));
  for (let i = k - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const hands = Array.from({ length: n }, () => []);
  if (k >= n) order.forEach((c, i) => hands[i % n].push(c));
  else for (let i = 0; i < n; i++) hands[i].push(order[i % k]);
  return hands.map(h => h.sort((a, b) => a - b));
}
