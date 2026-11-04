// Pewter, the bluffing game of coins, at Party's table: the bidding game Skull (Alex Randolph's, 2011) with its rules and
// none of its pictures or words (README, Pewter). Everyone has four coins, three silver and one pewter, a bad one. Each
// round everyone lays one face down; then in turn they add another of their own on top of their stack or open the bidding:
// a bid names how many coins the bidder will turn without finding a pewter, all of their own stack first, then others'
// stacks by choice, one coin at a time from the top. Others raise or pass; the highest bidder turns. All silver: a round
// won, and two rounds win the game. A pewter: the bidder loses a coin of their own at random, and whoever owned the
// pewter is named. A player with no coins is out; the last one in wins too.
//
// Decisions made where the rules were silent (the owner asked for the rules above): a bid equal to every coin on the
// table closes the bidding at once (nobody could raise it); a bidder who is out starts the next round with the owner of
// the pewter they hit (their own pewter: the next player in seat order); a player who leaves voids the round.
//
// Each decision is a step of its own ("bid#9": the phase and a counter), so what a phone sent for one is never read as an
// answer to the next. Like Undercover and Cabal, the table's state holds every hand and each phone shows only its own: a
// table of friends, not a casino. Computer players (option) fill the empty seats; they answer a moment after they are
// asked, from `pewterBot`, which is given only what a player at the table could see.
import { h, button, waitingFor, countdown } from "./party-kit.js";
import { shuffle } from "./party-core.js";
import { PERSONAS, pewterBot } from "./party-pewter-bot.js";

export const COINS = ["p", "p", "p", "b"];                    // p silver, b pewter
export const WINS = 2;
export const MAX_SEATS = 6;
const LOG = 30;                                                // lines of history kept

// ---------- the table as plain data ----------
// The database keeps no empty list or object: a player with nothing in hand or on the table has no entry there, so each is
// read through these.
const hand = (s, u) => s.hand?.[u] || [];
const stack = (s, u) => s.stack?.[u] || [];
const coinsOf = (s, u) => hand(s, u).length + stack(s, u).length;
const ups = (s, u) => s.flip?.ups?.[u] || 0;
const nm = (s, u) => s.names?.[u] || "Someone";
const isBot = (s, u) => !!s.bots?.[u];
/** Who still has coins, in seat order. */
export const alive = s => s.seats.filter(u => coinsOf(s, u) > 0);
/** Coins on the table. */
export const onTable = s => s.seats.reduce((n, u) => n + stack(s, u).length, 0);
const active = s => alive(s).filter(u => !(s.passed || []).includes(u));
/** The next player after u in seat order among `list` (u itself if it is the only one). */
function after(s, u, list = alive(s)) {
  const i = s.seats.indexOf(u);
  for (let k = 1; k <= s.seats.length; k++) { const v = s.seats[(i + k) % s.seats.length]; if (list.includes(v)) return v; }
  return u;
}
const word = c => (c === "b" ? "pewter" : "silver");
const coinWord = n => `${n} coin${n === 1 ? "" : "s"}`;

// ---------- moving ----------
// G is one call of advance: the state being changed (a copy), who is at the table, the clock and the generator, and what
// the table will say aloud.
function note(G, text) {
  const log = G.s.log;
  log.push(text);
  if (log.length > LOG) log.splice(0, log.length - LOG);
  G.say.push(text);
}
/** A new step. A computer player's turn to answer waits a moment (`botAt`), so the humans see what it does. */
function enter(G, phase) {
  const s = G.s;
  s.n++; s.phase = phase; s.step = phase === "over" ? "over" : `${phase}#${s.n}`;   // Party looks for the step "over"
  if (s.clock && phase !== "over") s.deadline = G.now + s.clock; else delete s.deadline;
  const asked = phase === "flip" ? s.bid.by : s.turn;
  if (["build", "bid", "flip"].includes(phase) && isBot(s, asked)) s.botAt = G.now + 700 + Math.floor(G.rng() * 800); else delete s.botAt;
}
function finish(G, winner) {
  const s = G.s, w = winner || alive(s)[0];
  gather(s);
  enter(G, "over");
  for (const k of ["bid", "passed", "flip", "turn", "deadline", "botAt"]) delete s[k];
  if (w) {
    s.won = w; s.winners = [w];
    note(G, winner ? `${nm(s, w)} has won ${WINS} rounds, and wins!` : `${nm(s, w)} is the last with any coins, and wins!`);
  }
}
/** All the coins back in their owners' hands. */
function gather(s) {
  for (const u of s.seats) {
    const all = [...hand(s, u), ...stack(s, u)];
    if (all.length) (s.hand ||= {})[u] = all; else if (s.hand) delete s.hand[u];
  }
  delete s.stack; delete s.bid; delete s.passed; delete s.flip;
}
/** Everyone lays a coin face down. */
function startRound(G, first) {
  const s = G.s;
  gather(s);
  s.first = first;
  s.turn = first;
  enter(G, "lay");
  G.say.push("Lay a coin face down.");
}
/** The round over, a pewter hit: the bidder loses a coin of their own at random. */
function miss(G, by, owner) {
  const s = G.s;
  note(G, owner === by ? `${nm(s, by)} turns their own pewter!` : `${nm(s, by)} turns ${nm(s, owner)}'s pewter!`);
  gather(s);
  const mine = hand(s, by), lost = Math.floor(G.rng() * mine.length);
  mine.splice(lost, 1);
  if (!mine.length) delete s.hand[by];
  note(G, `${nm(s, by)} loses a coin at random${coinsOf(s, by) ? ` and has ${coinWord(coinsOf(s, by))} left` : " and is out"}.`);
  if (alive(s).length <= 1) return finish(G);
  startRound(G, coinsOf(s, by) ? by : owner !== by && coinsOf(s, owner) ? owner : after(s, by));
}
/** The round won: all the coins turned were silver. */
function win(G, by) {
  const s = G.s;
  s.wins[by] = (s.wins[by] || 0) + 1;
  note(G, `${nm(s, by)} turns every coin silver and wins the round (${s.wins[by]} of ${WINS}).`);
  if (s.wins[by] >= WINS) return finish(G, by);
  startRound(G, by);
}

/** The bidding is over: the highest bidder turns coins, their own stack first, then others' by choice. */
function beginFlip(G) {
  const s = G.s, { by, n } = s.bid;
  s.flip = { got: 0 };
  delete s.passed;
  const own = stack(s, by), k = Math.min(n, own.length);
  note(G, `${nm(s, by)} has bid ${n} and turns ${k === 0 ? "nothing of their own" : k === 1 ? "their own top coin" : `their own top ${k}`}.`);
  for (let i = 0; i < k; i++) {
    if (own[own.length - 1 - i] === "b") return miss(G, by, by);
    s.flip.got++; (s.flip.ups ||= {})[by] = (s.flip.ups[by] || 0) + 1;
  }
  return turning(G);
}
/** The bidder still has coins to turn: from the one stack left to them, or they choose. */
function turning(G) {
  const s = G.s, { by, n } = s.bid;
  while (s.flip.got < n) {
    const options = alive(s).filter(u => u !== by && stack(s, u).length - ups(s, u) > 0);
    if (!options.length) break;
    if (options.length > 1) {
      enter(G, "flip");
      G.say.push(`${nm(s, by)}, whose stack will you turn from?`);
      return;
    }
    if (turnOne(G, options[0])) return;                         // a pewter: the round is over
  }
  return win(G, by);
}
/** One coin from the top of `from`'s stack; true if it was the pewter. */
function turnOne(G, from) {
  const s = G.s, by = s.bid.by, st = stack(s, from), c = st[st.length - 1 - ups(s, from)];
  if (c === "b") { miss(G, by, from); return true; }
  (s.flip.ups ||= {})[from] = ups(s, from) + 1;
  s.flip.got++;
  note(G, `${nm(s, by)} turns a coin of ${nm(s, from)}'s: silver (${s.flip.got} of ${s.bid.n}).`);
  return false;
}

/** After a bid or a pass: the next to answer, or the bidding is over. */
function bidding(G, actor) {
  const s = G.s, left = active(s), next = after(s, actor, left);
  if (left.length <= 1 || next === s.bid.by || s.bid.n >= onTable(s)) return beginFlip(G);
  s.turn = next;
  enter(G, "bid");
}

/** A player who has left the table is out, their coins gone; the round is void. True if anyone left. */
function dropLeavers(G) {
  const s = G.s, gone = alive(s).filter(u => !isBot(s, u) && !G.here.has(u));
  if (!gone.length) return false;
  const turn = s.turn;
  for (const u of gone) {
    if (s.hand) delete s.hand[u];
    if (s.stack) delete s.stack[u];
    note(G, `${nm(s, u)} has left the table.`);
  }
  if (alive(s).length <= 1) { finish(G); return true; }
  if (s.phase !== "over") {
    note(G, "The round is void; everyone takes their coins back.");
    startRound(G, alive(s).includes(turn) ? turn : after(s, turn));
  }
  return true;
}

const inputOf = (G, inputs, u) => {
  const s = G.s;
  if (!isBot(s, u)) return inputs[u];
  if (G.now < (s.botAt ?? 0)) return null;
  return (G.cache[u] ||= pewterBot(s, u, G.rng));
};
const whole = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;

/** What the step in play is waiting for, done if it can be; true if the state changed. */
function settle(G, inputs) {
  const s = G.s, late = !!s.deadline && G.now >= s.deadline;
  const inp = u => inputOf(G, inputs, u);
  if (s.phase === "lay") {
    const who = alive(s), laid = u => hand(s, u).includes(inp(u)?.lay);
    if (!late && !who.every(laid)) return false;
    for (const u of who) {
      const c = laid(u) ? inp(u).lay : hand(s, u).includes("p") ? "p" : "b";
      hand(s, u).splice(hand(s, u).indexOf(c), 1);
      if (!hand(s, u).length) delete s.hand[u];
      ((s.stack ||= {})[u] ||= []).push(c);
    }
    note(G, "Every coin is down.");
    s.turn = s.first;
    enter(G, "build");
    G.say.push(`${nm(s, s.turn)}, add a coin or open the bidding.`);
    return true;
  }
  if (s.phase === "build") {
    const u = s.turn, i = inp(u), mine = hand(s, u), T = onTable(s), laid = stack(s, u).length;
    const adding = mine.includes(i?.add) ? i.add : null, bid = whole(i?.bid, 1, T) ? i.bid : 0;
    if (!adding && !bid && !late) return false;
    // out of time: a silver coin if it has one (or the pewter), else it opens at what it has laid
    const c = adding || (!bid && mine.length ? (mine.includes("p") ? "p" : mine[0]) : null);
    if (c) {
      mine.splice(mine.indexOf(c), 1);
      if (!mine.length) delete s.hand[u];
      s.stack[u].push(c);
      note(G, `${nm(s, u)} adds a coin.`);
      s.turn = after(s, u);
      enter(G, "build");
      return true;
    }
    const n = bid || Math.min(Math.max(1, laid), T);
    s.bid = { by: u, n };
    note(G, `${nm(s, u)} opens the bidding at ${n}.`);
    if (n >= T) { beginFlip(G); return true; }
    s.turn = after(s, u);
    enter(G, "bid");
    G.say.push(`${nm(s, s.turn)}, raise or pass.`);
    return true;
  }
  if (s.phase === "bid") {
    const u = s.turn, i = inp(u);
    if (whole(i?.bid, s.bid.n + 1, onTable(s))) {
      s.bid = { by: u, n: i.bid };
      note(G, `${nm(s, u)} raises to ${i.bid}.`);
      bidding(G, u);
      return true;
    }
    if (!i?.pass && !late) return false;
    (s.passed ||= []).push(u);
    note(G, `${nm(s, u)} passes.`);
    bidding(G, u);
    return true;
  }
  if (s.phase === "flip") {
    const by = s.bid.by, i = inp(by)?.from;
    const options = alive(s).filter(u => u !== by && stack(s, u).length - ups(s, u) > 0);
    const ok = options.includes(i);
    if (!ok && !late) return false;
    if (!turnOne(G, ok ? i : options[Math.floor(G.rng() * options.length)])) turning(G);
    return true;
  }
  return false;
}

// ---------- the module ----------
/** The seats a game of these options and this many people has: the people, then computer players up to `fill` seats. */
const seatsFor = (n, options) => Math.max(n, Math.min(MAX_SEATS, Number(options?.fill) || 0));

export default {
  id: "pewter",
  name: "Pewter",
  min: 2,                                                  // the lobby lists it from two people; need() lets one alone start it with computer players
  max: MAX_SEATS,
  blurb: "Lay a coin, bid how many you can turn without finding the pewter.",
  rules: [
    "Everyone has four coins: three silver and one pewter, a bad one. Each round everyone lays one coin face down. Then, in turn, you either add another of your own coins on top of your stack, or open the bidding.",
    "A bid names how many coins you will turn without finding a pewter. Others raise it, or pass and are out of the round. The highest bidder turns coins: all of their own stack first, from the top, then others' stacks, one coin at a time, from whichever stacks they choose.",
    "All silver, and you win the round; two rounds win the game. Find a pewter and you lose a coin of your own, at random (the pewter's owner is named, and if you are out, starts the next round). Turn your own pewter and you lose a coin too. A player with no coins is out; the last one in wins.",
    "Bluff with a silver on top of a pewter, or hold the pewter back in your hand. With no coins left in hand you must open the bidding. The Computer players option fills the seats nobody has.",
  ],
  options: [
    { id: "fill", label: "Computer players", choices: [["0", "None"], ["4", "Fill to 4"], ["5", "Fill to 5"], ["6", "Fill to 6"]], value: "0" },
    { id: "clock", label: "Clock", choices: [["0", "Off"], ["20", "20 s"], ["30", "30 s"], ["60", "60 s"]], value: "60" },
  ],

  need(players, options) {
    const n = players.length, seats = seatsFor(n, options);
    if (n > MAX_SEATS) return `Pewter takes at most ${MAX_SEATS}`;
    if (seats < 3) return `Pewter needs 3 players: ${3 - n} more to join, or add computer players`;
    return "";
  },

  start({ players, options, rng, now }) {
    const humans = players.map(p => ({ uid: p.uid, name: p.name }));
    const extra = seatsFor(humans.length, options) - humans.length;
    const bots = Array.from({ length: extra }, (_, i) => ({ uid: `bot${i + 1}`, name: PERSONAS[i % PERSONAS.length].name }));
    const all = [...humans, ...bots], seats = all.map(p => p.uid);
    const first = seats[Math.floor(rng() * seats.length)];
    const clock = Math.max(0, Number(options.clock) || 0) * 1000;
    const s = {
      step: "lay#1", phase: "lay", n: 1, seats, names: Object.fromEntries(all.map(p => [p.uid, p.name])),
      hand: Object.fromEntries(seats.map(u => [u, shuffle(COINS, rng)])), wins: Object.fromEntries(seats.map(u => [u, 0])),
      first, turn: first, clock, log: [`${nameOf(all, first)} starts.`],
      say: `Pewter. Everyone lay a coin face down. ${nameOf(all, first)} starts.`,
    };
    if (bots.length) s.bots = Object.fromEntries(bots.map(b => [b.uid, 1]));
    if (!clock) delete s.clock; else s.deadline = now + clock;
    return s;
  },

  advance(state, { players, inputs, now, rng }) {
    const s = structuredClone(state);
    s.log ||= [];
    const G = { s, here: new Set(players.map(p => p.uid)), now, rng, say: [], cache: {} };
    const left = dropLeavers(G);
    const moved = s.step === state.step && s.phase !== "over" ? settle(G, inputs) : false;
    if (!left && !moved) return null;
    for (const k of ["hand", "stack", "passed"]) if (s[k] && !Object.keys(s[k]).length) delete s[k];   // the database keeps no empty list or object
    if (s.flip?.ups && !Object.keys(s.flip.ups).length) delete s.flip.ups;
    const say = G.say.join(" ");
    return say ? { state: s, say } : { state: s };
  },

  wakeAt(s) {
    const times = s.phase === "over" ? [] : [s.botAt, s.deadline].filter(Boolean);
    return times.length ? Math.min(...times) : null;
  },

  view(stage, ctx) { drawPewter(stage, ctx); },
};
function nameOf(all, uid) { return all.find(p => p.uid === uid).name; }

// ---------- drawing ----------
// A phone's own choices before they're sent: the number being bid. They belong to the step they were made in.
const local = { key: "", bid: 0 };
let coinsHidden = false;

const disc = (c, cls = "") => h("i", { class: `pw-coin ${c === "b" ? "pewter" : c === "?" ? "back" : "silver"} ${cls}`.trim(), title: c === "?" ? "Face down" : word(c) });

function drawPewter(stage, ctx) {
  const { state: s, me, players, inputs } = ctx;
  const key = `${ctx.seq}:${s.step}`;
  if (local.key !== key) { local.key = key; local.bid = 0; }
  const draw = () => drawPewter(stage, ctx);
  const name = u => nm(s, u) !== "Someone" ? nm(s, u) : players.find(p => p.uid === u)?.name || "Someone";
  const seated = s.seats.includes(me.uid), live = coinsOf(s, me.uid) > 0, over = s.phase === "over";
  const peopleOf = list => list.map(u => ({ uid: u, name: name(u) }));
  const ask = text => h("p", { class: "pk-ask pw-ask" }, text);
  const sub = text => h("p", { class: "pk-line pw-sub" }, text);
  const clock = () => (s.deadline && !over ? countdown(s.deadline, ctx.now, { total: s.clock }) : null);
  const send = value => ctx.send(value);
  const T = onTable(s);
  const parts = [];

  // the table: every player, their rounds won, the coins they have laid (turned ones face up), the coins left
  parts.push(h("ul", { class: "pw-players" }, ...s.seats.map(u => {
    const n = coinsOf(s, u), laid = stack(s, u).length, up = ups(s, u);
    const turn = !over && n && ((s.phase === "flip" ? s.bid?.by : s.phase === "lay" ? null : s.turn) === u);
    const cls = ["pw-p", u === me.uid ? "me" : "", n ? "" : "out", turn ? "turn" : "", over && s.won === u ? "won" : "", s.bid?.by === u && ["bid", "flip"].includes(s.phase) ? "high" : ""].filter(Boolean).join(" ");
    const stackEl = h("span", { class: "pw-stack", "aria-label": `${laid} laid` },
      ...Array.from({ length: laid }, (_, i) => disc(i >= laid - up ? "p" : "?", i >= laid - up ? "turned" : "")));
    return h("li", { class: cls },
      h("span", { class: "pw-top" }, h("span", { class: "pw-name" }, name(u)),
        h("span", { class: "pw-wins", "aria-label": `${s.wins?.[u] || 0} of ${WINS} rounds won` }, ...Array.from({ length: WINS }, (_, i) => h("i", { class: `pw-pip${i < (s.wins?.[u] || 0) ? " on" : ""}` })))),
      n ? h("span", { class: "pw-row" }, stackEl, h("span", { class: "pw-left" }, `${n}`)) : h("span", { class: "pw-row" }, "out"),
      s.bid && s.bid.by === u && ["bid", "flip"].includes(s.phase) ? h("span", { class: "pw-bid" }, `bid ${s.bid.n}`) : (s.passed || []).includes(u) ? h("span", { class: "pw-bid pass" }, "passed") : null);
  })));

  if (!seated) parts.push(sub("You joined after the coins were dealt: watch this one, play the next."));
  else if (!live && !over) parts.push(sub("You're out: watch, and keep your face straight."));
  const mine = hand(s, me.uid), laid = stack(s, me.uid);
  const count = (list, c) => list.filter(x => x === c).length;
  const gridBid = (lo, hi, label, onSend) => {
    if (!local.bid || local.bid < lo || local.bid > hi) local.bid = Math.min(Math.max(lo, laid.length), hi);
    const step = d => { local.bid = Math.min(hi, Math.max(lo, local.bid + d)); draw(); };
    return h("div", { class: "pw-bidbox" },
      h("div", { class: "pw-stepper" },
        h("button", { type: "button", class: "pw-step", disabled: local.bid <= lo, "aria-label": "One fewer", onclick: () => step(-1) }, "−"),
        h("span", { class: "pw-n", "aria-live": "polite" }, String(local.bid), h("em", {}, `of ${T} on the table`)),
        h("button", { type: "button", class: "pw-step", disabled: local.bid >= hi, "aria-label": "One more", onclick: () => step(1) }, "+")),
      button(`${label} ${local.bid}`, () => onSend(local.bid)));
  };
  const addRow = () => h("div", { class: "pw-row2" },
    ...["p", "b"].filter(c => mine.includes(c)).map(c => button(`Add ${word(c)} · ${count(mine, c)}`, () => send({ add: c }), { primary: false, cls: "pw-add" })));

  if (s.phase === "lay") {
    const who = alive(s), done = u => (isBot(s, u) ? false : inputs[u]?.lay != null);
    const sent = inputs[me.uid]?.lay;
    if (seated && live && !sent) {
      parts.push(ask("Lay a coin face down"));
      parts.push(h("div", { class: "pw-row2" }, ...["p", "b"].filter(c => mine.includes(c)).map(c =>
        button(`${word(c)[0].toUpperCase()}${word(c).slice(1)} · ${count(mine, c)}`, () => send({ lay: c }), { primary: c === "p", cls: "pw-lay" }))));
      parts.push(sub("Silver is safe for you to turn. Pewter is a trap for whoever turns it."));
    } else parts.push(ask(sent ? "Your coin is down" : "Coins are going down"));
    parts.push(h("p", { class: "pk-wait" }, waitingFor(peopleOf(who.filter(u => !isBot(s, u))), who.filter(done))));
    parts.push(clock());
  } else if (s.phase === "build") {
    const u = s.turn;
    if (u === me.uid && live) {
      parts.push(ask(mine.length ? "Add a coin, or open the bidding" : "No coins in hand: open the bidding"));
      if (mine.length) parts.push(addRow());
      parts.push(gridBid(1, Math.max(1, T), "Open the bidding at", n => send({ bid: n })));
    } else parts.push(ask(`${name(u)} is choosing`));
    parts.push(clock());
  } else if (s.phase === "bid") {
    const u = s.turn;
    parts.push(sub(`${name(s.bid.by)} bids ${s.bid.n}: that many coins turned without a pewter.`));
    if (u === me.uid && live) {
      parts.push(ask(`Raise above ${s.bid.n}, or pass`));
      parts.push(gridBid(s.bid.n + 1, T, "Raise to", n => send({ bid: n })));
      parts.push(button("Pass", () => send({ pass: 1 }), { primary: false }));
    } else parts.push(ask(`${name(u)} is deciding`));
    parts.push(clock());
  } else if (s.phase === "flip") {
    const by = s.bid.by;
    if (by === me.uid) {
      parts.push(ask(`You bid ${s.bid.n}: turn a coin from whose stack?`));
      const options = alive(s).filter(u => u !== by && stack(s, u).length - ups(s, u) > 0);
      parts.push(h("div", { class: "pw-targets" }, ...options.map(u => h("button", { type: "button", class: "pw-target", onclick: () => send({ from: u }) },
        h("b", {}, name(u)), h("span", {}, `${stack(s, u).length - ups(s, u)} left`)))));
    } else parts.push(ask(`${name(by)} is turning coins: ${s.flip.got} of ${s.bid.n} so far`));
    parts.push(clock());
  } else if (over) {
    parts.push(h("div", { class: "pk-verdict big" }, s.won ? `${name(s.won)} wins` : "Nobody wins"));
    parts.push(h("ul", { class: "pk-roles pw-final" }, ...s.seats.map(u => h("li", { class: s.won === u ? "won" : "" }, h("span", {}, name(u)),
      h("span", {}, `${s.wins?.[u] || 0} round${(s.wins?.[u] || 0) === 1 ? "" : "s"} · ${coinsOf(s, u) ? coinWord(coinsOf(s, u)) : "out"}`)))));
  }

  // your own coins: face up on your phone, hidden again with a tap for a neighbour's glance
  if (seated && live) {
    const face = c => disc(coinsHidden ? "?" : c);
    parts.push(h("button", { type: "button", class: `pw-hand${coinsHidden ? " hidden" : ""}`, "aria-pressed": String(coinsHidden), onclick: () => { coinsHidden = !coinsHidden; draw(); } },
      h("span", { class: "pw-hand-label" }, "Your coins", h("em", {}, coinsHidden ? "tap to show" : "tap to hide")),
      h("span", { class: "pw-hand-coins" },
        h("span", { class: "pw-group" }, h("small", {}, "Laid"), h("span", { class: "pw-coins" }, ...(laid.length ? laid.map(face) : [h("em", {}, "none")]))),
        h("span", { class: "pw-group" }, h("small", {}, "In hand"), h("span", { class: "pw-coins" }, ...(mine.length ? mine.map(face) : [h("em", {}, "none")]))))));
  }
  const log = (s.log || []).slice(-4).reverse();
  parts.push(h("ol", { class: "pw-log", "aria-label": "What has happened" }, ...log.map(t => h("li", {}, t))));
  stage.replaceChildren(h("div", { class: "pk-col pw-col" }, ...parts));
}
