// Codeword's clues (docs/codeword.md): a grid opens on a question from Punt's machinery whose answer is one easy word,
// and that word's letters are the grid's starting letters (the engine chooses the grid so they crack it). This builds
// the candidates: questions with one right option that is a single word of letters, from the knowledge Settings has on.
// Sources, each a Punt topic with the subject it belongs to (topics.js TOPIC_OF.punt): countries and commodities are
// Crates' clue questions ("Which country is this about? Fjords"), at the easiest clues and, for countries, the well
// known ones; cities are the capitals; flags are "Whose flag is …?". Settings' subjects choose the sources (topicsOf
// in punt-gen.js: a subject that is off takes its topics out; nothing left, as when only STEM is on, deals all four,
// as Settings says a mix too narrow does), and "Content marked for removal" (Include or Exclude) decides whether marked
// questions are in. Everything is a function of the seed and those two choices, so a link or a table carries them
// (`src`, `inc`); today's grid takes neither (every source, Exclude), being the same for everyone.
// Needs Crates' bank (bank.js, which sets window.CRATES_BANK), so it is loaded here, not by the page's markup.
import { mentions } from "./give-away.js";
import { STAR, mixFromSubjects, TOPIC_OF } from "./topics.js";

/** The sources in the order they are written in a link: id, link letter, label, the kind of word a mystery is. */
export const SOURCES = [
  { id: "countries", ch: "c", kind: "country" },
  { id: "commodities", ch: "m", kind: "commodity" },
  { id: "cities", ch: "t", kind: "city" },
  { id: "flags", ch: "f", kind: "country" },
];
export const ALL_SOURCES = SOURCES.map(s => s.ch).join("");
/** What the mystery row is called for each kind. */
export const KIND_LABEL = { country: "Country", commodity: "Commodity", city: "City" };

/** The link letters of the sources Settings' subjects leave on (`weights`: punt-gen.js topicsOf); all when none is. */
export function sourcesOf(weights) {
  const on = SOURCES.filter(s => (weights?.[s.id] || 0) > 0).map(s => s.ch).join("");
  return on || ALL_SOURCES;
}
/** The same from Settings' subjects (topics-on.js subjectsOn): a source is in when the subject of its Punt topic is. */
export const sourcesFromSubjects = on => sourcesOf(mixFromSubjects(SOURCES.map(s => [s.id]), TOPIC_OF.punt, on));
/** A link's letters made whole: known letters only, in order; none left means all. */
export const cleanSources = text => SOURCES.filter(s => String(text || "").includes(s.ch)).map(s => s.ch).join("") || ALL_SOURCES;

/** The word an answer is, if it is one plain word of 4 to `max` letters, else "". An abbreviation (all capitals) is not. */
function wordOf(label, max) {
  const s = String(label).trim();
  if (s.length > 1 && s === s.toUpperCase() && /[A-Z]/.test(s)) return "";
  const w = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return /^[a-z]+$/.test(w) && w.length >= 4 && w.length <= max ? w : "";
}
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (rnd, xs) => { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } return xs; };
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Crates' bank, once it is there (a page loads bank.js; Node tests set window first). */
async function bankReady() {
  if (globalThis.window?.CRATES_BANK) return;
  if (typeof document === "undefined") throw new Error("Crates' bank isn't loaded");
  await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "bank.js"; s.onload = res; s.onerror = () => rej(new Error("bank.js")); document.head.append(s); });
}

const PER_SOURCE = 14;
/**
 * The candidate clues for a grid: [{ word, kind, clue: { ask, prompt, options (four labels), a (the right one's index),
 * note, mk } }], in the order the seed shuffles them, one for each word. `src` the sources' link letters, `inc` whether
 * what is marked for removal is in, `max` the longest word the grid takes.
 */
export async function cluePool(seed, { src = ALL_SOURCES, inc = false, max = 9 } = {}) {
  await bankReady();
  const letters = cleanSources(src), want = SOURCES.filter(s => letters.includes(s.ch));
  const { mixQuestions } = await import("./punt-gen.js");
  const ok = mk => !mk || (inc && mk !== "l");
  const wellKnown = want.some(s => s.id === "countries") ? new Set((await import("./flags-bank.js")).MATHS.filter(q => q.lv === "ea").map(q => String(q.o[q.a[0]]).toLowerCase())) : null;
  const out = [];
  for (const [i, s] of want.entries()) {
    const found = [], sseed = (seed ^ Math.imul(i + 1, 0x9E3779B1)) >>> 0;
    if (s.id === "countries" || s.id === "commodities") {
      const qs = mixQuestions(sseed, [{ id: s.id, label: s.id, weight: 1, cat: s.kind, diffs: [1], include: inc }], PER_SOURCE * 4, []);
      for (const q of qs) {
        if (q.kind !== "clue") continue;
        const right = q.options.filter(o => o.right);
        const word = right.length === 1 && q.need === 1 ? wordOf(right[0].label, max) : "";
        if (!word || (s.id === "countries" && !wellKnown.has(right[0].label.toLowerCase()))) continue;
        found.push({ word, kind: s.kind, mk: q.mk, ask: q.ask, prompt: q.prompt, options: q.options.map(o => o.label), a: q.options.findIndex(o => o.right), note: q.notes?.[0]?.text || "" });
      }
    } else {
      const bank = (await (s.id === "cities" ? import("./cities-bank.js") : import("./flags-bank.js"))).MATHS;
      const items = bank.filter(q => q.a?.length === 1 && q.d <= 3 && ok(q.mk) && (s.id === "flags" ? q.lv === "ea" : q.area === "Capitals"));
      for (const q of shuffle(rng(sseed), items)) {
        const label = q.o[q.a[0]], word = wordOf(label, max);
        if (!word || q.o.length !== 4 || mentions(q.q, label)) continue;
        found.push({ word, kind: s.kind, mk: q.mk, ask: s.id === "flags" ? "" : "Which city?", prompt: q.q, options: q.o.slice(), a: q.a[0], note: q.x || "" });
      }
    }
    out.push(...found.slice(0, PER_SOURCE).filter(f => ok(f.mk)));
  }
  const seen = new Set(), rnd = rng(seed ^ 0x5EED);
  return shuffle(rnd, out).filter(f => !seen.has(f.word) && seen.add(f.word)).map(f => ({
    word: f.word, kind: f.kind,
    clue: { ask: f.ask, prompt: f.prompt, options: f.options, a: f.a, note: clip(f.note, 140), ...(f.mk ? { mk: f.mk } : {}) },
  }));
}

/** A clue's prompt as markup (the question; a marked one carries its star, topics.js). */
export const starOf = clue => (clue.mk === "s" || clue.mk === "p" ? STAR : "");
