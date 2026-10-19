// Dandan's rules: the turn, the stack and priority, combat, the state-based checks, and the moves a seat may make.
// A game is a plain object (JSON-safe, nothing undefined) moved by act(); toMove() says whose decision it is: whoever
// holds priority, or whoever a question is put to (pending). Priority passes by itself where a seat has nothing it
// could do (see wants): nobody is asked at an upkeep, or to answer a spell they can't answer.
//
// The turn: untap, upkeep, draw, main, declare attackers, declare blockers, combat damage, main, end step, cleanup.
// (The beginning and end of combat have no priority: nothing here acts in them.) A spell or ability goes on the
// stack; both players pass in turn with it there and the top one resolves; the stack empty, both passing ends the step.
import { CARDS, DECK, HALVES, NAMES, BASICS, parseCost } from "./dandan-cards.js";
import { shuffle } from "./seats.js";
import {
  LIFE, HAND, other, list, withRng, say, nm, isLandId, perm, isLand, isCreature, pt, canAttack, unblockable, fetchTypes, typesOf, needType,
  payPlan, pay, draw, shuffleLib, pushItem, itemOf, leaveStack, enterBf, leaveBf, toGrave, toLib, toYard, fromYard, fromLib, fromHand,
  mill, lands, permToLib, bounce,
} from "./dandan-core.js";
import { RES, same, targetLists, stillLegal, modesOf } from "./dandan-spells.js";

export const STEPS = ["upkeep", "draw", "main1", "attackers", "blockers", "damage", "main2", "end"];
const isMain = s => s.step === "main1" || s.step === "main2";
/** The steps (stack empty) where a seat is asked whether it wants to act, if it can: its own turn's mains, attack, blocks and end; the other's attack, blocks and end. */
const MY_STOPS = new Set(["main1", "attackers", "blockers", "main2", "end"]);
const THEIR_STOPS = new Set(["attackers", "blockers", "end"]);

// ---------- a new game ----------
function blank() {
  return {
    v: 1, turn: 0, active: 0, first: 0, step: "mull", prio: 0, passes: 0, res: 0,
    lib: [], yard: [], exile: [], hand: [[], []], bf: [], stack: [], life: [LIFE, LIFE], kn: [], nid: 1, nt: 0,
    played: 0, drawn: [0, 0], attacked: false, quick: [false, false], combat: null, pending: null, lost: [false, false],
    over: false, winner: -1, why: "", mull: { n: [0, 0], done: [false, false] }, reveal: null, log: [], ln: 0,
  };
}

/** A fresh game: the 80 cards shuffled into the one library, seven dealt to each in turn, the first to play chosen (the last game's loser, else by lot). */
export function deal({ rng, prev = null }) {
  return withRng(rng, () => {
    const s = blank();
    s.lib = shuffle(DECK.map((_, i) => i), rng);
    s.first = prev && prev.over && prev.winner >= 0 ? other(prev.winner) : (rng() < 0.5 ? 0 : 1);
    s.active = s.prio = s.first;
    for (let i = 0; i < HAND; i++) for (const seat of [s.first, other(s.first)]) draw(s, seat, 1);
    s.drawn = [0, 0];
    say(s, `{s${s.first}} plays first`);
    askMull(s, s.first);
    settle(s);
    return s;
  });
}

// ---------- the opening hand ----------
/** A hand with fewer than two lands or fewer than two spells may be thrown back for nothing, shown to the other player. */
export const unplayable = (s, seat) => {
  const h = s.hand[seat], n = h.filter(isLandId).length;
  return n < 2 || h.length - n < 2;
};
function askMull(s, seat) {
  s.pending = { t: "mull", seat, free: s.mull.n[seat] === 0 && s.hand[seat].length === HAND && unplayable(s, seat), taken: s.mull.n[seat] };
}
function mulligan(s, seat) {
  if (s.pending.free) { s.reveal = { seat, cards: [...s.hand[seat]] }; say(s, `{s${seat}} shows ${s.hand[seat].map(nm).join(", ")} and takes a free mulligan`); }
  else { s.mull.n[seat]++; say(s, `{s${seat}} takes a mulligan`); }
  s.lib.push(...s.hand[seat]);
  s.hand[seat] = [];
  shuffleLib(s);
  draw(s, seat, HAND);
  s.drawn = [0, 0];
  askMull(s, seat);
}
function keepHand(s, seat) {
  const n = s.mull.n[seat];
  if (n > 0) { s.pending = { t: "bottom", seat, n }; return; }
  doneMull(s, seat);
}
function doneMull(s, seat) {
  s.mull.done[seat] = true;
  s.pending = null;
  say(s, `{s${seat}} keeps ${s.hand[seat].length}`);
  const next = other(seat);
  if (!s.mull.done[next]) { askMull(s, next); return; }
  s.reveal = null;
  startTurn(s);
}

// ---------- the turn ----------
function startTurn(s) {
  s.turn++;
  s.active = s.turn === 1 ? s.first : other(s.active);
  for (const p of s.bf) if (p.ctl === s.active) p.tapped = false;
  s.played = 0;
  s.drawn = [0, 0];
  s.attacked = false;
  s.quick = [false, false];
  s.combat = null;
  s.step = "upkeep";
  s.prio = s.active;
  s.passes = 0;
  say(s, `Turn ${s.turn}: {s${s.active}}`);
}
function endTurn(s) {
  for (const p of s.bf) { delete p.dmg; delete p.pump; delete p.walk; }
  startTurn(s);
}
function cleanup(s) {
  const over = s.hand[s.active].length - HAND;
  if (over > 0) { s.pending = { t: "discard", seat: s.active, n: over, why: "hand size", cleanup: true }; return; }
  endTurn(s);
}
/** A step ends: what the next one does by the rules, not by choice (the draw, combat damage), then priority to the active player. */
function advance(s) {
  const act = s.active;
  switch (s.step) {
    case "upkeep": s.step = "draw"; if (s.turn > 1) draw(s, act, 1); break;
    case "draw": s.step = "main1"; break;
    case "main1": {
      const ids = s.bf.filter(p => canAttack(s, p)).map(p => p.id);
      if (ids.length) { s.step = "attackers"; s.pending = { t: "attack", seat: act, ids }; return; }
      s.step = "main2";
      break;
    }
    case "attackers": {
      const att = (s.combat ? s.combat.att : []).filter(id => perm(s, id));
      if (!att.length) { s.combat = null; s.step = "main2"; break; }
      s.combat.att = att;
      s.step = "blockers";
      const def = other(act);
      const blockers = s.bf.filter(p => p.ctl === def && isCreature(p) && !p.tapped).map(p => p.id);
      const attackers = att.filter(id => !unblockable(s, perm(s, id)));
      if (blockers.length && attackers.length) { s.pending = { t: "block", seat: def, blockers, attackers }; return; }
      break;
    }
    case "blockers": s.step = "damage"; combatDamage(s); break;
    case "damage": s.step = "main2"; s.combat = null; break;
    case "main2": s.step = "end"; break;
    case "end": cleanup(s); return;
  }
  s.prio = s.active;
  s.passes = 0;
}

/** Combat damage, all at once: unblocked attackers hit the player; a blocked one deals its damage to its blockers in turn, enough to be lethal to each and the rest to the last. */
function combatDamage(s) {
  const c = s.combat;
  if (!c) return;
  const hurt = new Map(), loss = [0, 0];
  const add = (id, n) => hurt.set(id, (hurt.get(id) || 0) + n);
  for (const aid of c.att) {
    const a = perm(s, aid);
    if (!a) continue;
    const power = pt(a)[0], mine = c.blk.filter(([, x]) => x === aid).map(([b]) => b);
    const blockers = mine.map(b => perm(s, b)).filter(Boolean);
    if (!mine.length) { if (power > 0) loss[other(a.ctl)] += power; }
    else {
      let left = Math.max(0, power);
      blockers.forEach((b, i) => {
        const give = i === blockers.length - 1 ? left : Math.min(left, Math.max(1, pt(b)[1] - (b.dmg || 0)));
        if (give > 0) add(b.id, give);
        left -= give;
      });
    }
    for (const b of blockers) if (pt(b)[0] > 0) add(aid, pt(b)[0]);
  }
  for (const [id, n] of hurt) { const p = perm(s, id); p.dmg = (p.dmg || 0) + n; }
  for (const seat of [0, 1]) if (loss[seat]) { s.life[seat] -= loss[seat]; say(s, `{s${seat}} takes ${loss[seat]}: ${s.life[seat]} left`); }
}

// ---------- state-based checks ----------
function gameOver(s, out) {
  s.over = true;
  s.step = "over";
  s.pending = null;
  s.winner = out.length === 2 ? -1 : other(out[0]);
  s.why = s.lost[out[0]] ? "library" : "life";
  say(s, s.winner < 0 ? "Both players lose: a draw" : `{s${s.winner}} wins: {s${other(s.winner)}} ${s.why === "library" ? "drew from an empty library" : "is out of life"}`);
}
/**
 * Players at 0 life or who drew from an empty library lose; creatures with no toughness left or enough damage die;
 * each Dandân whose controller has none of the land type its text names gets a trigger (once, until it resolves).
 * Returns whether anything changed.
 */
export function sba(s) {
  let acted = false;
  for (let g = 0; g < 100; g++) {
    const out = [0, 1].filter(i => s.life[i] <= 0 || s.lost[i]);
    if (out.length) { gameOver(s, out); return true; }
    let changed = false;
    for (const p of [...s.bf]) {
      if (!isCreature(p)) continue;
      if (pt(p)[1] <= 0 || (p.dmg || 0) >= pt(p)[1]) { say(s, `{s${p.ctl}}'s ${nm(p.id)} dies`); toGrave(s, p.id); changed = true; }
    }
    const need = s.bf.filter(p => nm(p.id) === "Dandân" && !p.trig && !lands(s, p.ctl).some(l => typesOf(l).includes(needType(p))));
    need.sort((a, b) => (b.ctl === s.active) - (a.ctl === s.active));
    for (const p of need) {
      p.trig = true;
      pushItem(s, { kind: "trigger", name: "@dandan", ctl: p.ctl, src: p.id });
      say(s, `{s${p.ctl}} has no ${needType(p)}: the Dandân will be sacrificed`);
      s.passes = 0;
      changed = true;
    }
    if (!changed) break;
    acted = true;
  }
  return acted;
}

// ---------- priority ----------
/** The spells worth stopping a combat step for: the ones that act on a creature. */
const COMBAT = new Set(["Piracy Charm", "Repulse", "Commit", "Mind Bend", "Metamorphose"]);
/** Whether a seat holding priority is asked: it could do something, and (on an empty stack) this is a step it stops at. */
export function wants(s, seat) {
  if (s.stack.length) return hasMove(s, seat);
  if (!(seat === s.active ? MY_STOPS : THEIR_STOPS).has(s.step)) return false;
  return hasMove(s, seat, s.step === "attackers" || s.step === "blockers" ? COMBAT : null);
}
/** Who draws next if nothing else is drawn first: the player whose draw step is next. */
export const nextDrawer = s => (s.step === "upkeep" && s.turn > 1 ? s.active : other(s.active));
function passPriority(s) {
  s.passes++;
  if (s.passes < 2) { s.prio = other(s.prio); return; }
  s.passes = 0;
  if (s.stack.length) resolveTop(s);
  else advance(s);
}
/** Plays the game on until a seat has a decision: priority passes where a seat has nothing to do, and the steps go by. */
export function settle(s) {
  for (let guard = 0; guard < 3000; guard++) {
    if (s.over || s.pending) return;
    if (sba(s)) continue;
    if (wants(s, s.prio)) return;
    passPriority(s);
  }
  throw new Error("dandan: the game didn't settle");
}

// ---------- resolving ----------
function resolveTop(s) {
  const it = s.stack[s.stack.length - 1];
  if (!stillLegal(s, it)) {
    say(s, `${it.name} fizzles: its target is gone`);
    leaveStack(s, it, "yard");
    s.prio = s.active;
    return;
  }
  s.res = it.sid;
  if (RES[it.name](s, it) === "wait") return;
  finish(s, it);
}
function finish(s, it) {
  s.res = 0;
  leaveStack(s, it, it.kind === "spell" && !it.moved ? "yard" : "none");
  s.prio = s.active;
  s.passes = 0;
}
/** A question's been answered: the item it was asked for carries on. */
function resume(s) {
  const it = itemOf(s, s.res);
  s.pending = null;
  if (!it) { s.res = 0; return; }
  if (RES[it.name](s, it) === "wait") return;
  finish(s, it);
}

// ---------- casting ----------
/** What a cast costs: a flashback's own cost from the graveyard; Deem Inferior {1} less for each card drawn this turn. */
export function costOf(s, seat, half, from) {
  const d = CARDS[half], c = parseCost(from === "yard" && d.flashback ? d.flashback : d.cost);
  if (half === "Deem Inferior") c.g = Math.max(0, c.g - s.drawn[seat]);
  return c;
}
/** Which half a card is cast as: from the hand its front, from the graveyard Memory (or a flashback card itself). */
export function halfOf(id, from = "hand") {
  const full = DECK[id];
  if (from === "yard") return full === "Commit // Memory" ? "Memory" : CARDS[full]?.flashback ? full : null;
  return HALVES[full] ? HALVES[full][0] : full;
}
/** A cast checked: { id, from, half, d, cost, plan, mode, targets } or why not. */
export function checkCast(s, seat, m) {
  const from = m.from === "yard" ? "yard" : "hand", id = m.card;
  if (!Number.isInteger(id) || id < 0 || id >= DECK.length) return "No such card";
  if (from === "hand" ? !s.hand[seat].includes(id) : !s.yard.includes(id)) return from === "hand" ? "That card isn't in your hand" : "That card isn't in the graveyard";
  const half = halfOf(id, from), d = half && CARDS[half];
  if (!d) return "That can't be cast from the graveyard";
  if (d.type === "land") return "A land is played, not cast";
  if ((d.type === "sorcery" || d.type === "creature") && !(seat === s.active && isMain(s) && !s.stack.length)) {
    if (!(d.type === "sorcery" && s.quick[seat])) return "Only in your main phase with nothing on the stack";
  }
  const plan = payPlan(s, seat, costOf(s, seat, half, from));
  if (!plan) return "Not enough mana";
  const mode = d.modes ? (m.mode ?? 0) : 0;
  if (d.modes && !(Number.isInteger(mode) && mode >= 0 && mode < d.modes.length)) return "Choose what it does";
  const lists = targetLists(s, seat, half, mode), targets = list(m.targets);
  if (!lists.length) return "It has no legal target";
  if (!lists.some(l => l.length === targets.length && l.every((t, i) => same(t, targets[i])))) return "Choose a legal target";
  return { id, from, half, d, cost: costOf(s, seat, half, from), plan, mode, targets };
}
/** A target in words, for the log. */
export function targetWords(s, t) {
  if (t.k === "s") return itemOf(s, t.sid)?.name || "a spell";
  if (t.k === "p") return `{s${t.seat}}`;
  const p = perm(s, t.id);
  return p ? `${nm(t.id)}${isLand(p) || nm(t.id) === "Clue" ? "" : ` ({s${p.ctl}})`}` : nm(t.id);
}
function doCast(s, seat, r, hold) {
  if (r.from === "hand") fromHand(s, seat, r.id); else fromYard(s, r.id);
  pay(s, r.plan);
  if (r.d.type === "sorcery") s.quick[seat] = false;
  const it = pushItem(s, { kind: "spell", name: r.half, card: r.id, ctl: seat, targets: r.targets.map(t => ({ ...t })), mode: r.mode, ...(r.from === "yard" ? { eol: true, from: "yard" } : {}) });
  const tw = r.targets.map(t => targetWords(s, t)).join(", ");
  say(s, `{s${seat}} casts ${r.half}${r.d.modes ? ` (${["islandwalk", "+2/−1", "discard"][r.mode]})` : ""}${tw ? ` on ${tw}` : ""}${r.from === "yard" ? " from the graveyard" : ""}`);
  if (hold) { s.passes = 0; s.prio = seat; } else { s.passes = 1; s.prio = other(seat); }
  return it;
}

// ---------- the other moves ----------
/** Cycling and islandcycling: the cost to pay, from the hand. */
function checkCycle(s, seat, m) {
  const id = m.card;
  if (!Number.isInteger(id) || !s.hand[seat].includes(id)) return "That card isn't in your hand";
  const d = CARDS[HALVES[DECK[id]] ? HALVES[DECK[id]][0] : DECK[id]];
  if (!d.cycling) return "That can't be cycled";
  const plan = payPlan(s, seat, parseCost(d.cycling));
  return plan ? { id, d, plan } : "Not enough mana";
}
/** A land on the battlefield's own ability: Flood Plain's fetch (tap, sacrifice), a Clue's draw ({2}, sacrifice). */
function checkAbility(s, seat, m) {
  const p = perm(s, m.id);
  if (!p || p.ctl !== seat) return "That isn't yours";
  if (nm(p.id) === "Flood Plain") return p.tapped ? "It's tapped" : { p, ab: "fetch" };
  if (nm(p.id) === "Clue") { const plan = payPlan(s, seat, parseCost(CARDS.Clue.clue)); return plan ? { p, ab: "clue", plan } : "Not enough mana"; }
  return "That has no ability";
}
function checkLand(s, seat, m) {
  const id = m.card;
  if (!Number.isInteger(id) || !s.hand[seat].includes(id)) return "That card isn't in your hand";
  if (!isLandId(id)) return "That isn't a land";
  if (seat !== s.active || !isMain(s) || s.stack.length) return "Lands are played in your main phase with nothing on the stack";
  if (s.played >= 1) return "You've played a land this turn";
  return { id };
}

/** One move checked: the thing it does, or why not (a string). Being the seat with priority is act()'s to check. */
export function check(s, seat, m) {
  switch (m?.t) {
    case "pass": return { t: "pass" };
    case "land": return checkLand(s, seat, m);
    case "cast": return checkCast(s, seat, m);
    case "cycle": return checkCycle(s, seat, m);
    case "ability": return checkAbility(s, seat, m);
    default: return "Not a move";
  }
}

function priorityMove(s, seat, m) {
  const r = check(s, seat, m);
  if (typeof r === "string") return r;
  switch (m.t) {
    case "pass": passPriority(s); break;
    case "land": {
      fromHand(s, seat, r.id);
      enterBf(s, r.id, seat);
      s.played++;
      s.passes = 0;
      say(s, `{s${seat}} plays ${nm(r.id)}`);
      break;
    }
    case "cast": doCast(s, seat, r, !!m.hold); break;
    case "cycle": {
      pay(s, r.plan);
      fromHand(s, seat, r.id);
      toYard(s, r.id);
      pushItem(s, { kind: "ability", name: r.d.islandcycling ? "@isle" : "@cycle", ctl: seat, src: r.id });
      say(s, `{s${seat}} cycles ${nm(r.id)}`);
      s.passes = 1;
      s.prio = other(seat);
      break;
    }
    case "ability": {
      if (r.ab === "fetch") {
        const types = fetchTypes(r.p);
        toGrave(s, r.p.id);
        pushItem(s, { kind: "ability", name: "@fetch", ctl: seat, src: r.p.id, d: { types } });
        say(s, `{s${seat}} sacrifices Flood Plain to search for a ${types.join(" or ")}`);
      } else {
        pay(s, r.plan);
        leaveBf(s, r.p.id);
        pushItem(s, { kind: "ability", name: "@clue", ctl: seat, src: r.p.id });
        say(s, `{s${seat}} cracks a Clue`);
      }
      s.passes = 1;
      s.prio = other(seat);
      break;
    }
  }
  return null;
}

// ---------- answers to a question ----------
const distinct = a => new Set(a).size === a.length;
function answer(s, seat, m) {
  const p = s.pending;
  if (p.t === "mull" ? !["keep", "mull"].includes(m?.t) : m?.t !== p.t) return "Answer the question first";
  const cards = list(m.cards);
  const resolving = p.sid ? itemOf(s, p.sid) : null;
  switch (p.t) {
    case "mull":
      if (m.t === "keep") { keepHand(s, seat); return null; }
      if (s.mull.n[seat] >= 6 && !p.free) return "Keep this hand";
      mulligan(s, seat);
      return null;
    case "bottom": {
      if (cards.length !== p.n || !distinct(cards) || !cards.every(id => s.hand[seat].includes(id))) return `Choose ${p.n} to put on the bottom`;
      for (const id of cards) { fromHand(s, seat, id); toLib(s, id, "bottom", 1 << seat); }
      doneMull(s, seat);
      return null;
    }
    case "attack": {
      const ids = list(m.ids);
      if (!distinct(ids) || !ids.every(id => p.ids.includes(id))) return "Those can't attack";
      s.pending = null;
      s.prio = s.active;
      s.passes = 0;
      if (!ids.length) { s.step = "main2"; s.combat = null; return null; }
      for (const id of ids) perm(s, id).tapped = true;
      s.combat = { att: ids, blk: [] };
      s.attacked = true;
      say(s, `{s${seat}} attacks with ${ids.length === 1 ? "a Dandân" : `${ids.length} Dandâns`}`);
      return null;
    }
    case "block": {
      const pairs = list(m.pairs).map(list);
      if (!pairs.every(q => q.length === 2 && p.blockers.includes(q[0]) && p.attackers.includes(q[1])) || !distinct(pairs.map(q => q[0]))) return "Those blocks aren't legal";
      s.pending = null;
      s.prio = s.active;
      s.passes = 0;
      s.combat.blk = pairs;
      if (pairs.length) say(s, `{s${seat}} blocks with ${pairs.length === 1 ? "a Dandân" : `${pairs.length} Dandâns`}`);
      return null;
    }
    case "discard": {
      if (cards.length !== p.n || !distinct(cards) || !cards.every(id => s.hand[seat].includes(id))) return `Discard ${p.n}`;
      for (const id of cards) { fromHand(s, seat, id); toYard(s, id); }
      say(s, `{s${seat}} discards ${cards.map(nm).join(", ")}`);
      if (p.cleanup) { s.pending = null; endTurn(s); } else resume(s);
      return null;
    }
    case "putback": {
      if (cards.length !== p.n || !distinct(cards) || !cards.every(id => s.hand[seat].includes(id))) return `Choose ${p.n} cards to put back`;
      for (const id of cards) fromHand(s, seat, id);
      for (let i = cards.length - 1; i >= 0; i--) toLib(s, cards[i], "top", 1 << seat);
      say(s, `{s${seat}} puts ${cards.length} back on the library`);
      resume(s);
      return null;
    }
    case "order": {
      if (cards.length !== p.cards.length || !distinct(cards) || !cards.every(id => p.cards.includes(id))) return "Put all of them in an order";
      s.lib.splice(0, cards.length, ...cards);
      resume(s);
      return null;
    }
    case "surveil": {
      if (typeof m.yard !== "boolean") return "Keep it or put it in the graveyard";
      if (m.yard) { mill(s, 1); say(s, `{s${seat}} puts ${nm(p.card)} in the graveyard`); } else say(s, `{s${seat}} keeps it on top`);
      resume(s);
      return null;
    }
    case "search": {
      const id = m.card ?? null;
      if (id !== null && !p.ids.includes(id)) return "That isn't one you can find";
      if (id !== null) {
        fromLib(s, id);
        if (p.to === "bf") { enterBf(s, id, seat); say(s, `{s${seat}} fetches ${nm(id)}`); }
        else { s.hand[seat].push(id); say(s, `{s${seat}} finds ${nm(id)}`); }
      } else say(s, `{s${seat}} finds nothing`);
      shuffleLib(s);
      resume(s);
      return null;
    }
    case "pick": {
      const id = m.card ?? null;
      if (id === null ? !p.optional : !p.ids.includes(id)) return id === null ? "Choose one" : "That isn't one you can choose";
      if (id !== null) {
        if (p.for === "drop") { fromHand(s, seat, id); enterBf(s, id, seat); say(s, `{s${seat}} puts ${nm(id)} onto the battlefield`); }
        else if (p.for === "boil") { bounce(s, id); say(s, `{s${seat}} returns ${nm(id)} to hand`); }
        else if (p.for === "sanct") { fromYard(s, id); toLib(s, id, "top", 3); say(s, `${nm(id)} goes on top of the library`); }
      }
      resume(s);
      return null;
    }
    case "owner": {
      if (typeof m.bottom !== "boolean") return "Second from the top, or the bottom";
      permToLib(s, p.target, m.bottom ? "bottom" : "second");
      say(s, `{s${seat}} puts it ${m.bottom ? "on the bottom" : "second from the top"}`);
      resume(s);
      return null;
    }
    case "bend": {
      if (!p.froms.includes(m.from) || !BASICS.includes(m.to) || m.to === m.from) return "Choose what to change, and to what";
      const t = perm(s, p.target);
      (t.tc ||= []).push([m.from, m.to]);
      say(s, `${nm(t.id)}: ${m.from} becomes ${m.to}`);
      resume(s);
      return null;
    }
    case "name": {
      if (!NAMES.includes(m.name)) return "Name a card in the deck";
      itemOf(s, p.sid).d.name = m.name;
      say(s, `{s${seat}} names ${m.name}`);
      resume(s);
      return null;
    }
    case "retarget": {
      const t = list(m.targets);
      if (t.length) {
        if (!p.options.some(l => l.length === t.length && l.every((x, i) => same(x, t[i])))) return "That isn't a legal target";
        itemOf(s, p.copy).targets = t.map(x => ({ ...x }));
        say(s, "The copy takes a new target");
      }
      resume(s);
      return null;
    }
  }
  return "Not now";
}

/** A seat's move made on a game (the runner hands in a copy and keeps it if this returns one). */
export function act(s, seat, m, { rng } = {}) {
  return withRng(rng, () => {
    if (s.over) return "The game is over";
    const err = s.pending ? (s.pending.seat === seat ? answer(s, seat, m) : "It isn't your turn") : (s.prio === seat ? priorityMove(s, seat, m) : "You don't have priority");
    if (err) return err;
    settle(s);
    return s;
  });
}
export const toMove = s => (s.over ? null : s.pending ? s.pending.seat : s.prio);

// ---------- what a seat could do ----------
/**
 * Every move a seat could make with priority now (not passing): lands, casts with their modes and targets, cycling,
 * abilities. A move per distinct card name. firstOnly: stop at the first (is there anything?).
 */
export function moves(s, seat, firstOnly = false, only = null) {
  const out = [], seen = new Set();
  const tryMove = m => {
    if (typeof check(s, seat, m) === "string") return false;
    out.push(m);
    return firstOnly;
  };
  for (const id of s.hand[seat]) {
    const full = DECK[id];
    if (seen.has(full)) continue;
    seen.add(full);
    const half = HALVES[full] ? HALVES[full][0] : full;
    if (only && !only.has(half)) continue;
    if (isLandId(id)) { if (tryMove({ t: "land", card: id })) return out; }
    else {
      for (let mode = 0; mode < modesOf(half); mode++) {
        for (const targets of targetLists(s, seat, half, mode)) {
          if (tryMove({ t: "cast", card: id, from: "hand", ...(CARDS[half].modes ? { mode } : {}), targets })) return out;
        }
      }
    }
    if (CARDS[half].cycling && tryMove({ t: "cycle", card: id })) return out;
  }
  const seenY = new Set();
  for (const id of s.yard) {
    const half = halfOf(id, "yard");
    if (!half || seenY.has(half) || (only && !only.has(half))) continue;
    seenY.add(half);
    for (const targets of targetLists(s, seat, half, 0)) if (tryMove({ t: "cast", card: id, from: "yard", targets })) return out;
  }
  if (!only) {
    for (const p of s.bf) {
      if (p.ctl === seat && (nm(p.id) === "Flood Plain" || nm(p.id) === "Clue") && tryMove({ t: "ability", id: p.id })) return out;
    }
  }
  return out;
}
export const hasMove = (s, seat, only = null) => moves(s, seat, true, only).length > 0;

// ---------- the game made whole after the database ----------
const lists = (o, keys, always = false) => { for (const k of keys) if (always || o[k] != null) o[k] = list(o[k]); };
export function restore(s) {
  if (!s) return s;
  lists(s, ["lib", "yard", "exile", "bf", "stack", "log"], true);
  s.hand = [0, 1].map(i => list(s.hand?.[i]));
  s.kn = list(s.kn).map(list);
  s.life = [0, 1].map(i => s.life?.[i] ?? LIFE);
  s.drawn = [0, 1].map(i => s.drawn?.[i] || 0);
  s.quick = [0, 1].map(i => !!s.quick?.[i]);
  s.lost = [0, 1].map(i => !!s.lost?.[i]);
  s.mull = { n: [0, 1].map(i => s.mull?.n?.[i] || 0), done: [0, 1].map(i => !!s.mull?.done?.[i]) };
  for (const p of s.bf) { if (p.tc) p.tc = list(p.tc).map(list); if (p.pump) p.pump = [p.pump[0] || 0, p.pump[1] || 0]; }
  for (const it of s.stack) { it.targets = list(it.targets); it.d ||= {}; }
  // the database keeps no nulls: a missing one is null again
  s.combat = s.combat ? { att: list(s.combat.att), blk: list(s.combat.blk).map(list) } : null;
  s.reveal = s.reveal ? { seat: s.reveal.seat, cards: list(s.reveal.cards) } : null;
  s.pending ||= null;
  if (s.pending) {
    lists(s.pending, ["ids", "cards", "froms", "blockers", "attackers"]);
    if (s.pending.options) s.pending.options = list(s.pending.options).map(l => list(l));
  }
  s.nt ||= 0;
  s.res ||= 0;
  s.why ||= "";
  s.ln ||= 0;
  return s;
}
