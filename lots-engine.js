// Lots' rules, with no page in it (tests/lots.mjs plays it in Node): sixteen words, four lots of four, each lot a
// category from the bank (lots-bank.js). A word fits a category when the category lists it, or, for the wordplay that a
// rule can check (a hidden word, an anagram, a letter added), when the rule says so; the generator deals only boards
// whose sixteen words can be sorted one way alone, counting every category that holds four of them, on the board or
// not. Difficulty is measured by what a solver has to do: how devious each link is, and how often the easiest lot left
// in sight has a red herring in it, so that a harder one must be found first.
import { CATEGORIES, SETS } from "./lots-bank.js";

export const SIZE = 4;                         // four lots of four words
export const MISTAKES = 4;                     // a classic board ends at the fourth wrong guess
/** Only Connect's wall: two and a half minutes, guesses free until two lots are found, then three lives; a point for
 *  each lot and each link named, and two more for all eight. */
export const WALL = { ms: 150000, lives: 3, free: 2, bonus: 2 };
export const LEVELS = ["easy", "medium", "hard"];
export const LEVEL_NAMES = { easy: "Easy", medium: "Medium", hard: "Hard" };

// ---------- randomness that every device repeats ----------
/** mulberry32: the same seed gives the same numbers on every device. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function pickWeighted(items, weight, rng) {
  let total = 0;
  const w = items.map(x => { const v = Math.max(0, weight(x)); total += v; return v; });
  if (total <= 0) return null;
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) { r -= w[i]; if (r < 0) return items[i]; }
  return items[items.length - 1];
}

// ---------- the bank ----------
/** "BEE=B SEA=C" → [["BEE", "B"], ["SEA", "C"]]: a member and the note that says why it belongs (underscores are spaces). */
const entries = s => String(s || "").trim().split(/\s+/).filter(Boolean).map(t => {
  const [w, note = ""] = t.split("=");
  return [w.toUpperCase().replace(/_/g, " "), note.replace(/_/g, " ")];
});
export const SET = Object.fromEntries(Object.entries(SETS).map(([k, v]) => [k, entries(v).map(([w]) => w)]));
/** The rules a page can check for itself: a word fits by its letters, whatever lists it. */
export const RULED = new Set(["hidden", "starts", "ends", "anagram", "front", "back", "behead", "palindrome", "novowel", "alpha"]);
const sorted = w => [...w].sort().join("");

/** A rule's check: the part of the word that makes it fit (a hidden word, the anagram's word), or null. */
function ruleOf(kind, set) {
  const targets = SET[set] || [];
  const has = new Set(targets), keys = new Map(targets.map(t => [sorted(t), t])), heads = new Map(targets.map(t => [t.slice(1), t]));
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const any = targets.length ? new RegExp(targets.slice().sort((a, b) => b.length - a.length).map(esc).join("|"), "g") : null;
  switch (kind) {
    case "hidden": return w => { if (!any) return null; any.lastIndex = 0; let m; while ((m = any.exec(w))) { if (m[0] !== w) return m[0]; any.lastIndex = m.index + 1; } return null; };
    case "starts": return w => targets.filter(t => t !== w && w.startsWith(t)).sort((a, b) => b.length - a.length)[0] || null;
    case "ends": return w => targets.filter(t => t !== w && w.endsWith(t)).sort((a, b) => b.length - a.length)[0] || null;
    case "anagram": return w => { const t = keys.get(sorted(w)); return t && t !== w ? t : null; };
    case "front": return w => (w.length >= 3 && has.has(w.slice(1)) ? w.slice(1) : null);
    case "back": return w => (w.length >= 3 && !w.endsWith("S") && has.has(w.slice(0, -1)) ? w.slice(0, -1) : null);   // a plural isn't a new word
    case "behead": return w => heads.get(w) || null;
    case "palindrome": return w => (w.length >= 3 && !w.includes(" ") && [...w].reverse().join("") === w ? w : null);
    case "novowel": return w => (w.length >= 3 && /^[A-Z]+$/.test(w) && !/[AEIOU]/.test(w) ? w : null);
    case "alpha": return w => (w.length >= 5 && /^[A-Z]+$/.test(w) && sorted(w) === w ? w : null);
    default: return () => null;
  }
}

/**
 * The categories: { id, topic, d (1 plain to 4 devious), name, w (members dealt), x (words that also fit, never dealt),
 * notes (why a member fits), kind, key (the word a phrase is made on: BALL in ___ BALL), set (a rule's words) }.
 */
export const CATS = CATEGORIES.map(([id, topic, d, name, w, x = "", rule = ""]) => {
  const [kind = "set", arg = ""] = (rule || "set").split(":");
  const members = entries(w), also = entries(x).filter(([m]) => !m.startsWith("@"));
  const c = {
    id, topic, d, name, kind,
    w: members.map(([m]) => m), x: also.map(([m]) => m),
    refs: entries(x).filter(([m]) => m.startsWith("@")).map(([m]) => m.slice(1).toLowerCase()),
    notes: Object.fromEntries([...members, ...also].filter(([, n]) => n).map(([m, n]) => [m, n])),
    key: kind === "after" || kind === "before" ? arg.toUpperCase() : null,
    set: RULED.has(kind) ? arg : null,
  };
  c.all = new Set([...c.w, ...c.x]);
  c.rule = RULED.has(kind) ? ruleOf(kind, arg) : null;
  return c;
});
export const BY_ID = new Map(CATS.map(c => [c.id, c]));
// @id in a category's also-fits takes in every word of that category (every fish has scales); twice, for a reference
// to a category that has references of its own
for (let pass = 0; pass < 2; pass++) for (const c of CATS) for (const id of c.refs) for (const w of BY_ID.get(id)?.all || []) c.all.add(w);
const RULE_CATS = CATS.filter(c => c.rule);
const LISTED = new Map();
for (const c of CATS) for (const word of c.all) { if (!LISTED.has(word)) LISTED.set(word, []); LISTED.get(word).push(c.id); }

/** Whether a word fits a category: listed in it, or (for a rule) its letters say so. */
export const fits = (c, word) => (c.rule ? c.rule(word) !== null : c.all.has(word));
const FITS = new Map();
/** Every category a word fits, as ids (worked out once a word). */
export function fitsOf(word) {
  let f = FITS.get(word);
  if (!f) {
    f = new Set(LISTED.get(word) || []);
    for (const c of RULE_CATS) if (c.rule(word) !== null) f.add(c.id);
    FITS.set(word, f);
  }
  return f;
}
/** Why a word is in a lot, in a few words: FOOT·BALL, LION in BULLION, HORSE rearranged, or the bank's own note. */
export function reason(c, word) {
  if (c.notes[word]) return c.notes[word];
  if (c.kind === "after") return `${word}·${c.key}`;
  if (c.kind === "before") return `${c.key}·${word}`;
  if (c.kind === "reverse") return [...word].reverse().join("");
  const hit = c.rule?.(word);
  if (!hit) return "";
  switch (c.kind) {
    case "hidden": return `${hit} inside`;
    case "starts": return `starts ${hit}`;
    case "ends": return `ends ${hit}`;
    case "anagram": return `${hit} rearranged`;
    case "front": return `${word[0]} + ${hit}`;
    case "back": return `${hit} + ${word.at(-1)}`;
    case "behead": return `${hit[0]}·${word}`;
    case "palindrome": return "the same backwards";
    case "novowel": return "no vowel";
    case "alpha": return "letters in order";
    default: return "";
  }
}

// ---------- topics ----------
export const TOPICS = [["wp", "Wordplay"], ["ph", "Phrases"], ["mn", "Meanings"], ["th", "Things with"], ["mk", "Markets"],
  ["sc", "Science & nature"], ["pl", "Places"], ["cu", "Culture"], ["sp", "Sport & games"], ["fd", "Food & drink"]];
const every = v => Object.fromEntries(TOPICS.map(([id]) => [id, v]));
/** The suite's presets (Balanced, Trader, Culture night), and Wordsmith for the wordplay. */
export const PRESETS = {
  balanced: { label: "Balanced", topics: every(1) },
  trader: { label: "Trader", topics: { ...every(1), mk: 2, pl: 2 } },
  culture: { label: "Culture night", topics: { ...every(1), cu: 2, fd: 2 } },
  wordsmith: { label: "Wordsmith", topics: { ...every(1), wp: 2, ph: 2, mn: 2 } },
};
/** A mix from storage (or anything) as a whole one: every topic 0, 1 or 2, at least one in. */
export function cleanMix(mix) {
  const out = every(1);
  for (const [id] of TOPICS) { const v = Number(mix?.[id]); if (v === 0 || v === 1 || v === 2) out[id] = v; }
  return TOPICS.some(([id]) => out[id] > 0) ? out : every(1);
}

// ---------- levels ----------
/**
 * What each level deals: the categories' difficulties (one pattern drawn a board), the red herrings (words that fit a
 * second lot on the board) and phantoms (a category off the board that four of the words fit too, which can't be a
 * lot because the rest wouldn't sort). Easy has neither; Medium sometimes one herring, as the newspaper's do; Hard
 * always one, sometimes two, and always one that bites: its false home is the easier lot, which then shows five.
 */
export const LEVEL = {
  easy: { patterns: [[1, 1, 2, 2], [1, 1, 1, 2], [1, 2, 2, 2], [1, 1, 2, 3]], herrings: [0, 0], plan: 0, phantoms: 0 },
  medium: { patterns: [[1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 3], [1, 2, 2, 4], [2, 2, 3, 4], [1, 1, 3, 4]], herrings: [0, 1], plan: 0.4, phantoms: 0 },
  hard: { patterns: [[2, 3, 4, 4], [2, 3, 3, 4], [3, 3, 4, 4], [1, 3, 4, 4], [2, 2, 4, 4]], herrings: [1, 2], plan: 1, two: 0.12, bite: true, phantoms: 1 },
};

// ---------- the solver ----------
/**
 * How many ways the words sort into the categories, four to each, every word in one it fits; counting stops at
 * `limit` (two is enough to know a board isn't sound).
 */
export function solutions(words, cats, limit = 2) {
  const options = words.map(w => cats.map((c, k) => (fits(c, w) ? k : -1)).filter(k => k >= 0));
  if (options.some(o => !o.length)) return 0;
  const order = words.map((_, i) => i).sort((a, b) => options[a].length - options[b].length);
  const room = cats.map(() => SIZE);
  let count = 0;
  (function go(i) {
    if (count >= limit) return;
    if (i === order.length) { count++; return; }
    for (const k of options[order[i]]) if (room[k] > 0) { room[k]--; go(i + 1); room[k]++; }
  })(0);
  return count;
}

/** Every way the words sort into the categories, as canonical strings (lots sorted, words sorted), up to `limit`. */
export function sortings(words, cats, limit = 4) {
  const options = words.map(w => cats.map((c, k) => (fits(c, w) ? k : -1)).filter(k => k >= 0));
  if (options.some(o => !o.length)) return [];
  const room = cats.map(() => SIZE), at = new Array(words.length), out = [];
  (function go(i) {
    if (out.length >= limit) return;
    if (i === words.length) {
      const lots = cats.map((_, k) => words.filter((_, j) => at[j] === k).sort().join(" "));
      out.push(lots.sort().join(" | "));
      return;
    }
    for (const k of options[i]) if (room[k] > 0) { room[k]--; at[i] = k; go(i + 1); room[k]++; }
  })(0);
  return out;
}

/**
 * Categories off the board that four or more of its words fit, beyond renaming a lot: a decoy, whose words span two
 * lots or more (the four metals that look like a lot, while one of them is a golf club). One whose words are all one
 * lot's only names it another way, and isn't one.
 */
function decoysAmong(lots, onBoard) {
  const words = lots.flat(), hits = new Map();
  for (const w of words) for (const id of fitsOf(w)) if (!onBoard.has(id)) { if (!hits.has(id)) hits.set(id, []); hits.get(id).push(w); }
  return [...hits].filter(([, ws]) => ws.length >= SIZE && !lots.some(lot => ws.every(w => lot.includes(w)))).map(([id]) => BY_ID.get(id));
}
/** Whether the words sort one way alone, using the board's categories and any decoy in place of any of them. */
function soundWith(words, chosen, decoys) {
  const pool = [...chosen, ...decoys], seen = new Set();
  const combos = [];
  (function pick(from, acc) {
    if (acc.length === SIZE) { combos.push(acc); return; }
    for (let i = from; i < pool.length; i++) pick(i + 1, [...acc, pool[i]]);
  })(0, []);
  for (const set of combos) for (const s of sortings(words, set, 2)) { seen.add(s); if (seen.size > 1) return false; }
  return seen.size === 1;
}

/** The board's words, by lot: [[four words], …]. */
const lotsOf = board => board.g.map(g => g.w);
const catsOf = board => board.g.map(g => BY_ID.get(g.c));

/**
 * What a solver meets on this board: the herrings (a word in one lot that fits another on the board: [word, its lot,
 * the lot it also fits]), decoys (categories off the board that four of the words fit, across lots), and the look-past
 * count: a solver goes for the easiest lot it can see, and each time that lot shows more than four words, it has to
 * find a harder one first. grade = the links' difficulty + 2 × look-pasts + herrings + 2 × decoys.
 */
export function analyse(board) {
  const cats = catsOf(board), lots = lotsOf(board), words = lots.flat();
  const herrings = [];
  lots.forEach((ws, k) => ws.forEach(w => cats.forEach((c, j) => { if (j !== k && fits(c, w)) herrings.push([w, k, j]); })));
  const phantoms = decoysAmong(lots, new Set(board.g.map(g => g.c))).map(c => c.id);
  // the solver's path: the easiest lot whose words in sight are exactly its four, each time
  let left = cats.map((c, k) => k), placed = new Set(), lookPast = 0;
  while (left.length) {
    const byEase = left.slice().sort((a, b) => cats[a].d - cats[b].d || a - b);
    const tight = byEase.findIndex(k => words.filter(w => !placed.has(w) && fits(cats[k], w)).length === SIZE);
    const at = tight < 0 ? 0 : tight;
    lookPast += at;
    lots[byEase[at]].forEach(w => placed.add(w));
    left = left.filter(k => k !== byEase[at]);
  }
  const links = cats.reduce((n, c) => n + c.d, 0);
  return { herrings, phantoms, lookPast, links, grade: links + 2 * lookPast + herrings.length + 2 * phantoms.length };
}

// ---------- dealing ----------
let BRIDGES = null, TO = null;
/**
 * Words in one category that fit another: by the two difficulties ("3>1": a d3 lot's word that fits a d1 lot), each
 * kept by the lot it belongs to, so a herring's lot is drawn first and its word after (drawn word by word, the few
 * categories that half the bank fits, things that bark, would deal every other herring); and by the category they
 * also fit. Worked out the first time a board needs a herring.
 */
function bridges() {
  if (BRIDGES) return BRIDGES;
  BRIDGES = new Map();
  TO = new Map();
  for (const T of CATS) for (const x of T.w) for (const id of fitsOf(x)) {
    if (id === T.id) continue;
    const F = BY_ID.get(id), k = `${T.d}>${F.d}`;
    if (!BRIDGES.has(k)) BRIDGES.set(k, new Map());
    const byLot = BRIDGES.get(k);
    if (!byLot.has(T.id)) byLot.set(T.id, []);
    byLot.get(T.id).push([x, T, F]);
    if (!TO.has(id)) TO.set(id, []);
    TO.get(id).push([x, T, F]);
  }
  return BRIDGES;
}
/** A tile may not hold the word another lot is made on (FOOTBALL beside ___ BALL), nor be it. */
const clashes = (word, cats) => cats.some(c => c.key && (word === c.key || word.includes(c.key)));
const take = (pattern, d) => { const i = pattern.indexOf(d); if (i < 0) return false; pattern.splice(i, 1); return true; };

/**
 * One board, or null: { seed, level, g: [{ c: category id, w: [four words] }] }, lots ranked easiest first (their colour
 * on the page). weights: { topic: 0 | 1 | 2 }; recent: category ids dealt lately, dealt less often. The same seed,
 * level and weights deal the same board on every device. How many herrings it plants is drawn once, for the board, so
 * a level deals them as often as it says (planned ones are harder to deal, and drawing a plan a try would deal fewer).
 */
export function deal({ seed, level = "medium", weights = null, recent = [], tries = 4000 } = {}) {
  const L = LEVEL[level] || LEVEL.medium, rng = seeded(seed), mix = cleanMix(weights), seen = new Set(recent);
  const weightOf = c => (mix[c.topic] ?? 1) * (seen.has(c.id) ? 0.2 : 1);
  const wanted = rng() < L.plan ? (L.two && rng() < L.two ? 2 : 1) : 0;
  for (let attempt = 0; attempt < tries; attempt++) {
    // a plan that won't come off settles for one herring fewer, late on
    const plan = attempt > tries * 0.75 && wanted > Math.max(1, L.herrings[0]) ? wanted - 1 : wanted;
    const b = attemptBoard(rng, L, weightOf, plan);
    if (b) return { seed, level, g: b };
  }
  return null;
}

function attemptBoard(rng, L, weightOf, wanted) {
  const pattern = L.patterns[Math.floor(rng() * L.patterns.length)].slice();
  const chosen = [], forced = new Map();
  // the planned herrings: a word of one lot (T) that fits another (F), of the pattern's difficulties; the first, on
  // Hard, bites (its false home is the easier lot); a second is a new lot's word that fits one already chosen
  if (wanted) {
    const ds = [...new Set(pattern)], pairs = [];
    for (const a of ds) for (const b of ds) if ((a !== b || pattern.filter(x => x === a).length > 1) && (!L.bite || b < a)) pairs.push(`${a}>${b}`);
    const k = pairs[Math.floor(rng() * pairs.length)], byLot = k && bridges().get(k);
    const lot = byLot && pickWeighted([...byLot.keys()], id => weightOf(BY_ID.get(id)), rng);
    if (!lot) return null;
    const list = byLot.get(lot), [x, T, F] = list[Math.floor(rng() * list.length)];
    if (!(weightOf(F) > 0) || !compatible(F, [T])) return null;
    take(pattern, T.d); take(pattern, F.d);
    chosen.push(T, F);
    forced.set(T.id, x);
  }
  if (wanted > 1) {
    const options = chosen.flatMap(F => (TO.get(F.id) || []).filter(([, T]) => pattern.includes(T.d) && !chosen.includes(T) && weightOf(T) > 0 && compatible(T, chosen)));
    if (!options.length) return null;
    const [x, T] = options[Math.floor(rng() * options.length)];
    take(pattern, T.d);
    chosen.push(T);
    forced.set(T.id, x);
  }
  for (const d of pattern) {
    const c = pickWeighted(CATS.filter(c => c.d === d && c.w.length > SIZE && !chosen.includes(c) && compatible(c, chosen)), weightOf, rng);
    if (!c) return null;
    chosen.push(c);
  }
  // four words a lot: the planned herring first; no word twice, none holding another lot's key; a rule's words each
  // with a hit of their own where it can (not TEN hidden in three of the four)
  const used = new Set(), g = [];
  for (const c of chosen) {
    const w = forced.has(c.id) ? [forced.get(c.id)] : [];
    if (w.some(x => used.has(x))) return null;
    const pool = shuffle(c.w, rng).filter(x => !w.includes(x) && !used.has(x) && !clashes(x, chosen));
    const hits = new Set(c.rule ? w.map(c.rule) : []);
    for (const pass of [0, 1]) for (const x of pool) {
      if (w.length === SIZE) break;
      if (w.includes(x) || (pass === 0 && c.rule && hits.has(c.rule(x)))) continue;
      w.push(x);
      if (c.rule) hits.add(c.rule(x));
    }
    if (w.length < SIZE) return null;
    w.forEach(x => used.add(x));
    g.push({ c: c.id, w });
  }
  if (g.some(lot => lot.w.some(x => clashes(x, chosen)))) return null;
  const words = g.flatMap(lot => lot.w);
  // herrings: each fits exactly one other lot, as many as the level deals
  let herrings = 0, bites = 0;
  const links = new Set();
  for (const [k, lot] of g.entries()) for (const x of lot.w) {
    const also = chosen.filter((c, j) => j !== k && fits(c, x));
    if (also.length > 1) return null;
    if (also.length) {
      herrings++;
      if (also[0].d < chosen[k].d) bites++;
      const pair = [chosen[k].id, also[0].id].sort().join("|");
      if (links.has(pair)) return null;                      // two herrings between the same lots could swap
      links.add(pair);
    }
  }
  // decoys: another category holding four of the words across lots; a level's herrings and decoys share its budget
  const decoys = decoysAmong(g.map(lot => lot.w), new Set(chosen.map(c => c.id)));
  const [least, most] = L.herrings;
  if (herrings < Math.max(least, wanted) || herrings + decoys.length > Math.max(most, wanted) || decoys.length > L.phantoms || (L.bite && !bites)) return null;
  // exactly one way to sort the sixteen, the decoys counted in as possible lots
  if (solutions(words, chosen) !== 1 || (decoys.length && !soundWith(words, chosen, decoys))) return null;
  // easiest first: the lots' colours, ochre to oxblood (equal ones by the order they were chosen)
  return g.map((lot, k) => ({ lot, d: chosen[k].d, k })).sort((a, b) => a.d - b.d || a.k - b.k).map(x => x.lot);
}
/** Lots that can share a board: not two on the same key, at most two of a topic, and one of each trick (two lots of
 *  homophones, or of anagrams, on one board would be the same idea twice); phrases may come in pairs. */
function compatible(c, chosen) {
  if (c.key && chosen.some(o => o.key === c.key)) return false;
  if (c.kind !== "set" && c.kind !== "after" && c.kind !== "before" && chosen.some(o => o.kind === c.kind)) return false;
  return chosen.filter(o => o.topic === c.topic).length < 2;
}

/** Today's board, the same for everyone: Medium, every topic in, nothing of yours in it. */
export const daily = day => deal({ seed: day, level: "medium" });

// ---------- a guess ----------
/** right: the four of one lot; one: three of them; miss: anything else. g: the lot, when right. */
export function classify(board, words) {
  const lotOf = w => board.g.findIndex(g => g.w.includes(w));
  const counts = new Map();
  for (const w of words) { const k = lotOf(w); counts.set(k, (counts.get(k) || 0) + 1); }
  const best = Math.max(...counts.values());
  const g = best === SIZE ? lotOf(words[0]) : null;
  return { res: best === SIZE ? "right" : best === SIZE - 1 ? "one" : "miss", g, lv: words.map(lotOf) };
}
export const comboKey = words => words.slice().sort().join("|");
/** A classic board's points: a point a lot found, and once all four are, a point for each mistake left (8 is perfect). */
export const points = (found, mistakes, won) => found + (won ? Math.max(0, MISTAKES - mistakes) : 0);
/** The wall's: a point a lot, a point a link named, two more for all eight (10 is perfect). */
export const wallPoints = (found, named) => found + named + (found === SIZE && named === SIZE ? WALL.bonus : 0);
/** Lots found in the order oxblood, cobalt, verdigris, ochre: the hardest first (the players' "reverse rainbow"). */
export const reverseRainbow = order => order.length === SIZE && order.every((g, i) => g === SIZE - 1 - i);

// ---------- naming a lot's link (the wall, and the partner's turn in Crossed) ----------
/**
 * Four links to choose from for lot k: its own and three others from the bank that don't fit all four of its words.
 * The most tempting come first: links that some of its words do fit (MAMMOTH has a trunk, but HUGE doesn't), then
 * links of the same kind (another ___ phrase, another hidden word), so naming one asks why its words belong, not
 * which option is in the right topic. Seeded, so every phone offers the same.
 */
export function namingOptions(board, k, seed) {
  const rng = seeded((seed ^ Math.imul(k + 1, 2654435761)) >>> 0), own = BY_ID.get(board.g[k].c), words = board.g[k].w;
  const onBoard = new Set(board.g.map(g => g.c));
  const family = c => (c.kind === "after" || c.kind === "before" ? "phrase" : RULED.has(c.kind) ? "rule" : c.kind === "sound" ? "sound" : c.topic);
  const hits = c => words.filter(w => fits(c, w)).length;
  const fair = shuffle(CATS.filter(c => !onBoard.has(c.id) && c.name !== own.name && hits(c) < SIZE), rng);
  const rank = c => (hits(c) ? 3 + Math.min(hits(c), 2) : 0) + (family(c) === family(own) ? 2 : 0);
  const picks = fair.map(c => [c, rank(c) + rng()]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c.id);
  return shuffle([own.id, ...picks], rng);
}

// ---------- playing together hidden: each holds eight ----------
/** How many of each lot's four the first player holds: one to three each, eight in all. */
export const SPLITS = [];
for (let a = 1; a <= 3; a++) for (let b = 1; b <= 3; b++) for (let c = 1; c <= 3; c++) { const d = 8 - a - b - c; if (d >= 1 && d <= 3) SPLITS.push([a, b, c, d]); }
/** Who holds each word: { word: 0 | 1 }, every lot shared between the two, eight each. */
export function split(board, seed) {
  const rng = seeded(seed ^ 0x51ed27), counts = SPLITS[Math.floor(rng() * SPLITS.length)], side = {};
  board.g.forEach((g, k) => shuffle(g.w, rng).forEach((w, i) => { side[w] = i < counts[k] ? 0 : 1; }));
  return side;
}
