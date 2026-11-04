// Cabal, the bluffing game of influence, at Party's table: Rikki Tahta's Coup (2012) with its rules and none of its words
// (README, Cabal). The ids (`coup`, `duke`, `assassinate`...) keep their old spelling so a saved game or a room from
// before the rename still reads; only what a player sees was renamed. Everyone has two secret influence cards (a Syndic,
// a Saboteur, a Privateer, an Astronomer or a Kontor) and two coins. On your turn you take an action; most
// of them need a character, and you may claim any character whether you hold it or not. Anyone may challenge a claim:
// whoever is wrong loses an influence. Some actions can be blocked, by claiming the character that stops them, and a
// block can be challenged too. A player with no influence left is out; the last one in wins.
//
// The rules are the published ones: Income 1, Foreign Aid 2 (the Syndic blocks it), Oust for 7 (compulsory from 10, never
// blocked), Tax 3 (Syndic), Sabotage for 3 (Saboteur; the Kontor blocks), Steal 2 (Privateer; the Privateer or the
// Astronomer blocks), Exchange (Astronomer: draw two, keep as many as you hold). A challenge that fails costs the
// challenger an influence and the claimant swaps the shown card for a new one from the deck; one that succeeds costs the
// claimant an influence and the action. The 3 coins of a sabotage are paid when it is declared, come back if the
// Saboteur is challenged and found false, and are lost if the Kontor blocks it. Two players: the first to play starts
// with one coin, not two.
//
// Each decision is a step of its own ("challenge#9": the phase and a counter), so what a phone sent for one is never
// read as an answer to the next. Everyone answers a challenge or a block window at once, on their own phone; it closes
// when all have answered, or when the clock (an option) runs out and the silent allow it. Like Undercover, the state
// holds every hand and each phone shows only its own: a table of friends, not a casino.
import { h, button, pickPlayer, waitingFor, countdown } from "./party-kit.js";
import { shuffle } from "./party-core.js";
import { play } from "./party-coup-solo.js";
import { wants3D, pick3D, sceneOf, signature } from "./party-coup-table.js";

export const CARDS = ["duke", "assassin", "captain", "ambassador", "contessa"];
export const COPIES = 3;
export const MUST_COUP = 10;
export const CARD = {
  duke: { name: "Syndic", glyph: "⚖️" },
  assassin: { name: "Saboteur", glyph: "💣" },
  captain: { name: "Privateer", glyph: "⚓" },
  ambassador: { name: "Astronomer", glyph: "🔭" },
  contessa: { name: "Kontor", glyph: "🗝️" },
};
/** The actions. `claim` is the character it needs, `blockedBy` who can stop it (`anyone`: any other player, else the
 *  target only), `cost` what it takes up front. `sub` is the line under its button. */
export const ACTIONS = {
  income: { name: "Income", sub: "+1" },
  aid: { name: "Foreign Aid", sub: "+2 · Syndic blocks", blockedBy: ["duke"], anyone: true },
  coup: { name: "Oust", sub: "pay 7 · a player loses a card", cost: 7, target: true },
  tax: { name: "Tax", sub: "+3 · Syndic", claim: "duke" },
  assassinate: { name: "Sabotage", sub: "pay 3 · Saboteur", claim: "assassin", cost: 3, target: true, blockedBy: ["contessa"] },
  steal: { name: "Steal", sub: "+2 · Privateer", claim: "captain", target: true, blockedBy: ["captain", "ambassador"] },
  exchange: { name: "Exchange", sub: "swap · Astronomer", claim: "ambassador" },
};
const ORDER = ["income", "aid", "tax", "steal", "exchange", "assassinate", "coup"];
const LOG = 30;                                   // lines of history kept

// ---------- the table as plain data ----------
// The database keeps no empty list or object: a player with no card left has no hand entry, nobody face up has no dead
// entry, so each is read through these.
const hand = (s, u) => s.hand?.[u] || [];
const faceUp = (s, u) => s.dead?.[u] || [];
/** Who still has influence, in seat order. */
export const alive = s => s.seats.filter(u => hand(s, u).length > 0);
const nm = (s, u) => s.names?.[u] || "Someone";
const coin = n => `${n} coin${n === 1 ? "" : "s"}`;
/** The player after u in seat order who still has influence. */
function after(s, u) {
  const i = s.seats.indexOf(u);
  for (let k = 1; k <= s.seats.length; k++) { const v = s.seats[(i + k) % s.seats.length]; if (hand(s, v).length) return v; }
  return null;
}
/** The list in the order they'd speak after `from`: the nearest on from them first. */
const clockwise = (s, from, list) => {
  const n = s.seats.length, i = s.seats.indexOf(from), gap = u => (s.seats.indexOf(u) - i + n) % n;
  return [...list].sort((a, b) => gap(a) - gap(b));
};
/** Who may block the action in play: any other player (Foreign Aid) or its target, while they have influence. */
export function blockers(s) {
  const a = ACTIONS[s.act?.kind];
  if (!a?.blockedBy) return [];
  return a.anyone ? alive(s).filter(u => u !== s.act.by) : alive(s).includes(s.act.target) ? [s.act.target] : [];
}
const canBlockWith = (s, card) => !!card && !!ACTIONS[s.act?.kind]?.blockedBy?.includes(card);
/** Who may challenge the claim in play: everyone with influence but the one who made it. */
export const challengers = s => alive(s).filter(u => u !== s.claim?.by);

// ---------- moving ----------
// G is one call of advance: the state being changed (a copy), who is at the table, the clock and the generator, and
// what the table will say aloud.
function note(G, text) {
  const log = G.s.log;
  log.push(text);
  if (log.length > LOG) log.splice(0, log.length - LOG);
  G.say.push(text);
}
function enter(G, phase) {
  const s = G.s;
  s.n++; s.phase = phase; s.step = phase === "over" ? "over" : `${phase}#${s.n}`;   // Party looks for the step "over"
  if (s.clock) s.deadline = G.now + s.clock; else delete s.deadline;
}
function finish(G) {
  const s = G.s, w = alive(s)[0];
  enter(G, "over");
  delete s.deadline;
  if (w) { s.won = w; s.winners = [w]; note(G, `${nm(s, w)} is the last with any influence, and wins!`); }
}
function startTurn(G) {
  const s = G.s;
  if (alive(s).length <= 1) return finish(G);
  s.turn = after(s, s.turn);
  for (const k of ["act", "claim", "block", "loser", "then", "exch"]) delete s[k];
  enter(G, "turn");
  G.say.push(s.coins[s.turn] >= MUST_COUP ? `${nm(s, s.turn)}, you have ${coin(s.coins[s.turn])}: you must Oust a rival.` : `${nm(s, s.turn)}, your turn.`);
}
/** On with what was waiting for a loss of influence to settle. */
function go(G, then) {
  if (alive(G.s).length <= 1) return finish(G);
  if (then === "next") return startTurn(G);
  if (then === "land") return land(G);
  if (then === "stood") return stood(G);
  return caught(G);
}
/** A card turned face up, the player out if it was their last. */
function reveal(G, u, i) {
  const s = G.s, [c] = s.hand[u].splice(i, 1);
  if (!s.hand[u].length) { delete s.hand[u]; s.coins[u] = 0; }
  (s.dead ||= {})[u] = [...faceUp(s, u), c];
  note(G, `${nm(s, u)} loses the ${CARD[c].name}${hand(s, u).length ? "" : " and is out"}.`);
}
/** u loses an influence, of their choice (no choice with one card), then `then` goes on. */
function lose(G, u, then) {
  const s = G.s, cards = hand(s, u);
  if (!cards.length) return go(G, then);
  if (cards.length === 1) { reveal(G, u, 0); return go(G, then); }
  s.loser = u; s.then = then;
  enter(G, "lose");
  G.say.push(`${nm(s, u)}, choose an influence to lose.`);
}

/** An action declared by the player whose turn it is; false (nothing changed) if it isn't allowed. */
function declare(G, by, inp) {
  const s = G.s, kind = inp?.do, a = ACTIONS[kind];
  if (!a) return false;
  const coins = s.coins[by];
  if (coins >= MUST_COUP && kind !== "coup") return false;
  if (a.cost && coins < a.cost) return false;
  const target = a.target ? String(inp.target ?? "") : null;
  if (a.target && (target === by || !alive(s).includes(target))) return false;
  s.coins[by] -= a.cost || 0;
  s.act = { by, kind, ...(a.target ? { target } : {}), ...(a.cost ? { paid: a.cost } : {}) };
  const who = nm(s, by), at = target ? nm(s, target) : "";
  if (kind === "income") {
    s.coins[by] += 1;
    note(G, `${who} takes Income: 1 coin.`);
    startTurn(G);
  } else if (kind === "coup") {
    note(G, `${who} pays 7 coins to oust one of ${at}'s influence.`);
    lose(G, target, "next");
  } else if (kind === "aid") {
    note(G, `${who} takes Foreign Aid. Anyone with the Syndic may block it.`);
    enter(G, "block");
  } else {
    s.claim = { by, card: a.claim, on: "act" };
      note(G, kind === "tax" ? `${who} claims the Syndic and takes Tax. Challenge?`
      : kind === "assassinate" ? `${who} pays 3 coins and claims the Saboteur against ${at}. Challenge?`
      : kind === "steal" ? `${who} claims the Privateer and steals from ${at}. Challenge?`
      : `${who} claims the Astronomer and exchanges cards. Challenge?`);
    enter(G, "challenge");
  }
  return true;
}

/** Who challenges: the claim is shown true (the challenger loses, the claimant takes a new card) or caught false. */
function challenge(G, ch) {
  const s = G.s, { by, card } = s.claim, name = CARD[card].name;
  if (hand(s, by).includes(card)) {
    note(G, `${nm(s, ch)} challenges ${nm(s, by)}, who shows the ${name}: the claim was true.`);
    s.hand[by].splice(s.hand[by].indexOf(card), 1);
    s.deck = shuffle([...s.deck, card], G.rng);
    s.hand[by].push(s.deck.shift());
    return lose(G, ch, "stood");
  }
  note(G, `${nm(s, ch)} challenges ${nm(s, by)}, who has no ${name}: caught bluffing.`);
  return lose(G, by, "caught");
}
/** The claim stands (nobody challenged it, or it was challenged wrongly). */
function stood(G) {
  const s = G.s;
  if (s.claim.on === "block") {
    note(G, `The ${CARD[s.block.card].name} stands: ${ACTIONS[s.act.kind].name} is blocked.`);
    return startTurn(G);
  }
  if (blockers(s).length) {
    enter(G, "block");
    G.say.push(`${nm(s, s.act.target)}, you may block it with the ${ACTIONS[s.act.kind].blockedBy.map(c => CARD[c].name).join(" or the ")}.`);
    return;
  }
  land(G);
}
/** The claim was false. */
function caught(G) {
  const s = G.s;
  if (s.claim.on === "block") { note(G, `The block fails: ${ACTIONS[s.act.kind].name} goes ahead.`); return land(G); }
  if (s.act.paid && alive(s).includes(s.act.by)) { s.coins[s.act.by] += s.act.paid; note(G, `${nm(s, s.act.by)} gets ${coin(s.act.paid)} back.`); }
  startTurn(G);
}
/** Someone blocks, claiming the character that stops it; anyone may challenge. */
function block(G, by, card) {
  const s = G.s;
  s.block = { by, card };
  s.claim = { by, card, on: "block" };
  note(G, `${nm(s, by)} blocks with the ${CARD[card].name}. Challenge?`);
  enter(G, "challenge");
}
/** The action happens. */
function land(G) {
  const s = G.s, { by, kind, target } = s.act, who = nm(s, by);
  if (!alive(s).includes(by)) return startTurn(G);
  if (kind === "aid") { s.coins[by] += 2; note(G, `${who} takes 2 coins.`); return startTurn(G); }
  if (kind === "tax") { s.coins[by] += 3; note(G, `${who} takes 3 coins.`); return startTurn(G); }
  if (kind === "steal") {
    const n = alive(s).includes(target) ? Math.min(2, s.coins[target]) : 0;
    s.coins[target] -= n; s.coins[by] += n;
    note(G, `${who} steals ${coin(n)} from ${nm(s, target)}.`);
    return startTurn(G);
  }
  if (kind === "assassinate") {
    if (!alive(s).includes(target)) return startTurn(G);
    note(G, `The saboteur reaches ${nm(s, target)}.`);
    return lose(G, target, "next");
  }
  if (kind === "exchange") {
    if (!alive(s).includes(by)) return startTurn(G);
    s.exch = { drawn: s.deck.splice(0, 2) };
    enter(G, "exchange");
    G.say.push(`${who}, choose which cards to keep.`);
    return;
  }
  startTurn(G);
}

/** A player who has left the table is out, their cards face up; what was waiting on them goes on. True if anyone left. */
function dropLeavers(G) {
  const s = G.s, gone = alive(s).filter(u => !G.here.has(u));
  if (!gone.length) return false;
  for (const u of gone) {
    s.dead = { ...(s.dead || {}), [u]: [...faceUp(s, u), ...hand(s, u)] };
    delete s.hand[u]; s.coins[u] = 0;
    note(G, `${nm(s, u)} has left the table.`);
  }
  if (alive(s).length <= 1) { finish(G); return true; }
  const lost = u => !alive(s).includes(u);
  if (s.phase === "turn" && lost(s.turn)) startTurn(G);
  else if (s.phase === "lose" && lost(s.loser)) { const then = s.then; delete s.loser; delete s.then; go(G, then); }
  else if (["challenge", "block", "exchange"].includes(s.phase) && (lost(s.act.by) || (s.claim && lost(s.claim.by)))) startTurn(G);
  return true;
}

const pick = (list, rng) => list[Math.floor(rng() * list.length)];
const answered = (inp, key) => inp?.[key] != null;

/** What the step in play is waiting for, done if it can be; true if the state changed. */
function settle(G, inputs) {
  const s = G.s, late = !!s.deadline && G.now >= s.deadline;
  if (s.phase === "turn") {
    const by = s.turn;
    if (inputs[by] && declare(G, by, inputs[by])) return true;
    if (!late) return false;
    const others = alive(s).filter(u => u !== by);
    return declare(G, by, s.coins[by] >= MUST_COUP ? { do: "coup", target: pick(others, G.rng) } : { do: "income" });
  }
  if (s.phase === "challenge") {
    const el = challengers(s), says = u => inputs[u]?.c === "challenge" || inputs[u]?.c === "allow";
    if (!late && !el.every(says)) return false;
    const ch = clockwise(s, s.claim.by, el.filter(u => inputs[u]?.c === "challenge"))[0];
    if (ch) challenge(G, ch); else stood(G);
    return true;
  }
  if (s.phase === "block") {
    const el = blockers(s), says = u => inputs[u]?.b === "allow" || canBlockWith(s, inputs[u]?.b);
    if (!late && !el.every(says)) return false;
    const bl = clockwise(s, s.act.by, el.filter(u => canBlockWith(s, inputs[u]?.b)))[0];
    if (bl) block(G, bl, inputs[bl].b); else land(G);
    return true;
  }
  if (s.phase === "lose") {
    const u = s.loser, n = hand(s, u).length, i = inputs[u]?.lose;
    const ok = Number.isInteger(i) && i >= 0 && i < n;
    if (!ok && !late) return false;
    const then = s.then;
    delete s.loser; delete s.then;
    reveal(G, u, ok ? i : Math.floor(G.rng() * n));
    go(G, then);
    return true;
  }
  if (s.phase === "exchange") {
    const by = s.act.by, pool = [...hand(s, by), ...s.exch.drawn], k = hand(s, by).length;
    const keep = Object.values(inputs[by]?.keep || {}).map(Number);
    const ok = answered(inputs[by], "keep") && keep.length === k && new Set(keep).size === k && keep.every(i => Number.isInteger(i) && i >= 0 && i < pool.length);
    if (!ok && !late) return false;
    const chosen = ok ? keep : pool.slice(0, k).map((_, i) => i);
    s.hand[by] = chosen.map(i => pool[i]);
    s.deck = shuffle([...s.deck, ...pool.filter((_, i) => !chosen.includes(i))], G.rng);
    delete s.exch;
    note(G, `${nm(s, by)} exchanges with the court deck.`);
    startTurn(G);
    return true;
  }
  return false;
}

// ---------- the module ----------
export default {
  id: "coup",
  name: "Cabal",
  min: 2,
  max: 6,
  solo: play,                                       // alone against one to four computer players (party-coup-solo.js)
  soloText: "Alone against 1–4 computer players",
  css: "party-coup.css",
  blurb: "Bluff, challenge, and be the last with any influence.",
  rules: [
    "Everyone has two secret influence cards and two coins. The court deck has three each of the Syndic, Saboteur, Privateer, Astronomer and Kontor. Lose both cards and you are out; the last player with influence wins.",
    "On your turn take one action. Income: 1 coin. Foreign Aid: 2 coins. Oust: pay 7 and a player loses an influence; with 10 coins you must. Then the characters: the Syndic takes Tax (3 coins); the Saboteur pays 3 so a player loses an influence; the Privateer steals 2 coins from a player; the Astronomer draws two cards from the deck and keeps as many as you hold.",
    "You may claim any character, whether you hold it or not. Anyone may challenge the claim. If you have the card you show it, the challenger loses an influence and you swap it for a new one; if not, you lose an influence and the action fails (a sabotage's 3 coins come back).",
    "Some actions can be blocked by claiming a character: the Syndic blocks Foreign Aid (anyone may), the Kontor a sabotage, the Privateer or the Astronomer a steal (the target only). A block can be challenged too. A sabotage that is challenged and true, then blocked wrongly, can cost the target both cards.",
    "With two players the first to play starts with one coin, not two.",
  ],
  options: [
    { id: "clock", label: "Clock", choices: [["0", "Off"], ["20", "20 s"], ["30", "30 s"], ["60", "60 s"]], value: "30" },
  ],

  start({ players, options, rng, now }) {
    const seats = players.map(p => p.uid), deck = shuffle(CARDS.flatMap(c => Array(COPIES).fill(c)), rng);
    const hands = {}, coins = {};
    for (const u of seats) { hands[u] = [deck.shift(), deck.shift()]; coins[u] = 2; }
    const first = seats[Math.floor(rng() * seats.length)];
    if (seats.length === 2) coins[first] = 1;
    const clock = Math.max(0, Number(options.clock) || 0) * 1000;
    const who = players.find(p => p.uid === first).name;
    const s = {
      step: "turn#1", phase: "turn", n: 1, seats, names: Object.fromEntries(players.map(p => [p.uid, p.name])),
      hand: hands, coins, deck, turn: first, clock, log: [`${who} starts.`],
      say: `Cabal. ${who} starts.`,
    };
    if (!clock) delete s.clock;
    else s.deadline = now + clock;
    return s;
  },

  advance(state, { players, inputs, now, rng }) {
    const s = structuredClone(state);
    s.log ||= [];
    const G = { s, here: new Set(players.map(p => p.uid)), now, rng, say: [] };
    const left = dropLeavers(G);
    const moved = s.step === state.step && s.phase !== "over" ? settle(G, inputs) : false;
    if (!left && !moved) return null;
    const say = G.say.join(" ");
    return say ? { state: s, say } : { state: s };
  },

  wakeAt: s => (s.phase !== "over" && s.deadline) || null,

  view(stage, ctx) { drawCoup(stage, ctx); },

  /** Menu, Table: flat or 3D (party.js puts it in the settings part). Only a pick is saved; until then the suite's 2D/3D default stands. */
  viewChoice: () => ({ label: "Table", options: [["flat", "Flat"], ["3d", "3D"]], value: wants3D() ? "3d" : "flat", onChange: v => { pick3D(v === "3d"); three.lostAt = 0; redrawLast(); } }),
};

// ---------- drawing ----------
// A phone's own choices before they're sent: the action waiting for its target, the cards picked to keep. They belong
// to the step they were made in, and are dropped when the step moves on.
const local = { key: "", pick: null, keep: new Set() };
let handHidden = false;

// The 3D table (party-coup-3d.js, three.js: loaded only when the table is drawn in 3D). One picture lives on through the redraws a
// step makes, moving into each new stage; if its stage is gone it frees itself. Where there is no WebGL the flat table stands in for
// good; where the context is lost it does for a while, and 3D is tried again after that.
const three = { host: null, table: null, loading: false, broken: false, lostAt: 0, sig: "", last: null, wired: false };
const LOST_FOR = 10000;
function redrawLast() {
  const l = three.last;
  if (l?.stage.isConnected) drawCoup(l.stage, l.ctx);
}
function release() {
  three.table?.dispose();
  Object.assign(three, { host: null, table: null, sig: "", loading: false });
}
/** The 3D picture's box if the table is to be drawn in 3D now, else null (the flat list is drawn). */
function box3D() {
  if (!wants3D() || three.broken || Date.now() - three.lostAt < LOST_FOR) return null;
  three.host ||= h("div", { class: "cp-3d" });
  if (!three.table && !three.loading) {
    three.loading = true;
    const host = three.host;
    import("./party-coup-3d.js").then(m => {
      if (three.host !== host) return;
      const table = m.createTable(host, {
        onLost: () => { three.lostAt = Date.now(); release(); redrawLast(); },
        onMine: () => { handHidden = !handHidden; redrawLast(); },
      });
      table.gone(() => { if (three.table === table) release(); });
      three.table = table;
      three.loading = false;
      if (!three.wired) { three.wired = true; import("./menu.js").then(mn => mn.onPause(() => three.table?.hold(true), () => three.table?.hold(false))).catch(() => {}); }
      redrawLast();
    }).catch(e => { console.warn("Cabal: no 3D here.", e); three.broken = true; release(); redrawLast(); });
  }
  return three.host;
}

function card(c, { back = false } = {}) {
  if (back) return h("span", { class: "cp-card back", "aria-label": "A card face down" });
  return h("span", { class: `cp-card ${c}` }, h("i", { class: "cp-glyph" }, CARD[c].glyph), h("b", {}, CARD[c].name));
}

function drawCoup(stage, ctx) {
  const { state: s, me, players, inputs } = ctx;
  const key = `${ctx.seq}:${s.step}`;
  if (local.key !== key) { local.key = key; local.pick = null; local.keep = new Set(); }
  const draw = () => drawCoup(stage, { ...ctx, state: s });
  const name = u => nm(s, u) !== "Someone" ? nm(s, u) : players.find(p => p.uid === u)?.name || "Someone";
  const seated = s.seats.includes(me.uid), live = hand(s, me.uid).length > 0, over = s.phase === "over";
  const peopleOf = list => players.filter(p => list.includes(p.uid));
  const ask = text => h("p", { class: "pk-ask cp-ask" }, text);
  const sub = text => h("p", { class: "pk-line cp-sub" }, text);
  const clock = () => (s.deadline && !over ? countdown(s.deadline, ctx.now, { total: s.clock }) : null);
  const send = value => ctx.send(value);
  const others = alive(s).filter(u => u !== me.uid);
  const parts = [];

  // the table: who is whose turn, the coins, the cards face down and face up
  const box = box3D();
  if (box) parts.push(box);
  parts.push(h("ul", { class: `cp-players${box ? " cp-sr" : ""}` }, ...s.seats.map(u => {
    const n = hand(s, u).length, up = faceUp(s, u);
    const cls = ["cp-p", u === me.uid ? "me" : "", n ? "" : "out", !over && n && u === s.turn ? "turn" : "", !over && s.act?.target === u ? "target" : "", over && s.won === u ? "won" : ""].filter(Boolean).join(" ");
    return h("li", { class: cls }, h("span", { class: "cp-name" }, name(u)),
      n ? h("span", { class: "cp-coins" }, h("i", { class: "cp-coin" }), String(s.coins[u] ?? 0)) : h("span", { class: "cp-coins" }, "out"),
      h("span", { class: "cp-minis" }, ...Array.from({ length: n }, () => h("i", { class: "cp-mini back" })), ...up.map(c => h("i", { class: `cp-mini ${c}`, title: CARD[c].name }, CARD[c].glyph))));
  })));

  // what's happening, and what this phone can do about it
  if (!box && wants3D() && (three.broken || Date.now() - three.lostAt < LOST_FOR)) parts.push(sub("3D isn't available right now: here is the flat table."));
  if (!seated) parts.push(sub("You joined after the cards were dealt: watch this one, play the next."));
  else if (!live && !over) parts.push(sub("You're out: watch, and keep your face straight."));
  const who = u => (u === me.uid ? "you" : name(u));

  if (s.phase === "turn") {
    const cur = s.turn;
    if (cur === me.uid && live) {
      const coins = s.coins[me.uid], must = coins >= MUST_COUP;
      if (local.pick) {
        const a = ACTIONS[local.pick];
        parts.push(ask(`${a.name}: which player?`));
        const targets = pickPlayer(others.map(u => ({ uid: u, name: `${name(u)} · ${s.coins[u]}` })), { label: "Targets", onPick: u => send({ do: local.pick, target: u }) });
        targets.append(h("button", { type: "button", class: "cp-back", onclick: () => { local.pick = null; draw(); } }, "Back"));
        parts.push(targets);
      } else {
        parts.push(ask(must ? `You have ${coins} coins: you must Oust` : "Your turn"));
        parts.push(h("div", { class: "cp-acts" }, ...ORDER.map(kind => {
          const a = ACTIONS[kind], ok = must ? kind === "coup" : !a.cost || coins >= a.cost;
          return h("button", { type: "button", class: `cp-act ${kind}`, disabled: !ok, onclick: () => {
            if (!a.target) return send({ do: kind });
            if (others.length === 1) return send({ do: kind, target: others[0] });
            local.pick = kind; draw();
          } }, h("b", {}, a.name), h("span", {}, a.sub));
        })));
      }
    } else parts.push(ask(`${name(cur)} is choosing an action`));
    parts.push(clock());
  } else if (s.phase === "challenge") {
    const c = s.claim, el = challengers(s), mine = inputs[me.uid]?.c, a = ACTIONS[s.act.kind];
    const target = s.act.target;
    parts.push(ask(c.on === "block" ? `${name(c.by)} blocks with the ${CARD[c.card].name}`
      : `${name(c.by)} claims the ${CARD[c.card].name}: ${a.name}${target ? `, against ${who(target)}` : ""}`));
    if (el.includes(me.uid)) {
      parts.push(sub("Do you believe them?"));
      parts.push(h("div", { class: "cp-row" },
        button("Challenge", () => send({ c: "challenge" }), { primary: false, cls: `cp-challenge${mine === "challenge" ? " chosen" : ""}`, disabled: !!mine }),
        button("Allow", () => send({ c: "allow" }), { cls: mine === "allow" ? "chosen" : "", disabled: !!mine })));
    } else if (c.by === me.uid && live) parts.push(sub(`Anyone may challenge. If they do, you show the ${CARD[c.card].name}.`));
    parts.push(h("p", { class: "pk-wait" }, waitingFor(peopleOf(el), el.filter(u => inputs[u]?.c))));
    parts.push(clock());
  } else if (s.phase === "block") {
    const el = blockers(s), a = ACTIONS[s.act.kind], mine = inputs[me.uid]?.b, target = s.act.target;
    parts.push(ask(s.act.kind === "aid" ? `${name(s.act.by)} is taking Foreign Aid` : `${name(s.act.by)} is ${s.act.kind === "steal" ? "stealing from" : "sabotaging"} ${who(target)}`));
    if (el.includes(me.uid)) {
      parts.push(sub(`You may block it, claiming the ${a.blockedBy.map(c => CARD[c].name).join(" or the ")}.`));
      parts.push(h("div", { class: "cp-row" },
        ...a.blockedBy.map(c => button(`Block: ${CARD[c].name}`, () => send({ b: c }), { primary: false, cls: mine === c ? "chosen" : "", disabled: !!mine })),
        button("Allow", () => send({ b: "allow" }), { cls: mine === "allow" ? "chosen" : "", disabled: !!mine })));
    }
    parts.push(h("p", { class: "pk-wait" }, waitingFor(peopleOf(el), el.filter(u => inputs[u]?.b))));
    parts.push(clock());
  } else if (s.phase === "lose") {
    const u = s.loser;
    if (u === me.uid) {
      parts.push(ask("Choose an influence to lose"));
      parts.push(h("div", { class: "cp-pool" }, ...hand(s, u).map((c, i) => h("button", { type: "button", class: "cp-pick", onclick: () => send({ lose: i }) }, card(c)))));
    } else parts.push(ask(`${name(u)} is choosing an influence to lose`));
    parts.push(clock());
  } else if (s.phase === "exchange") {
    const by = s.act.by;
    if (by === me.uid) {
      const pool = [...hand(s, by), ...s.exch.drawn], k = hand(s, by).length;
      parts.push(ask(`Keep ${k} of these ${pool.length}`));
      parts.push(h("div", { class: "cp-pool" }, ...pool.map((c, i) => h("button", { type: "button", class: "cp-pick", "aria-pressed": String(local.keep.has(i)), onclick: () => {
        if (local.keep.has(i)) local.keep.delete(i); else if (local.keep.size < k) local.keep.add(i);
        draw();
      } }, card(c)))));
      parts.push(button("Keep these", () => send({ keep: [...local.keep] }), { disabled: local.keep.size !== k }));
    } else parts.push(ask(`${name(by)} is exchanging with the court deck`));
    parts.push(clock());
  } else if (over) {
    parts.push(h("div", { class: "pk-verdict big" }, s.won ? `${name(s.won)} wins` : "Nobody wins"));
    parts.push(h("ul", { class: "pk-roles cp-final" }, ...s.seats.map(u => h("li", { class: s.won === u ? "won" : "" }, h("span", {}, name(u)),
      h("span", {}, [...hand(s, u), ...faceUp(s, u)].map(c => CARD[c].name).join(", ") || "—")))));
  }

  // your own cards: face up on your phone, hidden again with a tap for a neighbour's glance
  const choosing = (s.phase === "lose" && s.loser === me.uid) || (s.phase === "exchange" && s.act.by === me.uid);   // the choice shows the cards
  if (seated && !choosing) {
    const mine = hand(s, me.uid), up = faceUp(s, me.uid);
    parts.push(h("button", { type: "button", class: `cp-hand${handHidden ? " hidden" : ""}`, "aria-pressed": String(handHidden), onclick: () => { handHidden = !handHidden; draw(); } },
      h("span", { class: "cp-hand-label" }, "Your influence", h("em", {}, handHidden ? "tap to show" : "tap to hide")),
      h("span", { class: "cp-hand-cards" }, ...mine.map(c => card(c, { back: handHidden })), ...up.map(c => h("span", { class: "cp-faceup" }, card(c))))));
  }
  // what has happened, the newest first
  const log = (s.log || []).slice(-4).reverse();
  parts.push(h("ol", { class: "cp-log", "aria-label": "What has happened" }, ...log.map(t => h("li", {}, t))));
  stage.replaceChildren(h("div", { class: "pk-col cp-col" }, ...parts));
  three.last = { stage, ctx };
  if (box && three.table) {
    const t = sceneOf(s, me.uid, { hidden: handHidden, names: Object.fromEntries(s.seats.map(u => [u, name(u)])) });
    if (t.claim) t.claim.label = `${CARD[t.claim.card].name}${t.claim.block ? " (block)" : ""}`;
    const sig = signature(t) + (t.claim?.label || "");
    three.table.show(true);
    if (sig !== three.sig) { three.sig = sig; three.table.update(t); }
  }
}

