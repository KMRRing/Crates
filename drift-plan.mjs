// Drift: the campaign's book of levels, made from this plan (Korbi, 23 Nov 2026: "drift campaign fixed deals that are winnable"; the
// chapters are the plan he reviewed that day, the first twelve here, the tides, ships, timber, mixed lots, sailing dates and the
// Hanse fleet to follow). A row is a level: its quay, its goods, its orders and its weather, and a grade. For each row this deals
// the level from SEEDS seeds of its own (dealOf writes every crate and every turn out), has drift-solve.js's planner play it, reading
// only the forecast, and the simple players of drift-bots.js too; a seed is kept if a player wins and the grade's simple players
// lose within the turns it allows. The level's par is the best of them (all read only the forecast); its limit the par and the
// grade's slack. Kept levels are
// frozen in drift-book.js with the planner's moves (the tests replay them): a level once written is never dealt again, so a
// player's stars stay true. A new row, or one named to `remake`, is the only thing written.
//
// Usage: node drift-plan.mjs check [id …]     what the rows would give, written nowhere
//        node drift-plan.mjs write            adds the rows not yet in the book to drift-book.js
//        node drift-plan.mjs remake id …      deals those again and writes them
import { writeFileSync, existsSync } from "node:fs";
import { fork } from "node:child_process";
import { rules, dealOf, QUEUE, GOODS } from "./drift-engine.js";
import { solve } from "./drift-solve.js";
import { BOTS } from "./drift-bots.js";
import { newGame, lay } from "./drift-engine.js";

export const BEAM = 16, SEEDS = 24, LONG = 140;
// How much a grade leaves over the planner's turns, and which simple players must not manage it in time: intro, the twist alone
// on a small dock with time to spare; easy, mid and hard; cap, a chapter's last, where even the one-ahead planner runs out of turns.
export const GRADES = {
  intro: { slack: 0.5, min: 4, beat: [] },
  easy: { slack: 0.35, min: 3, beat: ["greedy"] },
  mid: { slack: 0.25, min: 3, beat: ["greedy", "needy"] },
  hard: { slack: 0.18, min: 2, beat: ["greedy", "needy"] },
  cap: { slack: 0.12, min: 2, beat: ["greedy", "needy", "planner"] },
};

const T = "trade", H = true;
// each chapter's rows; `w: T` is a trade wind (it holds its heading), else the wind veers every turn
export const PLAN = [
  { ch: "trade", rows: [
    { name: "First cargo", grade: "intro", shape: "dock", goods: 2, orders: [6, 6, 0, 0], w: T, tip: "Lay the crate; then the wind slides every crate its way. Three of a good in a line ship." },
    { name: "Downwind", grade: "easy", shape: "pier", goods: 2, orders: [9, 6, 0, 0], w: T, tip: "The trade wind holds its heading a few turns: pile crates against the edge it blows to." },
    { name: "Down the slip", grade: "easy", shape: "hull", goods: 3, orders: [6, 6, 3, 0], w: T, tip: "A slide stops where the water begins: the hull's bow catches crates." },
    { name: "Chain", grade: "mid", shape: "cog", goods: 3, orders: [6, 9, 6, 0], w: T, tip: "After a shipment the wind blows on: the gap it leaves can bring the next line together." },
    { name: "The Bergen run", grade: "cap", shape: "quay", goods: 3, orders: [9, 9, 6, 0], w: T, tip: "Three goods on the open quay, and fewer turns to do it in." },
  ] },
  { ch: "shift", rows: [
    { name: "Veering", grade: "intro", shape: "dock", goods: 2, orders: [6, 6, 0, 0], tip: "The wind changes every turn now. Read the next arrow: lay where it will bring the crate to its pair." },
    { name: "Boxing the compass", grade: "easy", shape: "basin", goods: 3, orders: [6, 6, 3, 0], tip: "A crate laid where two coming winds both serve it is worth two laid anywhere." },
    { name: "Two ways", grade: "mid", shape: "lagoon", goods: 3, orders: [6, 6, 6, 0], tip: "The lagoon's water splits its rows: a slide on one side never reaches the other." },
    { name: "Hold your hand", grade: "mid", shape: "pier", goods: 3, orders: [9, 6, 6, 0], tip: "Shipping now is not always best: a pair kept apart can wait for the crate that makes two lines." },
    { name: "Figure of eight", grade: "hard", shape: "eight", goods: 3, orders: [9, 9, 6, 0], tip: "Two rings of quay with a waist between: the narrows decide where crates pile." },
    { name: "Hanse fair", grade: "cap", shape: "kontor", goods: 4, orders: [6, 6, 6, 6], tip: "All four goods on the Kontor's stepped quay." },
  ] },
  { ch: "hold", rows: [
    { name: "The warehouse", grade: "intro", shape: "dock", goods: 3, orders: [6, 6, 3, 0], hold: H, tip: "Tap the warehouse to put the crate away and take out the one kept there (or the next in line). Once between two crates." },
    { name: "Wrong crate", grade: "easy", shape: "pier", goods: 3, orders: [6, 6, 6, 0], hold: H, tip: "A crate that would spoil a line can wait in the warehouse for its own wind." },
    { name: "Keep one back", grade: "mid", shape: "cog", goods: 3, orders: [9, 6, 6, 0], hold: H, tip: "The crate kept back is the one that finishes a line when nothing in the queue can." },
    { name: "The spare", grade: "hard", shape: "jetty", goods: 4, orders: [6, 6, 6, 3], hold: H, tip: "Four goods on a jetty: the warehouse holds what the arms can't take." },
    { name: "Staple right", grade: "cap", shape: "hull", goods: 4, orders: [6, 9, 6, 6], hold: H, tip: "Every cargo landed and offered in town, as a staple port demanded: a full hull of all four goods." },
  ] },
  { ch: "moor", rows: [
    { name: "Bollards", grade: "intro", shape: "dock", goods: 3, orders: [6, 6, 3, 0], hold: H, moor: 5, tip: "A crate with an anchor comes moored: it stays put whatever the wind, and the others pile against it." },
    { name: "Breakwater", grade: "easy", shape: "pier", goods: 3, orders: [6, 6, 6, 0], hold: H, moor: 6, tip: "A moored crate is a wall you place: build a line against it." },
    { name: "Against the post", grade: "mid", shape: "basin", goods: 3, orders: [9, 6, 6, 0], hold: H, moor: 6, tip: "Lay a moored crate where a slide should stop, one short of the edge." },
    { name: "Moored apart", grade: "mid", shape: "lagoon", goods: 3, orders: [9, 9, 6, 0], hold: H, moor: 5, tip: "A moored crate also keeps a pair apart: lay it where it spoils a line you don't want yet." },
    { name: "Crowded berth", grade: "hard", shape: "cog", goods: 4, orders: [6, 6, 6, 6], hold: H, moor: 6, tip: "Four goods, and every sixth crate a wall." },
    { name: "Lübeck", grade: "cap", shape: "quay", goods: 4, orders: [9, 6, 9, 6], hold: H, moor: 6, tip: "The queen of the Hanse: the open quay, moorings and all four goods." },
  ] },
  { ch: "long", rows: [
    { name: "Long cargo", grade: "intro", shape: "dock", goods: 3, orders: [6, 3, 4, 0], runs: [0, 0, 4, 0], mix: [2, 2, 2, 1], hold: H, tip: "Furs ship only in lines of four or more: a line of three of them goes, and counts for nothing." },
    { name: "Four abreast", grade: "easy", shape: "pier", goods: 3, orders: [6, 6, 8, 0], runs: [0, 0, 4, 0], hold: H, tip: "Three furs in a line are lost: keep the third apart until the fourth is coming." },
    { name: "Short and long", grade: "mid", shape: "hull", goods: 3, orders: [6, 8, 6, 0], runs: [0, 4, 0, 0], hold: H, moor: 7, tip: "Herring in fours, salt and furs in threes." },
    { name: "Not three", grade: "mid", shape: "eight", goods: 3, orders: [9, 6, 8, 0], runs: [0, 0, 4, 0], hold: H, moor: 7, tip: "The warehouse keeps the third fur from spoiling the line." },
    { name: "Two long cargoes", grade: "hard", shape: "cog", goods: 4, orders: [6, 6, 4, 4], runs: [0, 0, 4, 4], hold: H, moor: 7, tip: "Furs and amber both in fours." },
    { name: "Novgorod", grade: "cap", shape: "quay", goods: 4, orders: [9, 6, 8, 4], runs: [0, 0, 4, 4], hold: H, moor: 7, tip: "Furs and amber from the far end of the Baltic, in long lines." },
  ] },
  { ch: "squall", rows: [
    { name: "Squall", grade: "intro", shape: "dock", goods: 3, orders: [6, 6, 3, 0], hold: H, squall: { every: 4, count: 1 }, tip: "A cloud in the queue is a squall: a stray crate lands where it is drawn faint, before the wind. Nothing can be laid there." },
    { name: "Strays", grade: "easy", shape: "pier", goods: 3, orders: [6, 6, 6, 0], hold: H, moor: 7, squall: { every: 4, count: 1 }, tip: "A stray lands where no line is made, but the wind can make one of it." },
    { name: "Storm season", grade: "mid", shape: "lagoon", goods: 3, orders: [9, 6, 6, 0], hold: H, moor: 6, squall: { every: 3, count: 1 }, tip: "Squalls every third turn: leave room for them." },
    { name: "Squall line", grade: "mid", shape: "hull", goods: 3, orders: [9, 9, 6, 0], hold: H, moor: 7, squall: { every: 3, count: 2 }, tip: "Two strays at a time." },
    { name: "Heavy weather", grade: "hard", shape: "basin", goods: 4, orders: [6, 6, 6, 4], runs: [0, 0, 0, 4], hold: H, moor: 6, squall: { every: 3, count: 1 }, tip: "Squalls, moorings and amber in fours." },
    { name: "Skagerrak", grade: "cap", shape: "quay", goods: 4, orders: [9, 9, 6, 4], runs: [0, 0, 0, 4], hold: H, moor: 7, squall: { every: 3, count: 2 }, tip: "The strait into the Baltic, in its autumn gales." },
  ] },
  { ch: "airs", rows: [
    { name: "Light airs", grade: "intro", shape: "dock", goods: 3, orders: [6, 6, 3, 0], hold: H, airs: { p: 0.5 }, tip: "A thin arrow is a breeze: every crate moves one square its way, not all the way." },
    { name: "Breeze", grade: "easy", shape: "pier", goods: 3, orders: [6, 6, 6, 0], hold: H, moor: 7, airs: { p: 0.4 }, tip: "A breeze moves a crate only if the square beside it is free once the crates ahead have moved." },
    { name: "Inch by inch", grade: "mid", shape: "cog", goods: 3, orders: [9, 6, 6, 0], hold: H, moor: 6, airs: { p: 0.4 }, tip: "A breeze can bring one crate alongside two without moving them." },
    { name: "Becalmed", grade: "mid", shape: "lagoon", goods: 3, orders: [9, 9, 6, 0], hold: H, moor: 7, airs: { p: 0.5 }, squall: { every: 5, count: 1 }, tip: "Mostly breezes, and a squall now and then." },
    { name: "Gentle hand", grade: "hard", shape: "jetty", goods: 4, orders: [6, 6, 6, 3], hold: H, moor: 6, airs: { p: 0.35 }, tip: "Four goods on the jetty, and breezes to place them." },
    { name: "Calm and storm", grade: "hard", shape: "hull", goods: 4, orders: [6, 9, 6, 4], runs: [0, 0, 0, 4], hold: H, moor: 7, airs: { p: 0.3 }, squall: { every: 4, count: 1 }, tip: "Breezes and squalls, and amber in fours." },
    { name: "The Sound", grade: "cap", shape: "kontor", goods: 4, orders: [9, 6, 9, 4], runs: [0, 0, 0, 4], hold: H, moor: 6, airs: { p: 0.3 }, squall: { every: 4, count: 1 }, tip: "The narrows where the Danish king took his toll: every kind of wind so far." },
  ] },
  { ch: "gust", rows: [
    { name: "Two winds", grade: "intro", shape: "dock", goods: 3, orders: [6, 6, 3, 0], hold: H, gust: { p: 0.35 }, tip: "A double arrow is a turn of two winds: the crates settle after the first, then the second blows." },
    { name: "Backing", grade: "easy", shape: "pier", goods: 3, orders: [6, 6, 6, 0], hold: H, moor: 7, gust: { p: 0.3 }, airs: { p: 0.15 }, tip: "A line can form after either wind." },
    { name: "Veer and back", grade: "mid", shape: "basin", goods: 3, orders: [9, 6, 6, 0], hold: H, moor: 6, gust: { p: 0.3 }, tip: "Two winds can carry a crate round a corner." },
    { name: "Crosswind", grade: "hard", shape: "eight", goods: 4, orders: [6, 6, 6, 6], hold: H, moor: 6, gust: { p: 0.25 }, squall: { every: 5, count: 1 }, tip: "Gusts and squalls on the figure of eight." },
    { name: "Kattegat", grade: "cap", shape: "quay", goods: 4, orders: [9, 6, 8, 6], runs: [0, 0, 4, 0], hold: H, moor: 7, gust: { p: 0.25 }, airs: { p: 0.2 }, squall: { every: 4, count: 1 }, tip: "Shifting winds in shallow water: everything so far." },
  ] },
  { ch: "wave", rows: [
    { name: "The swell", grade: "intro", shape: "dock", goods: 3, orders: [6, 6, 3, 0], hold: H, wave: { p: 0.35 }, tip: "A band with arrows is a rogue wave: it shoves that row or column one square, before the wind." },
    { name: "Swell", grade: "easy", shape: "pier", goods: 3, orders: [6, 6, 6, 0], hold: H, moor: 7, wave: { p: 0.3 }, tip: "A crate with water or a crate behind it doesn't move in the wave." },
    { name: "Breakers", grade: "mid", shape: "hull", goods: 3, orders: [9, 6, 6, 0], hold: H, moor: 6, wave: { p: 0.3 }, gust: { p: 0.1 }, tip: "A wave can line up what the wind then ships." },
    { name: "Rollers", grade: "hard", shape: "cog", goods: 4, orders: [6, 6, 6, 6], hold: H, moor: 6, wave: { p: 0.25 }, airs: { p: 0.15 }, tip: "Waves and breezes, both a square at a time." },
    { name: "Dogger Bank", grade: "cap", shape: "kontor", goods: 4, orders: [9, 9, 6, 6], hold: H, moor: 7, wave: { p: 0.25 }, gust: { p: 0.1 }, squall: { every: 5, count: 1 }, tip: "Short steep seas over the bank: waves, gusts and squalls." },
  ] },
  { ch: "fog", rows: [
    { name: "Murk", grade: "intro", shape: "dock", goods: 3, orders: [6, 6, 3, 0], hold: H, fog: { p: 0.3 }, tip: "On a foggy turn you see this wind and this crate, and nothing after them." },
    { name: "Sea fret", grade: "easy", shape: "pier", goods: 3, orders: [6, 6, 6, 0], hold: H, moor: 7, fog: { p: 0.3 }, tip: "Fog is forecast: before it comes, leave nothing that needs the next wind." },
    { name: "Haar", grade: "mid", shape: "lagoon", goods: 3, orders: [9, 6, 6, 0], hold: H, moor: 6, fog: { p: 0.25 }, wave: { p: 0.1 }, tip: "The warehouse is a crate you can still see in fog." },
    { name: "Thick weather", grade: "hard", shape: "basin", goods: 4, orders: [6, 6, 6, 6], hold: H, moor: 6, fog: { p: 0.2 }, squall: { every: 5, count: 1 }, tip: "Fog between squalls." },
    { name: "Blind passage", grade: "cap", shape: "eight", goods: 4, orders: [9, 6, 6, 6], hold: H, moor: 7, fog: { p: 0.2 }, gust: { p: 0.1 }, airs: { p: 0.15 }, tip: "Fog, gusts and breezes on the figure of eight." },
  ] },
  { ch: "reef", rows: [
    { name: "Shoals", grade: "intro", shape: "dock", goods: 3, orders: [6, 6, 3, 0], hold: H, rock: { p: 0.2, max: 2 }, tip: "A faint rock is where one will rise next turn, and stay: slides stop at it and lines break at it." },
    { name: "Rocks", grade: "easy", shape: "pier", goods: 3, orders: [6, 6, 6, 0], hold: H, moor: 7, rock: { p: 0.15, max: 3 }, tip: "A rock is a moored crate that never ships." },
    { name: "Skerries", grade: "mid", shape: "cog", goods: 3, orders: [9, 6, 6, 0], hold: H, moor: 6, rock: { p: 0.15, max: 3 }, wave: { p: 0.1 }, tip: "Rocks and the odd wave." },
    { name: "Rocks and rollers", grade: "hard", shape: "hull", goods: 4, orders: [6, 6, 6, 6], hold: H, moor: 6, rock: { p: 0.1, max: 3 }, wave: { p: 0.15 }, gust: { p: 0.1 }, tip: "Rocks, waves and gusts on a narrow hull." },
    { name: "Reef passage", grade: "cap", shape: "quay", goods: 4, orders: [9, 9, 6, 6], hold: H, moor: 7, rock: { p: 0.1, max: 4 }, squall: { every: 5, count: 1 }, fog: { p: 0.1 }, tip: "Reefs, squalls and fog on the open quay." },
  ] },
  { ch: "seal", rows: [
    { name: "The seal", grade: "intro", shape: "dock", goods: 3, orders: [6, 6, 6, 0], hold: H, seal: 7, tip: "A crate with the harbour master's wax ships every crate of its good on the quay when it's laid." },
    { name: "Wax", grade: "easy", shape: "pier", goods: 3, orders: [9, 6, 6, 0], hold: H, moor: 6, seal: 8, tip: "Lay a seal when the quay holds the most of its good." },
    { name: "Customs", grade: "mid", shape: "lagoon", goods: 4, orders: [6, 6, 6, 6], hold: H, moor: 6, seal: 8, squall: { every: 5, count: 1 }, tip: "The warehouse can keep a seal until its good has piled up." },
    { name: "Harbour dues", grade: "hard", shape: "jetty", goods: 4, orders: [9, 6, 9, 6], hold: H, moor: 6, seal: 9, wave: { p: 0.1 }, gust: { p: 0.1 }, tip: "Seals, waves and gusts on the jetty." },
    { name: "Open season", grade: "cap", shape: "eight", goods: 4, orders: [9, 6, 9, 6], hold: H, moor: 6, seal: 9, squall: { every: 6, count: 1 }, gust: { p: 0.1 }, wave: { p: 0.1 }, fog: { p: 0.08 }, rock: { p: 0.06, max: 2 }, airs: { p: 0.1 }, tip: "Everything at once: waves, gusts, squalls, fog, reefs, breezes and the harbour master's seal." },
  ] },
];
export const ROWS = PLAN.flatMap(({ ch, rows }) => rows.map((row, k) => ({ ...row, id: `${ch}-${k + 1}`, ch })));

/** A row's rules, with no deal yet. */
export function rowRules(row, turns = LONG) {
  const { name, grade, tip, id, ch, w, ...r } = row;
  return rules({ ...r, windMode: w === T ? "trade" : "random", turns });
}
const encode = moves => moves.map(m => (m.stow ? "*" : "") + m.at.toString(36)).join(" ");

/** A simple player's whole game, with its moves (drift-bots.js's play, kept). */
function bot(r, seed, name) {
  let s = newGame(r, seed);
  let z = (seed + 17) * 2654435761 >>> 0 || 1;
  const rnd = () => ((z = (Math.imul(z, 1103515245) + 12345) & 0x7fffffff) / 0x7fffffff), f = BOTS[name], moves = [];
  for (let k = 0; k < LONG && s.status === "play"; k++) { const i = f(r, s, rnd); if (i == null) break; moves.push({ at: i, stow: false }); s = lay(r, s, i).state; }
  return { state: s, moves };
}
/** A row's own seeds: a hundred to a row, so no two rows deal the same quay (a small dock dealt from seed 21 is the same dock). */
const seedsOf = row => Array.from({ length: SEEDS }, (_, k) => 1 + k + 100 * ROWS.findIndex(r => r.id === row.id));

/** The best seed for a row: the level it makes, or null with none in SEEDS. */
export function make(row) {
  const g = GRADES[row.grade], base = rowRules(row), want = row.orders.reduce((a, b) => a + b, 0) * (row.grade === "intro" ? 1.1 : 1.4);
  let best = null;
  for (const seed of seedsOf(row)) {
    const deal = dealOf(base, seed, LONG, LONG + QUEUE + 1), r = { ...base, deal };
    const runs = { strong: solve(r, seed, LONG, BEAM), ...Object.fromEntries(["greedy", "needy", "planner"].map(b => [b, bot(r, seed, b)])) };
    const took = Object.fromEntries(Object.entries(runs).map(([k, v]) => [k, v.state.status === "won" ? v.state.turns : LONG]));
    const by = Object.keys(took).reduce((a, k) => (took[k] < took[a] ? k : a), "strong");
    if (took[by] >= LONG) continue;
    const run = runs[by], par = took[by], turns = par + Math.max(g.min, Math.ceil(par * g.slack));
    const { strong, ...weak } = took;
    const margin = Math.min(10, ...g.beat.map(b => weak[b] - turns));
    const ok = margin > 0, score = (ok ? 100 : 0) + margin * 2 - Math.abs(par - want) * 0.5;
    if (!best || score > best.score) best = { score, ok, seed, par, turns, weak: { strong, ...weak }, deal, moves: run.moves };
  }
  if (!best) return null;
  const { seed, par, turns, weak, deal, moves, ok } = best;
  const r = rowRules(row, turns), cut = { cells: deal.cells, crates: deal.crates.slice(0, turns + QUEUE + 1), plan: deal.plan.slice(0, turns + QUEUE) };
  const keep = ["shape", "goods", "mix", "runs", "orders", "hold"].reduce((o, k) => (row[k] !== undefined ? { ...o, [k]: row[k] } : o), {});
  return { id: row.id, ch: row.ch, name: row.name, grade: row.grade, tip: row.tip, ...keep, mix: r.mix.slice(), turns, par, seed, weak, sure: ok, deal: cut, moves: encode(moves) };
}

// ---------- the book ----------
const BOOK_FILE = new URL("./drift-book.js", import.meta.url);
async function readBook() { return existsSync(BOOK_FILE) ? (await import(BOOK_FILE.href)).BOOK : []; }
function writeBook(levels) {
  const order = new Map(ROWS.map((row, k) => [row.id, k]));
  levels.sort((a, b) => order.get(a.id) - order.get(b.id));
  writeFileSync(BOOK_FILE, `// Drift: the campaign's levels, made by drift-plan.mjs (node drift-plan.mjs write) from its plan, never by hand: each one's deal
// written out (drift-engine.js's codes), its par and turns, and the moves of the planner that won it in par.
export const BOOK = [
${levels.map(L => "  " + JSON.stringify(L)).join(",\n")},
];
`);
}
const say = L => `${L.id.padEnd(9)} ${L.name.padEnd(20)} ${L.grade.padEnd(5)} seed ${String(L.seed).padStart(4)} par ${String(L.par).padStart(2)} turns ${String(L.turns).padStart(2)}  strong ${L.weak.strong} greedy ${L.weak.greedy} needy ${L.weak.needy} planner ${L.weak.planner}${L.sure ? "" : "  (the simple players were not all beaten)"}`;

/** Makes rows in two processes (the machine's cores), each the rows of its own half. */
async function makeAll(ids) {
  if (ids.length < 2) return ids.map(id => make(ROWS.find(r => r.id === id)));
  const halves = [ids.filter((_, k) => k % 2 === 0), ids.filter((_, k) => k % 2 === 1)];
  const runs = halves.map(h => new Promise((ok, fail) => {
    const kid = fork(new URL(import.meta.url).pathname, ["rows", ...h]), got = [];
    kid.on("message", L => { got.push(L); if (L) console.error(say(L)); });
    kid.on("exit", code => (code ? fail(new Error(`rows ${h.join(" ")} failed`)) : ok(got)));
  }));
  return (await Promise.all(runs)).flat();
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "rows") {
  for (const id of args) process.send(make(ROWS.find(r => r.id === id)));
  process.exit(0);
} else if (cmd === "check" || cmd === "write" || cmd === "remake") {
  const book = await readBook(), have = new Set(book.map(L => L.id));
  const ids = cmd === "write" ? ROWS.filter(r => !have.has(r.id)).map(r => r.id) : args.length ? args : ROWS.map(r => r.id);
  const made = (await makeAll(ids)).filter(Boolean);
  if (ids.length < 2) made.forEach(L => console.error(say(L)));
  const missing = ids.filter(id => !made.some(L => L.id === id));
  if (missing.length) console.error(`no seed won: ${missing.join(" ")}`);
  if (cmd !== "check") writeBook([...book.filter(L => !made.some(M => M.id === L.id)), ...made].filter(L => ROWS.some(r => r.id === L.id)));
}
