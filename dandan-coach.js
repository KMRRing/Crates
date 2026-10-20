// Dandan's coach in words, for the page's Hint, Check and Always: what dandan-think.js's weighing of a decision comes
// to. A move by name ("Cast Memory Lapse on their Dandân", "Attack with both Dandâns"), the coach's line at a decision
// (its move, the one or two things that decide it, its chance of winning), and the check's verdict on a move of yours:
// as good, or how much worse and why. The reasons are worked out from the table, the move and the format's rules of
// thumb (who draws the card a counter puts on top, the mana that untaps, the last Island), the figures from the
// weighing. Pure, so the tests read it as the page does.
import { CARDS, DECK, HALVES, total } from "./dandan-cards.js";
import { nextDrawer, halfOf, costOf } from "./dandan-engine.js";
import { other, nm, perm, isLand, isCreature, creatures, lands, needType, typesOf, itemOf, pt } from "./dandan-core.js";
import { facts, counterRisk, holds } from "./dandan-policy.js";

const pc = x => `${Math.round(100 * x)}%`;
const plural = (n, one, many) => (n === 1 ? one : many);
const cap = w => (w ? w[0].toUpperCase() + w.slice(1) : w);
const front = id => (HALVES[DECK[id]] ? HALVES[DECK[id]][0] : DECK[id]);
/**
 * Whether two moves are the same: their JSON, with a permanent's object number left out (a move from the page may not
 * carry it), and the cards of a set (put on the bottom, discarded, attacking, blocking) in any order.
 */
export const sameMove = (a, b) => !!a && !!b && JSON.stringify(norm(a), strip) === JSON.stringify(norm(b), strip);
const strip = (k, v) => (k === "oid" || k === "hold" ? undefined : v);
function norm(m) {
  if (m.t === "bottom" || m.t === "discard") return { ...m, cards: [...(m.cards || [])].sort((x, y) => x - y) };
  if (m.t === "attack") return { ...m, ids: [...(m.ids || [])].sort((x, y) => x - y) };
  if (m.t === "block") return { ...m, pairs: [...(m.pairs || [])].map(p => [...p]).sort((x, y) => x[0] - y[0] || x[1] - y[1]) };
  return m;
}

// ---------- a move by name ----------
/** A permanent or spell as the seat would call it: "their Dandân", "your Island", "their Brainstorm". */
function thing(s, seat, t) {
  if (!t) return "";
  if (t.k === "p") return t.seat === seat ? "yourself" : "them";
  if (t.k === "g") return `${nm(t.id)} in the graveyard`;
  if (t.k === "s") { const it = itemOf(s, t.sid); return it ? `${it.ctl === seat ? "your" : "their"} ${spellName(it)}` : "a spell"; }
  const p = perm(s, t.id);
  return p ? `${p.ctl === seat ? "your" : "their"} ${nm(t.id)}` : nm(t.id);
}
const STACK_NAMES = { "@fetch": "Flood Plain search", "@isle": "islandcycling", "@cycle": "cycling", "@clue": "Clue", "@dandan": "Dandân sacrifice",
  "@depths": "Halimar Depths look", "@falls": "surveil", "@boil": "Izzet Boilerworks return", "@sanct": "Mystic Sanctuary" };
const spellName = it => STACK_NAMES[it.name] || it.name;
const MODE = ["for islandwalk", "for +2/−1", "for a discard"];
const handNames = ids => ids.map(nm).join(" and ");

/** A move in words, as an instruction without its capital: "cast Memory Lapse on their Dandân", "pass". */
export function moveName(m, s, seat) {
  if (!m) return "";
  switch (m.t) {
    case "pass": return s.stack.length ? "let it resolve" : "pass";
    case "land": return `play ${nm(m.card)}`;
    case "cast": {
      const half = m.from === "yard" ? halfOf(m.card, "yard") : front(m.card);
      const how = CARDS[half]?.modes ? ` ${MODE[m.mode ?? 0]}` : "";
      const t = m.targets?.[0];
      const on = !t ? "" : t.k === "g" ? ` for ${nm(t.id)}` : ` on ${thing(s, seat, t)}`;
      const flash = m.from === "yard" ? (CARDS[half]?.flashback ? " with flashback" : " from the graveyard") : "";
      return `cast ${half}${how}${on}${flash}`;
    }
    case "cycle": return `${CARDS[front(m.card)]?.islandcycling ? "islandcycle" : "cycle"} ${nm(m.card)}`;
    case "ability": return nm(m.id) === "Clue" ? "crack the Clue" : "sacrifice Flood Plain for an Island";
    case "keep": return "keep this hand";
    case "mull": return s.pending?.free ? "take the free mulligan" : "take a mulligan";
    case "bottom": return `put ${handNames(m.cards || [])} on the bottom`;
    case "discard": return `discard ${handNames(m.cards || [])}`;
    case "putback": return (m.cards || []).length > 1 ? `put back ${nm(m.cards[0])} on top and ${nm(m.cards[1])} under it` : `put back ${handNames(m.cards || [])}`;
    case "attack": {
      const n = (m.ids || []).length, all = s.pending?.ids?.length || n;
      return !n ? "don't attack" : n === all && n > 1 ? `attack with all ${n} Dandâns` : `attack with ${n === 1 ? "one Dandân" : `${n} Dandâns`}`;
    }
    case "block": { const n = (m.pairs || []).length; return !n ? "don't block" : `block ${n === 1 ? "their attacker" : `${n} attackers`}`; }
    case "order": return `put them ${(m.cards || []).map(nm).join(", ")}, the first on top`;
    case "surveil": return m.yard ? `put ${nm(s.pending?.card)} in the graveyard` : `keep ${nm(s.pending?.card)} on top`;
    case "search": return m.card == null ? "find nothing" : `${s.pending?.to === "bf" ? "fetch" : "find"} ${nm(m.card)}`;
    case "pick": {
      if (m.card == null) return s.pending?.for === "sanct" ? "put nothing on top" : "put nothing in";
      return s.pending?.for === "boil" ? `return ${nm(m.card)}` : s.pending?.for === "drop" ? `put ${nm(m.card)} onto the battlefield` : `put ${nm(m.card)} on top`;
    }
    case "owner": return m.bottom ? "put it on the bottom" : "put it second from the top";
    case "bend": {
      const t = perm(s, s.pending?.target);
      return t && isCreature(t) ? `make it look for a ${m.to} instead of an ${m.from}` : `turn its ${m.from} into a ${m.to}`;
    }
    case "name": return `name ${m.name}`;
    case "retarget": {
      if (!m.targets?.length) return "keep the copy's target";
      const t = m.targets[0], it = t.k === "s" ? itemOf(s, t.sid) : null;
      if (it && it.sid === s.pending?.sid) return "aim the copy at your Reversal, so it does nothing";
      return `aim the copy at ${thing(s, seat, t)}`;
    }
  }
  return "";
}
export const moveSaid = (m, s, seat) => cap(moveName(m, s, seat));

// ---------- why ----------
/**
 * The one or two things that tell for move `a` over move `b` at this decision, in words, from the table and the
 * format's rules of thumb, said from a's side (what a has going for it, then what b has against it). Each reason is
 * about something (keeping Lapse mana, the free mana at their end step, the card on top…): two about the same thing
 * are one.
 */
export function reasons(s, seat, a, b, { againstFirst = false } = {}) {
  const F = facts(s, seat), out = [], themes = new Set();
  const pro = forMove(s, seat, F, a, true), con = forMove(s, seat, F, b, false);
  for (const [theme, text] of againstFirst ? [...con, ...pro] : [...pro, ...con]) {
    if (themes.has(theme) || out.length >= 2) continue;
    themes.add(theme);
    out.push(text);
  }
  return out;
}
/** What a move says for itself (good: it is the better one) or against itself (it is the worse): [theme, sentence] pairs. */
function forMove(s, seat, F, m, good) {
  if (!m) return [];
  const out = [], say = (theme, text) => out.push([theme, text]);
  const opp = other(seat), next = nextDrawer(s), myTurn = s.active === seat;
  const theirEnd = !myTurn && s.step === "end" && !s.stack.length;
  const t0 = m.targets?.[0], target = t0?.k === "c" ? perm(s, t0.id) : null, spell = t0?.k === "s" ? itemOf(s, t0.sid) : null;
  const hand = s.hand[seat].map(id => DECK[id]);
  const lapseOpen = (hand.includes("Memory Lapse") || hand.includes("Narset's Reversal")) && F.my.n >= 2;
  const half = m.t === "cast" ? (m.from === "yard" ? halfOf(m.card, "yard") : front(m.card)) : null;
  const risk = half ? counterRisk(F, half) : 0;
  const free = "It's the end of their turn: your lands untap next, so this mana is free.";
  const stealing = s.step === "upkeep" && !myTurn && F.known != null;
  switch (m.t) {
    case "pass": {
      if (s.stack.length) {
        const top = s.stack[s.stack.length - 1];
        if (good && top.ctl !== seat) {
          if (top.kind === "spell" && next === opp) say("top", `Countered now, their ${spellName(top)} would only go back on top for them to draw again.`);
          else say("keep", `Their ${spellName(top)} isn't worth an answer: keep the card for something that is.`);
        }
        break;
      }
      if (good && myTurn && lapseOpen) say("lapse-mana", "Keep two open for Memory Lapse: whatever you counter on their turn goes on top for you to draw.");
      else if (good && myTurn && F.their.u >= 1 && F.their.n >= 2) say("counter-risk", `They have ${F.their.n} open: a spell cast into that on your turn, if countered, goes on top for them.`);
      else if (good && !myTurn && !theirEnd) say("wait", "Wait: their turn isn't over, and what you'd spend now is what answers their next spell.");
      if (!good && theirEnd && F.my.n) say("end-step", "It's the end of their turn: your lands untap next, so mana left open now goes to waste.");
      break;
    }
    case "land": {
      const d = CARDS[DECK[m.card]], isl = (d.subs || []).includes("Island");
      const mine = F.mine.length + hand.filter(n => n === "Dandân").length;
      if (good && isl && mine && F.myIsl < 2) say("islands", `An Island keeps your ${plural(mine, "Dandân", "Dandâns")} alive: with none, ${plural(mine, "it is", "they are")} sacrificed.`);
      if (good && !isl && !mine && F.theirs.length && F.myIsl === 0) say("islands", "With no Island of yours, their Dandâns can't attack you at all.");
      if (!good && isl && !mine && F.theirs.length && F.myIsl === 0) say("islands", "Your first Island is what lets their Dandâns attack you.");
      if (!good && d.tapped) say("tapped", `${nm(m.card)} comes in tapped.`);
      break;
    }
    case "cast": {
      if (half === "Dandân") {
        if (!F.myIsl) { if (!good) say("islands", "With no Island of yours it would be sacrificed at once."); }
        else if (good && F.noLapse && F.their.n >= 2) say("counter-risk", "They let your last Dandân resolve with a Lapse's mana open, and haven't drawn since: they very likely hold no Memory Lapse.");
        else if (good && risk < 0.15) say("counter-risk", F.their.n < 2 ? "They are tapped out: nothing can counter it now." : "Little chance they can counter it now.");
        else if (!good && risk >= 0.25) say("counter-risk", `They have ${F.their.n} open: a Memory Lapse (they hold one about ${pc(holds(F, "Memory Lapse"))} of the time) puts it on top for them to draw.`);
        if (good && F.theirIsl) say("clock", "Once it's in, it attacks for 4 a turn: they control an Island.");
        if (!good && !F.theirIsl) say("clock", "They control no Island, so it couldn't attack them.");
        break;
      }
      if (spell && ["Memory Lapse", "Commit", "Narset's Reversal"].includes(half)) {
        const theirs = spell.ctl !== seat;
        if (half === "Narset's Reversal") {
          if (good && theirs) say("reversal", `Their ${spellName(spell)} goes back to their hand unresolved, and you get a copy of it.`);
          break;
        }
        if (!theirs) { if (!good) say("own", "That would counter your own spell."); break; }
        const to = half === "Memory Lapse" ? next : other(next), where = half === "Memory Lapse" ? "on top" : "second from the top";
        if (good) say("top", to === seat ? `Countered now, their ${spellName(spell)} goes ${where}, and you draw it.` : `It stops their ${spellName(spell)} now, though it goes back for them to draw.`);
        else if (to !== seat) say("top", `Countered now, their ${spellName(spell)} only goes back ${where} for them to draw: the counter is worth more later.`);
        break;
      }
      if (half === "Mind Bend" && target && target.ctl !== seat) {
        if (isCreature(target)) { if (good) say("bend", "Mind Bend on a Dandân is a kill for one blue: told to look for a land type they don't have, it is sacrificed."); }
        else if (isLand(target)) {
          const dying = creatures(s, target.ctl).filter(d => typesOf(target).includes(needType(d)) && islandsOfType(s, target.ctl, needType(d)) <= 1).length;
          if (dying && good) say("islands", `It's their last Island: ${plural(dying, "their Dandân goes", `their ${dying} Dandâns go`)} with it.`);
          else if (!dying && !good) say("bend", "An Island turned into a Swamp still makes mana for them: keep Mind Bend for a Dandân, or for their last Island under one.");
        }
        break;
      }
      if (["Piracy Charm", "Repulse", "Commit", "Metamorphose", "Gone Missing", "Deem Inferior"].includes(half) && target) {
        const attacking = s.combat?.att.includes(target.id) && target.ctl !== seat;
        if (isCreature(target) && target.ctl !== seat) {
          if (attacking) { if (good) say("combat", "It's attacking you: answered now, its 4 damage never lands."); }
          else if (good && theirEnd) say("end-step", "It's the end of their turn: your lands untap next, so the mana is free, and their Dandân won't be there to block yours.");
          else if (!good && !theirEnd) say("timing", "Better kept until it attacks, or the end of their turn, when the mana is free.");
          if (["Metamorphose", "Gone Missing"].includes(half)) {
            if (good && next === seat) say("top", "It goes on top, and you draw it next.");
            if (!good && next !== seat) say("top", "It goes on top, and they draw it straight back.");
          }
        } else if (isLand(target) && target.ctl !== seat && !good) say("islands", "Taking a land of theirs matters little while no Dandân depends on it.");
        if (half === "Piracy Charm" && m.mode === 0 && good) say("combat", "Islandwalk: they control an Island, so it can't be blocked.");
        break;
      }
      // the spells that draw: when the mana is free, and when the top card is known
      if (["Brainstorm", "Predict", "Quicken", "Take Inventory", "Chart a Course", "Lórien Revealed", "Mystic Retrieval"].includes(half)) {
        if (good && stealing) say("top", `You know the top card is ${nm(F.known)}: drawn now, it's yours instead of theirs.`);
        if (good && half === "Predict" && F.known != null) say("top", `You know the top card is ${nm(F.known)}: name it, and Predict draws two.`);
        if (good && theirEnd) say("end-step", free);
        if (!good && myTurn && lapseOpen && F.my.n - total(costOf(s, seat, half, m.from)) < 2) say("lapse-mana", "It taps the two you'd keep for Memory Lapse on their turn.");
        if (!good && myTurn && risk >= 0.3 && CARDS[half].type === "sorcery") say("counter-risk", `Cast on your turn into ${F.their.n} open mana, a counter would put it on top for them.`);
      }
      break;
    }
    case "cycle": case "ability": {
      if (good && stealing && m.t === "cycle") say("top", `You know the top card is ${nm(F.known)}: drawn now, it's yours instead of theirs.`);
      if (good && theirEnd) say("end-step", free);
      if (m.t === "ability" && nm(m.id) === "Flood Plain" && F.known != null) {
        if (!good && next === seat) say("top", `It shuffles away the ${nm(F.known)} you'd draw next.`);
        if (good && next !== seat) say("top", `It shuffles away the ${nm(F.known)} they'd draw next.`);
      }
      break;
    }
    case "attack": {
      const n = (m.ids || []).length;
      const back = F.theirs.filter(d => islandsOfType(s, seat, needType(d)) > 0).length, blockers = F.theirs.filter(d => !d.tapped).length;
      if (good && n && n > blockers) say("combat", `They have ${blockers ? `only ${blockers} to block with` : "nothing to block with"}.`);
      if (!good && n && back * 4 >= s.life[seat]) say("combat", `Their Dandâns could swing back for ${4 * back}: you're at ${s.life[seat]}, and an attacker can't block.`);
      if (good && !n && back * 4 >= s.life[seat]) say("combat", `Keep them home: their swing back could be ${4 * back}, and you're at ${s.life[seat]}.`);
      break;
    }
    case "block": {
      const n = (m.pairs || []).length;
      const incoming = (s.pending?.attackers || []).map(id => perm(s, id)).filter(Boolean).reduce((t, p) => t + Math.max(0, pt(p)[0]), 0);
      if (good && n) say("combat", `Unblocked, you'd go to ${s.life[seat] - incoming}: a Dandân for a Dandân is an even trade.`);
      if (good && !n) say("combat", `At ${s.life[seat]} you can take ${incoming}, and keep your Dandân to attack.`);
      break;
    }
    case "putback": case "order": case "surveil":
      say("top", next === seat ? "You draw the top card next." : "They draw the top card next: give them the one they'd least like.");
      break;
    case "keep": case "mull": {
      const h = s.hand[seat], n = h.filter(id => CARDS[front(id)]?.type === "land").length;
      if (m.t === "keep" && good) say("hand", `${n} ${plural(n, "land", "lands")} and ${h.length - n} spells: enough to play.`);
      if (m.t === "mull" && good) say("hand", s.pending?.free ? "It's free: a hand short of lands or spells is shown and dealt again." : `${n} ${plural(n, "land", "lands")} in seven is too ${n < 2 ? "few" : "many"}.`);
      break;
    }
    case "pick":
      if (s.pending?.for === "boil" && good) say("land", "Return a land that's already tapped: you play it again next turn.");
      if (s.pending?.for === "sanct") say("top", next === seat ? "You draw the top card next." : "They draw the top card next.");
      break;
    case "owner": say("top", other(next) === seat ? "You'd draw the second card." : "They'd draw the second card."); break;
    case "bend": {
      const t = perm(s, s.pending?.target);
      if (t && isCreature(t) && good) say("bend", `They have no ${m.to}: told to look for one, it is sacrificed.`);
      break;
    }
    default: break;
  }
  return out;
}
const islandsOfType = (s, seat, type) => s.bf.filter(l => l.ctl === seat && isLand(l) && typesOf(l).includes(type)).length;

// ---------- the coach's lines ----------
const entry = (r, m) => r.list.find(c => sameMove(c.move, m));

/**
 * What the coach makes of a decision, in a line: its move, the thing that decides it (said for the move itself, or
 * against the next best when that is clearly worse), and its chance of winning from there.
 */
export function adviceLine(r, s, seat) {
  const m = r.best;
  if (r.only) return `${moveSaid(m, s, seat)}: the only move`;
  const c = entry(r, m), next = r.list.find(x => !sameMove(x.move, m));
  const clear = next && c && c.mean - next.mean > MARGIN;
  const why = reasons(s, seat, m, clear ? next.move : null);
  return [moveSaid(m, s, seat), ...why.slice(0, 1).map(w => w.replace(/\.$/, "")), c && Number.isFinite(c.mean) ? `${pc(c.mean)} to win` : ""].filter(Boolean).join(" · ");
}

/** Below this a move is as good as the coach's (a share of the chance of winning), and it must be clear of it by twice the gap's standard error. */
export const MARGIN = 0.03;
/**
 * The check's verdict on a move of yours, from the coach's weighing of the decision before it (r, with your move in it):
 * null when it's the coach's or as good as near as the deals can tell; else { gap, words, best }.
 */
export function verdict(r, mine, s, seat) {
  const best = r.list[0], m = entry(r, mine);
  if (!m || r.only || sameMove(best.move, mine)) return null;
  const gap = best.mean - m.mean, se = Math.hypot(best.se, m.se);
  if (!(gap > MARGIN && gap > 2 * se)) return null;
  // what tells against yours first: it's your move the word is about; with no rule of thumb to say, the deals do
  const why = reasons(s, seat, best.move, mine, { againstFirst: true });
  if (!why.length && m.vs) why.push(`Played out, ${doing(best.move, s, seat)} came out ahead in ${m.better} of the ${m.vs} deals and behind in ${m.worse}.`);
  return { gap, se, best: best.move, words: `${cap(doing(mine, s, seat))}: about ${Math.round(100 * gap)} points worse than ${doing(best.move, s, seat)} (${pc(m.mean)} to win against ${pc(best.mean)}).${why.length ? ` ${why.join(" ")}` : ""}` };
}
/** A move as a doing: "passing", "casting Memory Lapse on their Dandân". */
function doing(m, s, seat) {
  const w = moveName(m, s, seat);
  if (w === "pass") return "passing";
  if (w === "let it resolve") return "letting it resolve";
  return w.replace(/^(\w+)/, x => ({ cast: "casting", play: "playing", attack: "attacking", block: "blocking", put: "putting", keep: "keeping", take: "taking", discard: "discarding", cycle: "cycling", islandcycle: "islandcycling", crack: "cracking", sacrifice: "sacrificing", fetch: "fetching", find: "finding", return: "returning", name: "naming", make: "making", turn: "turning", aim: "aiming", "don't": "not" }[x] || x));
}

/** The note under Why?: how the figures were come by. */
export function whyNote(r) {
  return `Each move was played out to the start of the turn after next in the same ${r.deals} deals of the cards you can't see (their hand and the library dealt from what you haven't seen), both sides by Medium's habits; the figure is the chance of winning from where it lands, judged as Medium against Medium would play it on.`;
}

