// Gammon: backgammon for two, on seats.js (solo against the computer, or at a table with a friend). A match to 1, 3, 5
// or 7 points, with the doubling cube if you like (the Crawford rule in the game after someone reaches a point short).
// The board and its moves are gammon-board.js's (each side's checkers counted in its own numbering).
import { start, plays, kindOf, won } from "./gammon-board.js";
import { botTurn, botCube, botTake } from "./gammon-bot.js";

export { start, plays, singles, apply, pips, kindOf } from "./gammon-board.js";
export const MATCHES = [1, 3, 5, 7];
export const SHOW_MS = 1300;                    // the dice of a turn with no move, shown before it passes
export const OVER_MS = 2600;                    // a game's end, shown before the next
/** Whether the side to roll may offer the cube. */
export const mayDouble = (s, seat) => s.cubeOn && !s.crawford && s.cube < 64 && (s.owner === -1 || s.owner === seat) && s.score[seat] + s.cube < s.match;

const other = s => 1 - s;
/** A roll of two dice. */
const roll = rng => [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)];

/** A new game in the match: the checkers set up, the opening roll (each a die, the higher moving first with both). */
function newGame(s, rng, now) {
  s.pos = [start(), start()];
  s.cube = 1;
  s.owner = -1;
  s.ply = 0;
  s.game = (s.game || 0) + 1;
  let a, b;
  do { a = 1 + Math.floor(rng() * 6); b = 1 + Math.floor(rng() * 6); } while (a === b);
  s.opening = [a, b];
  s.turn = a > b ? 0 : 1;
  s.dice = [Math.max(a, b), Math.min(a, b)];
  delete s.result; delete s.last; delete s.until;
  s.say = `Game ${s.game}: {s0} rolls ${a}, {s1} ${b}. {s${s.turn}} moves first.`;
  return inHand(s, now);
}
/** The turn's dice, in hand: the play to make, or a turn that can't move, shown and then passed. */
function inHand(s, now) {
  s.step = "move";
  const legal = plays(s.pos[s.turn], s.pos[other(s.turn)], s.dice);
  if (!legal[0].moves.length) { s.step = "blocked"; s.until = now + SHOW_MS; }
  return s;
}
/** The next player's turn: the cube offered first if they may, else the dice. */
function nextTurn(s, rng, now) {
  s.turn = other(s.turn);
  s.dice = [];
  if (mayDouble(s, s.turn)) { s.step = "roll"; return s; }
  s.dice = roll(rng);
  return inHand(s, now);
}
/** A game over: its points to the winner, the match on, or over. */
function endGame(s, winner, kind, now, dropped = false) {
  const points = s.cube * (dropped ? 1 : kind);
  s.score[winner] += points;
  s.result = { winner, kind: dropped ? 0 : kind, points };
  const what = dropped ? "the cube dropped" : kind === 3 ? "a backgammon" : kind === 2 ? "a gammon" : "a single game";
  s.say = `{s${winner}} wins ${what}: ${points} ${points === 1 ? "point" : "points"}.`;
  if (s.score[winner] >= s.match) {
    s.step = "over";
    s.winners = [winner];
    s.say += s.match > 1 ? ` {s${winner}} wins the match, ${s.score[winner]} to ${s.score[other(winner)]}.` : "";
    delete s.until;
    return s;
  }
  // the Crawford game: the one after someone first comes within a point of the match, played without the cube
  const crawfordNow = s.cubeOn && !s.crawfordDone && s.score[winner] === s.match - 1;
  s.crawford = false;
  if (crawfordNow) { s.crawford = true; s.crawfordDone = true; }
  s.step = "gameover";
  s.until = now + OVER_MS;
  return s;
}

export const rules = {
  id: "gammon",
  seats: { min: 2, max: 2 },

  deal({ options = {}, rng, now }) {
    const match = MATCHES.includes(Number(options.match)) ? Number(options.match) : 3;
    const s = { seats: 2, match, cubeOn: options.cube !== false && match > 1, score: [0, 0], crawford: false, crawfordDone: false };
    newGame(s, rng, now);
    if (match > 1) s.say = `A match to ${match}. ${s.say}`;
    return s;
  },

  toMove: s => (s.step === "roll" || s.step === "move" ? s.turn : s.step === "take" ? other(s.turn) : null),

  act(s, seat, m, { rng, now }) {
    if (rules.toMove(s) !== seat) return "It isn't your turn";
    if (s.step === "roll") {
      if (m?.t === "double") {
        if (!mayDouble(s, seat)) return "You can't double now";
        s.step = "take";
        s.say = `{s${seat}} doubles to ${s.cube * 2}.`;
        return s;
      }
      if (m?.t !== "roll") return "Roll, or double";
      s.dice = roll(rng);
      return inHand(s, now);
    }
    if (s.step === "take") {
      if (m?.t === "take") {
        s.cube *= 2;
        s.owner = seat;
        s.say = `{s${seat}} takes: the cube is on ${s.cube}.`;
        s.dice = roll(rng);
        return inHand(s, now);
      }
      if (m?.t === "drop") return endGame(s, s.turn, 1, now, true);
      return "Take, or drop";
    }
    if (s.step !== "move" || m?.t !== "play" || !Array.isArray(m.moves)) return "Make your move";
    const me = s.pos[seat], op = s.pos[other(seat)];
    const legal = plays(me, op, s.dice);
    const want = m.moves.map(x => `${x[0]}>${x[1]}`).join(" ");
    const play = legal.find(p => p.moves.map(x => `${x[0]}>${x[1]}`).join(" ") === want);
    if (!play) return "That isn't a legal play";
    s.pos[seat] = play.me;
    s.pos[other(seat)] = play.op;
    s.ply++;
    s.last = { seat, dice: s.dice.slice(), moves: play.moves.map(x => [x[0], x[1]]), ply: s.ply, game: s.game };
    delete s.say;
    if (won(play.me)) return endGame(s, seat, kindOf(play.me, play.op), now);
    return nextTurn(s, rng, now);
  },

  bot(s, seat, { level, rng }) {
    if (s.step === "roll") return { t: botCube(s, seat, level) ? "double" : "roll" };
    if (s.step === "take") return { t: botTake(s, seat, level) ? "take" : "drop" };
    return { t: "play", moves: botTurn(s.pos[seat], s.pos[other(seat)], s.dice, { level, rng }) };
  },

  over: s => s.step === "over",
  wakeAt: s => (s.step === "blocked" || s.step === "gameover" ? s.until : null),

  wake(s, { rng, now }) {
    if (s.step === "blocked") {
      s.ply++;
      s.last = { seat: s.turn, dice: s.dice.slice(), moves: [], ply: s.ply, game: s.game };
      s.say = `{s${s.turn}} can't move.`;
      delete s.until;
      return nextTurn(s, rng, now);
    }
    if (s.step === "gameover") return newGame(s, rng, now);
    return null;
  },

  restore(s) {
    const arr = a => Array.from({ length: 26 }, (_, i) => a?.[i] || 0);
    s.pos = [arr(s.pos?.[0]), arr(s.pos?.[1])];
    s.score = [0, 1].map(i => s.score?.[i] || 0);
    s.dice = s.dice ? Object.values(s.dice) : [];
    s.opening = s.opening ? Object.values(s.opening) : [];
    if (s.last) { s.last.dice = s.last.dice ? Object.values(s.last.dice) : []; s.last.moves = s.last.moves ? Object.values(s.last.moves).map(x => Object.values(x)) : []; }
    if (s.winners) s.winners = Object.values(s.winners);
    return s;
  },
};
