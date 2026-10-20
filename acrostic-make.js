// Acrostic's generator (README, Classics: Acrostic), pure, run in a worker on the phone (acrostic-worker.js) and in the
// tests: a text from the knowledge base, answers whose letters are exactly the text's (one per letter of the spine,
// which they start with, or end with in a telestich), each letter given a square of the text so the two sides cross
// well, the proof that the letters fit one way only, and clues chosen until a person needs the level's skill. Every
// choice comes from the seed and every search is bounded by its count of steps, never the clock, so a seed makes the
// same puzzle on every phone (the daily, a match).
import { VERSION, LEVELS, layOut, lettersOf, owners, runsOf } from "./acrostic-engine.js";
import { answers, bagKey, lexicon, code } from "./acrostic-words.js";
import { entries } from "./acrostic-texts.js";
import { fills, grade, rivalPlan, splitFor, uncluedFor } from "./acrostic-solve.js";

export { LEVELS, TWISTS, DAILY } from "./acrostic-engine.js";
const MAX_LEN = 12, MIN_LEN = 3;

/**
 * A seeded generator (xorshift): the same seed, the same puzzle. The seed is mixed first, since xorshift's first draws
 * from seeds close together (two days' dates) are close too.
 */
export function rng(seed) {
  let s = hash(`acrostic:${seed}`) || 0x9E3779B9;
  const next = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let i = 0; i < 8; i++) next();
  return next;
}
const shuffle = (xs, rand) => { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } return xs; };
/** A string's hash, for orderings that must not move when the knowledge base grows (FNV-1a). */
export function hash(s) { let h = 0x811C9DC5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; }

// ---------- the answers: the text's letters, word by word ----------
const VOWEL = new Set([0, 4, 8, 14, 20, 24]);                 // A E I O U Y
// words a clue can only define flatly (That man, Definite article): used when the letters need them, not by choice
const DULL = new Set(("THE AND BUT NOR YET FOR ARE WAS WERE HIM HER HIS HERS SHE ITS THEY THEM THEIR OUR OURS YOUR YOURS MINE THAT THIS THESE " +
  "THOSE WHO WHOM WHAT WHICH WITH FROM INTO ONTO UPON THAN THEN THERE HERE BEEN BEING HAS HAD DID DOES").split(" "));

/**
 * Answers whose letters are exactly the text's: one for each letter of the spine, in order, each starting with it
 * (`at` "first") or ending with it ("last"). A depth-first search on the answer with the fewest words left, its words
 * tried by how well they house the letters hardest to place (those the bank's words seldom carry: running prose has far
 * more H, T and W than a dictionary), keeping the vowels in step and the lengths even; the last two answers are looked
 * up by what's left. Returns the answers' word ids, or null when it finds none within `budget` steps.
 */
export function fillAnswers(text, spine, { at = "first", tier = 1, rand = Math.random, budget = 1600, width = 10, prefer = 0, lean = 0.4 } = {}) {
  const W = answers(), rarity = W.rarity;
  const R = new Int16Array(26);
  for (const ch of lettersOf(text)) R[code(ch)]++;
  const sp = [...lettersOf(spine)].map(code);
  for (const s of sp) if (--R[s] < 0) return null;            // the spine's letters are the text's: each must be there
  let L = R.reduce((a, b) => a + b, 0);
  const k = sp.length;
  if (L < (MIN_LEN - 1) * k || L > (MAX_LEN - 1) * k) return null;
  const ok = x => x.tier <= tier && x.n >= MIN_LEN && x.n <= MAX_LEN;
  const fits = x => { const t = x.tail[at]; for (let j = 0; j < t.length; j += 2) if (R[t[j]] < t[j + 1]) return false; return true; };
  const take = (x, sign) => { const t = x.tail[at]; for (let j = 0; j < t.length; j += 2) R[t[j]] -= sign * t[j + 1]; };
  const lists0 = sp.map(s => shuffle((W.byEnd[at].get(s) || []).filter(id => ok(W.list[id]) && fits(W.list[id])), rand));
  const chosen = new Array(k).fill(-1), failed = new Set();
  let nodes = 0;
  // the answers that take exactly what's left, beside their letter of the spine
  const exact = i => (W.bag[at].get(bagKey(sp[i], R)) || []).filter(id => ok(W.list[id]));
  function dfs(left, lists) {
    if (++nodes > budget) return false;
    const s = left.length;
    if (s === 1) { const c = exact(left[0]); if (!c.length) return false; chosen[left[0]] = c[Math.floor(rand() * c.length)]; return true; }
    if (s === 2) {
      const [a, b] = lists[0].length <= lists[1].length ? [0, 1] : [1, 0];
      for (const id of lists[a]) {
        const x = W.list[id], rest = L - (x.n - 1);
        if (rest < MIN_LEN - 1 || rest > MAX_LEN - 1 || !fits(x)) continue;
        take(x, 1);
        const c = exact(left[b]);
        take(x, -1);
        if (c.length) { chosen[left[a]] = id; chosen[left[b]] = c[Math.floor(rand() * c.length)]; return true; }
      }
      return false;
    }
    let key = String.fromCharCode(...R.map(n => 48 + n));
    for (const i of [...left].sort((x, y) => sp[x] - sp[y])) key += String.fromCharCode(65 + sp[i]);
    if (failed.has(key)) return false;
    // every answer's words that still fit (and leave the rest a length the others can take); every letter left must
    // have a word to go into
    // and the answers left must have room for every letter: as many of each as their words can hold between them
    const lo = (MIN_LEN - 1) * (s - 1), hi = (MAX_LEN - 1) * (s - 1);
    const next = [], room = new Int16Array(26), most = new Int16Array(26);
    let best = 0;
    for (let q = 0; q < s; q++) {
      const list = [];
      most.fill(0);
      for (const id of lists[q]) {
        const x = W.list[id], rest = L - (x.n - 1);
        if (rest < lo || rest > hi || !fits(x)) continue;
        list.push(id);
        const t = x.tail[at];
        for (let j = 0; j < t.length; j += 2) if (t[j + 1] > most[t[j]]) most[t[j]] = t[j + 1];
      }
      if (!list.length) { failed.add(key); return false; }
      for (let c = 0; c < 26; c++) room[c] += most[c];
      next.push(list);
      if (list.length < next[best].length) best = q;
    }
    for (let c = 0; c < 26; c++) if (R[c] > room[c]) { failed.add(key); return false; }
    let vowels = 0; for (const v of VOWEL) vowels += R[v];
    const target = L / s, slot = left[best];
    const scored = next[best].map(id => {
      const x = W.list[id], t = x.tail[at];
      let gain = 0, v = 0;
      for (let j = 0; j < t.length; j += 2) { gain += rarity[t[j]] * t[j + 1] * (R[t[j]] / L) * 10; if (VOWEL.has(t[j])) v += t[j + 1]; }
      const after = (vowels - v) / Math.max(1, L - (x.n - 1));
      return [-gain + Math.abs(after - 0.4) * 8 + Math.abs(x.n - 1 - target) * 0.5 + rand() * 1.5 + Math.abs(x.tier - prefer) * lean + (DULL.has(x.word) ? 1.2 : 0), id];
    }).sort((p, q) => p[0] - q[0]);
    const restLeft = left.filter((_, q) => q !== best), restLists = next.filter((_, q) => q !== best);
    for (const [, id] of scored.slice(0, s > 4 ? width : width * 2)) {
      const x = W.list[id];
      take(x, 1); L -= x.n - 1; chosen[slot] = id;
      if (dfs(restLeft, restLists)) return true;
      take(x, -1); L += x.n - 1;
      if (nodes > budget) return false;
    }
    chosen[slot] = -1;
    failed.add(key);
    return false;
  }
  return dfs(sp.map((_, i) => i), lists0) ? chosen : null;
}

// ---------- the squares: each answer's letters into the text ----------
/**
 * Gives every letter of every answer a square holding that letter, so the two sides cross well: an answer's letters
 * spread over different words of the text, never two of its letters side by side in the same order (that would spell
 * a piece of it), and above all no square whose letter could change with both its answer and its word still words
 * (a second way to fill it). A local search over swaps of same-letter squares. Returns each answer's squares.
 */
export function mapLetters(cells, layout, words, at, rand, { avoid = null, rounds = 30 } = {}) {
  const N = cells.length, runs = runsOf(layout);
  const runOf = new Int32Array(N), posIn = new Int32Array(N);
  runs.forEach((r, i) => r.forEach((c, p) => { runOf[c] = i; posIn[c] = p; }));
  const clued = answers().has;
  const slots = [];                                          // every answer letter: [answer, place]
  words.forEach((w, i) => { for (let j = 0; j < w.length; j++) slots.push([i, j]); });
  // the letters each answer letter could change to and still be a word (the spine's own letter can't: it's the source)
  const alt = slots.map(([i, j]) => {
    const w = words[i], spineAt = at === "last" ? w.length - 1 : 0;
    if (j === spineAt) return 0;
    let m = 0;
    for (let c = 0; c < 26; c++) { const ch = String.fromCharCode(65 + c); if (ch !== w[j] && clued.has(w.slice(0, j) + ch + w.slice(j + 1))) m |= 1 << c; }
    return m;
  });
  // the letters each square could change to with its word of the text still a word
  const runAlt = new Int32Array(N);
  for (let c = 0; c < N; c++) {
    const r = runs[runOf[c]], L = lexicon(r.length, "proof");
    if (!L) continue;
    const word = r.map(x => cells[x]).join(""), p = posIn[c];
    let m = 0;
    for (let q = 0; q < 26; q++) { const ch = String.fromCharCode(65 + q); if (ch !== cells[c] && L.has(word.slice(0, p) + ch + word.slice(p + 1))) m |= 1 << q; }
    runAlt[c] = m;
  }
  // the squares and the answer letters of each letter, matched at random to begin with
  const bySlot = new Int32Array(slots.length), byCell = new Int32Array(N);
  const groups = new Map();
  cells.split("").forEach((ch, c) => { if (!groups.has(ch)) groups.set(ch, { cells: [], slots: [] }); groups.get(ch).cells.push(c); });
  slots.forEach(([i, j], s) => groups.get(words[i][j]).slots.push(s));
  for (const g of groups.values()) {
    shuffle(g.cells, rand);
    g.slots.forEach((s, k) => { bySlot[s] = g.cells[k]; byCell[g.cells[k]] = s; });
  }
  const ansOf = Int32Array.from(slots, s => s[0]), placeOf = Int32Array.from(slots, s => s[1]);
  /** What a square costs where it stands: a second way to fill it, a run-mate of the same answer, a neighbour that spells a piece. */
  function costAt(c) {
    const s = byCell[c], i = ansOf[s], j = placeOf[s];
    let x = (alt[s] & runAlt[c]) ? 60 : 0;
    if (avoid?.has(i * N + c)) x += 30;
    for (const d of runs[runOf[c]]) if (d !== c && ansOf[byCell[d]] === i) x += 5;
    if (c > 0 && ansOf[byCell[c - 1]] === i && Math.abs(placeOf[byCell[c - 1]] - j) === 1) x += 8;
    if (c < N - 1 && ansOf[byCell[c + 1]] === i && Math.abs(placeOf[byCell[c + 1]] - j) === 1) x += 8;
    return x;
  }
  // the squares a swap can change the cost of: the two, their neighbours, and their words of the text (each once: a
  // mark by the swap's number keeps the list free of repeats without a set made every time)
  const seen = new Int32Array(N).fill(-1), around = [];
  const near = (a, b, tag) => {
    around.length = 0;
    const add = c => { if (c >= 0 && c < N && seen[c] !== tag) { seen[c] = tag; around.push(c); } };
    for (const c of runs[runOf[a]]) add(c);
    for (const c of runs[runOf[b]]) add(c);
    add(a - 1); add(a + 1); add(b - 1); add(b + 1);
    return around;
  };
  let cost = 0;
  for (let c = 0; c < N; c++) cost += costAt(c);
  const swappable = [...groups.values()].filter(g => g.cells.length > 1);
  for (let round = 0; round < rounds * N && cost > 0 && swappable.length; round++) {
    const g = swappable[Math.floor(rand() * swappable.length)];
    const a = g.cells[Math.floor(rand() * g.cells.length)], b = g.cells[Math.floor(rand() * g.cells.length)];
    if (a === b) continue;
    const cs = near(a, b, round);
    let before = 0; for (const c of cs) before += costAt(c);
    const sa = byCell[a], sb = byCell[b];
    byCell[a] = sb; byCell[b] = sa; bySlot[sa] = b; bySlot[sb] = a;
    let after = 0; for (const c of cs) after += costAt(c);
    if (after <= before) cost += after - before;
    else { byCell[a] = sa; byCell[b] = sb; bySlot[sa] = a; bySlot[sb] = b; }
  }
  const out = words.map(w => new Array(w.length));
  slots.forEach(([i, j], s) => { out[i][j] = bySlot[s]; });
  return { cells: out, cost };
}

// ---------- the puzzle ----------
/** The level's forms of an entry: [{ text, spine, k, n }], each text with a spine its letters can carry. */
function formsFor(entry, L, at) {
  const out = [];
  for (const f of entry.forms) {
    const n = lettersOf(f.text).length;
    if (n < L.letters[0] || n > L.letters[1]) continue;
    for (const s of f.spines) {
      const k = lettersOf(s.text).length;
      if (k < L.answers[0] || k > L.answers[1] || n / k < L.avg[0] || n / k > L.avg[1]) continue;
      // the spine's letters must all be in the text, since every answer's letters are; X starts no answer
      const R = new Int16Array(26);
      for (const ch of lettersOf(f.text)) R[code(ch)]++;
      if ([...lettersOf(s.text)].some(ch => --R[code(ch)] < 0) || (at === "first" && /[X]/.test(lettersOf(s.text)))) continue;
      out.push({ text: f.text, spine: s, k, n });
    }
  }
  return out;
}

/** The entries a puzzle may come from, for these sources (all when none is given). */
export function pool(sources = null, stages = null) {
  const want = sources?.length ? new Set(sources) : null;
  return entries().filter(e => (!want || want.has(e.source)) && (!stages?.[e.source] || stages[e.source].includes(e.stage)));
}

/**
 * Makes a puzzle from `seed`: { level, twist, sources, stages, avoid (entry ids to pass over, a run's recent ones),
 * daily (order the texts by the day's hash, so a growing knowledge base doesn't move every later daily) }. Returns
 * the puzzle, or null if nothing in the pool can be made at this level.
 */
export function makePuzzle(seed, { level = "medium", twist = "classic", sources = null, stages = null, avoid = [], daily = false, maxEntries = 60 } = {}) {
  const L = LEVELS[level] || LEVELS.medium, at = twist === "telestich" ? "last" : "first";
  const rand = rng(seed);
  let list = pool(sources, stages);
  if (!list.length) list = pool();
  const skip = new Set(avoid);
  const fresh = list.filter(e => !skip.has(e.id));
  list = daily ? [...list].sort((a, b) => hash(`${seed}:${a.id}`) - hash(`${seed}:${b.id}`)) : shuffle(fresh.length ? fresh : [...list], rand);
  let tried = 0;
  for (const entry of list) {
    if (!formsFor(entry, L, at).length) continue;
    if (++tried > maxEntries) break;
    const P = fromEntry(entry, seed, { level, twist }, rand);
    if (P) return P;
  }
  return null;
}
/**
 * A puzzle from this entry, or null: its forms that suit the level, the most telling spine first (the knowledge
 * base's order) and the forms of the text at random among those, each tried in turn.
 */
export function fromEntry(entry, seed, { level = "medium", twist = "classic" } = {}, rand = rng(seed)) {
  const L = LEVELS[level] || LEVELS.medium, at = twist === "telestich" ? "last" : "first";
  const forms = formsFor(entry, L, at);
  const rank = new Map(), tie = new Map(forms.map(f => [f, rand()]));
  entry.forms.forEach(f => f.spines.forEach((s, i) => { if (!rank.has(s.text)) rank.set(s.text, i); }));
  forms.sort((a, b) => rank.get(a.spine.text) - rank.get(b.spine.text) || tie.get(a) - tie.get(b));
  for (const form of forms.slice(0, 3)) {
    const P = build(entry, form, L, level, twist, at, seed, rand);
    if (P) return P;
  }
  return null;
}

/** One form made into a puzzle, or null: the fill, the squares, the proof, the clues, the grade, the split. */
function build(entry, form, L, level, twist, at, seed, rand) {
  const W = answers();
  const { cells, layout } = layOut(form.text);
  for (let attempt = 0; attempt < 3; attempt++) {
    const ids = fillAnswers(form.text, form.spine.text, { at, tier: L.tier, rand, prefer: L.prefer, lean: L.lean });
    if (!ids) return null;                                    // the letters don't go into words this way
    const words = ids.map(id => W.list[id].word);
    let avoid = null;
    for (let m = 0; m < 3; m++) {
      const mapped = mapLetters(cells, layout, words, at, rand, { avoid });
      const P = {
        v: VERSION, seed, level, twist, source: entry.source, id: entry.id, famous: entry.famous, text: form.text, cells, layout,
        answers: words.map((word, i) => ({ word, tier: W.list[ids[i]].tier, cells: mapped.cells[i], clue: "", d: 1 })),
        spine: { text: form.spine.text.toUpperCase(), label: form.spine.label, at }, about: entry.about,
      };
      const proof = fills(P);
      if (proof.count === 1) return finish(P, L, twist, rand, ids);
      if (proof.count === 2 && proof.two) {
        // the squares the second fill differs in: their answers are moved elsewhere next time
        avoid ||= new Set();
        const own = owners(P);
        for (let c = 0; c < cells.length; c++) if (proof.two[c] !== cells[c]) avoid.add(own[c].a * cells.length + c);
      } else if (proof.count == null) break;                  // too slow to prove: another fill
    }
  }
  return null;
}

/** The clues, until a person needs the level's skill; then the grade, the twist, the team's split, the rivals. */
function finish(P, L, twist, rand, ids) {
  const W = answers();
  const clueOf = (a, d) => { const cs = W.list[ids[a]].clues; return cs.find(c => c.d === d) || cs[0]; };
  const setClue = (a, d) => { const c = clueOf(a, d); P.answers[a].clue = c.text; P.answers[a].d = c.d; };
  P.answers.forEach((_, a) => setClue(a, L.d));
  const readOf = blankSet => (blankSet ? a => !blankSet.has(a) : () => true);
  let unclued = null;
  if (twist === "half") {
    unclued = uncluedFor(P, Math.max(L.grade, 2), rand);
    if (!unclued) return null;
  }
  const opts = { read: readOf(unclued && new Set(unclued)) };
  let g = grade(P, opts);
  // harder clues one at a time (the answers crossed least first, where they tell most) until the level is reached;
  // an easier one back if a step overshoots
  if (g.level < L.grade) {
    const order = shuffle([...P.answers.keys()], rand).filter(a => P.answers[a].d === 1);
    for (const a of order) {
      if (W.list[ids[a]].clues.every(c => c.d === 1)) continue;
      setClue(a, 2);
      const g2 = grade(P, opts);
      if (g2.level > L.grade) { setClue(a, 1); continue; }
      g = g2;
      if (g.level >= L.grade) break;
    }
  }
  if (g.level > 3) return null;
  if (g.level < L.grade - 1) return null;                     // never more than a step easier than asked
  P.grade = g;
  if (unclued) P.unclued = unclued;
  const { split, alone } = splitFor(P, rand);
  P.split = split;
  P.alone = alone;
  P.rival = { 1: rivalPlan(P, 1), 2: rivalPlan(P, 2), 3: rivalPlan(P, 3) };
  return P;
}
