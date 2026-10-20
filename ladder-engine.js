// Ladder's rules, puzzles and players (README, Ladder): Lewis Carroll's Doublets, played on the suite's word list. From
// a first word to a last, one letter changed at a time, every rung a word; par is the fewest steps it can be done in.
// Pure: no page in it, so tests/ladder.mjs plays it in Node.
import { wordsOf, tierOf, isVariant, isWord } from "./wordlist.js";

// Which words count. A rung may be any word up to SCOWL 55 (tier 5), so a player is never told a real word isn't one;
// par is the fewest steps through any of them, and every ladder dealt can be done at par in words no rarer than
// SCOWL 35 (tier 2), so par never hangs on a word a person wouldn't know. The two ends are the commonest words (SCOWL
// 10), not a plural, a past tense or a word like "also", and not one spelling's alone (colour, color: nobody's last
// word is the other side's typo).
export const ACCEPT = 5, COMMON = 2, ENDS = 0;
export const LENGTHS = [3, 4, 5, 6];
export const RULES = { classic: "Classic", grow: "Grow and shrink" };

// The word list leaves out offensive words but kept some of their plurals and past tenses: these are no words here.
const BANNED = new Set(("cums fags dicks cunts shits twats wanks wanker poofs homo homos dyke dykes sluts whores wop wops kikes spics " +
  "chink chinks gook gooks gyp gyps retard fucks fucked piss pissed arse arses arsed crap craps turd turds prick pricks raped rapes " +
  "nudes gimp pimp pimps hooker").split(" "));
// Words a player may use but the game never puts on screen itself (an end, a hint, a route, the computer's rungs): they
// count as the rarest, so no route the game shows or needs passes through them.
const QUIET = new Set(("hell damn bum bums butt butts sod sods bugger pee pees poo poop poops puke dork prat knob knobs perv pervs queer " +
  "pansy hump humps shag shags snog tart tarts hoe hoes nob nobs sperm labia scrotum nude sexy horny").split(" "));
// Common words that make a dull end: words like "also" and "from", past tenses that aren't -ed, comparatives, -ly
// adverbs, and computing's jargon.
const STOP = new Set(("and any are but can did for get got had has her hes him his how its may nor not now our own per she the too use " +
  "via was who why yes yet you ago all ate fed hid led met ran sat saw won err mod able also away been both came does done drew each " +
  "else even ever felt fell flew from gave goes gone grew held here hung into just kept knew lain made many more most much must none " +
  "once only onto over paid said seen sent sold some soon such than that them then they this thus till told took unto upon very went " +
  "were what when whom will with wore worn your info byte data disk about above after again ahead along apart aside badly began begun " +
  "below borne chose could daily datum dealt ditto drawn drove eaten every fewer flied flies flown forth found fully going grown hello " +
  "hence later least lower maybe meant might nicer never often older other ought outer safer sadly shall shown since spent spoke stood " +
  "taken their there these those threw tried tries truly tying under until upper usual where which while whose wider would wrote " +
  "across almost always anyone anyway became become before behind beyond bigger bitten bodies bought buried buries cannot caught chosen " +
  "closer copied copies deeply easier easily either enough except faster fewest fairly firmly freely gotten harder hardly hereby higher " +
  "highly indeed itself kindly ladies larger latest latter lesser likely loudly lowest mainly merely misled mostly myself namely nearby " +
  "nearer nearly nicest nobody oldest partly purely rarely rather really safely safest should simply slower slowly solely sooner sought " +
  "surely though thrown toward unless unlike varied varies vastly whilst widely widest within binary buffer cursor syntax server script " +
  "subset packet layout header logged french").split(" "));

/** A plural, a past tense or an -ing form of another word: never an end, and second choice on a route the game shows. */
export const inflected = w => {
  const is = x => isWord(x, ACCEPT);
  if (w.endsWith("s") && !w.endsWith("ss") && (is(w.slice(0, -1)) || (w.endsWith("es") && is(w.slice(0, -2))) || (w.endsWith("ies") && is(`${w.slice(0, -3)}y`)))) return true;
  // feed, seed and sing aren't fee + d, see + d or s + ing; but died, used and owed are die, use and owe + d
  if (w.length === 4) return w.endsWith("ed") && w[1] !== "e" && w !== "shed" && is(w.slice(0, -1));
  if (w.length < 4) return false;
  return (w.endsWith("ed") && (is(w.slice(0, -2)) || is(w.slice(0, -1)) || (w[w.length - 3] === w[w.length - 4] && is(w.slice(0, -3)))))
    || (w.endsWith("ing") && (is(w.slice(0, -3)) || is(`${w.slice(0, -3)}e`)));
};

// ---------- the words, as a graph ----------
// One graph for each length in Classic (a step keeps the length), one across every length in Grow and shrink (a step
// may also add or take away a letter). Built the first time a ladder needs it: about 25 ms a length in Node, 150 ms
// for Grow and shrink's.
const graphs = new Map();
export function graphFor(rules = "classic", n = 4) {
  const key = rules === "grow" ? "grow" : `classic${n}`;
  let g = graphs.get(key);
  if (!g) { g = build(rules === "grow" ? LENGTHS : [n], rules === "grow"); graphs.set(key, g); }
  return g;
}
function build(lengths, grow) {
  const words = [], tier = [];
  for (const n of lengths) for (const w of wordsOf(n, ACCEPT)) {
    if (BANNED.has(w)) continue;
    words.push(w);
    tier.push(QUIET.has(w) ? ACCEPT : tierOf(w));
  }
  const at = new Map(words.map((w, i) => [w, i]));
  const adj = words.map(() => []);
  // a letter changed: words that share a pattern with one letter blanked out are a step apart. A pattern is a number
  // (the letters in base 27, the blank 0, the length above them all), which is far quicker to make than a string.
  const patterns = new Map();
  words.forEach((w, i) => {
    let full = w.length * 27 ** 7;
    const place = [];
    for (let p = 0, m = 1; p < w.length; p++, m *= 27) { place.push((w.charCodeAt(p) - 96) * m); full += place[p]; }
    for (let p = 0; p < w.length; p++) {
      const k = full - place[p], b = patterns.get(k);
      if (b) b.push(i); else patterns.set(k, [i]);
    }
  });
  for (const b of patterns.values()) if (b.length > 1) for (const i of b) for (const j of b) if (i !== j) adj[i].push(j);
  // a letter added or taken away: a word with one letter dropped that is itself a word (dropping either of a double
  // letter gives the same word: one link)
  if (grow) words.forEach((w, i) => {
    for (let p = 0; p < w.length; p++) {
      if (p && w[p] === w[p - 1]) continue;
      const j = at.get(w.slice(0, p) + w.slice(p + 1));
      if (j != null) { adj[i].push(j); adj[j].push(i); }
    }
  });
  // what a word costs on a route the game shows: its tier, and a little more for a plural or a past tense
  const cost = Float32Array.from(words, (w, i) => tier[i] + (inflected(w) ? 0.5 : 0));
  return { grow, words, tier: Uint8Array.from(tier), cost, at, adj, base: words.length };
}
/**
 * A word's place in the graph, or -1. Carroll's own ends aren't all words of the list (CAIN and ABEL are names): an end
 * that isn't joins as a guest, linked to the words a step from it, and is a rung only of its own ladder (searches pass
 * through a guest only when it's one of their ends).
 */
function idOf(g, word, guest = false) {
  const w = String(word || "").toLowerCase();
  let i = g.at.get(w);
  if (i != null || !guest || !/^[a-z]{3,}$/.test(w)) return i ?? -1;
  i = g.words.length;
  g.words.push(w);
  g.tier = Uint8Array.from([...g.tier, ENDS]);
  g.cost = Float32Array.from([...g.cost, ENDS]);
  g.at.set(w, i);
  g.adj.push([]);
  for (const v of neighboursOf(g, w)) { const j = g.at.get(v); if (j != null && j !== i && j < g.base && !g.adj[i].includes(j)) { g.adj[i].push(j); g.adj[j].push(i); } }
  return i;
}
/** The strings a step from `w`, words or not, by the rules of graph g. */
function* neighboursOf(g, w) {
  const A = "abcdefghijklmnopqrstuvwxyz";
  for (let p = 0; p < w.length; p++) for (const c of A) if (c !== w[p]) yield w.slice(0, p) + c + w.slice(p + 1);
  if (!g.grow) return;
  for (let p = 0; p < w.length; p++) yield w.slice(0, p) + w.slice(p + 1);
  for (let p = 0; p <= w.length; p++) for (const c of A) yield w.slice(0, p) + c + w.slice(p);
}

/** Whether b is one step from a: a letter changed in its place (or, growing, a letter added or taken away). */
export function isStep(a, b, rules = "classic") {
  if (a.length === b.length) {
    let diff = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++diff > 1) return false;
    return diff === 1;
  }
  if (rules !== "grow" || Math.abs(a.length - b.length) !== 1) return false;
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  for (let p = 0; p < l.length; p++) if (l.slice(0, p) + l.slice(p + 1) === s) return true;
  return false;
}
const graphOf = P => graphFor(P.rules, P.start.length);
/** Whether a word may be a rung of ladder P (its own ends always may). */
export function isRung(P, word) {
  const w = String(word || "").toLowerCase();
  if (w === P.start || w === P.end) return true;
  if (P.rules !== "grow" && w.length !== P.start.length) return false;
  if (w.length < LENGTHS[0] || w.length > LENGTHS.at(-1)) return false;
  const g = graphOf(P), i = g.at.get(w);
  return i != null && i < g.base;
}
/** How common a word is: its tier (0 the commonest), or -1 when it isn't a word here. */
export function rarity(P, word) { const g = graphOf(P), i = g.at.get(String(word || "").toLowerCase()); return i == null || i >= g.base ? -1 : g.tier[i]; }

// ---------- searching ----------
/** Steps from `from` to every word (-1: out of reach), only through words no rarer than `upto` and not in `avoid`. */
function reach(g, from, { upto = ACCEPT, ends = [], avoid = null } = {}) {
  const d = new Int16Array(g.words.length).fill(-1), q = [from];
  d[from] = 0;
  for (let h = 0; h < q.length; h++) {
    const u = q[h];
    for (const v of g.adj[u]) {
      if (d[v] >= 0 || avoid?.has(v)) continue;
      if ((g.tier[v] > upto || v >= g.base) && !ends.includes(v)) continue;
      d[v] = d[u] + 1;
      q.push(v);
    }
  }
  return d;
}
/**
 * The fewest letters that must change, a lower bound on the steps left (each step changes one): in Classic, the
 * letters that differ in their places; growing, the edit distance (letters changed, added or taken away).
 */
export function apart(a, b, rules = "classic") {
  if (rules !== "grow" && a.length === b.length) {
    let n = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
    return n;
  }
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** The shortest routes from s to e, as layers of the words on them; null when there are none. */
function shortest(g, s, e, avoid = null) {
  const ends = [s, e], ds = reach(g, s, { ends, avoid }), par = ds[e];
  if (par < 1) return null;
  const de = reach(g, e, { ends, avoid }), layers = Array.from({ length: par + 1 }, () => []), on = new Uint8Array(g.words.length);
  for (let v = 0; v < g.words.length; v++) if (ds[v] >= 0 && de[v] >= 0 && ds[v] + de[v] === par) { layers[ds[v]].push(v); on[v] = 1; }
  return { par, ds, layers, on };
}
/**
 * The route at par whose rarest word is commonest, and that word's tier; among those, the commonest words overall
 * (a plural or a past tense counting a little rarer), then the alphabet, so it's the same route every time.
 */
function commonest(g, s, e, { par, ds, layers }) {
  const n = g.words.length, worst = new Int16Array(n).fill(99), sum = new Float64Array(n), from = new Int32Array(n).fill(-1);
  worst[s] = 0;
  for (let k = 1; k <= par; k++) for (const v of layers[k]) {
    const t = v === e ? 0 : g.tier[v], c = v === e ? 0 : g.cost[v];
    for (const u of g.adj[v]) {
      if (ds[u] !== k - 1 || worst[u] === 99) continue;
      const w = Math.max(worst[u], t), sm = sum[u] + c, b = from[v];
      if (b < 0 || w < worst[v] || (w === worst[v] && (sm < sum[v] || (sm === sum[v] && g.words[u] < g.words[b])))) { worst[v] = w; sum[v] = sm; from[v] = u; }
    }
  }
  const route = [];
  for (let v = e; v >= 0; v = from[v]) route.push(g.words[v]);
  return { route: route.reverse(), worst: worst[e] };
}

/**
 * What a ladder from `start` to `end` is like, by the rules: par (the fewest steps), how many routes take par steps
 * (counted exactly, up to a million), how many of those a person could find (every word on it no rarer than COMMON),
 * the detours par needs (steps beyond the letters that differ: each a letter changed to something that is neither its
 * first letter nor its last), and the commonest route at par with the tier of its rarest word (`needs`). null when
 * there is no ladder at all.
 */
export function analyse(start, end, rules = "classic") {
  const s0 = String(start).toLowerCase(), e0 = String(end).toLowerCase();
  if (rules !== "grow" && s0.length !== e0.length) return null;
  const g = graphFor(rules, s0.length), s = idOf(g, s0, true), e = idOf(g, e0, true);
  if (s < 0 || e < 0 || s === e) return null;
  const sh = shortest(g, s, e);
  if (!sh) return null;
  const { par, ds, layers, on } = sh, all = new Float64Array(g.words.length), common = new Float64Array(g.words.length), CAP = 1e6;
  all[s] = common[s] = 1;
  for (let k = 1; k <= par; k++) for (const v of layers[k]) {
    let a = 0, c = 0;
    for (const u of g.adj[v]) if (on[u] && ds[u] === k - 1) { a += all[u]; c += common[u]; }
    all[v] = Math.min(CAP, a);
    common[v] = v === e || g.tier[v] <= COMMON ? Math.min(CAP, c) : 0;
  }
  const { route, worst } = commonest(g, s, e, sh);
  return { start: s0, end: e0, rules, par, routes: all[e], common: common[e], needs: worst, detours: par - apart(s0, e0, rules), route };
}

/** The fewest steps from one word to another (-1: none), through any word a rung may be. */
export function distance(a, b, rules = "classic") {
  const g = graphFor(rules, a.length), s = idOf(g, a), e = idOf(g, b);
  if (s < 0 || e < 0) return -1;
  return s === e ? 0 : reach(g, s, { ends: [e] })[e];
}

/**
 * The commonest shortest route from `from` to `to` in ladder P that keeps clear of `avoid` (words already on the
 * ladder, which it may not pass through again). null when there's none.
 */
export function routeFrom(P, from, to, avoid = []) {
  const g = graphOf(P), s = idOf(g, from), e = idOf(g, to);
  if (s < 0 || e < 0) return null;
  if (s === e) return [from];
  const banned = new Set(avoid.map(w => g.at.get(w)).filter(i => i != null && i !== s && i !== e));
  const sh = shortest(g, s, e, banned);
  return sh ? commonest(g, s, e, sh).route : null;
}

// ---------- a person's search: the grading, and the computer players ----------
/**
 * Searches as a careful person does: best first by the steps taken plus (weight times) the letters still wrong, only
 * through words no rarer than `vocab`, never back through a word on its ladder. Weight 1 is exact (it finds par when
 * its words allow); a heavier weight rushes at the end word and may take a step or two more. Among equals, the
 * nearer the end and the commoner word first; `rng` jitters that order, so two computer players don't think alike.
 * Returns the route found and how many words it tried, or null.
 */
export function search(P, { from = P.start, to = P.end, vocab = COMMON, weight = 1, rng = null, cap = 20000, avoid = [] } = {}) {
  const g = graphOf(P), s = idOf(g, from), e = idOf(g, to);
  if (s < 0 || e < 0) return null;
  if (s === e) return { route: [from], tries: 0 };
  const banned = new Set(avoid.map(w => g.at.get(w)).filter(i => i != null && i !== s && i !== e));
  const target = g.words[e], best = new Map([[s, 0]]), back = new Map(), heap = [], done = new Set();
  const key = (v, d) => { const h = apart(g.words[v], target, P.rules); return [d + weight * h, h, g.cost[v] + (rng ? rng() * 1.5 : 0), v]; };
  const less = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3];
  const push = x => { heap.push(x); for (let i = heap.length - 1; i > 0;) { const p = (i - 1) >> 1; if (less(heap[p], heap[i]) <= 0) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && less(heap[l], heap[m]) < 0) m = l;
        if (r < heap.length && less(heap[r], heap[m]) < 0) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  push(key(s, 0));
  let tries = 0;
  while (heap.length && tries < cap) {
    const [, , , u] = pop();
    if (done.has(u)) continue;
    done.add(u);
    tries++;
    if (u === e) {
      const route = [];
      for (let v = e; v != null; v = back.get(v)) route.push(g.words[v]);
      return { route: route.reverse(), tries };
    }
    const d = best.get(u);
    for (const v of g.adj[u]) {
      if (done.has(v) || banned.has(v) || ((g.tier[v] > vocab || v >= g.base) && v !== e)) continue;
      if (best.has(v) && best.get(v) <= d + 1) continue;
      best.set(v, d + 1);
      back.set(v, u);
      push(key(v, d + 1));
    }
  }
  return null;
}

// ---------- difficulty ----------
// What makes a ladder hard is the search it takes, not its length alone: one whose letters can be changed one by one
// into the end's, in some order (no detours), is found by trying the obvious change at each rung; one that needs a
// letter changed to a go-between and changed again later (a detour) hides par from that; and one with a single route
// at par hides it best. `effort` is how many words a careful person's search (search() above, weight 1, common words)
// tries before it holds a ladder at par. Measured on 1,800 ladders (October 2026): with no detours it tries par + 1
// words (straight there); one detour at par 5, about 9; two at par 6, 23; three at par 7 or 8, 56 to 113.
export const LEVELS = {
  easy: { label: "Easy", par: { 3: [3, 4], 4: [3, 4], 5: [4, 5], 6: [4, 5] }, detours: [0, 1], effort: [0, 12], routes: [2, Infinity] },
  medium: { label: "Medium", par: { 3: [4, 5], 4: [5, 6], 5: [5, 7], 6: [5, 7] }, detours: [1, 2], effort: [8, 60], routes: [1, Infinity] },
  hard: { label: "Hard", par: { 3: [5, 7], 4: [6, 8], 5: [7, 9], 6: [6, 9] }, detours: [2, 9], effort: [25, Infinity], routes: [1, 1] },
};
export const LEVEL_ORDER = ["easy", "medium", "hard"];
/** A careful person's work to find par: words tried. */
export function effort(P) { return search(P, { vocab: COMMON })?.tries ?? Infinity; }
const parRange = (level, P) => LEVELS[level].par[Math.min(6, Math.max(3, Math.max(P.start.length, P.end.length)))];
/** Whether ladder P (an analysis) fits a level. */
export function fits(P, level) {
  const L = LEVELS[level], [lo, hi] = parRange(level, P);
  if (P.par < lo || P.par > hi || P.needs > COMMON) return false;
  if (P.rules !== "grow" && (P.detours < L.detours[0] || P.detours > L.detours[1])) return false;
  if (P.routes < L.routes[0] || P.routes > L.routes[1]) return false;
  const work = effort(P);
  return work >= L.effort[0] && work <= L.effort[1];
}
/** The level a given ladder (Carroll's, a linked pair) is played as: by its par for its length. */
export function levelOf(P) {
  for (const level of LEVEL_ORDER) if (P.par <= parRange(level, P)[1]) return level;
  return "hard";
}

// ---------- making ladders ----------
/** A seeded random number generator (mulberry32): the same ladders from the same seed on every phone. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ends = new Map();
/** The words a ladder may start or end on, in graph g at length n. */
function endsOf(g, n) {
  const key = `${g.grow ? "g" : "c"}${n}`;
  if (!ends.has(key)) {
    const out = [];
    for (let i = 0; i < g.base; i++) {
      const w = g.words[i];
      if (w.length === n && g.tier[i] <= ENDS && !STOP.has(w) && !isVariant(w) && !inflected(w) && g.adj[i].length >= 2) out.push(i);
    }
    ends.set(key, out);
  }
  return ends.get(key);
}
/** Whether a word may be an end of a ladder the game makes. */
export const isEnd = w => tierOf(w) >= 0 && tierOf(w) <= ENDS && !STOP.has(w) && !BANNED.has(w) && !QUIET.has(w) && !isVariant(w) && !inflected(w);
/**
 * A ladder for a level, from a seed: { start, end, par, routes, common, needs, detours, route, rules, level, seed }.
 * A first word is drawn among the commonest; every word a par's distance from it that can be reached at par through
 * common words too is a candidate for the last, graded until one fits the level. `lengths`: the word lengths allowed
 * (in Grow and shrink, the ends may differ by a letter or two). After many tries it settles for the nearest fit.
 */
export function generate(seed, { level = "medium", lengths = [4, 5], rules = "classic" } = {}) {
  const r = rng(seed), L = LEVELS[level] || LEVELS.medium;
  const pick = xs => xs[Math.floor(r() * xs.length)];
  const want = lengths.filter(n => LENGTHS.includes(n));
  if (!want.length) want.push(4, 5);
  let fallback = null;
  for (let attempt = 0; attempt < 150; attempt++) {
    const n = pick(want), g = graphFor(rules, n), pool = endsOf(g, n);
    if (!pool.length) continue;
    const s = pick(pool), [lo, hi] = L.par[n], ds = reach(g, s), dc = reach(g, s, { upto: COMMON });
    const cands = [];
    for (const m of rules === "grow" ? want.filter(x => Math.abs(x - n) <= 2) : [n]) for (const e of endsOf(g, m)) if (e !== s && ds[e] >= lo && ds[e] <= hi && dc[e] === ds[e]) cands.push(e);
    for (let k = cands.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [cands[k], cands[j]] = [cands[j], cands[k]]; }
    for (const e of cands.slice(0, 12)) {
      const P = analyse(g.words[s], g.words[e], rules);
      if (!P) continue;
      if (fits(P, level)) return { ...P, level, seed };
      if (!fallback && P.needs <= COMMON) fallback = { ...P, level, seed };
    }
  }
  return fallback || { ...analyse("cold", "warm"), level, seed };
}

// ---------- a ladder in play ----------
// A run is worked from both ends at once, as on paper: `top` runs down from the first word, `bottom` up to the last
// (bottom[0] is its working rung, nearest the top). The ladder is whole when a word made at one end is a word of the
// other: the two are joined there, and any rungs past the join, a way the other end needn't have gone, are dropped.
export const OVER = 60, HINT = 30;            // what a step over par and a hint add to a score, in seconds
export const newRun = P => ({ top: [P.start], bottom: [P.end], hinted: [], hints: 0, ms: 0, done: false });
/** The working rung at one end: the word the next step is made from. */
export const working = (run, side) => (side === "bottom" ? run.bottom[0] : run.top.at(-1));
/** Every word on the ladder, top to bottom. */
export const words = run => [...run.top, ...run.bottom];
/** Steps on a whole ladder (or so far, counting the gap as one). */
export const steps = run => run.top.length + run.bottom.length - 1;
/**
 * Makes `word` the next rung at one end ("top" or "bottom"). Returns "placed", "done" (the ladder is whole), or why
 * not: "same" (no letter changed), "step" (more than one changed, or one added where the rules don't allow it),
 * "word" (not a word here), "used" (already on this end of the ladder: undo back to it instead).
 */
export function place(P, run, side, word, { hint = false } = {}) {
  const w = String(word || "").toLowerCase(), from = working(run, side);
  if (run.done) return "done";
  if (w === from) return "same";
  if (!isStep(from, w, P.rules)) return "step";
  if (!isRung(P, w)) return "word";
  const mine = side === "bottom" ? run.bottom : run.top, other = side === "bottom" ? run.top : run.bottom;
  const meet = other.indexOf(w);
  if (meet >= 0) {
    if (side === "bottom") run.top = run.top.slice(0, meet + 1); else run.bottom = run.bottom.slice(meet);
    if (hint) run.hinted.push(w);
    run.done = true;
    return "done";
  }
  if (mine.includes(w)) return "used";
  if (side === "bottom") run.bottom.unshift(w); else run.top.push(w);
  if (hint) run.hinted.push(w);
  return "placed";
}
/** Takes the working rung off one end (never the first or last word). */
export function undo(run, side) {
  if (run.done) return false;
  if (side === "bottom") { if (run.bottom.length < 2) return false; run.bottom.shift(); }
  else { if (run.top.length < 2) return false; run.top.pop(); }
  return true;
}
/**
 * A hint at one end: the next rung on the commonest shortest route from its working rung towards the other end's
 * word (from the top, the last word; from the bottom, the first), clear of that end's own rungs; and how many steps
 * remain from it.
 */
export function hintFor(P, run, side) {
  const from = working(run, side), to = side === "bottom" ? P.start : P.end;
  const route = routeFrom(P, from, to, side === "bottom" ? run.bottom : run.top);
  return route && route.length > 1 ? { word: route[1], left: route.length - 2 } : null;
}
/** A finished run's score in seconds (lower is better): the time, and OVER for every step over par, HINT a hint. */
export const score = (P, run) => Math.round(run.ms / 1000) + OVER * Math.max(0, steps(run) - P.par) + HINT * run.hints;

// ---------- the computer players ----------
// A computer player searches as a person does (search() above), at a level: a novice knows fewer words and rushes for
// the end, so it often takes a step or two more than par; a club player rushes less; a master searches exactly and
// finds par. Each thinks before every rung, longer the more words it tried, and the timing has a person's unevenness.
export const RIVALS = {
  novice: { label: "Novice", vocab: 1, weight: 3, think: 7000, per: 420 },
  club: { label: "Club", vocab: 2, weight: 1.5, think: 4800, per: 260 },
  master: { label: "Master", vocab: 2, weight: 1, think: 3200, per: 140 },
};
/**
 * How a computer player at `level` climbs ladder P: { level, route, at } where at[k] is the moment, in ms from the
 * start, that it places route[k + 1]. The same seed gives the same climb on every phone.
 */
export function rivalPlan(P, level = "club", seed = 1) {
  const R = RIVALS[level] || RIVALS.club, r = rng(seed);
  // a novice whose words don't reach the end learns the commoner ones it lacked, as a person looks harder
  const found = search(P, { vocab: R.vocab, weight: R.weight, rng: r }) || search(P, { vocab: COMMON, weight: R.weight, rng: r })
    || { route: analyse(P.start, P.end, P.rules)?.route || [P.start, P.end], tries: 0 };
  const rungs = found.route.length - 1, at = [];
  const work = R.think * rungs + R.per * found.tries;
  // shares of the work by rung, uneven as a person's: some rungs come at once, some take a while
  const shares = Array.from({ length: rungs }, () => 0.45 + r() * 1.1), total = shares.reduce((a, b) => a + b, 0);
  let t = 0;
  for (const s of shares) { t += (work * s) / total; at.push(Math.round(t)); }
  return { level, route: found.route, at };
}
/** The rungs a computer player has placed by `ms` into its climb. */
export const rivalAt = (plan, ms) => plan.at.filter(t => t <= ms).length;
