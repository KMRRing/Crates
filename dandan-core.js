// Dandan's table: the zones, the permanents, the mana and what a card knows about the library. Pure functions on the
// game state (a plain object that survives JSON and the database); the rules of the turn, the stack and the moves are
// dandan-engine.js's, what each card does dandan-spells.js's.
//
// The format is the communal one: ONE library and ONE graveyard for both players, so "your graveyard" and "its
// owner's library" are the same pile for you and for the computer. A card in hand is its holder's; one on the stack or
// the battlefield belongs to whoever played it.
import { CARDS, DECK, HALVES, BASIC_MANA, TOKEN_AT, cardName, parseCost, total, isToken } from "./dandan-cards.js";
import { shuffle } from "./seats.js";

export const LIFE = 20, HAND = 7;
export const other = seat => 1 - seat;
/** A list as the database gives it back: dense, in order, whatever shape it came in (a list, or an object of indices). */
export const list = x => (Array.isArray(x) ? x.filter(v => v != null) : x && typeof x === "object" ? Object.values(x) : []);

// ---------- randomness: the move's own stream, set by whoever runs a move ----------
let rng = Math.random;
export function withRng(r, fn) {
  const old = rng;
  rng = r || Math.random;
  try { return fn(); } finally { rng = old; }
}
export const random = () => rng();

// ---------- the log: a line for each thing that happens, {s0} for whoever sits in seat 0 ----------
export function say(s, text) {
  s.ln = (s.ln || 0) + 1;
  s.log.push({ n: s.ln, t: text });
  if (s.log.length > 80) s.log.splice(0, s.log.length - 80);
}

// ---------- cards ----------
/** The entry of what a card id is on its front face (a split card's front is Commit). */
export const defOf = id => CARDS[id >= TOKEN_AT ? "Clue" : (HALVES[DECK[id]] ? HALVES[DECK[id]][0] : DECK[id])];
export const isLandId = id => defOf(id).type === "land";
/** A card's name for the log. */
export const nm = id => (id >= TOKEN_AT ? "Clue" : DECK[id]);
/** Whether a card is an instant or a sorcery (the split card is both, in the graveyard). */
export const isSpellCard = id => id < TOKEN_AT && (defOf(id).type === "instant" || defOf(id).type === "sorcery" || !!HALVES[DECK[id]]);

// ---------- permanents ----------
export const perm = (s, id) => s.bf.find(p => p.id === id);
const tcMap = (tc, word) => { for (const [a, b] of tc || []) if (word === a) word = b; return word; };
export const isLand = p => defOf(p.id).type === "land";
export const isCreature = p => defOf(p.id).type === "creature";
/** The land types a land has now: its own, with Mind Bend's changes. */
export function typesOf(p) {
  const d = defOf(p.id);
  return d.type === "land" ? [...new Set(d.subs.map(t => tcMap(p.tc, t)))] : [];
}
export const isIsland = p => typesOf(p).includes("Island");
export const islands = (s, seat) => s.bf.filter(p => p.ctl === seat && isIsland(p));
/** The land type a Dandân looks for in its text: "Island", unless Mind Bend changed it. */
export const needType = p => tcMap(p.tc, "Island");
/** The types a Flood Plain fetches, with the changes. */
export const fetchTypes = p => (defOf(p.id).fetch || []).map(t => tcMap(p.tc, t));
export const lands = (s, seat) => s.bf.filter(p => p.ctl === seat && isLand(p));
export const creatures = (s, seat) => s.bf.filter(p => (seat == null || p.ctl === seat) && isCreature(p));
/** Power and toughness now. */
export function pt(p) {
  const [a, b] = defOf(p.id).pt || [0, 0];
  return [a + (p.pump?.[0] || 0), b + (p.pump?.[1] || 0)];
}
/** Whether a creature may be blocked by anything: not while it has islandwalk and the defender has an Island. */
export const unblockable = (s, p) => !!p.walk && islands(s, other(p.ctl)).length > 0;
/** Whether a creature could attack now: untapped, here since before this turn, and its text's land type opposite. */
export function canAttack(s, p) {
  if (!isCreature(p) || p.tapped || p.ent >= s.turn || p.ctl !== s.active) return false;
  return s.bf.some(l => l.ctl === other(p.ctl) && isLand(l) && typesOf(l).includes(needType(p)));
}

// ---------- mana ----------
/** What a land can tap for: alternatives, each a list of colours made together (Boilerworks one of two, Falls two of one). */
export function manaAlts(p) {
  const d = defOf(p.id), out = [], seen = new Set();
  const add = a => { const k = a.join(""); if (!seen.has(k)) { seen.add(k); out.push(a); } };
  for (const t of typesOf(p)) if (BASIC_MANA[t]) add([BASIC_MANA[t]]);
  for (const a of d.mana || []) add(a);
  return out;
}
/** How much we'd rather keep a land untapped: lands that make more, or either colour, are kept for last. */
const keepValue = alts => (alts.length > 1 ? 1.3 : alts[0].length > 1 ? 1.6 : 1);

/**
 * How to pay a cost ({ g, U, R }) from a seat's untapped lands: { taps: [land ids] }, or null if it can't. Among the
 * ways, the one that leaves the most behind: lands that are worth more (red, two mana) stay untapped, and mana made
 * and not used counts against a way. Deterministic.
 */
export function payPlan(s, seat, cost, skip = []) {
  const need = total(cost);
  if (need === 0) return { taps: [] };
  const mine = s.bf.filter(p => p.ctl === seat && !p.tapped && isLand(p) && !skip.includes(p.id))
    .map(p => ({ id: p.id, alts: manaAlts(p) })).filter(l => l.alts.length);
  if (mine.reduce((n, l) => n + Math.max(...l.alts.map(a => a.length)), 0) < need) return null;
  const cap = need + 3, key = (u, r, t) => `${u},${r},${t}`;
  let states = new Map([[key(0, 0, 0), { u: 0, r: 0, t: 0, pen: 0, taps: [] }]]);
  for (const land of mine) {
    const next = new Map(states);
    for (const st of states.values()) {
      for (const alt of land.alts) {
        const u = Math.min(cost.U, st.u + alt.filter(c => c === "U").length), r = Math.min(cost.R, st.r + alt.filter(c => c === "R").length);
        const t = Math.min(cap, st.t + alt.length), pen = st.pen + keepValue(land.alts);
        const k = key(u, r, t), old = next.get(k);
        if (!old || pen < old.pen) next.set(k, { u, r, t, pen, taps: [...st.taps, land.id] });
      }
    }
    states = next;
  }
  let best = null;
  for (const st of states.values()) {
    if (st.u < cost.U || st.r < cost.R || st.t < need) continue;
    const score = st.pen + 0.9 * (st.t - need);
    if (!best || score < best.score) best = { score, taps: st.taps };
  }
  return best ? { taps: best.taps } : null;
}
export const canPay = (s, seat, cost, skip) => !!payPlan(s, seat, cost, skip);
/** Pays: taps the lands of a plan. */
export function pay(s, plan) { for (const id of plan.taps) perm(s, id).tapped = true; }

// ---------- zones ----------
export const count = (arr, f) => arr.reduce((n, x) => n + (f(x) ? 1 : 0), 0);
export const knOf = (s, id) => s.kn.find(e => e[0] === id)?.[1] || 0;
export function knSet(s, id, mask) { const e = s.kn.find(x => x[0] === id); if (e) e[1] = mask; else s.kn.push([id, mask]); }
export function knDrop(s, id) { const i = s.kn.findIndex(e => e[0] === id); if (i >= 0) s.kn.splice(i, 1); }
/** The top card of the library, if this seat knows what it is (a spell put on top in the open, a look at it). */
export const topKnown = (s, seat) => (s.lib.length && (knOf(s, s.lib[0]) & (1 << seat)) ? s.lib[0] : null);
export const BOTH = 3;

/** A card into the library: "top", "second" (second from the top) or "bottom", known to the seats in mask. */
export function toLib(s, id, where, mask = 0) {
  if (isToken(id)) return;
  if (where === "top") s.lib.unshift(id);
  else if (where === "second") s.lib.splice(Math.min(1, s.lib.length), 0, id);
  else s.lib.push(id);
  if (mask) knSet(s, id, mask); else knDrop(s, id);
}
export function toYard(s, id) { if (!isToken(id)) s.yard.push(id); }
export function fromYard(s, id) { const i = s.yard.indexOf(id); if (i >= 0) s.yard.splice(i, 1); return i >= 0; }
export function fromLib(s, id) { const i = s.lib.indexOf(id); if (i >= 0) { s.lib.splice(i, 1); knDrop(s, id); } return i >= 0; }
export function fromHand(s, seat, id) { const h = s.hand[seat], i = h.indexOf(id); if (i >= 0) h.splice(i, 1); return i >= 0; }
export function shuffleLib(s) { s.lib = shuffle(s.lib, rng); s.kn = []; }

/** Draws n cards; a draw from an empty library marks the seat to lose when the game next checks. */
export function draw(s, seat, n = 1) {
  let got = 0;
  for (let i = 0; i < n; i++) {
    if (!s.lib.length) { s.lost[seat] = true; say(s, `{s${seat}} has to draw from an empty library`); break; }
    const id = s.lib.shift();
    knDrop(s, id);
    s.hand[seat].push(id);
    s.drawn[seat]++;
    got++;
  }
  return got;
}
/** The top n cards of the library into the graveyard (the ids milled). */
export function mill(s, n = 1) {
  const out = [];
  for (let i = 0; i < n && s.lib.length; i++) { const id = s.lib.shift(); knDrop(s, id); toYard(s, id); out.push(id); }
  return out;
}

// ---------- the stack ----------
export function pushItem(s, it) {
  it.sid = s.nid++;
  it.step = 0;
  it.d ||= {};
  it.targets ||= [];
  s.stack.push(it);
  return it;
}
export const itemOf = (s, sid) => s.stack.find(i => i.sid === sid);
/**
 * A spell leaves the stack for dest: "yard", "hand" (its owner's), "libtop", "libsecond", "exile", or "none" (its
 * resolution has already put the card somewhere). A copy ceases to exist; a flashback or aftermath spell is exiled
 * wherever it would have gone.
 */
export function leaveStack(s, it, dest) {
  s.stack = s.stack.filter(x => x.sid !== it.sid);
  if (it.kind !== "spell" || it.copy || dest === "none") return;
  if (it.eol) dest = "exile";
  if (dest === "yard") toYard(s, it.card);
  else if (dest === "hand") { s.hand[it.ctl].push(it.card); }
  else if (dest === "libtop") toLib(s, it.card, "top", BOTH);
  else if (dest === "libsecond") toLib(s, it.card, "second", BOTH);
  else s.exile.push(it.card);
}

// ---------- the battlefield ----------
/** A card onto the battlefield under ctl's control; enters-the-battlefield triggers go on the stack. */
export function enterBf(s, id, ctl, { tapped } = {}) {
  const d = defOf(id);
  let tap = tapped ?? !!d.tapped;
  if (nm(id) === "Mystic Sanctuary") tap = islands(s, ctl).length < 3;
  const p = { id, ctl, tapped: tap, ent: s.turn };
  s.bf.push(p);
  const name = nm(id);
  const trig = { "Halimar Depths": "@depths", "Thundering Falls": "@falls", "Izzet Boilerworks": "@boil" }[name] || (name === "Mystic Sanctuary" && !tap ? "@sanct" : null);
  if (trig) pushItem(s, { kind: "trigger", name: trig, ctl, src: id });
  return p;
}
export function leaveBf(s, id) { const i = s.bf.findIndex(p => p.id === id); if (i >= 0) s.bf.splice(i, 1); return i >= 0; }
/** A permanent dies or is sacrificed: into the graveyard (a token just goes). */
export function toGrave(s, id) { if (leaveBf(s, id)) toYard(s, id); }
/** A permanent back to its owner's hand (a token just goes). */
export function bounce(s, id) {
  const p = perm(s, id);
  if (!p) return;
  leaveBf(s, id);
  if (!isToken(id)) s.hand[p.ctl].push(id);
}
/** A permanent into the library (a token just goes); where is "top", "second" or "bottom". */
export function permToLib(s, id, where) {
  if (!leaveBf(s, id)) return;
  toLib(s, id, where, BOTH);
}

// ---------- questions put to a player ----------
/**
 * A decision for a seat, mid-resolution of an item (or a turn-based one: it = null). The item waits on the stack
 * and carries on at `next` when the answer's in.
 */
export function ask(s, it, pend, next) {
  if (it) { it.step = next; pend.sid = it.sid; s.res = it.sid; }
  s.pending = pend;
  return "wait";
}

export { CARDS, DECK, HALVES, BASIC_MANA, TOKEN_AT, cardName, parseCost, total, isToken };
