// Cue's library: how many cards there are of each kind, none twice, none too short or too long to fit a card, nothing
// that is not clean (nothing sexual, nothing hateful, nothing about drinking or drugs, nothing rude about a person), the
// levels (kids within work within friends), and the twins that the Turn setting's "a different cue" uses.
import { LIB, CATS, LEVELS, pool, oddFor } from "../cue-library.js";
import { KINDS } from "../cue-words.js";
import { TALK } from "../cue-lib-talk.js";
import { PLAY } from "../cue-lib-play.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const rng = seed => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

// words that don't belong on a card: whole words (or the start of one), case aside
const BANNED = [
  // sexual
  "sex", "sexy", "sexual", "porn", "nude", "naked", "horny", "kinky", "slut", "whore", "orgasm", "condom", "erotic", "fetish", "boob", "boobs", "breast", "breasts", "penis", "vagina", "bum", "butt", "strip", "stripper", "lingerie", "underwear", "hook-up", "hookup", "kiss", "kissed", "make-out", "affair", "cheat", "cheated", "virgin", "dating",
  // drinking and drugs
  "drink", "drinks", "drinking", "drank", "drunk", "beer", "wine", "vodka", "whisky", "whiskey", "tequila", "booze", "boozy", "alcohol", "cocktail", "pint", "pints", "hangover", "tipsy", "wasted", "shot", "shots", "cheers", "pub", "lager", "gin", "rum", "champagne", "prosecco", "bar", "weed", "cocaine", "marijuana", "stoned", "drugs", "cigarette", "cigarettes", "smoke", "smoking", "vape", "vaping",
  // hateful, cruel or about a body
  "nazi", "hitler", "retard", "retarded", "faggot", "tranny", "spastic", "kike", "chink", "gypsy", "gay", "fat", "ugly", "stupid", "idiot", "dumb", "loser", "hate", "kill", "murder", "suicide", "die", "death", "dead", "funeral", "rape", "gun", "bomb", "terrorist",
  // rude
  "fuck", "shit", "damn", "bastard", "bitch", "crap", "piss", "ass", "arse",
];
const wordsOfText = t => t.toLowerCase().replace(/[^a-zé' -]/g, " ").split(/[ ]+/).filter(Boolean);
const slur = /n[i1]gg|f[a@]gg?[o0]t|ch[i1]nk|k[i1]ke|retard/i;

// ---------- counts ----------
const fresh = LIB.filter(c => c.cat !== "words");
check(fresh.length >= 500, `at least 500 new cards beside the words (${fresh.length})`);
const per = Object.fromEntries(CATS.map(c => [c.id, LIB.filter(x => x.cat === c.id).length]));
check(CATS.length >= 11 && CATS.every(c => c.name && c.one && c.ask && c.x), `every category has a name, what it is called on a card, and what to do (${CATS.length} categories)`);
check(CATS.filter(c => c.id !== "words").every(c => per[c.id] >= 40), `at least 40 cards in each category (the fewest: ${Math.min(...CATS.filter(c => c.id !== "words").map(c => per[c.id]))})`);
for (const c of CATS.filter(c => c.id !== "words")) check([0, 1, 2].every(l => LIB.filter(x => x.cat === c.id && x.lvl === l).length >= 8), `${c.name}: at least 8 cards for each of kids, work and friends`);
console.log(`     ${CATS.map(c => `${c.id} ${per[c.id]}`).join(", ")}; ${LIB.length} cards in all`);

// ---------- no duplicates, lengths ----------
const texts = LIB.map(c => c.t.toLowerCase()), twice = texts.filter((t, i) => texts.indexOf(t) !== i);
check(!twice.length, `no card twice${twice.length ? `: ${[...new Set(twice)].slice(0, 5).join("; ")}` : ""}`);
const twins = LIB.filter(c => c.o).map(c => c.o.toLowerCase());
check(LIB.filter(c => c.o).every(c => c.o.toLowerCase() !== c.t.toLowerCase()) && new Set(twins).size === twins.length, "a twin is never its own card's text, and none comes twice");
const long = fresh.filter(c => c.t.length > 110 || (c.o && c.o.length > 110)), short = fresh.filter(c => c.t.length < 5);
check(!long.length && !short.length, `every new card between 5 and 110 characters, so it fits a card large${long.length ? `; long: ${long[0].t}` : ""}${short.length ? `; short: ${short[0].t}` : ""}`);
const raw = [...TALK, ...PLAY].flatMap(c => [...c.kids, ...c.work, ...c.friends]);
check(raw.every(r => r.split("|").length <= 2 && r === r.trim() && !/\s{2}/.test(r)), "a card is its text or its text and one twin, with no stray spaces");
const wordsOnly = KINDS.flatMap(k => k.words);
check(new Set(wordsOnly).size === wordsOnly.length && wordsOnly.every(w => /^[a-zé]+$/.test(w)), "the words are single words, none twice");

// ---------- clean ----------
const all = LIB.flatMap(c => [c.t, c.o].filter(Boolean)).concat(CATS.flatMap(c => [c.name, c.one, c.ask, c.x, c.guess || ""]), KINDS.map(k => `${k.name} ${k.one}`));
const found = [];
for (const t of all) {
  const ws = wordsOfText(t);
  for (const b of BANNED) if (ws.includes(b)) found.push(`${b}: ${t}`);
  if (slur.test(t)) found.push(`slur: ${t}`);
}
check(!found.length, `no banned word on any card, category or word (${BANNED.length} words checked)${found.length ? `: ${found.slice(0, 6).join(" | ")}` : ""}`);
check(all.every(t => !/[؀-ۿ]/.test(t)) && LIB.every(c => !/\bhttps?:|@/.test(c.t)), "no links or addresses on a card");

// ---------- levels ----------
check(LEVELS.map(([v]) => v).join() === "0,1,2", "three levels: kids and family, work-safe, friends");
const ids = (cat, lvl, blind = false) => new Set(pool(cat, lvl, blind));
check([...ids("mix", 0)].every(i => LIB[i].lvl === 0) && [...ids("mix", 1)].every(i => LIB[i].lvl <= 1) && ids("mix", 0).size < ids("mix", 1).size && ids("mix", 1).size < ids("mix", 2).size, "kids' cards are within work-safe, within friends");
check(pool("likely", 2).every(i => LIB[i].cat === "likely") && pool("likely", 2).length === per.likely, "one category: all its cards at the top level");
const blind = pool("mix", 2, true);
check(blind.length > 0 && blind.every(i => CATS.find(c => c.id === LIB[i].cat).guess), "with no cue for X, only cards that can be worked out from what the others say");
check(!pool("likely", 2, true).length && !pool("rather", 2, true).length, "…so not Most likely or Would you rather");

// ---------- twins ----------
const r = rng(5);
const twinned = LIB.map((c, i) => i).filter(i => LIB[i].o);
check(twinned.length >= 150 && CATS.filter(c => c.guess && c.id !== "words").every(c => LIB.filter(x => x.cat === c.id).every(x => x.o)), `every card of Describe it, Name three and Act it out has a twin (${twinned.length} twins)`);
let ok = true, same = false, kind = true;
for (let k = 0; k < 3000; k++) {
  const i = Math.floor(r() * LIB.length), lvl = LIB[i].lvl, o = oddFor(i, lvl, r);
  if (!o || o === LIB[i].t) same = true;
  if (LIB[i].kind && LIB.find(c => c.t === o && c.kind === LIB[i].kind) === undefined) kind = false;
  if (!LIB[i].o && !LIB.some(c => c.cat === LIB[i].cat && c.t === o && c.lvl <= lvl)) ok = false;
}
check(!same, "what the odd one out sees is never the card itself");
check(ok, "…and with no twin it is another card of the category, within the level");
check(kind, "…and for a word, another word of its kind (a cat's twin is an animal)");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log(`cue-library: ${fresh.length} new cards in ${CATS.length - 1} categories, and ${wordsOnly.length} words`);
