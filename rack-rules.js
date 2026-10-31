// Rack: a word game on a board for two to four (README, Rack). The rules as a pure module for seats.js, which moves it
// solo against the computer or at a table with friends; the computer player is rack-bot.js's, the page rack.js.
//
// A 15 by 15 board and a bag of 100 tiles (two of them blanks); each player holds seven. A turn lays tiles from the rack in
// one row or one column to make a word, running through or beside the tiles already down, every other word the new tiles
// form being a word too; or swaps tiles with the bag (only while it holds a full rack's worth); or passes. The first word
// covers the star in the middle. A tile scores its value, a word the sum of its tiles'; a new tile on a premium square
// doubles or triples its letter (2L, 3L) or its whole word (2W, 3W), premiums count the turn the tile is laid and never
// again, and a blank scores nothing. Seven tiles in one turn (a "bingo") add 50. The game ends when a player has no tiles
// and the bag is empty (that player adds the others' tiles, each of the others loses theirs), or after six turns running
// that scored nothing (everyone loses their own).
//
// There is no challenge: a word that isn't in the word list is refused before the turn is spent. The list is the suite's
// English list (wordlist.js, SCOWL) with the two-letter words and a few short ones a word-game player expects.
//
// The board is a string of 225 characters, "." for an empty square, a capital for a tile and a lower-case letter for a
// blank standing as that letter; racks and the bag are strings too (a blank is "?"), which the database keeps whole.
import { isWord } from "./wordlist.js";
import { shuffle } from "./seats.js";
import { botMove } from "./rack-bot.js";

export const SIZE = 15, CELLS = SIZE * SIZE, CENTER = 112, HAND = 7, BINGO = 50, SCORELESS = 6;

export const COUNTS = { A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4, M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1, "?": 2 };
export const VALUES = { A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10, "?": 0 };
/** What a tile counts: a blank standing as a letter (lower case) nothing. */
export const valueOf = ch => VALUES[ch] ?? 0;
/** The whole bag, a tile each. */
export const fullBag = () => Object.entries(COUNTS).flatMap(([ch, n]) => Array(n).fill(ch));

// The premium squares, W/w: triple/double word, L/l: triple/double letter, * the star (a double word).
const ROWS = [
  "W..l...W...l..W", ".w...L...L...w.", "..w...l.l...w..", "l..w...l...w..l", "....w.....w....",
  ".L...L...L...L.", "..l...l.l...l..", "W..l...*...l..W",
  "..l...l.l...l..", ".L...L...L...L.", "....w.....w....", "l..w...l...w..l", "..w...l.l...w..", ".w...L...L...w.", "W..l...W...l..W",
];
export const premiumAt = i => ROWS[(i / SIZE) | 0][i % SIZE];

// ---------- the word list ----------
// The two-letter words (Collins), which SCOWL leaves out (it keeps words of three letters and up), and short words it lacks
// that every word-game player knows.
export const TWO = new Set(("aa ab ad ae ag ah ai al am an ar as at aw ax ay ba be bi bo by ch da de di do ea ed ee ef eh el em en er es ew ex fa fe fy " +
  "gi go gu ha he hi hm ho id if in io is it ja jo ka ki ko ky la li lo ma me mi mm mo mu my na ne no nu ny ob od oe of oh oi ok om on oo op or os ou ow ox oy " +
  "pa pe pi po qi re sh si so st ta te ti to ug uh um un up ur us ut we wo xi xu ya ye yo yu za ze zo").split(" "));
export const EXTRA = new Set("aal gox jeu oxo oxy pht qat qin qis syn tsk vox yex zax zea zzz".split(" "));
/** Whether a word (any case) may be played. */
export function isPlay(word) {
  const w = String(word).toLowerCase();
  return w.length === 2 ? TWO.has(w) : EXTRA.has(w) || isWord(w);
}

// ---------- a play ----------
const prev = (i, step) => (step === 1 ? (i % SIZE ? i - 1 : -1) : i >= SIZE ? i - SIZE : -1);
const next = (i, step) => (step === 1 ? (i % SIZE < SIZE - 1 ? i + 1 : -1) : i < CELLS - SIZE ? i + SIZE : -1);
export const isEmptyBoard = board => !/[A-Za-z]/.test(board);

/**
 * What laying `put` on `board` makes: { score, words: [{ word, score }], cells, bingo }, or { error } in words. `put` is
 * [[square, letter]…], a capital for a tile and a lower-case letter for a blank. `dict` says what a word is (null: no
 * test, for a computer player whose words are known good); the rack isn't looked at here.
 */
export function evaluate(board, put, dict = isPlay) {
  if (!put.length) return { error: "Lay at least one tile" };
  const cells = new Map();
  for (const [i, ch] of put) {
    if (!Number.isInteger(i) || i < 0 || i >= CELLS) return { error: "That square isn't on the board" };
    if (typeof ch !== "string" || !/^[A-Za-z]$/.test(ch)) return { error: "That isn't a letter" };
    if (board[i] !== ".") return { error: "That square already has a tile" };
    if (cells.has(i)) return { error: "Two tiles on one square" };
    cells.set(i, ch);
  }
  const keys = [...cells.keys()].sort((a, b) => a - b);
  const rows = new Set(keys.map(i => (i / SIZE) | 0)), cols = new Set(keys.map(i => i % SIZE));
  if (rows.size > 1 && cols.size > 1) return { error: "Lay the tiles in one row or one column" };
  const at = i => cells.get(i) ?? (board[i] !== "." ? board[i] : null);
  if (keys.length > 1) {
    const step = rows.size === 1 ? 1 : SIZE;
    for (let i = keys[0]; i <= keys[keys.length - 1]; i += step) if (at(i) == null) return { error: "The tiles must make one word, with no gap" };
  }
  // every word of two letters or more that a new tile is part of, along the row and the column
  const found = new Map();
  let joins = false;
  for (const i of keys) {
    for (const step of [1, SIZE]) {
      let a = i, b = i;
      for (let p; (p = prev(a, step)) >= 0 && at(p) != null;) a = p;
      for (let n; (n = next(b, step)) >= 0 && at(n) != null;) b = n;
      if (a === b) continue;
      const key = `${step}:${a}`;
      if (found.has(key)) continue;
      let text = "", sum = 0, mult = 1;
      for (let j = a; j <= b; j += step) {
        const ch = at(j);
        text += ch.toUpperCase();
        let v = valueOf(ch);
        if (cells.has(j)) {
          const p = premiumAt(j);
          if (p === "L") v *= 3; else if (p === "l") v *= 2; else if (p === "W") mult *= 3; else if (p === "w" || p === "*") mult *= 2;
        } else joins = true;
        sum += v;
      }
      found.set(key, { word: text, score: sum * mult });
    }
  }
  if (!found.size) return { error: "A word needs at least two letters" };
  if (isEmptyBoard(board)) {
    if (!cells.has(CENTER)) return { error: "The first word covers the star" };
  } else if (!joins) return { error: "The word must join the tiles on the board" };
  const words = [...found.values()];
  if (dict) for (const w of words) if (!dict(w.word)) return { error: `${w.word} isn't in the word list`, word: w.word };
  const bingo = cells.size === HAND;
  return { score: words.reduce((n, w) => n + w.score, 0) + (bingo ? BINGO : 0), words, cells: keys, bingo };
}

// ---------- the game ----------
const sumOf = rack => [...rack].reduce((n, ch) => n + valueOf(ch), 0);
const upper = ch => (ch === ch.toLowerCase() ? "?" : ch);               // the tile a placed letter is made from

/** The game over: leftover tiles settled, the winners named. */
function finish(s, out) {
  const left = s.racks.map(sumOf), adj = left.map(v => -v);
  if (out >= 0) adj[out] = left.reduce((n, v, i) => (i === out ? n : n + v), 0);
  const totals = s.scores.map((v, i) => v + adj[i]), best = Math.max(...totals);
  s.final = { adj, left, totals, out };
  s.scores = totals;
  s.winners = totals.flatMap((v, i) => (v === best ? [i] : []));
  s.step = "over";
  const w = s.winners.map(i => `{s${i}}`).join(" and ");
  s.say = s.winners.length === s.seats ? `Level: ${best} each.` : `Game to ${w}, ${best}${s.seats === 2 ? ` to ${Math.min(...totals)}` : ""}.`;
  return s;
}

/** A turn spent without laying a word. */
function scoreless(s, seat, last, say) {
  s.passes = (s.passes || 0) + 1;
  s.last = { seat, ...last };
  s.moves++;
  if (s.passes >= SCORELESS) {
    const done = finish(s, -1);
    done.say = `Six turns without a word. ${done.say}`;
    return done;
  }
  s.turn = (seat + 1) % s.seats;
  s.say = say;
  return s;
}

function lay(s, seat, put) {
  const rack = [...s.racks[seat]];
  for (const [, ch] of put) {
    const k = rack.indexOf(upper(String(ch)));
    if (k < 0) return upper(String(ch)) === "?" ? "You have no blank" : `You don't have a ${String(ch).toUpperCase()}`;
    rack.splice(k, 1);
  }
  const r = evaluate(s.board, put);
  if (r.error) return r.error;
  const board = [...s.board];
  for (const [i, ch] of put) board[i] = ch;
  s.board = board.join("");
  const draw = Math.min(put.length, s.bag.length);
  s.racks[seat] = rack.join("") + s.bag.slice(0, draw);
  s.bag = s.bag.slice(draw);
  s.scores[seat] += r.score;
  s.passes = 0;
  s.moves++;
  s.last = { seat, did: "play", score: r.score, words: r.words.map(w => w.word), cells: r.cells };
  if (r.bingo) s.last.bingo = true;
  const main = r.words[0].word.toLowerCase();
  if (!s.racks[seat]) {
    const done = finish(s, seat);
    done.say = `{s${seat}} plays ${main} for ${r.score} and goes out. ${done.say}`;
    return done;
  }
  s.turn = (seat + 1) % s.seats;
  s.say = `{s${seat}} plays ${main} for ${r.score}${r.bingo ? ", using all seven tiles" : ""}.`;
  return s;
}

function swap(s, seat, tiles, rng) {
  if (s.bag.length < HAND) return "The bag holds fewer than seven tiles: no swapping now";
  const rack = [...s.racks[seat]], out = [...String(tiles ?? "")];
  if (!out.length) return "Pick the tiles to swap";
  for (const ch of out) {
    const k = rack.indexOf(ch);
    if (k < 0) return "You don't have those tiles";
    rack.splice(k, 1);
  }
  const fresh = s.bag.slice(0, out.length);
  s.racks[seat] = rack.join("") + fresh;
  s.bag = shuffle([...s.bag.slice(out.length), ...out], rng).join("");
  return scoreless(s, seat, { did: "swap", n: out.length }, `{s${seat}} swaps ${out.length} ${out.length === 1 ? "tile" : "tiles"}.`);
}

function restore(s) {
  s.bag ??= "";
  s.racks = Array.from({ length: s.seats }, (_, i) => s.racks?.[i] ?? "");
  s.scores = Array.from({ length: s.seats }, (_, i) => s.scores?.[i] ?? 0);
  s.passes ??= 0;
  if (s.last && s.last.did === "play") { s.last.words ??= []; s.last.cells ??= []; }
  if (s.final) {
    for (const k of ["adj", "left", "totals"]) s.final[k] = Array.from({ length: s.seats }, (_, i) => s.final[k]?.[i] ?? 0);
    s.winners = s.winners ?? [];
  }
  return s;
}

export const rules = {
  id: "rack",
  seats: { min: 2, max: 4 },

  deal({ seats, rng, prev }) {
    const bag = shuffle(fullBag(), rng).join(""), racks = [];
    for (let i = 0; i < seats; i++) racks.push(bag.slice(i * HAND, (i + 1) * HAND));
    const first = Number.isInteger(prev?.first) ? (prev.first + 1) % seats : Math.floor(rng() * seats);
    const s = { seats, board: ".".repeat(CELLS), bag: bag.slice(seats * HAND), racks, scores: new Array(seats).fill(0), turn: first, first, passes: 0, moves: 0, step: "play" };
    s.say = `{s${first}} goes first.`;
    return s;
  },

  toMove: s => (s.step === "play" ? s.turn : null),

  act(s, seat, m, { rng }) {
    if (s.step !== "play") return "The game is over";
    if (seat !== s.turn) return "It isn't your turn";
    if (m?.t === "play") return lay(s, seat, Array.isArray(m.put) ? m.put.map(p => [p?.[0], p?.[1]]) : []);
    if (m?.t === "swap") return swap(s, seat, m.tiles, rng);
    if (m?.t === "pass") return scoreless(s, seat, { did: "pass" }, `{s${seat}} passes.`);
    return "Lay a word, swap tiles or pass";
  },

  bot: (s, seat, ctx) => botMove(s, seat, ctx),

  over: s => s.step === "over",
  restore,
};
