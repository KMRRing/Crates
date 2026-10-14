// Cartel as a game for a few seats (seats.js): the referee (cartel-engine.js) and the computer players (cartel-ai.js)
// as pure functions of a state that can be stored, so one runner plays it solo on this device or at a table of
// friends, each on their own phone, the computer in the seats nobody has (README, Seats).
//
// The referee's state is kept as it is, but for its random stream, a function, which is kept as the number it has
// reached (rstate) and made a stream again for each move. Each seat has a personality, the one the computer plays it
// with when nobody sits there (yours too, for when your phone has been away a while).
import * as E from "./cartel-engine.js";
import { Player, PERSONAS } from "./cartel-ai.js";

export { PERSONAS };
const IDS = Object.keys(PERSONAS);
const clone = v => JSON.parse(JSON.stringify(v));

/** The referee's state, made playable: its random stream a function again. */
function wet(st) {
  const s = st;
  s.r = E.rng(st.rstate ?? st.seed);
  delete s.rstate;
  return s;
}
/** And as it's kept: the stream as the number it has reached, and nothing the database would refuse (a field the
 *  referee left undefined: a bid cleared from a state that had none). */
function dry(s) {
  const out = { ...s, rstate: s.r.state() };
  delete out.r;
  return JSON.parse(JSON.stringify(out));
}

// events whose lists may be empty (the database keeps no empty list): a banker at the cap takes none, a steal from an
// empty hand gets none
const LISTS = { banker: ["dice"], trader: ["lost", "dice"], take: ["dice"], receive: ["dice"], pay: ["dice"] };
/** A map of die id to face as the database may give it back: a list with gaps (or nulls, once copied). */
const faces = m => (m && typeof m === "object" ? Object.fromEntries(Object.entries(m).filter(([, f]) => f != null)) : m);

/** The personalities at a table of n: the opponents chosen for seats 1 on, then the rest at random; seat 0's last. */
function personasFor(n, opponents, rng) {
  const chosen = (opponents || []).filter(id => PERSONAS[id]);
  const rest = IDS.filter(id => !chosen.includes(id)).map(id => [id, rng()]).sort((a, b) => a[1] - b[1]).map(([id]) => id);
  const pool = [...chosen, ...rest];
  const others = Array.from({ length: n - 1 }, (_, k) => pool[k % pool.length]);
  return [pool.find(id => !others.includes(id)) || "quant", ...others];
}

/** Whose decision it is: a claim's or block's answer, a proven claimant's choice, else the player whose turn it is. */
const toMove = s => (s.over ? null : s.pending ? (s.pending.type === "proof" ? s.pending.claimant : s.pending.challenger) : s.turn);

/**
 * A move, as a seat makes it: { t: "free", die } the Fixer's reroll; { t: "act", action } the turn's move (the
 * referee's act); { t: "ask", target, question }; { t: "bid", q, f } or { t: "bid", call: true }; { t: "answer",
 * decision } to a claim ("challenge", "allow", { block: role }); { t: "block", challenge } to a block; { t: "proof",
 * keep } a proven die kept shown or put back.
 */
function act(st, seat, m) {
  const s = wet(st);
  try {
    switch (m?.t) {
      case "free": E.freeReroll(s, m.die); break;
      case "act": E.act(s, m.action); break;
      case "ask": E.freeAsk(s, m.target, m.question); break;
      case "bid": E.bid(s, m.call ? { call: true } : { q: m.q, f: m.f }); break;
      case "answer": E.respond(s, m.decision); break;
      case "block": E.respondBlock(s, !!m.challenge); break;
      case "proof": E.keepProof(s, !!m.keep); break;
      default: return "That isn't a move";
    }
  } catch (e) { return String(e.message || e).replace(/^./, c => c.toUpperCase()); }
  return dry(s);
}

/** The plainest move a seat can always make: what a computer player falls back on if the referee refuses its own. */
function plainest(s, seat) {
  const c = s.pending;
  if (c?.type === "proof") return { t: "proof", keep: true };
  if (c?.type === "block") return { t: "block", challenge: false };
  if (c) return { t: "answer", decision: "allow" };
  if (s.step === "act") return { t: "act", action: E.mustHit(s) ? { type: "hit", target: s.players.find(p => !p.out && p.i !== seat).i } : { type: "pass" } };
  return { t: "bid", ...(s.bid ? { call: true } : { q: 1, f: 2 }) };
}

/**
 * A computer player's move: its personality's player, following the game as its seat sees it, from the start (so any
 * device can make it, the one that ran the table before having gone), on a random stream of this move's own. Its
 * free moves come first, as at the solo table: the Fixer's reroll before its move, the question before its bid.
 */
function bot(st, seat, { rng }) {
  const s = wet(clone(st)), persona = PERSONAS[s.players[seat]?.persona] ? s.players[seat].persona : "quant";
  const ai = new Player(seat, s.players.length, persona, Math.floor(rng() * 2 ** 31));
  ai.sync(s, E.seen);
  let m;
  try {
    const c = s.pending;
    if (c?.type === "proof") m = { t: "proof", keep: ai.keepProof(s) };
    else if (c?.type === "block") m = { t: "block", challenge: ai.challengeBlock(s) };
    else if (c) m = { t: "answer", decision: ai.challenge(s) };
    else if (s.step === "act") {
      const die = s.freeUsed ? null : ai.free(s);
      m = die != null ? { t: "free", die } : { t: "act", action: ai.action(s) };
    } else {
      const q = s.askUsed ? null : ai.ask(s);
      m = q ? { t: "ask", target: q.target, question: q.question } : { t: "bid", ...ai.bid(s) };
    }
  } catch (e) { console.error(e); m = null; }
  // a move the referee refuses (it shouldn't) mustn't stall the table: the plainest one instead
  if (!m || typeof act(clone(st), seat, m) === "string") return plainest(s, seat);
  return m;
}

/** A state read back from the database made whole: the empty lists it dropped, and its maps of faces without gaps. */
function restore(st) {
  st.bid ??= null;
  st.pending ??= null;
  st.over ??= null;
  st.players ||= [];
  for (const p of st.players) { p.dice ||= []; p.out ??= false; }
  st.events ||= [];
  for (const e of st.events) {
    for (const k of LISTS[e.t] || []) e[k] ||= [];
    if (e.faces) e.faces = faces(e.faces);
    if (e.priv) for (const [i, x] of Object.entries(e.priv)) if (x?.faces) e.priv[i] = { ...x, faces: faces(x.faces) };
  }
  if (st.pending?.base) st.pending.base.picks ||= {};
  if (st.pending) st.pending.picks ||= {};
  return st;
}

export const rules = {
  id: "cartel",
  seats: { min: 3, max: 4 },
  /** A new game for so many seats; options.opponents: the personalities chosen for the seats after yours. */
  deal({ seats, options = {}, rng }) {
    const ps = personasFor(seats, options.opponents, rng);
    return dry(E.newGame(Math.floor(rng() * 2 ** 31), ps.map(id => ({ name: PERSONAS[id].name, persona: id }))));
  },
  toMove,
  act,
  bot,
  over: s => !!s.over,
  restore,
};
