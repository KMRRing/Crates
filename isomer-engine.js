// Isomer (README, Isomer): Jumble's genre. Jumbled words to put right; some of their squares are circled, and the
// circled letters, put in order, are the final answer, a thing from the knowledge base clued by its hint. This module
// is the puzzle and the run, pure (isomer.js draws them; tests/isomer.mjs runs them): the modes and levels, the
// generator and its proof that every puzzle has one answer, a run's moves (placing letters, hints, the checks), the
// score, and the solver that grades every puzzle and plays as the computer rival.
import { pool, depthOf, holds, jumble, jumbleLong, spellings } from "./isomer-words.js";
import { finalsAll, themesAll, weightOf, clueOf, halvesOf, partnerOf, pairedClue, pairable, cardOf, pairOf, pileKey, lettersOf, TOPIC, NOUN } from "./isomer-kb.js";
import { isWord } from "./wordlist.js";
import { BANK } from "./core.js";

export const PER_HINT = 15;                 // seconds a hinted letter adds to the score
export const MOST_PEOPLE = 6;

// ---------- seeded randomness (the same deal on every device for a seed) ----------
export const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (r, xs) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function drawOne(r, items, weight) {
  let total = 0;
  const ws = items.map(x => { const w = Math.max(0, weight(x)); total += w; return w; });
  if (total <= 0) return null;
  let t = r() * total;
  for (let i = 0; i < items.length; i++) if ((t -= ws[i]) < 0) return items[i];
  return items[items.length - 1];
}

// ---------- modes and levels ----------
/**
 * The twists (README, Isomer): Classic, the newspaper's (two words of five letters, two of six, one final); Theme, the
 * four jumbles a country's or commodity's own clues, each with its hint, the circled letters naming what they point
 * to (Jumble's themed Brainbusters); Double, two finals from one tray of circled letters, unmarked, a thing and its
 * country or commodity; Jumbo, the Sunday size (six words up to seven letters, a longer final).
 */
export const MODES = {
  classic: { label: "Classic", lengths: [5, 5, 6, 6], finals: 1, letters: { easy: [5, 7], medium: [5, 9], hard: [6, 10] } },
  theme: { label: "Theme", jumbles: 4, finals: 1, letters: { easy: [4, 7], medium: [4, 9], hard: [5, 10] } },
  double: { label: "Double", lengths: [5, 5, 6, 6], finals: 2, letters: { easy: [8, 10], medium: [8, 11], hard: [9, 12] } },
  jumbo: { label: "Jumbo", lengths: [5, 5, 6, 6, 7, 7], finals: 1, letters: { easy: [7, 10], medium: [8, 12], hard: [9, 14] } },
};
/**
 * The levels, by how deep the solver must search (isomer-words.js, depthOf): each length has a warm word and a deep
 * one, the warm within the first few arrangements a reader tries, the deep further down; how common the words are
 * (SCOWL's tiers); how the jumbles are drawn (plain, any, or lures that look like other words); and how obscure the
 * final's clue is (the knowledge base's difficulty, 1 to 3, as weights).
 */
export const LEVELS = {
  easy: { label: "Easy", tier: 0, warm: [1, 2], deep: [1, 3], style: "plain", d: [1, 0, 0], themeD: [1, 0.1, 0] },
  medium: { label: "Medium", tier: 1, warm: [1, 4], deep: [4, 30], style: "any", d: [1, 1, 0.15], themeD: [0.6, 1, 0.4] },
  hard: { label: "Hard", tier: 2, warm: [2, 12], deep: [14, 1000], style: "lure", d: [0.15, 1, 1.4], themeD: [0, 0.5, 1.5] },
};
export const DAILY = { mode: "classic", level: "medium", cat: "mixed" };   // today's puzzle: the same for everyone
export const POOLS = { country: ["country"], commodity: ["commodity"], mixed: ["country", "commodity"] };
const CAP = n => (n >= 7 ? 4 : n >= 5 ? 3 : 2);        // the most circles a word of n letters carries
const BEHIND_SHARE = 0.45;                              // how often a final is the country or commodity, not the thing

/** k circles shared out among words that can carry `caps`, every word one at least, the rest at random. */
function shareOut(k, caps, r) {
  const out = caps.map(() => 1);
  let left = k - out.length;
  while (left > 0) {
    const room = out.map((n, i) => caps[i] - n);
    const i = drawOne(r, out.map((_, j) => j), j => room[j]);
    if (i == null) return null;
    out[i]++; left--;
  }
  return out;
}

/** Single-letter edits from a to b. */
function edits(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}
/** Whether a jumble's word would echo a final and so hint at it (FRENCH beside FRANCE, SPANISH beside SPAIN): two
 *  edits apart or less, or four letters in a row in common. */
export function echoes(word, finalLetters) {
  if (edits(word, finalLetters) <= 2) return true;
  for (let i = 0; i + 4 <= word.length; i++) if (finalLetters.includes(word.slice(i, i + 4))) return true;
  return false;
}
/**
 * Four (or six) ordinary words holding a final's letters between them, each in its depth band and none echoing a
 * final: the circles' letters shared out, a word found for each share, its circles placed on letters it has. null if
 * no fit turns up.
 */
function fitWords(letters, lengths, L, r, finals) {
  const caps = lengths.map(CAP);
  if (letters.length < lengths.length || letters.length > caps.reduce((a, b) => a + b, 0)) return null;
  const bands = lengths.map((n, i) => (lengths.indexOf(n) === i ? L.warm : L.deep));   // each length: a warm word and a deep one
  for (let attempt = 0; attempt < 60; attempt++) {
    const sizes = shareOut(letters.length, caps, r);
    if (!sizes) return null;
    const mixed = shuffle(r, letters);
    let at = 0;
    const groups = sizes.map(s => mixed.slice(at, at += s));
    const used = new Set(), out = [];
    // the shares with the rarest letters find their words first, while the most words are left
    const order = lengths.map((_, i) => i).sort((a, b) => rarity(groups[b]) - rarity(groups[a]));
    let ok = true;
    for (const s of order) {
      const g = groups[s], [lo, hi] = bands[s];
      const cands = shuffle(r, pool(lengths[s], L.tier).filter(x => !used.has(x.w) && holds(x.counts, g)));
      const hit = cands.slice(0, 60).find(x => { const d = depthOf(x.w); return d >= lo && d <= hi && !finals.some(f => echoes(x.w, f)); });
      if (!hit) { ok = false; break; }
      used.add(hit.w);
      const circles = [];
      for (const ch of g) circles.push(shuffle(r, [...hit.w].map((c, p) => (c === ch && !circles.includes(p) ? p : -1)).filter(p => p >= 0))[0]);
      out[s] = { answer: hit.w, circles: circles.sort((a, b) => a - b), depth: depthOf(hit.w), tier: hit.tier };
    }
    if (ok) return out;
  }
  return null;
}
const RARE = "jqxzkvwyfbghmp";                            // the letters fewest words hold, rarest first
const rarity = g => g.reduce((n, ch) => { const at = RARE.indexOf(ch); return n + (at < 0 ? 0 : RARE.length - at); }, 0);

/** The finals a deal can draw from: their category in the pool, their letters in range, their topics in the mix. */
function finalsFor({ cats, range, L, mix, double = false }) {
  const [lo, hi] = range;
  return finalsAll().filter(f => cats.includes(f.cat) && weightOf(f.topics, mix) > 0 && L.d[f.d - 1] > 0 && (double
    ? pairable(f) && f.letters.length + partnerOf(f).letters.length >= lo && f.letters.length + partnerOf(f).letters.length <= hi
    : f.letters.length >= lo && f.letters.length <= hi));
}
/** One final drawn by weight: the thing or its country or commodity (each answer as likely as the next, however many
 *  clues it has), its topic's weight, its difficulty's. */
function drawFinal(r, cands, L, mix, avoid) {
  const left = cands.filter(f => !avoid.has(f.a * 1000 + f.i));
  const behinds = new Map();
  for (const f of left) if (f.kind === "behind") behinds.set(f.a, (behinds.get(f.a) || 0) + 1);
  const names = left.filter(f => f.kind === "name").length, answers = behinds.size;
  const share = f => (f.kind === "name" ? (names ? (1 - BEHIND_SHARE) / names : 0) : (answers ? BEHIND_SHARE / answers / behinds.get(f.a) : 0));
  return drawOne(r, left, f => share(f) * weightOf(f.topics, mix) * L.d[f.d - 1]);
}

/** A final as the puzzle carries it: its letters, its words' lengths, its clue (and halves of it, for a pair). */
function finalOf(f, r, clue = clueOf(f), halves = halvesOf(f)) {
  return { kind: f.kind, a: f.a, i: f.i, cat: f.cat, answer: f.letters, parts: f.parts, text: f.text, clueName: f.clue, d: f.d, clue, halves,
    key: pileKey(f), pair: pairOf(f), card: cardOf(f, r) };
}

/**
 * A puzzle, the same for a seed and the same options on every device: { v, mode, level, seed, cat, words: [{ answer,
 * jumble, circles, depth, tier, (a theme's: text, hint, d, key, pair, card) }], finals: [{ answer, parts, text, clue,
 * halves, … }], tray: [[word, square]…] (the circled letters in the order they stand), secs (what the solver takes) }.
 * opts: { mode, level, cat ("country", "commodity", "mixed"), mix (topic weights) }.
 */
export function makePuzzle(seed, { mode = "classic", level = "medium", cat = "mixed", mix = null } = {}) {
  const M = MODES[mode] || MODES.classic, L = LEVELS[level] || LEVELS.medium, r = rng(seed);
  for (let round = 0; round < 3; round++) {
    // a mix too narrow, or a pool too small, falls back to every topic (README, Isomer: it says so)
    const m = round === 0 ? mix : null;
    const pick = POOLS[cat] ? cat : "mixed", cats = pick === "mixed" ? [r() < 0.5 ? "country" : "commodity"] : POOLS[pick];
    const p = mode === "theme" ? themePuzzle(r, M, L, level, cats, m) : wordPuzzle(r, M, L, level, cats, m, mode);
    if (p) return { v: 1, mode: M === MODES[mode] ? mode : "classic", level: LEVELS[level] ? level : "medium", seed, cat: cats[0], ...p, wide: round > 0 && !!mix, secs: Math.round(solveTime(p, RIVALS.sharp) / 1000) };
  }
  throw new Error(`no puzzle for ${seed} ${mode} ${level} ${cat}`);
}

function wordPuzzle(r, M, L, level, cats, mix, mode) {
  const range = M.letters[level], avoid = new Set();
  const cands = finalsFor({ cats, range, L, mix, double: M.finals === 2 });
  for (let tries = 0; tries < 40; tries++) {
    const f = drawFinal(r, cands, L, mix, avoid);
    if (!f) return null;
    avoid.add(f.a * 1000 + f.i);
    const two = M.finals === 2 ? [f, partnerOf(f)] : [f];
    const words = fitWords(two.flatMap(x => [...x.letters]), M.lengths, L, r, two.map(x => x.letters));
    if (!words) continue;
    for (const w of words) w.jumble = jumble(w.answer, r, L.style);
    let finals;
    if (M.finals === 2) {
      // Double: the thing by its hint and topic alone (its country or commodity is the other answer), and that answer
      const topic = f.topics.map(t => TOPIC[t])[0] || "", pc = pairedClue(two[1]);
      finals = [finalOf(f, r, { tag: topic, text: f.hint }, [{ text: f.hint }, { tag: topic }]), finalOf(two[1], r, pc, [{ tag: pc.tag }, { text: pc.text }])];
    } else finals = [finalOf(f, r)];
    return { words, finals, tray: trayOf(words, finals, r) };
  }
  return null;
}

/** A theme: a country or commodity and four of its clues that hold its letters between them, each a jumble with its
 *  hint; best when no other answer in the bank carries all four (Crates' rule for a crate). */
function themePuzzle(r, M, L, level, cats, mix) {
  const [lo, hi] = M.letters[level];
  const all = themesAll().filter(t => cats.includes(t.cat) && t.letters.length >= lo && t.letters.length <= hi);
  for (let tries = 0; tries < 40; tries++) {
    const t = all[Math.floor(r() * all.length)];
    if (!t) return null;
    const clues = t.clues.filter(c => weightOf(c.topics, mix) > 0 && L.themeD[c.d - 1] > 0);
    if (clues.length < 4) continue;
    let best = null;
    for (let pick = 0; pick < 30 && !(best?.only); pick++) {
      const four = [];
      const left = [...clues];
      while (four.length < 4 && left.length) { const c = drawOne(r, left, c => weightOf(c.topics, mix) * L.themeD[c.d - 1]); four.push(c); left.splice(left.indexOf(c), 1); }
      if (four.length < 4) break;
      const circles = cover(t.letters, four.map(c => c.letters), r);
      if (!circles) continue;
      const carriers = four.map(c => new Set([t.a, ...c.alt]));
      const only = [...carriers[0]].filter(a => carriers.every(s => s.has(a))).length === 1;
      if (!best || (only && !best.only)) best = { four, circles, only };
    }
    if (!best) continue;
    const order = best.four.map((c, i) => i).sort((a, b) => best.four[a].letters.length - best.four[b].letters.length);
    const words = order.map(i => {
      const c = best.four[i], f = { kind: "name", a: t.a, i: c.i, cat: t.cat, letters: c.letters, parts: [c.letters.length], text: c.text, d: c.d, topics: c.topics, hint: c.hint, clue: c.text, context: t.text };
      return { answer: c.letters, circles: best.circles[i], depth: depthOf(c.letters), tier: 0, jumble: jumble(c.letters, r, L.style), text: c.text, hint: c.hint, d: c.d,
        topic: c.topics.map(x => TOPIC[x])[0] || "", key: pileKey(f), pair: pairOf(f), card: cardOf(f, r) };
    });
    // the final's card for the pile: the first clue, asking for the country or commodity it points to
    const c0 = best.four[0], f = { kind: "behind", a: t.a, i: c0.i, cat: t.cat, letters: t.letters, parts: t.parts, text: t.text, d: 1, topics: c0.topics, hint: c0.hint, clue: c0.text, context: c0.text };
    const clue = { tag: `A ${NOUN[t.cat]}`, text: "What all four point to" };
    const finals = [finalOf(f, r, clue, [{ tag: clue.tag }, { text: clue.text }])];
    return { words, finals, tray: trayOf(words, finals, r), theme: true, only: best.only };
  }
  return null;
}
/** Which squares of each word to circle so their letters are exactly `target`'s, every word one at least and no more
 *  than it can carry: a small search, the letters shared out one at a time. null if they can't. */
function cover(target, words, r) {
  const need = shuffle(r, [...target]), circles = words.map(() => []), caps = words.map(w => CAP(w.length));
  const go = k => {
    if (k === need.length) return circles.every(c => c.length > 0);
    const left = need.length - k, empty = circles.filter(c => !c.length).length;
    if (empty > left) return false;
    for (const wi of shuffle(r, words.map((_, i) => i))) {
      if (circles[wi].length >= caps[wi]) continue;
      for (let p = 0; p < words[wi].length; p++) if (words[wi][p] === need[k] && !circles[wi].includes(p)) {
        circles[wi].push(p);
        if (go(k + 1)) return true;
        circles[wi].pop();
        break;                                                    // the same letter elsewhere in this word is the same choice
      }
    }
    return false;
  };
  return go(0) ? circles.map(c => c.sort((a, b) => a - b)) : null;
}
/** The circled letters in the order the tray shows them: jumbled like a word, so the tray never spells a final. */
function trayOf(words, finals, r) {
  const spots = words.flatMap((w, wi) => w.circles.map(p => [wi, p]));
  const order = jumbleLong(spots.map(([wi, p]) => words[wi].answer[p]), finals.map(f => f.answer), r);
  return order.map(i => spots[i]);
}

// ---------- one answer: the solver's count ----------
const sorted = s => [...s].sort().join("");
/** Whether letters `part` can be taken out of letters `whole` (both sorted or not). */
const within = (part, whole) => { const left = [...whole]; for (const ch of part) { const at = left.indexOf(ch); if (at < 0) return false; left.splice(at, 1); } return true; };
/**
 * The answers a puzzle has, counted up to two each, as a solver would find them: for each jumble, the words in the
 * widest list (SCOWL 70, both spellings) its letters spell (a theme's jumble: its clue, and any word its letters
 * spell besides); for each final, the things in the knowledge base its clue could be, spelled with the tray's letters
 * (in Double, every way the tray splits into a thing with that hint and the country or commodity it points to). One
 * each, and the tray holding exactly the finals' letters, is a puzzle with exactly one answer.
 */
export function countSolutions(p) {
  const words = p.words.map(w => Math.min(2, p.theme ? 1 + spellings(w.answer) - (isWord(w.answer) ? 1 : 0) : spellings(w.answer)));
  const tray = sorted(p.tray.map(([wi, s]) => p.words[wi].answer[s]).join(""));
  let finals;
  if (p.finals.length === 2) {
    const [thing] = p.finals, hint = BANK[thing.a].words[thing.i].hint;
    const ways = new Set(finalsAll().filter(x => x.kind === "name" && x.hint === hint && within(x.letters, tray)
      && pairable(x) && sorted(x.letters + partnerOf(x).letters) === tray).map(x => `${x.text}/${BANK[x.a].name}`));
    finals = [Math.min(2, ways.size), Math.min(2, ways.size)];
  } else if (p.theme) {
    const names = p.words.map(w => w.text);
    const fits = BANK.filter(a => names.every(n => a.words.some(w => w.w === n)) && lettersOf(a.name) && sorted(lettersOf(a.name).letters) === tray);
    finals = [Math.min(2, fits.length)];
  } else {
    finals = p.finals.map(f => {
      const same = f.kind === "name"
        ? BANK[f.a].words.filter(w => lettersOf(w.w) && sorted(lettersOf(w.w).letters) === sorted(f.answer)).map(w => w.w)
        : BANK.filter(a => a.words.some(w => w.w === f.clueName) && lettersOf(a.name) && sorted(lettersOf(a.name).letters) === sorted(f.answer)).map(a => a.name);
      return Math.min(2, new Set(same).size);
    });
  }
  const whole = sorted(p.finals.map(f => f.answer).join(""));
  return { words, finals, tray: whole === tray ? 1 : 0, one: words.every(n => n === 1) && finals.every(n => n === 1) && whole === tray };
}

// ---------- the solver: a person's pace, at levels ----------
/**
 * How a person unjumbles, at three paces (README, Isomer, The computer): down the arrangements that look most like
 * English, a try at a time (try, in ms, longer for a longer word), recognising the word when it comes up with a
 * chance that falls with its rarity (recog, by tier: a reader can pass a rare word by and come round to it again), then
 * the final: known from its clue with a chance by its difficulty (know), else worked out from the letters.
 */
export const RIVALS = {
  steady: { label: "Steady", read: 3000, try: 2200, tap: 450, recog: [0.9, 0.78, 0.62], know: [0.75, 0.45, 0.25] },
  sharp: { label: "Sharp", read: 2000, try: 1100, tap: 320, recog: [0.97, 0.9, 0.78], know: [0.9, 0.65, 0.4] },
  ace: { label: "Ace", read: 1200, try: 550, tap: 230, recog: [0.99, 0.96, 0.9], know: [0.97, 0.85, 0.6] },
};
const PASS = 40;                     // the arrangements a reader goes through before coming round to the start again
const NAME_DEPTH = 120;              // a name not known from its hint: the letters worked at, the hint narrowing them down
/**
 * The ms one jumble takes the solver: tries down the list, and round again for each time it misses the word. A
 * theme's jumble has its hint: known, the name comes to mind and only needs checking against the letters; not known,
 * it's worked out from the letters like any word, the hint halving the search.
 */
function wordMs(w, R, misses, known = false) {
  const n = w.answer.length, slow = 1 + 0.12 * (n - 5);
  if (w.hint) return R.read + (known ? 1.5 * R.try : Math.min(NAME_DEPTH, w.depth || depthOf(w.answer)) * 0.5 * R.try * slow) + n * R.tap;
  return R.read + ((w.depth || depthOf(w.answer)) + misses * PASS) * R.try * slow + n * R.tap;
}
function finalMs(f, R, known) {
  const k = f.answer.length;
  return R.read + (known ? 0 : (2 + 0.8 * (k - 3) ** 2) * R.try) + k * R.tap;
}
const knows = (R, d) => R.know[Math.min(3, Math.max(1, d || 1)) - 1];
/** What a puzzle takes the solver at a pace: the expected ms (each miss and each clue known by its chance). */
export function solveTime(p, R = RIVALS.sharp) {
  const words = p.words.reduce((t, w) => {
    if (w.hint) { const q = knows(R, w.d); return t + q * wordMs(w, R, 0, true) + (1 - q) * wordMs(w, R, 0, false); }
    const q = R.recog[Math.min(2, w.tier || 0)];
    return t + wordMs(w, R, (1 - q) / q);
  }, 0);
  const finals = p.finals.reduce((t, f) => { const q = knows(R, f.d); return t + q * finalMs(f, R, true) + (1 - q) * finalMs(f, R, false); }, 0);
  return words + finals;
}
/**
 * The computer playing a puzzle at a pace: when it solves each item, in ms from its start ({ at: [ms for each word,
 * then each final], end }). It takes the jumbles quickest first, as a person skims for the easy ones, then the finals
 * once their letters are in. The same seed plays the same way on every device, so everyone at a table sees one rival.
 */
export function rivalPlan(p, level, seed) {
  const R = RIVALS[level] || RIVALS.sharp, r = rng(seed ^ 0x51ED), at = [];
  const times = p.words.map(w => {
    if (w.hint) return wordMs(w, R, 0, r() < knows(R, w.d)) * (0.8 + 0.4 * r());
    const q = R.recog[Math.min(2, w.tier || 0)];
    let misses = 0;
    while (r() > q && misses < 6) misses++;
    return wordMs(w, R, misses) * (0.8 + 0.4 * r());
  });
  let clock = 0;
  for (const i of times.map((_, i) => i).sort((a, b) => times[a] - times[b])) { clock += times[i]; at[i] = Math.round(clock); }
  p.finals.forEach((f, fi) => { clock += finalMs(f, R, r() < knows(R, f.d)) * (0.85 + 0.3 * r()); at[p.words.length + fi] = Math.round(clock); });
  return { at, end: Math.round(clock) };
}
/** How far the rival has got by `ms`: the items it has solved. */
export const rivalSolved = (plan, ms) => plan.at.filter(t => t <= ms).length;

// ---------- the run: placing letters ----------
/**
 * A puzzle's items, the jumbles then the finals: { kind, n (its squares), answer, letters (its rack: a jumble's letters
 * as jumbled, a final's the tray's) }.
 */
const ITEMS = new WeakMap();
export function itemsOf(p) {
  if (!ITEMS.has(p)) {
    const tray = p.tray.map(([wi, s]) => p.words[wi].answer[s]);
    ITEMS.set(p, [...p.words.map(w => ({ kind: "word", n: w.answer.length, answer: w.answer, letters: [...w.jumble] })),
      ...p.finals.map(f => ({ kind: "final", n: f.answer.length, answer: f.answer, letters: tray }))]);
  }
  return ITEMS.get(p);
}
/** A fresh run of a puzzle: every square empty, the clock at nought. */
export function newRun(p) {
  const items = itemsOf(p);
  return { squares: items.map(it => Array(it.n).fill(-1)), locked: items.map(() => []), solved: items.map(() => false),
    hints: items.map(() => 0), order: items.map(it => it.letters.map((_, k) => k)), lent: [], active: 0, ms: 0, done: false };
}
/** A run as JSON gives it back (or a partner's copy), made whole for its puzzle; null if it isn't one. */
export function tidyRun(p, run) {
  const items = itemsOf(p);
  if (!run || !Array.isArray(run.squares) || run.squares.length !== items.length) return null;
  const fix = (xs, n, d) => Array.from({ length: n }, (_, i) => (xs?.[i] ?? d));
  return { ...run, squares: items.map((it, i) => fix(run.squares[i], it.n, -1)), locked: items.map((_, i) => [...(run.locked?.[i] || [])]),
    solved: items.map((_, i) => !!run.solved?.[i]), hints: items.map((_, i) => run.hints?.[i] || 0),
    order: items.map((it, i) => (Array.isArray(run.order?.[i]) && run.order[i].length === it.letters.length ? run.order[i] : it.letters.map((_, k) => k))),
    lent: [...(run.lent || [])], active: Math.min(items.length - 1, Math.max(0, run.active | 0)), ms: Number(run.ms) || 0, done: !!run.done };
}
const isFinal = (p, i) => i >= p.words.length;
/** The rack tiles of item i used anywhere: a jumble's in its own squares, a tray letter in any final's. */
function usedTiles(p, run, i) {
  const used = new Set();
  const from = isFinal(p, i) ? p.finals.map((_, f) => p.words.length + f) : [i];
  for (const j of from) for (const k of run.squares[j]) if (k >= 0) used.add(k);
  return used;
}
/** Whether a tray letter can be placed: its word is solved, or a hint lent it. */
export const trayOpen = (p, run, t) => run.solved[p.tray[t][0]] || run.lent.includes(t);
/** The rack of item i as it stands: [{ k, ch, used, open }] in the run's order (open: a tray letter you have). */
export function rackOf(p, run, i) {
  const it = itemsOf(p)[i], used = usedTiles(p, run, i);
  return run.order[i].map(k => ({ k, ch: it.letters[k], used: used.has(k), open: isFinal(p, i) ? trayOpen(p, run, k) : true }));
}
/** What item i spells so far (a gap as a space). */
export const spelled = (p, run, i) => run.squares[i].map(k => (k >= 0 ? itemsOf(p)[i].letters[k] : " ")).join("");
/**
 * Puts rack tile k in item i's first empty square: "placed", "solved" (the last square, and it's the answer), "wrong"
 * (the last square, and it isn't: the letters stay for you to move), or "no" (solved already, the tile in use or not
 * yours yet).
 */
export function place(p, run, i, k) {
  if (run.done || run.solved[i]) return "no";
  const it = itemsOf(p)[i];
  if (k < 0 || k >= it.letters.length || usedTiles(p, run, i).has(k) || (isFinal(p, i) && !trayOpen(p, run, k))) return "no";
  const s = run.squares[i].indexOf(-1);
  if (s < 0) return "no";
  run.squares[i][s] = k;
  return settle(p, run, i);
}
/** Places by letter (a key typed): the first unused tile with it. */
export function placeLetter(p, run, i, ch) {
  const tile = rackOf(p, run, i).find(t => !t.used && t.open && t.ch === ch);
  return tile ? place(p, run, i, tile.k) : "no";
}
function settle(p, run, i) {
  if (run.squares[i].includes(-1)) return "placed";
  if (spelled(p, run, i) !== itemsOf(p)[i].answer) return "wrong";
  run.solved[i] = true;
  run.done = run.solved.every(Boolean);
  return "solved";
}
/** Takes the letter out of square s of item i (not one a hint placed): whether it did. */
export function unplace(p, run, i, s) {
  if (run.done || run.solved[i] || run.squares[i][s] < 0 || run.locked[i].includes(s)) return false;
  run.squares[i][s] = -1;
  return true;
}
/** Takes back the last letter placed in item i (⌫). */
export function back(p, run, i) {
  for (let s = run.squares[i].length - 1; s >= 0; s--) if (run.squares[i][s] >= 0 && !run.locked[i].includes(s)) return unplace(p, run, i, s);
  return false;
}
/** Empties item i but for the hinted squares. */
export function clear(p, run, i) {
  let any = false;
  for (let s = 0; s < run.squares[i].length; s++) if (unplace(p, run, i, s)) any = true;
  return any;
}
/** The rack in a new order (Shuffle: another arrangement to look at). */
export function reshuffle(run, i, r) { run.order[i] = shuffle(r, run.order[i]); }
/**
 * A hint: the right letter in item i's first square that hasn't got it, locked there (+PER_HINT seconds). A tray letter
 * whose word isn't solved yet is lent to the final for it. "solved" if that finished the item, "hinted", or "no".
 */
export function hint(p, run, i) {
  if (run.done || run.solved[i]) return "no";
  const it = itemsOf(p)[i], sq = run.squares[i];
  const s = sq.findIndex((k, j) => k < 0 || it.letters[k] !== it.answer[j]);
  if (s < 0) return "no";
  const ch = it.answer[s];
  if (sq[s] >= 0) sq[s] = -1;                                   // a wrong letter there goes back to the rack
  const used = usedTiles(p, run, i);
  let k = it.letters.findIndex((c, x) => c === ch && !used.has(x) && (!isFinal(p, i) || trayOpen(p, run, x)));
  if (k < 0) k = it.letters.findIndex((c, x) => c === ch && !used.has(x));
  if (k < 0) {                                                  // every tile with that letter stands in a wrong square: take one back
    const from = isFinal(p, i) ? p.finals.map((_, f) => p.words.length + f) : [i];
    for (const j of from) for (let t = 0; t < run.squares[j].length && k < 0; t++) {
      const x = run.squares[j][t];
      if (x >= 0 && it.letters[x] === ch && !run.locked[j].includes(t) && !(j === i && t < s)) { run.squares[j][t] = -1; k = x; }
    }
  }
  if (k < 0) return "no";
  if (isFinal(p, i) && !trayOpen(p, run, k)) run.lent.push(k);
  sq[s] = k;
  run.locked[i].push(s);
  run.hints[i]++;
  return settle(p, run, i) === "solved" ? "solved" : "hinted";
}
/** Marks item i solved from outside (a partner solved it at the table): its squares spelled right. */
export function solveFrom(p, run, i) {
  if (run.solved[i]) return false;
  const it = itemsOf(p)[i], taken = new Set();
  if (isFinal(p, i)) for (let f = 0; f < p.finals.length; f++) if (p.words.length + f !== i) for (const k of run.squares[p.words.length + f]) if (k >= 0) taken.add(k);
  run.squares[i] = [...it.answer].map(ch => { const k = it.letters.findIndex((c, x) => c === ch && !taken.has(x)); taken.add(k); return k; });
  run.solved[i] = true;
  run.done = run.solved.every(Boolean);
  return true;
}
/** Hinted letters in all. */
export const hintsOf = run => run.hints.reduce((a, b) => a + b, 0);
/** The score: seconds on the clock and PER_HINT a hinted letter (lower is better). */
export const scoreOf = (run, ms = run.ms) => Math.round(ms / 1000) + PER_HINT * hintsOf(run);
/** The next item still to solve after i (round the end), or i if none. */
export function nextOpen(run, i) {
  for (let step = 1; step <= run.solved.length; step++) { const j = (i + step) % run.solved.length; if (!run.solved[j]) return j; }
  return i;
}
/** Seconds as 1:05 (or 1:02:05). */
export const clock = secs => { const s = Math.max(0, Math.round(secs)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, p2 = n => String(n).padStart(2, "0"); return h ? `${h}:${p2(m)}:${p2(s % 60)}` : `${m}:${p2(s % 60)}`; };
