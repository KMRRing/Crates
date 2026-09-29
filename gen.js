// Builds boards from the word bank: four answers, four words each, exactly one solution.
import { BANK, norm, shuffled } from "./core.js";

const DIFF_WEIGHT = { easy: [3, 1, 0.2], mixed: [1, 1, 1], hard: [0.3, 1, 2.5] };
const MAX_HERRINGS = 2;        // words on a board that also fit another crate on it
const SAME_TOPIC_DAMPING = 0.45;
const RECENT_DAMPING = 0.25;

export function wordWeight(word, settings) {
  const topic = Math.max(...word.topics.map(t => settings.topics[t] ?? 1));
  return topic > 0 ? topic * DIFF_WEIGHT[settings.difficulty][word.d - 1] : 0;
}

function pick(items, weights, rng) {
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return -1;
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return items.length - 1;
}

const wordKey = (a, i) => `${a}.${i}`;

function eligibleAnswers(cat, settings) {
  return BANK.map((a, i) => i).filter(i => {
    const a = BANK[i];
    return a.cat === cat && !settings.off.includes(a.group)
      && a.words.filter(w => wordWeight(w, settings) > 0).length >= 4;
  });
}

function sampleWords(ai, settings, banned, recentW, rng) {
  const cands = BANK[ai].words.map((w, i) => i)
    .filter(i => wordWeight(BANK[ai].words[i], settings) > 0 && !banned.has(norm(BANK[ai].words[i].w)));
  const weights = cands.map(i => wordWeight(BANK[ai].words[i], settings) * (recentW.has(wordKey(ai, i)) ? RECENT_DAMPING : 1));
  const out = [];
  while (out.length < 4) {
    const k = pick(cands, weights, rng);
    if (k < 0) return null;
    const i = cands[k];
    out.push(i);
    const topics = BANK[ai].words[i].topics;
    cands.splice(k, 1); weights.splice(k, 1);
    cands.forEach((j, n) => {
      if (BANK[ai].words[j].topics.some(t => topics.includes(t))) weights[n] *= SAME_TOPIC_DAMPING;
    });
  }
  return out;
}

/** Number of ways to fill four crates of four, given each word's own crate plus its also-fits. */
export function countSolutions(groups) {
  const answers = groups.map(g => g.a);
  const cands = groups.flatMap((g, gi) => g.w.map(wi => [gi, ...BANK[g.a].words[wi].alt.map(a => answers.indexOf(a)).filter(x => x >= 0)]));
  const fill = [0, 0, 0, 0];
  let count = 0;
  (function go(k) {
    if (count > 1) return;
    if (k === cands.length) { count++; return; }
    for (const c of cands[k]) {
      if (fill[c] < 4) { fill[c]++; go(k + 1); fill[c]--; }
    }
  })(0);
  return count;
}

/** Yellow → red by average word difficulty. */
function withLevels(groups) {
  const avg = g => g.w.reduce((s, wi) => s + BANK[g.a].words[wi].d, 0) / 4;
  const order = groups.map((g, i) => i).sort((x, y) => avg(groups[x]) - avg(groups[y]) || groups[x].a - groups[y].a);
  return groups.map((g, i) => ({ ...g, level: order.indexOf(i) }));
}

export function generate({ pool, settings, recentA = [], recentW = [], rng = Math.random }) {
  const recentAs = new Set(recentA), recentWs = new Set(recentW);
  const cats = pool === "mixed" ? shuffled(["country", "commodity"], rng) : [pool];
  for (const cat of cats) {
    const answers = eligibleAnswers(cat, settings);
    if (answers.length < 4) continue;
    for (let attempt = 0; attempt < 400; attempt++) {
      const chosen = [];
      const pool4 = answers.slice(), weights = pool4.map(a => (recentAs.has(a) ? RECENT_DAMPING : 1));
      while (chosen.length < 4) {
        const k = pick(pool4, weights, rng);
        chosen.push(pool4[k]); pool4.splice(k, 1); weights.splice(k, 1);
      }
      // A tile must never be the name of another crate on the board.
      const banned = new Set(chosen.flatMap(a => [BANK[a].name, ...BANK[a].aliases].map(norm)));
      const groups = [];
      for (const a of chosen) {
        const w = sampleWords(a, settings, banned, recentWs, rng);
        if (!w) break;
        w.forEach(i => banned.add(norm(BANK[a].words[i].w)));
        groups.push({ a, w });
      }
      if (groups.length < 4) continue;
      const herrings = groups.reduce((s, g) => s + g.w.filter(i => BANK[g.a].words[i].alt.some(x => chosen.includes(x))).length, 0);
      if (herrings > MAX_HERRINGS) continue;
      if (countSolutions(groups) !== 1) continue;
      return { cat, groups: withLevels(groups) };
    }
  }
  return null;
}

// ---------- board codes: "a.w.w.w.w-…" in base36, positions in the append-only bank ----------
export const encode = board => board.groups.map(g => [g.a, ...g.w].map(n => n.toString(36)).join(".")).join("-");

export function decode(code) {
  try {
    const groups = String(code).trim().toLowerCase().split("-").map(part => {
      const [a, ...w] = part.split(".").map(x => parseInt(x, 36));
      return { a, w };
    });
    if (groups.length !== 4) return null;
    const cat = BANK[groups[0].a]?.cat;
    const seen = new Set(), answers = new Set();
    for (const g of groups) {
      const ans = BANK[g.a];
      if (!ans || ans.cat !== cat || answers.has(g.a) || g.w.length !== 4) return null;
      answers.add(g.a);
      for (const i of g.w) {
        const word = ans.words[i];
        if (!word || seen.has(norm(word.w))) return null;
        seen.add(norm(word.w));
      }
    }
    return { cat, groups: withLevels(groups) };
  } catch { return null; }
}

/** What the page needs to show about each crate. */
export function describe(board) {
  const answers = board.groups.map(g => g.a);
  return board.groups.map(g => {
    const ans = BANK[g.a];
    const words = g.w.map(i => ans.words[i]);
    return {
      answer: ans.name, aliases: ans.aliases, level: g.level,
      words: words.map(x => x.w),
      details: words.map(x => [x.w, x.hint]),
      herrings: words.flatMap(x => x.alt.filter(a => answers.includes(a) && a !== g.a).map(a => `${x.w} also fits ${BANK[a].name}`)),
    };
  });
}

export const hintFor = (board, word) => {
  for (const g of board.groups) for (const i of g.w) if (BANK[g.a].words[i].w === word) return BANK[g.a].words[i].hint;
  return "";
};
export const groupIndexOf = (board, word) => board.groups.findIndex(g => g.w.some(i => BANK[g.a].words[i].w === word));

/** right = all four in one crate; one = three of four; miss = anything else. */
export function classify(board, words) {
  const counts = {};
  words.forEach(w => { const g = groupIndexOf(board, w); counts[g] = (counts[g] || 0) + 1; });
  const best = Math.max(...Object.values(counts));
  return {
    res: best === 4 ? "right" : best === 3 ? "one" : "miss",
    g: best === 4 ? Number(Object.keys(counts)[0]) : null,
    lv: words.map(w => board.groups[groupIndexOf(board, w)].level),
  };
}
