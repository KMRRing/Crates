// Party's engine room: the games, and how one is started and moved on, with no page in it (party.js draws), so the
// tests can play a whole evening in Node. A party game is a module (party-<id>.js) whose default export is
//
//   { id, name, zh?, min, max, blurb, rules: [paragraphs], options: [{ id, label, choices: [[value, text]…], value }],
//     css?: "party-<id>.css" (its own styles, linked by party.js before themes.css),
//     need?(players, options) → what stops it starting, in words, or "" (min and max are checked otherwise),
//     start({ players, options, rng, now, shown }) → state (with show: [what it has just shown], if it remembers),
//     advance(state, { players, inputs, now, rng, shown }) → { state, say, show? } | null,
//     wakeAt(state) → a time (the database's, ms) to call advance again, or null,
//     view(stage, ctx),
//     solo?(stage, { back }) → it's also played on one phone, no party needed: drawn on Party's page before a party's
//       open, where its tile opens it (Higher or Lower) }
//
// start and advance are pure: advance runs inside the table's transaction on the device that runs the table (the
// host's phone), on the freshest copy, and may run more than once, so its randomness comes from rng (seeded by the
// game and the table's move number, the same every time). It gathers what the players sent (inputs: their votes,
// clues, guesses, each tagged with the step it was for) and moves the game on, or says nothing changed (null). What
// a player does on their own turn (I've said mine) can instead go straight into the state (ctx.act in party.js).
// players: [{ uid, pid, name, seat }] in seat order, the people at the table now. shown: what the game has shown the
// people at this party before, oldest first (branch.shown, where every phone also brings what it has been shown at
// other parties: party.js), so a game that deals things (Who am I's identities) needn't deal one twice; what it
// reports with `show` is added.
import undercover from "./party-undercover.js";
import whoami from "./party-whoami.js";
import echo from "./party-echo.js";
import decoy from "./party-decoy.js";
import gauge from "./party-gauge.js";
import fuse from "./party-fuse.js";
import snap from "./party-snap.js";
import sketch from "./party-sketch.js";
import whispers from "./party-whispers.js";
import forger from "./party-forger.js";
import gallery from "./party-gallery.js";
import hilo from "./party-hilo.js";

/** The games, in the order the lobby lists them. */
export const GAMES = [undercover, whoami, echo, decoy, gauge, fuse, snap, sketch, whispers, forger, gallery, hilo];
export const gameById = id => GAMES.find(g => g.id === id) || null;

/** A seeded generator (mulberry32): the same seed gives the same numbers, on every device and every retry. */
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
/** A list shuffled by rng (Fisher–Yates: every order equally likely). */
export function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** The people at the table as a game sees them. */
export const playersOf = branch => Object.entries(branch?.players || {}).filter(([, p]) => p && Number.isInteger(p.seat))
  .map(([uid, p]) => ({ uid, pid: p.pid || uid, name: p.name, seat: p.seat, online: p.online !== false }))
  .sort((a, b) => a.seat - b.seat);

/** What the players sent for this step of this game: { uid: input }, the stale ones (an earlier step) left out. */
export function inputsFor(branch, step) {
  const out = {}, seq = branch?.game?.seq;
  for (const [uid, v] of Object.entries(branch?.inputs || {})) if (v && v.seq === seq && v.step === step) out[uid] = v;
  return out;
}

// ---------- what the games have shown ----------
// The database may give a list back as an object with holes; a game remembers at most KEEP things, the newest.
const listOf = x => (x ? Object.values(x).filter(v => v != null) : []);
const KEEP = 2000;
/** What a game has shown at the party, oldest first. */
export const shownOf = (branch, id) => listOf(branch?.shown?.[id]);
/** Lists of what's been shown, each oldest first and each newer than the one before, as one: everything once, where
 *  it was shown last. */
export function mergeShown(...lists) {
  const out = [], had = new Set();
  for (const list of lists.reverse()) for (const x of listOf(list).reverse()) if (!had.has(x)) { had.add(x); out.push(x); }
  return out.reverse().slice(-KEEP);
}
function addShown(branch, id, show) {
  if (!listOf(show).length) return;
  branch.shown ||= {};
  branch.shown[id] = mergeShown(shownOf(branch, id), show);
}
/** A phone's memory of what it has been shown (`mine`, by game, from earlier parties) beside the party's: { home: its
 *  memory with the party's added, missing: the games of which it remembers something the party doesn't }. */
export function recall(mine, branch) {
  const home = {}, missing = [];
  for (const id of new Set([...Object.keys(mine || {}), ...Object.keys(branch?.shown || {})])) {
    const here = shownOf(branch, id);
    home[id] = mergeShown(mine?.[id], here);
    if (home[id].length > here.length) missing.push(id);
  }
  return { home, missing };
}

/** A game's options as chosen, each one it has filled in with its default. */
export const optionsOf = (game, options = {}) => Object.fromEntries((game.options || []).map(o => [o.id, options[o.id] ?? o.value]));

/**
 * What stops a game starting with these players and options, in words ("Undercover needs 3 players: 1 more to
 * join"), or "" when it can start. A game with computer players to fill its seats says so with its own need().
 */
export function needOf(game, players, options = {}) {
  if (!game) return "That game isn't in this version";
  if (game.need) return game.need(players, optionsOf(game, options)) || "";
  const n = players.length;
  if (n < game.min) return `${game.name} needs ${game.min} players: ${game.min - n} more to join`;
  if (n > game.max) return `${game.name} takes at most ${game.max}`;
  return "";
}

/** Starts a game at the table (inside a transaction on the branch): false if it can't start (too few players). */
export function startGame(branch, id, options = {}, now = Date.now()) {
  const game = gameById(id), players = playersOf(branch);
  if (!game || needOf(game, players, options)) return false;
  const seq = (branch.game?.seq || branch.played || 0) + 1, seed = (Math.random() * 2 ** 32) >>> 0;
  const opts = optionsOf(game, options);
  const state = game.start({ players, options: opts, rng: seeded(seed), now, shown: shownOf(branch, id) });
  if (!state) return false;
  addShown(branch, id, state.show);
  delete state.show;
  branch.game = { id, seq, seed, options: opts, state, started: now };
  branch.played = seq;
  delete branch.inputs;
  if (state.say) { branch.say = { n: (branch.say?.n || 0) + 1, text: state.say, lang: "en-GB", at: now }; delete state.say; }
  return true;
}

/**
 * Moves the game on (inside a transaction on the branch, on the device that runs the table): the game's advance on the
 * freshest copy; false when there's nothing to do. Inputs it has used are cleared with the step they were for.
 */
export function advanceGame(branch, now = Date.now()) {
  const g = branch?.game, game = gameById(g?.id);
  if (!g || !game) return false;
  const step = g.state?.step;
  const inputs = inputsFor(branch, step);
  const r = game.advance(g.state, { players: playersOf(branch), inputs, now, rng: seeded((g.seed ^ Math.imul(branch.rev || 0, 2654435761)) >>> 0),
    shown: shownOf(branch, g.id) });
  if (!r || !r.state) return false;
  g.state = r.state;
  addShown(branch, g.id, r.show);
  if (r.state.step !== step) delete branch.inputs;               // what was sent for the step just closed
  if (r.say) branch.say = { n: (branch.say?.n || 0) + 1, text: r.say, lang: r.lang || "en-GB", at: now };
  // a game over: its winners' wins counted for the evening, by player (a player's other device is the same player)
  if (r.state.step === "over" && Array.isArray(r.state.winners) && !g.tallied) {
    const pidOf = Object.fromEntries(playersOf(branch).map(p => [p.uid, p.pid]));
    branch.tally ||= {};
    for (const u of r.state.winners) { const pid = pidOf[u] || u; branch.tally[pid] = (branch.tally[pid] || 0) + 1; }
    g.tallied = true;
  }
  return true;
}

/** Ends the game in progress, back to the lobby (the host's "Choose another game"). */
export function endGame(branch) {
  if (!branch.game) return false;
  delete branch.game;
  delete branch.inputs;
  return true;
}

// ---------- every game a party can play ----------
// A party is a room for the evening, and its host chooses what it plays. Beside Party's own games (played here, on
// this page), that is the card, dice and board games for a few seats, each on its own page at a table in the party's
// room (seats.js: the computer takes the seats nobody has), and any game with a duo match (together.js, or Crates' and
// Slate's own rooms), dealt fresh in the party's room as a request said yes to would be, for as many as its table
// seats: Crates, River and Gambit two; Tribute and Hong up to four, the computer in the seats nobody has; the rest up
// to six, each on their own phone (one board or line for the team in Slate, Delta, Origin and Order; the head-to-heads
// on one deal, duel.js, as a race).
//   kind: "table" or "duo"; page: where it's played; max: the most people it seats; across: two people sit across a
//   four-seat table (partners); duo: the game's name in the room (its branch, and a request's game); race: everyone
//   plays the same deal on their own phone (duel.js); bots: a duo match whose empty seats the computer takes (Hong,
//   Tribute; every other duo match is people only).
export const ELSEWHERE = [
  { id: "boast", name: "Boast", kind: "table", page: "boast.html", max: 6, blurb: "Liar's dice with Chinese rules: bid on all the dice under the cups, or open." },
  { id: "bigtwo", name: "Big Two", kind: "table", page: "bigtwo.html", max: 4, blurb: "鋤大D, Hong Kong's climbing card game: be first to shed your cards." },
  { id: "landlord", name: "Landlord", kind: "table", page: "landlord.html", max: 3, blurb: "斗地主: the landlord against the two peasants." },
  { id: "holdem", name: "Texas Hold'em", kind: "table", page: "holdem.html", max: 6, blurb: "德州撲克: Macau's rules, no limit, a commission to the house; up to six at the felt." },
  { id: "factor", name: "Factor", kind: "table", page: "factor.html", max: 4, blurb: "Settle an island and trade for what it lacks: roads, posts and factories, first to ten points." },
  { id: "banquet", name: "Banquet", kind: "table", page: "banquet.html", max: 2, blurb: "划拳 and 十五二十, the hand games of a banquet table." },
  { id: "gammon", name: "Gammon", kind: "table", page: "gammon.html", max: 2, blurb: "Backgammon: a match, with the doubling cube." },
  { id: "trumps", name: "Trumps", kind: "table", page: "trumps.html", max: 4, across: true, blurb: "Jass, Belote, Coinche or Schafkopf, at a table of four." },
  { id: "quest", name: "Quest", kind: "table", page: "quest.html", max: 10, blurb: "Hidden loyalties: find the traitors before three quests fail." },
  { id: "bones", name: "Bones", kind: "table", page: "bones.html", max: 4, blurb: "Dominoes: Partnership, Gaple, or Fives and Threes." },
  { id: "dandan", name: "Dandan", kind: "table", page: "dandan.html", max: 2, blurb: "Forgetful Fish: one shared deck of eighty cards, two players, and Dandâns that only attack across an Island." },
  { id: "cartel", name: "Cartel", kind: "table", page: "cartel.html", max: 4, blurb: "Coup and Liar's Dice in dice: claim roles you may not hold, bid on dice you can't see." },
  { id: "contract", name: "Contract", kind: "table", page: "contract.html", max: 4, across: true, blurb: "Bridge: the auction in SAYC, then the play, a Chicago match of four deals." },
  { id: "crates", name: "Crates", kind: "duo", duo: "crates", page: "crates.html", max: 2, blurb: "Sixteen words into four crates, one board between you." },
  { id: "glyph", name: "Slate", kind: "duo", duo: "glyph", page: "slate.html", max: 6, blurb: "A small crossword with secret letter rules, everyone filling the one board." },
  { id: "delta", name: "Delta", kind: "duo", duo: "delta", page: "delta.html", max: 6, blurb: "The hex sums, everyone drawing on the one board." },
  { id: "punt", name: "Punt", kind: "duo", duo: "punt", page: "punt.html", max: 6, blurb: "Trivia with a stake on every answer: a pot each, or one for the table." },
  { id: "chart", name: "Chart", kind: "duo", duo: "chart", page: "chart.html", max: 6, blurb: "Everyone pins the same places on their own phone: every pin revealed, closest scores most." },
  { id: "quote", name: "Quote", kind: "duo", duo: "quote", page: "quote.html", max: 6, blurb: "Everyone makes a market on the same numbers: every range revealed against the truth." },
  { id: "spot", name: "Spot", kind: "duo", duo: "spot", page: "spot.html", max: 6, blurb: "Flying sums: the same ones for everyone, or call out yours and catch theirs." },
  { id: "stow", name: "Stow", kind: "duo", duo: "stow", page: "stow.html", max: 6, blurb: "One hold, a hand each: take turns round the table to clear the cargo." },
  { id: "hong", name: "Hong", kind: "duo", duo: "hong", page: "hong.html", max: 4, bots: true, blurb: "Hong Kong mahjong, four at the table." },
  { id: "tribute", name: "Tribute", kind: "duo", duo: "tribute", page: "tribute.html", max: 4, bots: true, blurb: "Guan Dan: two partnerships, across the table from each other." },
  { id: "river", name: "River", kind: "duo", duo: "river", page: "river.html", max: 2, blurb: "Xiangqi, Chinese chess, one against the other." },
  { id: "gambit", name: "Gambit", kind: "duo", duo: "gambit", page: "gambit.html", max: 2, blurb: "Chess, one against the other." },
  { id: "rush", name: "Puzzle rush", kind: "duo", duo: "rush", page: "rush.html", max: 6, race: true, blurb: "Gambit's puzzle battle: the same chess puzzles for everyone, against the clock." },
  { id: "origin", name: "Origin", kind: "duo", duo: "origin", page: "origin.html", max: 6, blurb: "Five hidden countries from their clues, as one team: anyone guesses." },
  { id: "order", name: "Order", kind: "duo", duo: "order", page: "order.html", max: 6, blurb: "One line for the whole table: dates, quantities or a story, anyone placing the next card." },
  { id: "arb", name: "Arb", kind: "duo", duo: "arb", page: "arb.html", max: 6, race: true, blurb: "The same five routes through the links for everyone: cheapest wins." },
  { id: "survey", name: "Survey", kind: "duo", duo: "survey", page: "survey.html", max: 6, race: true, blurb: "The same block of rock for everyone: chip away the waste, the fastest clear wins." },
  { id: "manifest", name: "Manifest", kind: "duo", duo: "manifest", page: "manifest.html", max: 6, blurb: "The same stack at the same moment: against each other, or one team pooling what each saw." },
  { id: "pipes", name: "Pipes", kind: "duo", duo: "pipes", page: "pipes.html", max: 6, race: true, blurb: "The same seeded run for everyone, an act or more: the most delivered wins." },
  { id: "sudoku", name: "Sudoku", kind: "duo", duo: "sudoku", page: "sudoku.html", max: 6, race: true, blurb: "The same grid for everyone, the fastest solve wins; or Together, one grid and a share of the givens each." },
  { id: "mines", name: "Mines", kind: "duo", duo: "mines", page: "mines.html", max: 6, race: true, blurb: "Minesweeper on a field that needs no guess: race it, or play it as one team, each reading part of its numbers." },
  { id: "nonogram", name: "Nonogram", kind: "duo", duo: "nonogram", page: "nonogram.html", max: 6, race: true, blurb: "A picture in a grid, a clue on every line: race to draw the same one, or split the clues and draw it together." },
  { id: "hitori", name: "Hitori", kind: "duo", duo: "hitori", page: "hitori.html", max: 6, race: true, blurb: "The same grid of numbers for everyone: shade the repeats, the fastest solve wins." },
  { id: "bulls", name: "Bulls", kind: "duo", duo: "bulls", page: "bulls.html", max: 6, blurb: "Mastermind round the table: one board with your keys on the others' screens, a race on one code, or codes set for each other." },
  { id: "assay", name: "Assay", kind: "duo", duo: "assay", page: "assay.html", max: 6, race: true, blurb: "The same hidden word for everyone, each on their own phone: the fewest guesses win, then the quicker." },
  { id: "yield", name: "Yield", kind: "duo", duo: "yield", page: "yield.html", max: 6, race: true, blurb: "The same seven letters for everyone: a sprint, the most points wins, or one team with a centre letter each." },
  { id: "isomer", name: "Isomer", kind: "duo", duo: "isomer:race", page: "isomer.html", max: 6, race: true, blurb: "Jumbled words, their circled letters the final answer: the same jumbles for everyone, the quickest wins." },
  { id: "ladder", name: "Ladder", kind: "duo", duo: "ladder", page: "ladder.html", max: 6, blurb: "Carroll's word ladders: the same three for everyone, lowest score wins, or one ladder for the team, each holding some of its letters." },
  { id: "lode", name: "Lode", kind: "duo", duo: "lode", page: "lode.html", max: 6, blurb: "One board of hidden theme words: race to find them, or split its letters and find them as a team." },
  { id: "lots", name: "Lots", kind: "duo", duo: "lotsrace", page: "lots.html", max: 6, race: true, blurb: "Sixteen words into four lots of four, the same board for everyone: the most points wins, then the quicker." },
  { id: "codeword", name: "Codeword", kind: "duo", duo: "codeword", page: "codeword.html", max: 6, race: true, blurb: "The same codeword for everyone at the table: the fastest to crack it wins." },
  { id: "crossword", name: "Crossword", kind: "duo", duo: "crossword", page: "crossword.html", max: 6, blurb: "One grid for the table, its clues split between you: nobody can finish it alone." },
  { id: "acrostic", name: "Acrostic", kind: "duo", duo: "acrostic", page: "acrostic.html", max: 6, race: true, blurb: "The same hidden text for everyone: crack the clues, fill the squares, the fastest solve wins." },
  { id: "calcudoku", name: "Calcudoku", kind: "duo", duo: "calcudoku", page: "calcudoku.html", max: 6, race: true, blurb: "The same cages for everyone, the fastest solve wins; or Together, one grid and a share of the clues each." },
  { id: "kakuro", name: "Kakuro", kind: "duo", duo: "kakuro", page: "kakuro.html", max: 6, race: true, blurb: "The same grid of sums for everyone, the fastest solve wins; or Together, one grid and a share of the clues each." },
];
/** Anything a party can play, by id: { id, name, kind ("party", "table", "duo"), min, max, blurb, … }, or null. */
export function playable(id) {
  const g = gameById(id);
  if (g) return { id: g.id, name: g.name, kind: "party", min: g.min, max: g.max, blurb: g.blurb, def: g };
  const e = ELSEWHERE.find(x => x.id === id);
  return e ? { min: e.kind === "duo" ? 2 : 1, ...e } : null;
}
/** Whether a party of n can play it: Party's own between their least and most, a table up to its seats (the computer
 *  fills the rest), a duo match by two (Tribute and Hong by up to four). */
export const fits = (entry, n) => !!entry && n >= entry.min && n <= entry.max;
/** Who plays a game, as words on its card. */
export const seatsText = entry => (entry.def?.solo ? `Any number on one phone, or ${entry.min}–${entry.max} on their own`
  : entry.kind === "duo" && entry.max === 2 ? "2 players"
  : entry.kind === "party" || (entry.kind === "duo" && !entry.bots) ? `${entry.min}–${entry.max} players`
    : `${entry.min}–${entry.max} players, the computer in any empty seat`);

/**
 * A table game's branch in the party's room, dealt by its host's page when it gets there: everyone in the party
 * seated as they sit in it (two at a four-seat table across from each other, as partners), the party's host its host,
 * each marked away until their phone sits down (so one who never comes is played for after the grace).
 */
export function tableFrom(party, entry, now = Date.now()) {
  const people = playersOf(party), across = entry.across && people.length === 2;
  const players = {};
  people.forEach((p, i) => { players[p.uid] = { name: p.name, ...(p.pid && p.pid !== p.uid ? { pid: p.pid } : {}), seat: across ? i * 2 : i, joined: now, online: false }; });
  return { v: 1, app: 0, created: now, host: party.host, rev: 0, party: true, players };
}
