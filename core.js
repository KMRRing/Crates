// Word bank, topics, settings and the rules shared by solo and together play.
import { KB_TOPICS as TOPICS, KB_PRESETS as PRESETS } from "./topics.js";
const RAW = JSON.parse(new TextDecoder().decode(
  Uint8Array.from(atob(window.CRATES_BANK), c => c.charCodeAt(0))));

/**
 * BANK[i] = { name, cat, group, aliases, words: [{ w, hint, topics, d, alt, since }] } — indices are stable.
 * Each word is one clue-answer pair with its own hint and difficulty; alt lists the other answers that
 * carry the same clue (the mapping is many-to-many); since = the batch that added the pair (0 = original).
 */
export const BANK = RAW.map(a => ({
  name: a.n, cat: a.c, group: a.g, aliases: a.a, entity: a.e,
  words: a.w.map(([w, hint, topics, d, alt, since = 0, entity]) => ({ w, hint, topics, d, alt, since, entity })),
}));

/** Bumped whenever a saved run changes shape (2: learning modes off/learn/norepeat/clues, seen clues). */
export const APP_VERSION = 2;

/** How far this build's bank goes. The bank only grows, so a bigger number means a newer build. */
export const BANK_SIZE = BANK.reduce((n, a) => n + a.words.length, 0);

export const NOUN = { country: "country", commodity: "commodity" };
export const PLURAL = { country: "Countries", commodity: "Commodities" };
export const SQUARES = ["🟨", "🟩", "🟦", "🟥"];
export const RESULT_LABEL = { right: "Right", one: "One away", miss: "Miss", hidden: "Wrong" };

/** Each category has its own topics (a country clue and a commodity clue ask different things), and the presets that
 *  weight them: the knowledge base's own, kept in topics.js, so the games that deal from it load them without the bank. */
export { TOPICS, PRESETS };
export const ALL_TOPICS = [...TOPICS.country, ...TOPICS.commodity];
/** Which categories a pool deals from. */
export const POOL_CATS = { country: ["country"], commodity: ["commodity"], mixed: ["country", "commodity"] };
export const WEIGHTS = [[0, "Out"], [1, "In"], [2, "More"]];   // tapped round on one button: out, in, more
export const GROUPS = {
  country: [["eu", "Europe"], ["me", "Middle East & N. Africa"], ["af", "Sub-Saharan Africa"], ["asia", "Asia & Pacific"], ["am", "Americas"]],
  commodity: [["nrg", "Energy"], ["bio", "Biofuels & low-carbon"], ["met", "Metals & minerals"], ["grain", "Grains & oilseeds"],
    ["soft", "Softs, fibres & livestock"], ["chem", "Chemicals"], ["circ", "Circular & recycled"], ["cred", "Credits & freight"]],
};

export function defaultSettings() {
  return { preset: "balanced", topics: { ...PRESETS.balanced.topics }, difficulty: "mixed", off: [] };
}

/** Accepts anything (old saves, room data) and returns a complete, valid settings object. */
export function cleanSettings(s) {
  const d = defaultSettings();
  if (!s || typeof s !== "object") return d;
  const topics = { ...(PRESETS[s.preset]?.topics || d.topics) };
  for (const [k] of ALL_TOPICS) {
    const raw = Number(s.topics?.[k]), v = raw > 0 && raw < 1 ? 1 : raw;   // an old "Less" (0.5) is in now
    if (WEIGHTS.some(([w]) => w === v)) topics[k] = v;
  }
  const valid = new Set(Object.values(GROUPS).flat().map(([k]) => k));
  return {
    preset: PRESETS[s.preset] ? s.preset : "custom",
    topics,
    difficulty: ["easy", "mixed", "hard"].includes(s.difficulty) ? s.difficulty : "mixed",
    off: arr(s.off).filter(k => valid.has(k)),
  };
}

/** "countries" / "commodity" / "mixed" (any casing or plural) → pool id, else null. */
export function parsePool(s) {
  s = String(s || "").trim().toLowerCase();
  if (s.startsWith("countr")) return "country";
  if (s.startsWith("commod")) return "commodity";
  if (/^(mix|all|both)/.test(s)) return "mixed";
  return null;
}
export const POOL_PARAM = { country: "countries", commodity: "commodities", mixed: "mixed" };

export const norm = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/^the /, "");

function editDistance(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}

/** Accepts the answer or an alias, allowing a typo or two on longer names. */
export function nameMatches(guess, answer) {
  const g = norm(guess || "");
  if (!g) return false;
  return [answer.name, ...answer.aliases].map(norm).some(a => {
    if (a === g) return true;
    const slack = a.length >= 9 ? 2 : a.length >= 5 ? 1 : 0;
    return editDistance(a, g) <= slack;
  });
}

export function shuffled(list, rng = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 272000 → "4:32", 3723000 → "1:02:03". */
export function formatTime(ms) {
  const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export const wordsKey = words => words.slice().sort().join("|");

/** A learning card is one clue-answer pair: Copper→Chile and Copper→Zambia are learned separately. */
export const cardKey = (a, i) => `${a}|${norm(BANK[a].words[i].w)}`;
/** cardKey → [answer, word] in the bank. */
export const PAIRS = new Map();
BANK.forEach((ans, a) => ans.words.forEach((w, i) => PAIRS.set(cardKey(a, i), [a, i])));

/** Realtime Database drops empty arrays and may hand arrays back as keyed objects. */
export function arr(x) {
  if (Array.isArray(x)) return x.filter(v => v != null);
  if (x && typeof x === "object") return Object.keys(x).sort((a, b) => a - b).map(k => x[k]).filter(v => v != null);
  return [];
}
