// Bones' puzzle rush without its page (bones-rush-ui.js, on rush-sheet.js): the bank's puzzles (bones-puzzles.js, found
// by tools/bones-puzzles.mjs), the verdict on a play, and what a puzzle comes to in words. A
// puzzle is a position as its player saw it, written as the course writes its steps (bones-course.js), so the course's
// stage draws it and its rules judge it; with it come the plays weighed and what each was worth over hundreds of deals
// of the tiles that player couldn't see, each played out exactly (bones-solve.js). Pure: the page and the tests share it.
import { TILES, NAMES, endsOf, legalPlays } from "./bones-rules.js";
import { tableOf, playsFor, withPlay, scoreOf } from "./bones-course.js";

/** A puzzle as a course step: its table, the best play to find and those as good. */
export const stepOf = p => ({ ...p, answer: p.best, accept: p.ok.filter(n => n !== p.best) });
/** What a play was worth in the puzzle's deals: { name, value }, by its name ("1-4@1"). */
const optOf = (p, name) => { const i = p.opts.indexOf(name); return i < 0 ? null : { name, value: p.vals[i] }; };

/**
 * The verdict on a play (its name, as playName writes it): { verdict: "best" | "fine" | "wrong", mine, best, next } —
 * best the puzzle's best, next the best of the others, mine the play made (each { name, value }); "fine" a play the
 * puzzle counts as good as the best (within half its margin).
 */
export function judge(p, name) {
  const best = optOf(p, p.best), mine = optOf(p, name) || { name, value: null };
  const next = p.opts.filter(n => n !== p.best).map(n => optOf(p, n)).sort((a, b) => b.value - a.value)[0] || null;
  return { verdict: name === p.best ? "best" : p.ok.includes(name) ? "fine" : "wrong", mine, best, next };
}

// ---------- in words ----------
/**
 * A play's name in words: "1-4@1" is "1–4 on the 1", "5-0@5d" "5–0 on the 5–5", a lead "6–4"; with its puzzle, an end
 * that's a double named as one ("6–5 on the 6–6"), as the button that lays it says.
 */
export function playWords(name, p = null) {
  const m = /^(\d)-(\d)(?:@(\d)(d?))?$/.exec(name);
  if (!m) return name;
  if (m[3] == null) return `${m[1]}–${m[2]}`;
  let double = !!m[4];
  if (p && !double) {
    const play = playsFor(stepOf(p), name)[0], e = play && endsOf(tableOf(stepOf(p)));
    double = !!e && (play.end === "L" ? e.Ld : e.Rd);
  }
  return `${m[1]}–${m[2]} on the ${m[3]}${double ? `–${m[3]}` : ""}`;
}
/** A worth in its game's terms: Partnership's points a hand, Gaple's chips, Fives and Threes' points (or the game). */
export function worthText(p, v) {
  const game = p.game || "partnership", sign = v > 0.05 ? "+" : v < -0.05 ? "−" : "", n = Math.abs(v).toFixed(1).replace(/\.0$/, "");
  if (game === "fives" && v >= 90) return "the game";
  return `${sign}${n} ${game === "gaple" ? "chips" : game === "fives" ? "points" : "points a hand"}`;
}
const list = names => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);
const SHE = new Set(["Rosa", "Marisol", "Sari", "Maggie"]);

/** What the best play does, in a sentence or two, by what the bank found it does (p.why), with the table's names. */
export function whyText(p) {
  const s = tableOf(stepOf(p)), play = playsFor(stepOf(p), p.best)[0];
  if (!play) return "";
  const t = withPlay(s, play), e = endsOf(t), names = NAMES[s.game], mine = t.hands[0], out = [];
  const down = new Set([t.first, ...t.left.map(x => x.t), ...t.right.map(x => x.t)]), has = (i, v) => TILES[i][0] === v || TILES[i][1] === v;
  const unseen = v => TILES.filter((_, i) => has(i, v) && !down.has(i) && !mine.includes(i)).length, held = v => mine.filter(i => has(i, v)).length;
  const why = new Set(p.why || []);
  const ends = e.L === e.R ? `both ends ${e.L}` : `the ends ${e.L} and ${e.R}`;
  if (why.has("exact")) out.push(`${s.opts.target} exactly: the game.`);
  else if (why.has("out")) out.push("Your last tile: out.");
  if (why.has("knock")) {
    const foes = s.game === "partnership" ? [1, 3] : [...Array(s.seats).keys()].slice(1);
    const lack = seat => new Set(s.log.filter(l => l.pass && l.seat === seat).flatMap(l => l.ends));
    const who = foes.filter(f => lack(f).has(e.L) && lack(f).has(e.R)).map(f => names[f - 1]);
    const them = who.length > 1 ? "both" : SHE.has(who[0]) ? "she" : "he";
    out.push(`It leaves ${ends}, ${e.L === e.R ? "a number" : "numbers"} ${list(who)} ${who.length > 1 ? "have" : "has"} knocked on: ${them} must knock again.`);
  }
  if (why.has("close")) {
    const fewer = s.game === "partnership" ? "your side holds fewer pips" : "you hold the fewest pips";
    out.push(`It closes the hand: every ${e.L === e.R ? e.L : `${e.L} and every ${e.R}`} is down, nobody can lay a tile, and as the count goes ${fewer}.`);
  } else if (why.has("last")) {
    const v = [e.L, e.R].find(x => !unseen(x) && held(x));
    out.push(`Every ${v} but yours is down: only you can play on ${e.L === e.R ? "either end" : `the ${v}`}.`);
  } else if (why.has("own")) {
    const v = [e.L, e.R].find(x => held(x) > unseen(x));
    out.push(`Of the ${v}s left you hold ${held(v)}, everyone else ${unseen(v)}: ${e.L === e.R ? "both ends play" : `the ${v} plays`} to you.`);
  }
  if (why.has("double")) out.push("A double fits only its own number: it goes while that's still about.");
  else if (why.has("heavy") && !out.length) out.push(s.game === "gaple" ? "The heaviest tile goes while it fits: every pip left in your hand costs three chips." : "The heaviest tile goes while it fits.");
  if (why.has("keep") && !out.length) out.push("It keeps the most tiles in your hand that fit the ends.");
  if (why.has("setup") || (why.has("most") && !why.has("exact"))) {
    const made = scoreOf(s, play), most = Math.max(...legalPlays(s, 0).map(x => scoreOf(s, x).pts));
    const now = made.pts ? `the ends make ${made.total}, ${made.pts} ${made.pts === 1 ? "point" : "points"}` : `the ends make ${made.total}, nothing`;
    out.push(why.has("setup") ? `Fewer points now (${now}, where another tile makes ${most}), and less for the next player to score on.` : `The most points now: ${now}.`);
  }
  return out.join(" ");
}

/** What a play does over the puzzle's deals, as a verdict says it: "does +20.3 points a hand on average", "wins the game". */
export const doesText = (p, v) => ((p.game || "partnership") === "fives" && v >= 90 ? "wins the game" : `does ${worthText(p, v)} on average`);
/** The question a puzzle asks (the stage shows the score). */
export function askText(p) {
  const game = p.game || "partnership", name = { partnership: "Partnership", gaple: "Gaple", fives: "Fives and Threes" }[game];
  return `${name}: lay the best tile. ${NAMES[game][0]} plays next${game === "partnership" ? ", Tito is your partner" : ""}.`;
}
