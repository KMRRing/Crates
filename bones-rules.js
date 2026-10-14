// Bones: dominoes on seats.js, three games of the double-six set (pagat.com's rules). Partnership, the block game of
// Latin America and the Caribbean: four in two partnerships, seven tiles each, the side that goes out (or holds fewer
// pips when the line is blocked) scoring the other side's pips, to 100. Gaple, Indonesia's: four each for themselves,
// seven each, the hand won by the lowest count of pips left, every player paying every other the difference. Fives and
// Threes, the English pub game: two to four (four in partnerships), five or seven each and the rest out of play, every
// tile scored on the ends it leaves, multiples of five and of three, to exactly 61.
//
// A tile is its index in TILES ([a, b], a ≤ b). The line is the first tile and two arms: `left` and `right`, each the
// tiles laid on that side in turn, with the number each leaves open. Seats play in turn (seat + 1 next); the page sets
// them out the game's way round (Partnership and Gaple to the right, Fives and Threes to the left). The computer players
// are bones-bot.js's.
import { botMove } from "./bones-bot.js";

export const TILES = [];
for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) TILES.push([a, b]);
export const idOf = (a, b) => TILES.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));
export const pipsOf = t => TILES[t][0] + TILES[t][1];
export const isDouble = t => TILES[t][0] === TILES[t][1];
export const hasValue = (t, v) => TILES[t][0] === v || TILES[t][1] === v;
/** The number a tile leaves open when its `v` side is laid against an end. */
export const otherEnd = (t, v) => (TILES[t][0] === v ? TILES[t][1] : TILES[t][0]);

export const HAND_MS = 4600;             // a hand's result, shown before the next deal
const shuffle = (list, rng) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/**
 * The games: seats, whether two partnerships play, the way round, each game's options (and their defaults), and how
 * many tiles a hand gets.
 */
export const GAMES = {
  partnership: { id: "partnership", name: "Partnership", seats: [4], ccw: true, defaults: { target: 100, count: "losers" } },
  gaple: { id: "gaple", name: "Gaple", seats: [4], ccw: true, defaults: { deals: 8, stuck: "pass", blank25: false } },
  fives: { id: "fives", name: "Fives and Threes", seats: [2, 3, 4], ccw: false, defaults: { target: 61, deal: "pub", players: 4 } },
};
export const TARGETS = { partnership: [100, 150, 200], fives: [31, 61, 121] };
export const DEALS = [4, 8, 12];
/** Tiles a hand: seven in the block games; in Fives and Threes five (seven for two), or the championship's nine for two and six for four. */
export function handSize(game, n, opts = {}) {
  if (game !== "fives") return 7;
  if (opts.deal === "championship") return { 2: 9, 3: 5, 4: 6 }[n];
  return { 2: 7, 3: 5, 4: 5 }[n];
}
export const teamsOf = s => s.game === "partnership" || (s.game === "fives" && s.seats === 4);
export const teamOf = seat => seat % 2;
/** Fives and Threes: a point for each five and each three the ends add up to (15 is three fives and five threes: 8). */
export const fivesPoints = total => (total > 0 && total % 5 === 0 ? total / 5 : 0) + (total > 0 && total % 3 === 0 ? total / 3 : 0);

// ---------- the line ----------
/** The two open ends: their numbers and whether each is a double laid crosswise (which counts both halves). */
export function endsOf(s) {
  if (s.first == null) return null;
  const [a, b] = s.firstSides;
  const L = s.left.length ? s.left.at(-1).v : a, R = s.right.length ? s.right.at(-1).v : b;
  const Ld = s.left.length ? isDouble(s.left.at(-1).t) : isDouble(s.first);
  const Rd = s.right.length ? isDouble(s.right.at(-1).t) : isDouble(s.first);
  return { L, R, Ld, Rd };
}
/** What the ends add up to for Fives and Threes: a double at an end counts both halves; a lone first tile its pips. */
export function endsTotal(s) {
  const e = endsOf(s);
  if (!e) return 0;
  if (!s.left.length && !s.right.length) return pipsOf(s.first);
  return (e.Ld ? 2 * e.L : e.L) + (e.Rd ? 2 * e.R : e.R);
}
/** Every play a seat may make: { t: "play", tile, end } ("L" or "R"; the first tile "L"); none means knock. */
export function legalPlays(s, seat) {
  const hand = s.hands[seat], out = [];
  if (s.first == null) {
    for (const t of hand) if (!s.must || s.must.tiles.includes(t)) out.push({ t: "play", tile: t, end: "L" });
    return out;
  }
  const e = endsOf(s);
  for (const t of hand) {
    if (hasValue(t, e.L)) out.push({ t: "play", tile: t, end: "L" });
    if (hasValue(t, e.R)) out.push({ t: "play", tile: t, end: "R" });
  }
  return out;
}
/** A hand's pips, Gaple's lone double blank counting 25 when that's played. */
export function handPips(s, seat) {
  const tiles = [...s.hands[seat], ...(s.dead?.[seat] || [])];
  let sum = tiles.reduce((a, t) => a + pipsOf(t), 0);
  if (s.game === "gaple" && s.opts.blank25 && tiles.includes(0) && !tiles.some(t => t !== 0 && hasValue(t, 0))) sum += 25;
  return sum;
}

// ---------- a deal ----------
function newHand(s, rng) {
  const n = s.seats, size = handSize(s.game, n, s.opts), pack = shuffle(TILES.map((_, i) => i), rng);
  s.handNo++;
  s.hands = Array.from({ length: n }, (_, i) => pack.slice(i * size, (i + 1) * size).sort((a, b) => a - b));
  s.boneyard = pack.slice(n * size);                    // Fives and Threes: out of play, face down
  s.dead = Array.from({ length: n }, () => []);
  s.first = null; s.firstSides = null; s.left = []; s.right = [];
  s.passes = 0; s.out = []; s.log = [];
  delete s.must; delete s.result; delete s.until;
  s.step = "play";
  const holder = t => s.hands.findIndex(h => h.includes(t));
  if (s.game === "partnership") {
    // the first deal is led with the double six by whoever holds it; then the lead passes on, any tile
    if (s.handNo === 1) { s.turn = holder(27); s.must = { seat: s.turn, tiles: [27] }; }
    else s.turn = (s.starter + 1) % n;
  } else if (s.game === "gaple") {
    // the first hand opens with the double blank; then the last hand's winner leads a double, or the next who has one
    if (s.handNo === 1) { s.turn = holder(0); s.must = { seat: s.turn, tiles: [0] }; }
    else {
      let p = s.lastWinner ?? 0;
      for (let k = 0; k < n && !s.hands[p].some(isDouble); k++) p = (p + 1) % n;
      s.turn = p;
      s.must = { seat: p, tiles: s.hands[p].filter(isDouble) };
    }
  } else s.turn = s.handNo === 1 ? Math.floor(rng() * n) : (s.starter + 1) % n;    // by lot, then to the left
  s.starter = s.turn;
}

export const rules = {
  id: "bones",
  seats: { min: 2, max: 4 },

  deal({ seats, options = {}, rng }) {
    const g = GAMES[options.game] || GAMES.partnership;
    const n = g.seats.includes(seats) ? seats : g.seats.includes(options.players) ? options.players : g.seats.at(-1);
    const opts = { ...g.defaults, ...options, game: g.id };
    const s = { game: g.id, seats: n, opts, handNo: 0, starter: 0, history: [] };
    s.scores = Array(teamsOf(s) ? 2 : n).fill(0);
    newHand(s, rng);
    s.say = `${g.name}: {s${s.turn}} to lead${s.must ? ` the ${s.must.tiles[0] === 27 ? "double six" : "double blank"}` : ""}.`;
    return s;
  },

  toMove: s => (s.step === "play" ? s.turn : null),

  act(s, seat, m, { rng, now }) {
    if (rules.toMove(s) !== seat) return "It isn't your turn";
    const plays = legalPlays(s, seat);
    if (m?.t === "pass") {
      if (plays.length) return "You can play, so you must";
      if (s.game === "gaple" && s.opts.stuck === "discard") return "Lay a tile face down";
      const e = endsOf(s);
      s.log.push({ seat, pass: true, ends: [e.L, e.R] });
      s.passes++;
      s.say = `${s.game === "fives" ? "A knock" : "A pass"} from {s${seat}}.`;
      return afterTurn(s, seat, rng, now);
    }
    if (m?.t === "discard") {
      if (s.game !== "gaple" || s.opts.stuck !== "discard") return "Knock instead";
      if (plays.length) return "You can play, so you must";
      if (!s.hands[seat].includes(m.tile)) return "That tile isn't yours";
      const e = endsOf(s);
      s.hands[seat] = s.hands[seat].filter(t => t !== m.tile);
      s.dead[seat].push(m.tile);
      s.log.push({ seat, pass: true, dead: true, ends: [e.L, e.R] });
      s.passes++;
      s.say = `A tile face down from {s${seat}}.`;
      return afterTurn(s, seat, rng, now);
    }
    if (m?.t !== "play" || !plays.some(p => p.tile === m.tile && (s.first == null || p.end === m.end))) {
      if (s.must && s.first == null) return s.must.tiles.length === 1 ? `Lead the ${s.must.tiles[0] === 27 ? "double six" : "double blank"}` : "Lead a double";
      return "That tile doesn't go there";
    }
    place(s, m.tile, s.first == null ? "L" : m.end);
    s.hands[seat] = s.hands[seat].filter(t => t !== m.tile);
    s.passes = 0;
    const entry = { seat, tile: m.tile, end: s.first === m.tile && !s.left.length && !s.right.length ? "F" : m.end };
    delete s.say;
    if (s.game === "fives") {
      const total = endsTotal(s), pts = fivesPoints(total);
      entry.total = total;
      if (pts) {
        entry.pts = gain(s, seat, pts);
        const said = entry.pts ? `${total}: ${pts} for {s${seat}}.` : `${total}, but ${pts} would take {s${seat}} past ${s.opts.target}.`;
        s.say = s.step === "over" ? `${said} ${s.say}` : said;     // the game won on it: both said
      }
    }
    s.log.push(entry);
    if (s.step === "over") return s;
    if (!s.hands[seat].length) {
      s.out.push(seat);
      if (s.game !== "fives" || !teamsOf(s) || s.out.some(p => p !== seat && teamOf(p) === teamOf(seat))) return endHand(s, { domino: seat }, now);
      s.say = `Out: {s${seat}}.`;
    }
    return afterTurn(s, seat, rng, now);
  },

  bot: (s, seat, { level, rng }) => botMove(s, seat, level, rng),
  over: s => s.step === "over",
  wakeAt: s => (s.step === "scored" ? s.until : null),

  wake(s, { rng }) {
    if (s.step !== "scored") return null;
    newHand(s, rng);
    s.say = `{s${s.turn}} to lead${s.must ? " a double" : ""}.`;
    return s;
  },

  restore(s) {
    const list = v => (v ? Object.values(v) : []);
    const fill = (v, n, d = 0) => Array.from({ length: n }, (_, i) => v?.[i] ?? d);
    const sides = teamsOf(s) ? 2 : s.seats;
    s.hands = Array.from({ length: s.seats }, (_, i) => list(s.hands?.[i]));
    s.dead = Array.from({ length: s.seats }, (_, i) => list(s.dead?.[i]));
    s.left = list(s.left);
    s.right = list(s.right);
    s.boneyard = list(s.boneyard);
    s.out = list(s.out);
    s.log = list(s.log).map(l => (l.ends ? { ...l, ends: list(l.ends) } : l));
    s.scores = fill(s.scores, sides);
    s.history = list(s.history).map(h => ({ ...h, delta: fill(h.delta, sides) }));
    if (s.first === undefined) s.first = null;
    if (s.firstSides) s.firstSides = list(s.firstSides);
    if (s.must) s.must = { ...s.must, tiles: list(s.must.tiles) };
    if (s.winners) s.winners = list(s.winners);
    if (s.result) {
      const r = s.result;
      r.pips = fill(r.pips, s.seats);
      r.hands = Array.from({ length: s.seats }, (_, i) => list(r.hands?.[i]));
      r.delta = fill(r.delta, sides);
      if (r.side) r.side = fill(r.side, 2);
    }
    return s;
  },
};

/** A tile laid at an end (or as the first, its sides as dealt). */
function place(s, t, end) {
  if (s.first == null) { s.first = t; s.firstSides = [...TILES[t]]; delete s.must; return; }
  const e = endsOf(s);
  if (end === "L") s.left.push({ t, v: otherEnd(t, e.L) });
  else s.right.push({ t, v: otherEnd(t, e.R) });
}

/** Points scored in Fives and Threes, to a player or their side: none if it would pass the target; the target exactly wins. */
function gain(s, seat, pts) {
  const k = teamsOf(s) ? teamOf(seat) : seat;
  if (s.scores[k] + pts > s.opts.target) return 0;
  s.scores[k] += pts;
  if (s.scores[k] === s.opts.target) finish(s, k);
  return pts;
}

/** The next to play, or the hand blocked (everyone with tiles has passed in a row). */
function afterTurn(s, seat, rng, now) {
  const active = s.hands.map((h, i) => i).filter(i => !s.out.includes(i));
  if (s.passes >= active.length) return endHand(s, { blocked: true }, now);
  let p = seat;
  do p = (p + 1) % s.seats; while (s.out.includes(p));
  s.turn = p;
  return s;
}

/** A hand's end: who won it and what it scores, shown a moment before the next deal (or the end of the game). */
function endHand(s, how, now) {
  const n = s.seats, pips = Array.from({ length: n }, (_, i) => handPips(s, i));
  const r = { how: how.blocked ? "blocked" : "domino", by: how.domino ?? null, pips, hands: s.hands.map(h => h.slice()) };
  if (s.game === "partnership") {
    const side = t => pips[t] + pips[t + 2];
    let win = how.blocked ? (side(0) < side(1) ? 0 : side(1) < side(0) ? 1 : -1) : teamOf(how.domino);
    r.team = win;
    r.delta = [0, 0];
    if (win >= 0) {
      r.delta[win] = s.opts.count === "all" ? side(0) + side(1) : side(1 - win);
      s.scores[win] += r.delta[win];
    }
    r.side = [side(0), side(1)];
  } else if (s.game === "gaple") {
    // the lowest count wins; a tie goes to the holder of the lowest tile, then the lowest end of it
    const low = p => { const ts = [...s.hands[p], ...s.dead[p]]; if (!ts.length) return [-1, -1]; const t = ts.reduce((a, b) => (pipsOf(b) < pipsOf(a) || (pipsOf(b) === pipsOf(a) && Math.min(...TILES[b]) < Math.min(...TILES[a])) ? b : a)); return [pipsOf(t), Math.min(...TILES[t])]; };
    const order = [...Array(n).keys()].sort((a, b) => pips[a] - pips[b] || low(a)[0] - low(b)[0] || low(a)[1] - low(b)[1]);
    const win = order[0], sum = pips.reduce((a, b) => a + b, 0);
    r.winner = win;
    r.delta = pips.map(p => sum - n * p);                  // each pays every other the difference
    r.delta.forEach((d, i) => { s.scores[i] += d; });
    s.lastWinner = win;
  } else {
    // Fives and Threes: a point for going out (both of a side, in partnerships); none when blocked
    r.delta = Array(s.scores.length).fill(0);
    if (!how.blocked) {
      const k = teamsOf(s) ? teamOf(how.domino) : how.domino;
      r.go = gain(s, how.domino, 1);
      r.delta[k] = r.go;
    }
  }
  s.history.push({ hand: s.handNo, how: r.how, delta: r.delta.slice() });
  s.result = r;
  if (s.step === "over") return s;
  const done = gameDone(s);
  if (done) { finish(s, done.k ?? null, done.winners); return s; }
  s.step = "scored";
  s.until = now + HAND_MS;
  s.say = handLine(s, r);
  return s;
}
function gameDone(s) {
  if (s.game === "partnership") {
    const best = Math.max(...s.scores);
    if (best >= s.opts.target && s.scores[0] !== s.scores[1]) return { k: s.scores.indexOf(best) };
    return null;
  }
  if (s.game === "gaple" && s.handNo >= s.opts.deals) {
    const best = Math.max(...s.scores);
    return { winners: s.scores.map((v, i) => (v === best ? i : -1)).filter(i => i >= 0) };
  }
  return null;
}
/** The game over: the side or the players that won. */
function finish(s, k, winners = null) {
  s.step = "over";
  delete s.until;
  if (winners) s.winners = winners;
  else s.winners = teamsOf(s) ? [k, k + 2].filter(p => p < s.seats) : [k];
  const names = s.winners.map(w => `{s${w}}`).join(" and ");
  s.say = s.game === "fives" ? `${s.opts.target} exactly: the game to ${names}.`
    : s.game === "gaple" ? `After ${s.handNo} deals, the game to ${names}.`
      : `The game to ${names}, ${s.scores[teamOf(s.winners[0])]} to ${s.scores[1 - teamOf(s.winners[0])]}.`;
}
function handLine(s, r) {
  if (s.game === "partnership") {
    if (r.team < 0) return `Blocked, and level at ${r.side[0]} each: no score.`;
    const who = `{s${r.team}} and {s${r.team + 2}}`;
    return `${r.how === "blocked" ? `Blocked: ${who} hold fewer` : `Out: {s${r.by}}. ${who} win the hand`}, ${r.delta[r.team]} points.`;
  }
  if (s.game === "gaple") return `${r.how === "blocked" ? "Blocked" : `Out: {s${r.by}}`}. The hand to {s${r.winner}}.`;
  return r.how === "blocked" ? "Blocked: no point for going out." : `Out: {s${r.by}}${teamsOf(s) ? " and partner" : ""}${r.go ? ", for a point" : ""}.`;
}
