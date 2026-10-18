// Factor's rules, a seats.js game (deal, toMove, act, bot, over, restore): the island trading game of the genre Catan made
// and Colonist plays in a browser, three or four at a table, the names and the art ours. You are a factor, a merchant's
// agent on a new coast: you found posts at the corners of the land, upgrade them to factories, join them with roads, and
// the number rolled each turn pays whoever stands at a hex with it. First to ten points on their own turn wins.
//
// A game is a state, a plain object kept as JSON (no Maps, no empty lists the database would drop: restore() makes
// it whole). The board is the arrays kind, num, ports (factor-board.js), the pieces vo, vl and eo: who holds each corner
// (seat + 1, 0 for nobody) and how big it is (1 a post, 2 a factory), and who holds each road. Each seat's hand is five
// counts, in RES order: timber, clay, wool, grain, iron. Anyone can read every hand in the state (as in every seat game
// here); the page and the computer players look only at what their seat may see.
//
// Steps: setup (the snake: each seat in turn a post and a road, then back the other way, the second post paying out
// the land round it), roll, main (build, buy, trade, play a card, end), discard (after a 7, each who holds eight or more
// gives up half), blockade (move it) and steal (from whom), causeway (two free roads), offer (the others answer one by one)
// and pick (the proposer chooses among those who said yes), over.
import { RES, HEXES, VERTS, EDGES, PORT_AT, makeBoard, otherEnd, portVerts } from "./factor-board.js";
import { shuffle } from "./seats.js";
import { botMove } from "./factor-bot.js";

export const COSTS = { road: [1, 1, 0, 0, 0], post: [1, 1, 1, 1, 0], factory: [0, 0, 0, 2, 3], dev: [0, 0, 1, 1, 1] };
export const PIECES = { road: 15, post: 5, factory: 4 };
export const SUPPLY = 19;                                         // of each resource, in the bank
export const TARGETS = [8, 10, 12];
export const DEFAULTS = { vp: 10, seats: 4 };
/** The development deck: privateers move the blockade (and, three played, make the largest fleet), patents are a hidden point. */
export const DEVS = { privateer: 14, patent: 5, causeway: 2, windfall: 2, corner: 2 };
export const CARD_NAMES = { privateer: "Privateer", patent: "Patent", causeway: "Causeway", windfall: "Windfall", corner: "Corner" };
export const CARD_TEXT = {
  privateer: "Move the blockade and take a card from someone it now sits beside. Three played is the largest fleet, 2 points.",
  patent: "A point, kept hidden until it wins.",
  causeway: "Build two roads for nothing.",
  windfall: "Take any two resources from the bank.",
  corner: "Name a resource: every other player gives you all they hold of it.",
};
export const MAX_OFFERS = 4;                                      // a turn's offers to the table: enough to haggle, not to stall
const sum = a => a.reduce((t, x) => t + x, 0);
const clone = v => JSON.parse(JSON.stringify(v));
const names = n => ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"][n] || String(n);

// ---------- the pieces, counted ----------
export const cards = (s, seat) => sum(s.hand[seat]);
export const bankOf = (s, r) => SUPPLY - s.hand.reduce((t, h) => t + h[r], 0);
export const has = (hand, cost) => cost.every((c, i) => hand[i] >= c);
export const piecesLeft = (s, seat) => {
  let road = PIECES.road, post = PIECES.post, factory = PIECES.factory;
  for (const o of s.eo) if (o === seat + 1) road--;
  for (let v = 0; v < s.vo.length; v++) if (s.vo[v] === seat + 1) { if (s.vl[v] === 2) { factory--; } else post--; }
  return { road, post, factory };
};
/** Who sits round the table, from `from` clockwise. */
export const roundFrom = (s, from) => Array.from({ length: s.seats }, (_, i) => (from + i) % s.seats);
/** The seats in the order the setup snakes through: the first seat round, then back again. */
export const setupOrder = s => { const o = roundFrom(s, s.first); return [...o, ...o.slice().reverse()]; };

/** What each resource costs this seat to turn into another at the bank: 4, or 3 with a harbour for anything, or 2 with its own. */
export function rates(s, seat) {
  const r = [4, 4, 4, 4, 4];
  PORT_AT.forEach((_, i) => {
    if (!portVerts(i).some(v => s.vo[v] === seat + 1)) return;
    const k = s.ports[i];
    if (k === "any") for (let j = 0; j < 5; j++) r[j] = Math.min(r[j], 3); else r[k] = 2;
  });
  return r;
}

// ---------- where a piece may go ----------
/** Corners a post may stand on: nobody's, with no building on a corner beside it (the distance rule); after the setup, on one of your roads. */
export function postSpots(s, seat, { setup = false } = {}) {
  const out = [];
  for (let v = 0; v < VERTS.length; v++) {
    if (s.vo[v] || VERTS[v].adj.some(w => s.vo[w])) continue;
    if (!setup && !VERTS[v].edges.some(e => s.eo[e] === seat + 1)) continue;
    out.push(v);
  }
  return out;
}
/** Your posts that may become factories. */
export const factorySpots = (s, seat) => Array.from({ length: VERTS.length }, (_, v) => v).filter(v => s.vo[v] === seat + 1 && s.vl[v] === 1);
/**
 * Edges a road may take: empty, and joined at an end to one of your buildings, or to one of your roads where no one else's
 * building stands (a building cuts a road). In the setup, `from` is the post just placed, and the road must touch it.
 */
export function roadSpots(s, seat, from = -1) {
  const out = [];
  for (let e = 0; e < EDGES.length; e++) {
    if (s.eo[e]) continue;
    const { a, b } = EDGES[e];
    if (from >= 0) { if (a === from || b === from) out.push(e); continue; }
    const joined = v => s.vo[v] === seat + 1 || (!s.vo[v] && VERTS[v].edges.some(f => f !== e && s.eo[f] === seat + 1));
    if (joined(a) || joined(b)) out.push(e);
  }
  return out;
}

/** The longest unbroken run of one seat's roads (no road used twice; another's building ends it). */
export function roadLength(s, seat) {
  let best = 0;
  const used = new Set();
  const walk = (v, len) => {
    if (len > best) best = len;
    for (const e of VERTS[v].edges) {
      if (s.eo[e] !== seat + 1 || used.has(e)) continue;
      used.add(e);
      const w = otherEnd(e, v);
      if (s.vo[w] && s.vo[w] !== seat + 1) best = Math.max(best, len + 1);
      else walk(w, len + 1);
      used.delete(e);
    }
  };
  const starts = new Set();
  for (let e = 0; e < EDGES.length; e++) if (s.eo[e] === seat + 1) { starts.add(EDGES[e].a); starts.add(EDGES[e].b); }
  for (const v of starts) walk(v, 0);
  return best;
}

/** Points: posts one, factories two, the longest road and the largest fleet two each, and (when asked) the hidden patents. */
export function pointsOf(s, seat, hidden = true) {
  let p = 0;
  for (let v = 0; v < s.vo.length; v++) if (s.vo[v] === seat + 1) p += s.vl[v];
  if (s.longest === seat) p += 2;
  if (s.army === seat) p += 2;
  if (hidden) p += s.devs[seat].filter(c => c === "patent").length;
  return p;
}
/** The cards in a hand you may play now: not today's purchases. */
export function playable(s, seat) {
  const held = {};
  for (const c of s.devs[seat]) held[c] = (held[c] || 0) + 1;
  if (seat === s.turn) for (const c of s.fresh) held[c]--;
  return Object.entries(held).filter(([c, n]) => n > 0 && c !== "patent").map(([c]) => c);
}

// ---------- the deal ----------
export function fresh({ seats, options = {}, rng }) {
  const board = makeBoard(rng);
  const first = Math.floor(rng() * seats);
  const deck = shuffle(Object.entries(DEVS).flatMap(([c, n]) => Array(n).fill(c)), rng);
  const s = {
    seats, opts: { vp: TARGETS.includes(options.vp) ? options.vp : DEFAULTS.vp },
    kind: board.kind, num: board.num, ports: board.ports, robber: board.robber,
    vo: Array(VERTS.length).fill(0), vl: Array(VERTS.length).fill(0), eo: Array(EDGES.length).fill(0),
    hand: Array.from({ length: seats }, () => [0, 0, 0, 0, 0]),
    devs: Array.from({ length: seats }, () => []), fresh: [], deck,
    played: Array(seats).fill(0),
    first, turn: first, step: "setup", si: 0, part: "post", last: -1,
    roll: [0, 0], got: Array.from({ length: seats }, () => [0, 0, 0, 0, 0]), owe: Array(seats).fill(0), back: "main", free: 0,
    offer: null, offers: 0, playedDev: false, mark: [], turnNo: 0,
    longest: -1, longLen: 0, army: -1, armyN: 0, winner: -1,
    say: "Place a post, then a road to it.",
  };
  return s;
}

// ---------- the turn ----------
function checkWin(s) {
  if (s.step === "over") return;
  if (pointsOf(s, s.turn) >= s.opts.vp) { s.step = "over"; s.winner = s.turn; s.say = `The game goes to {s${s.turn}}, with ${pointsOf(s, s.turn)} points.`; }
}
/** The longest road passes to whoever has the most (five at least); a tie leaves it where it is; a cut road may leave it with nobody. */
function updateLongest(s) {
  const lens = Array.from({ length: s.seats }, (_, i) => roadLength(s, i)), top = Math.max(...lens);
  const before = s.longest;
  if (top < 5) { s.longest = -1; s.longLen = 0; }
  else {
    const tied = lens.map((l, i) => (l === top ? i : -1)).filter(i => i >= 0);
    if (!tied.includes(s.longest)) s.longest = tied.length === 1 ? tied[0] : -1;
    s.longLen = s.longest >= 0 ? top : 0;
  }
  if (s.longest !== before && s.longest >= 0) s.say = `The longest road goes to {s${s.longest}}: ${top}.`;
}
function updateArmy(s, seat) {
  if (s.played[seat] >= 3 && s.played[seat] > s.armyN) { s.army = seat; s.armyN = s.played[seat]; s.say = `The largest fleet goes to {s${seat}}: ${s.armyN}.`; }
}

/** Pays the land: each seat with a building at a hex of the number rolled. Short in the bank, one taker gets what is left; several get nothing. */
function produce(s, total) {
  const owed = Array.from({ length: s.seats }, () => [0, 0, 0, 0, 0]);
  HEXES.forEach((h, i) => {
    if (s.num[i] !== total || s.robber === i) return;
    for (const v of h.corners) if (s.vo[v]) owed[s.vo[v] - 1][s.kind[i]] += s.vl[v];
  });
  s.got = Array.from({ length: s.seats }, () => [0, 0, 0, 0, 0]);
  for (let r = 0; r < 5; r++) {
    const want = owed.reduce((t, o) => t + o[r], 0), bank = bankOf(s, r);
    if (!want) continue;
    if (want <= bank) owed.forEach((o, i) => { s.hand[i][r] += o[r]; s.got[i][r] = o[r]; });
    else {
      const takers = owed.map((o, i) => (o[r] > 0 ? i : -1)).filter(i => i >= 0);
      if (takers.length === 1) { s.hand[takers[0]][r] += bank; s.got[takers[0]][r] = bank; }
    }
  }
}

/** Who the blockade on a hex would let a seat take from: others with a building there and a card in hand. */
export function victims(s, hex, seat) {
  const out = new Set();
  for (const v of HEXES[hex].corners) { const o = s.vo[v] - 1; if (o >= 0 && o !== seat && cards(s, o) > 0) out.add(o); }
  return [...out];
}
function stealFrom(s, seat, from, rng) {
  const bag = s.hand[from].flatMap((n, r) => Array(n).fill(r));
  const r = bag[Math.floor(rng() * bag.length)];
  s.hand[from][r]--; s.hand[seat][r]++;
  s.say = `{s${seat}} took a card from {s${from}}.`;
  s.stole = [seat, from, r];
}
function afterBlockade(s) { s.step = s.back; s.back = "main"; }
function endTurn(s) {
  s.fresh = []; s.playedDev = false; s.offers = 0; s.offer = null; s.free = 0;
  s.turn = (s.turn + 1) % s.seats; s.step = "roll"; s.turnNo++; s.rolled = false; s.mark = []; s.stole = null;
  s.say = `{s${s.turn}} to roll.`;
  checkWin(s);
}
function goMain(s) { s.step = "main"; s.offer = null; }

const need = (hand, cost) => !has(hand, cost);
const resName = i => RES[i];
const costWords = cost => cost.map((n, i) => (n ? `${n} ${RES[i]}` : "")).filter(Boolean).join(", ");

/** Builds a piece for a seat: checked, paid for unless free, placed. Returns the reason it can't be, or null. */
function build(s, seat, what, at, { free = false, setup = false } = {}) {
  const left = piecesLeft(s, seat);
  if (setup) free = true;                         // the setup's post and road are for nothing
  if (what === "road") {
    if (!Number.isInteger(at) || at < 0 || at >= EDGES.length) return "No such road";
    if (left.road < 1) return "You have no roads left";
    if (!free && need(s.hand[seat], COSTS.road)) return `A road costs ${costWords(COSTS.road)}`;
    if (!roadSpots(s, seat, setup ? s.last : -1).includes(at)) return setup ? "A road goes beside the post you just placed" : "A road must join one of your roads or buildings, and no one else's building may stand in the way";
    if (!free) COSTS.road.forEach((c, i) => { s.hand[seat][i] -= c; });
    s.eo[at] = seat + 1; s.mark = ["e", at];
    return null;
  }
  if (what === "post") {
    if (!Number.isInteger(at) || at < 0 || at >= VERTS.length) return "No such corner";
    if (left.post < 1) return "You have no posts left";
    if (!setup && need(s.hand[seat], COSTS.post)) return `A post costs ${costWords(COSTS.post)}`;
    if (s.vo[at]) return "A building stands there";
    if (VERTS[at].adj.some(w => s.vo[w])) return "Too close to another building: a corner between them must stay empty";
    if (!setup && !VERTS[at].edges.some(e => s.eo[e] === seat + 1)) return "A post goes at the end of one of your roads";
    if (!setup) COSTS.post.forEach((c, i) => { s.hand[seat][i] -= c; });
    s.vo[at] = seat + 1; s.vl[at] = 1; s.mark = ["v", at];
    return null;
  }
  if (what === "factory") {
    if (!Number.isInteger(at) || at < 0 || at >= VERTS.length || s.vo[at] !== seat + 1 || s.vl[at] !== 1) return "A factory is built on one of your posts";
    if (left.factory < 1) return "You have no factories left";
    if (need(s.hand[seat], COSTS.factory)) return `A factory costs ${costWords(COSTS.factory)}`;
    COSTS.factory.forEach((c, i) => { s.hand[seat][i] -= c; });
    s.vl[at] = 2; s.mark = ["v", at];
    return null;
  }
  return "Build a road, a post or a factory";
}

const isCount5 = a => Array.isArray(a) && a.length === 5 && a.every(n => Number.isInteger(n) && n >= 0);

function act(s, seat, m, { rng }) {
  if (!m || typeof m !== "object") return "No move";
  if (s.step === "over") return "The game is over";
  if (toMove(s) !== seat) return "It isn't your turn";
  const me = s.hand[seat];

  // ----- the setup: a post, then a road to it -----
  if (s.step === "setup") {
    if (m.t !== "build") return s.part === "post" ? "Place a post" : "Place a road beside your post";
    if (m.what !== s.part) return s.part === "post" ? "Place a post first" : "Now the road, beside the post you just placed";
    const why = build(s, seat, s.part, m.at, { setup: true });
    if (why) return why;
    const order = setupOrder(s);
    if (s.part === "post") {
      s.last = m.at; s.part = "road";
      if (s.si >= s.seats) {                       // the second post pays out the land round it
        for (const h of VERTS[m.at].hexes) if (s.kind[h] < 5) s.hand[seat][s.kind[h]]++;
      }
      s.say = "A road, beside it.";
    } else {
      s.part = "post"; s.last = -1; s.si++;
      if (s.si >= order.length) { s.step = "roll"; s.turn = s.first; s.turnNo = 1; s.say = `{s${s.turn}} to roll.`; }
      else { s.turn = order[s.si]; s.say = s.si === s.seats ? `{s${s.turn}} to place the second post, which pays out the land round it.` : `{s${s.turn}} to place a post.`; }
    }
    return s;
  }

  // ----- a seat that isn't the turn's: the discards of a 7, an offer answered -----
  if (s.step === "discard") {
    if (m.t !== "discard" || !isCount5(m.n)) return `Give up ${s.owe[seat]} cards`;
    if (sum(m.n) !== s.owe[seat]) return `Give up exactly ${s.owe[seat]} cards`;
    if (m.n.some((n, i) => n > me[i])) return "You don't hold those";
    m.n.forEach((n, i) => { me[i] -= n; });
    s.owe[seat] = 0;
    s.say = `{s${seat}} gave up ${names(sum(m.n))} cards.`;
    if (s.owe.every(n => n === 0)) { s.step = "blockade"; s.say = "{s" + s.turn + "} to move the blockade."; }
    return s;
  }
  if (s.step === "offer") {
    if (m.t !== "answer") return "Say yes or no to the offer";
    s.offer.resp[seat] = m.yes ? 1 : 0;
    return resolveOffer(s);
  }

  // everything else is the turn's seat
  if (s.step === "roll") {
    if (m.t === "play") return playCard(s, seat, m, rng);
    if (m.t !== "roll") return "Roll the dice, or play a Privateer first";
    const a = 1 + Math.floor(rng() * 6), b = 1 + Math.floor(rng() * 6), total = a + b;
    s.roll = [a, b]; s.rolled = true; s.mark = []; s.stole = null;
    if (total === 7) {
      s.owe = s.hand.map(h => (sum(h) > 7 ? Math.floor(sum(h) / 2) : 0));
      s.back = "main";
      s.got = Array.from({ length: s.seats }, () => [0, 0, 0, 0, 0]);
      if (s.owe.some(n => n > 0)) { s.step = "discard"; s.say = `{s${seat}} rolled seven: those with eight cards or more give up half.`; }
      else { s.step = "blockade"; s.say = `{s${seat}} rolled seven, so the blockade must move.`; }
    } else {
      produce(s, total);
      s.step = "main";
      const who = s.got.map((g, i) => (sum(g) ? i : -1)).filter(i => i >= 0);
      s.say = `{s${seat}} rolled ${names(total)}.${who.length ? "" : " Nobody is paid."}`;
    }
    return s;
  }

  if (s.step === "blockade") {
    if (m.t !== "blockade") return "Move the blockade to another hex";
    if (!Number.isInteger(m.hex) || m.hex < 0 || m.hex >= HEXES.length) return "No such hex";
    if (m.hex === s.robber) return "The blockade must move to another hex";
    s.robber = m.hex; s.mark = ["h", m.hex];
    const v = victims(s, m.hex, seat);
    if (v.length === 0) { s.say = `{s${seat}} moved the blockade.`; s.stole = null; afterBlockade(s); }
    else if (v.length === 1) { stealFrom(s, seat, v[0], rng); afterBlockade(s); }
    else { s.step = "steal"; s.say = `{s${seat}} to choose whom to take from.`; }
    return s;
  }
  if (s.step === "steal") {
    if (m.t !== "steal" || !victims(s, s.robber, seat).includes(m.from)) return "Take from someone beside the blockade who holds a card";
    stealFrom(s, seat, m.from, rng);
    afterBlockade(s);
    return s;
  }

  if (s.step === "causeway") {
    if (m.t === "skip") { s.free = 0; goMain(s); return s; }
    if (m.t !== "build" || m.what !== "road") return "Build a road, or skip the rest";
    const why = build(s, seat, "road", m.at, { free: true });
    if (why) return why;
    s.free--;
    updateLongest(s);
    checkWin(s);
    if (s.step !== "over" && (s.free <= 0 || piecesLeft(s, seat).road < 1 || roadSpots(s, seat).length === 0)) { s.free = 0; goMain(s); }
    return s;
  }

  if (s.step === "pick") {
    if (m.t !== "pick") return "Choose who you trade with";
    if (m.with === -1) { s.say = "{s" + seat + "} turned the offers down."; goMain(s); return s; }
    if (!s.offer.resp.some((r, i) => r === 1 && i === m.with)) return "Choose one of those who said yes";
    return settle(s, m.with);
  }

  // ----- the turn proper -----
  if (s.step !== "main") return "Not now";
  switch (m.t) {
    case "build": {
      const why = build(s, seat, m.what, m.at);
      if (why) return why;
      if (m.what === "factory") s.say = `{s${seat}} upgraded a post to a factory.`;
      else if (m.what === "post") s.say = `{s${seat}} founded a post.`;
      else s.say = `{s${seat}} laid a road.`;
      updateLongest(s);
      checkWin(s);
      return s;
    }
    case "buy": {
      if (!s.deck.length) return "The development deck is empty";
      if (need(me, COSTS.dev)) return `A card costs ${costWords(COSTS.dev)}`;
      COSTS.dev.forEach((c, i) => { me[i] -= c; });
      const c = s.deck.pop();
      s.devs[seat].push(c); s.fresh.push(c);
      s.say = `{s${seat}} bought a development card.`;
      s.bought = c;
      checkWin(s);
      return s;
    }
    case "bank": {
      if (!Number.isInteger(m.give) || !Number.isInteger(m.get) || m.give < 0 || m.give > 4 || m.get < 0 || m.get > 4 || m.give === m.get) return "Trade one resource for another";
      const rate = rates(s, seat)[m.give];
      if (me[m.give] < rate) return `${rate} ${resName(m.give)} buy one at the bank`;
      if (bankOf(s, m.get) < 1) return `The bank has no ${resName(m.get)}`;
      me[m.give] -= rate; me[m.get]++;
      s.say = `{s${seat}} traded ${rate} ${resName(m.give)} for one ${resName(m.get)} at the bank.`;
      return s;
    }
    case "offer": {
      if (s.offers >= MAX_OFFERS) return `${MAX_OFFERS} offers a turn is enough`;
      if (!isCount5(m.give) || !isCount5(m.get)) return "An offer is cards for cards";
      if (sum(m.give) < 1 || sum(m.get) < 1) return "An offer gives something and asks for something";
      if (m.give.some((n, i) => n > 0 && m.get[i] > 0)) return "Don't ask for the kind you give";
      if (m.give.some((n, i) => n > me[i])) return "You don't hold what you offer";
      s.offers++;
      const resp = Array.from({ length: s.seats }, (_, i) => (i === seat ? 2 : s.hand[i].every((h, r) => h >= m.get[r]) ? -1 : 0));
      s.offer = { from: seat, give: m.give, get: m.get, resp };
      s.step = "offer";
      s.say = `{s${seat}} offered ${tradeWords(m.give)} for ${tradeWords(m.get)}.`;
      return resolveOffer(s);
    }
    case "play": return playCard(s, seat, m, rng);
    case "end": {
      endTurn(s);
      return s;
    }
    default: return "Not a move";
  }
}

const tradeWords = c => c.map((n, i) => (n ? `${n} ${RES[i]}` : "")).filter(Boolean).join(" and ");

/** Once every seat has answered (those who can't give it have): nobody, one (it is done), or several (the proposer picks). */
function resolveOffer(s) {
  const o = s.offer;
  if (o.resp.some(r => r === -1)) return s;
  const yes = o.resp.map((r, i) => (r === 1 ? i : -1)).filter(i => i >= 0);
  if (yes.length === 0) { s.say = "Nobody takes it."; s.nobody = true; goMain(s); return s; }
  if (yes.length === 1) return settle(s, yes[0]);
  s.step = "pick"; s.say = `{s${o.from}} to choose among those who said yes.`;
  return s;
}
function settle(s, other) {
  const o = s.offer, a = s.hand[o.from], b = s.hand[other];
  o.give.forEach((n, i) => { a[i] -= n; b[i] += n; });
  o.get.forEach((n, i) => { b[i] -= n; a[i] += n; });
  s.say = `{s${o.from}} traded ${tradeWords(o.give)} to {s${other}} for ${tradeWords(o.get)}.`;
  s.dealt = [o.from, other];
  goMain(s);
  return s;
}

function playCard(s, seat, m, rng) {
  const card = m.card;
  if (s.playedDev) return "One development card a turn";
  if (!playable(s, seat).includes(card)) return card === "patent" ? "A patent is a point, not a play" : "You hold no such card you can play yet: not one bought this turn";
  if (s.step === "roll" && card !== "privateer") return "Before the roll, only a Privateer";
  const use = () => { s.devs[seat].splice(s.devs[seat].indexOf(card), 1); s.playedDev = true; };
  if (card === "privateer") {
    use(); s.played[seat]++;
    s.back = s.step; s.step = "blockade"; s.say = `{s${seat}} played a Privateer: the blockade moves.`;
    updateArmy(s, seat);
    checkWin(s);
    return s;
  }
  if (card === "causeway") {
    const left = piecesLeft(s, seat).road;
    if (left < 1 || roadSpots(s, seat).length === 0) return "You have no road to build";
    use(); s.free = Math.min(2, left); s.step = "causeway"; s.say = `{s${seat}} played a Causeway: two roads for nothing.`;
    return s;
  }
  if (card === "windfall") {
    if (!Array.isArray(m.res) || m.res.length !== 2 || m.res.some(r => !Number.isInteger(r) || r < 0 || r > 4)) return "Name two resources";
    const take = [0, 0, 0, 0, 0]; m.res.forEach(r => { take[r]++; });
    if (take.some((n, r) => n > bankOf(s, r))) return "The bank is short of that";
    use(); take.forEach((n, r) => { s.hand[seat][r] += n; });
    s.say = `{s${seat}} played a Windfall: ${tradeWords(take)}.`;
    return s;
  }
  if (card === "corner") {
    if (!Number.isInteger(m.res) || m.res < 0 || m.res > 4) return "Name a resource to corner";
    use();
    let got = 0;
    for (let i = 0; i < s.seats; i++) if (i !== seat) { got += s.hand[i][m.res]; s.hand[seat][m.res] += s.hand[i][m.res]; s.hand[i][m.res] = 0; }
    s.say = `{s${seat}} cornered the market in ${RES[m.res]} and took ${got}.`;
    return s;
  }
  return "Not a card you can play";
}

/** The seat that must act now, or null. */
export function toMove(s) {
  switch (s.step) {
    case "discard": { const i = s.owe.findIndex(n => n > 0); return i < 0 ? null : i; }
    case "offer": { const i = s.offer.resp.findIndex(r => r === -1); return i < 0 ? null : i; }
    case "over": return null;
    default: return s.turn;
  }
}

/** What the database gave back: empty lists, objects and nulls are gone. */
function restore(s) {
  s.devs = Array.from({ length: s.seats }, (_, i) => (Array.isArray(s.devs?.[i]) ? s.devs[i] : s.devs?.[i] ? Object.values(s.devs[i]) : []));
  s.fresh ||= []; s.deck ||= []; s.mark ||= [];
  s.offer ||= null;
  s.stole ||= null; s.dealt ||= null; s.bought ||= null; s.nobody ||= false;
  return s;
}

export const rules = {
  id: "factor",
  seats: { min: 3, max: 4 },
  deal: ({ seats, options, rng }) => fresh({ seats, options, rng }),
  toMove,
  act,
  bot: (s, seat, ctx) => botMove(s, seat, ctx),
  over: s => s.step === "over",
  restore,
};
export const copy = clone;
