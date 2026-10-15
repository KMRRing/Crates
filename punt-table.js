// Punt at a table (a pair's match, or a party of up to six): the pure part, tested in tests/punt.mjs. The same
// question for everyone, each picking and staking on their own phone. Against (the default), each has a pot of their
// own; Together, the table shares one, each staking up to an equal share of it (half for two, a third for three).
// A question settles once everyone at the table has staked; someone slow can be gone on without once everyone else
// has and GRACE has passed (their stake is nothing); people away are never waited for. Next waits for everyone at the
// table the same way. Solo is the shared pot with one player in it: it settles (settleRound) and moves on (advance)
// through here too, without the waiting.
//
// The room's branch: { v: 1, app, created, seed, level, length, mix | maths, questions, mode, people (seats kept for
// people), players, index, phase: "bet" | "reveal", bets: { uid: { pick | typed, pct, at } }, pot (Together),
// pots: { uid: n } (Against), next: { uid: at } (who has pressed Next), log: [{ index, pot, change, bets: { uid:
// { pick, typed, pct, stake, change, pot (theirs before, Against), none (no stake: away, slow, bust) } } }], done }.
// Everything a player has is keyed by their id, never by seat number (the database reads numbered keys back as a
// list with holes), and an id swapped for another's moves it all (reseat in rooms.js).
import { settle, pickedRight, averageReturn, START_POT, LENGTHS } from "./punt-gen.js";
import { check } from "./typing.js";
import { seatsOf } from "./rooms.js";
import { presentSlots } from "./duel-core.js";

export const MOST = 6;                 // the most at one table (a party's)
export const GRACE = 30000;            // ms the table waits on the slow, once everyone else is done, before anyone may go on
export const MODES = { against: "Against", together: "Together" };

/** The seats a table keeps for people: as many as the request was for, two to six (a pair's: two). */
export const peopleFor = ask => Math.min(MOST, Math.max(2, Number(ask?.people) || 2));
/** Against: a pot each; Together: one for the table. A table from before there were two had one pot. */
export const modeOf = g => (g?.mode === "against" ? "against" : "together");
export const lengthOf = s => (LENGTHS[s?.length] ? s.length : "standard");
export const logOf = g => Object.values(g?.log || {}).filter(Boolean);

/** A saved pick as a list (sessions saved before several-right questions stored one index); null for none. */
export const picksOf = p => (p == null ? null : Array.isArray(p) ? p.filter(x => x != null) : Object.values(p ?? {}).length ? Object.values(p) : [p]);
/** Whether a bet's answer was right (null: nothing chosen): a typed answer against the name, a pick against the options. */
export function judged(q, b) {
  if (b?.typed != null) return { right: check(b.typed, [q.answer]).right };
  const p = picksOf(b?.pick);
  return { right: p ? pickedRight(q, p) : null };
}

/** The seated players' ids, in the order they sat down. */
export const seatedIds = g => seatsOf(g).sort((a, b) => a[1].slot - b[1].slot).map(([id]) => id);
/** The ids at the table now: seated, with Punt open on a device that's online (this device's own always). */
export function presentIds(g, here, me = null) {
  const slots = presentSlots(g, here, "punt", me);
  return seatedIds(g).filter(id => slots.includes(g.players[id].slot));
}
/** A player's pot: their own (Against: 1,000 for one who sat down since), or the table's. */
export const potOf = (g, id) => (modeOf(g) === "against" ? g.pots?.[id] ?? START_POT : g.pot);
/** Against, a player with nothing left can't stake: they watch. */
export const isBust = (g, id) => modeOf(g) === "against" && potOf(g, id) <= 0;
/** The most one player may stake, as a share of their pot: all of their own; of a shared pot an equal share, so the
 *  stakes together can never come to more than the pot (half for two, a third for three). */
export const maxShare = g => (modeOf(g) === "against" ? 100 : Math.floor(100 / Math.max(2, Number(g?.people) || 2, seatedIds(g).length)));

/**
 * Who the table waits for now, { ids, seats }. At a question: everyone here who hasn't staked, and, until the first
 * question has settled, the seats kept for people who haven't sat down yet (a party's phones arrive one by one). At
 * the reveal: everyone here who hasn't pressed Next. Never one who's bust: they only watch. here: presentIds.
 */
export function waitingFor(g, here) {
  const at = seatedIds(g).filter(id => here.includes(id) && !isBust(g, id));
  if (g.done) return { ids: [], seats: 0 };
  if (g.phase === "reveal") return { ids: at.filter(id => !g.next?.[id]), seats: 0 };
  const seats = logOf(g).length ? 0 : Math.max(0, (Number(g.people) || 2) - seatedIds(g).length);
  return { ids: at.filter(id => !g.bets?.[id]), seats };
}
const nobody = w => !w.ids.length && !w.seats;
/** When the table started waiting on whoever it still waits for: the last stake (or Next) of those who are done. */
function waitingSince(g) {
  const done = Object.values((g.phase === "reveal" ? g.next : g.bets) || {}).map(x => (typeof x === "number" ? x : x?.at)).filter(Number.isFinite);
  return done.length ? Math.max(...done) : null;
}
/** When anyone may go on without those still to stake (or press Next), or null while nobody's done or nobody's waited for. */
export function goOnAt(g, here) {
  if (nobody(waitingFor(g, here))) return null;
  const since = waitingSince(g);
  return since == null ? null : since + GRACE;
}
export const mayGoOn = (g, here, now) => { const at = goOnAt(g, here); return at != null && now >= at; };

/**
 * Settles the question (in the transaction): every stake paid at 2× or lost, on the player's own pot or the table's;
 * everyone seated who didn't stake staked nothing. ids: who's in the round (everyone seated; solo, the one player).
 */
export function settleRound(g, ids = seatedIds(g)) {
  const q = g.questions[g.index], against = modeOf(g) === "against", bets = {};
  let total = 0;
  g.pots ??= {};
  for (const id of ids) {
    const b = g.bets?.[id], pot = against ? potOf(g, id) : g.pot;
    if (!b) { bets[id] = { pct: 0, stake: 0, change: 0, none: true, ...(against && { pot }) }; continue; }
    const share = b.pct || 0, p = picksOf(b.pick), { right } = judged(q, b);
    const { stake, change } = right == null || !share ? { stake: 0, change: 0 } : settle(pot, share, right);
    bets[id] = { pick: p, ...(b.typed != null && { typed: b.typed }), pct: share, stake, change, ...(against && { pot }) };
    if (against) g.pots[id] = Math.max(0, pot + change);
    total += change;
  }
  g.log = [...logOf(g), against ? { index: g.index, bets } : { index: g.index, pot: g.pot, bets, change: total }];
  if (!against) g.pot = Math.max(0, g.pot + total);
  if (!Object.keys(g.pots).length) delete g.pots;
  g.phase = "reveal";
  g.bets = {};
  return true;
}

/** A stake (or a pass, a stake of 0%), at a table: noted, and the question settled once nobody's left to wait for.
 *  A stake is held to the most a player may stake now (one more seated at a shared pot makes everyone's share less). */
export function stake(g, id, bet, here) {
  if (g.done || g.phase !== "bet" || isBust(g, id)) return false;
  g.bets = { ...(g.bets || {}), [id]: { ...bet, pct: Math.min(bet.pct || 0, maxShare(g)) } };
  if (nobody(waitingFor(g, here))) settleRound(g);
  return true;
}

/** Whether the run is over at this reveal: the set's last question, or no chips left (Against: nobody's). */
export function runOver(g) {
  const broke = modeOf(g) === "against" ? seatedIds(g).every(id => isBust(g, id)) : g.pot <= 0;
  return broke || (lengthOf(g) !== "endless" && g.index + 1 >= Object.values(g.questions).length);
}
/** On to the next question, or the end; more(g): an endless run's next block, once it's needed. */
export function advance(g, more = null, now = Date.now()) {
  if (g.phase !== "reveal" || g.done) return false;
  g.questions = Object.values(g.questions);
  delete g.next;
  if (runOver(g)) { g.done = { at: now }; return true; }
  if (g.index + 1 >= g.questions.length && more) g.questions = g.questions.concat(more(g));
  g.index++;
  g.phase = "bet";
  return true;
}
/** Next pressed: noted, and on once everyone here has. */
export function pressNext(g, id, here, now, more = null) {
  if (g.phase !== "reveal" || g.done) return false;
  g.next = { ...(g.next || {}), [id]: now };
  if (nobody(waitingFor(g, here))) advance(g, more, now);
  return true;
}
/** Everyone done but the slow, who have had GRACE: on without them (their stake is nothing). */
export function goOn(g, here, now, more = null) {
  if (g.done || !mayGoOn(g, here, now)) return false;
  return g.phase === "reveal" ? advance(g, more, now) : settleRound(g);
}
/** Nobody left to wait for (the last one still to stake has gone): settle, or move on. */
export function carryOn(g, here, now, more = null) {
  if (g.done || !nobody(waitingFor(g, here))) return false;
  return g.phase === "reveal" ? advance(g, more, now) : settleRound(g);
}

/** A player's run as one pot's log: what their pot was before each question they sat in, and what it did. */
export const runOf = (g, id) => (modeOf(g) === "against"
  ? logOf(g).filter(r => r.bets?.[id]).map(r => ({ pot: r.bets[id].pot ?? START_POT, change: r.bets[id].change || 0 }))
  : logOf(g).map(r => ({ pot: r.pot, change: r.change })));
/** What a player has put into the shared pot over the run (Together: the standings). */
export const addedBy = (g, id) => logOf(g).reduce((t, r) => t + (r.bets?.[id]?.change || 0), 0);

/**
 * The standings after a question: everyone seated, with what they did (pick, stake, gain or loss) and where they
 * stand. Against: their pot, best first; Together: what each has added to the pot over the run, most first. Equal
 * ones keep the order they sat down in. entry: the question's log entry (the latest).
 */
export function standingsAfter(g, entry = logOf(g).at(-1)) {
  const against = modeOf(g) === "against";
  const rows = seatedIds(g).map(id => {
    const b = entry?.bets?.[id] || null, p = g.players[id];
    return { id, slot: p.slot, name: p.name || "Player", bet: b, change: b?.change ?? null, value: against ? potOf(g, id) : addedBy(g, id) };
  });
  return rows.sort((a, b) => b.value - a.value || a.slot - b.slot);
}

/** The match for the pair's record, once it's over: Against, head to head (won: sole first); Together, the team's pot. */
export function resultFor(g, id) {
  if (!g?.done) return null;
  const match = `${g.seed}-${g.created || ""}`;
  if (modeOf(g) === "together") return { match, score: g.pot ?? null, won: (g.pot ?? 0) > START_POT, coop: true };
  const mine = potOf(g, id), others = seatedIds(g).filter(x => x !== id).map(x => potOf(g, x));
  return { match, score: mine, won: others.every(x => mine > x), coop: false };
}
/** A player's average return a question, compounded, over the questions they sat in. */
export const averageFor = (g, id) => averageReturn(runOf(g, id));
