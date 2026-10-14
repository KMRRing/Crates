// Who am I?, the guessing game of sticky notes on foreheads, played with phones: everyone is someone (a famous person,
// a god, a country, a dish… dealt from the knowledge base, or written by the player before them), and every phone
// shows each player everyone's identity but their own. In turn, each asks the table yes-or-no questions about who
// they are, aloud, and goes on while the answers are yes; on their turn they may guess, on their phone. Right, and
// they're done; wrong, and the turn passes (the others can count a guess that's right in other words). The others
// answer from what they know and from the crib on each card, what kb/ says of that identity. First to guess wins;
// the game ends when one is left, and the phone says who they were.
import { DECKS, WHO } from "./party-whoami-bank.js";
import { h, button, countdown, waitingFor } from "./party-kit.js";
import { shuffle } from "./party-core.js";
import { showPicture } from "./pics.js";

export const WRITE = "write", MIXED = "mixed";
const deckOf = id => DECKS.find(d => d.id === id) || null;
const homeDeck = id => DECKS.find(d => d.ids.includes(id)) || null;
const SHOWN = 3;                      // crib lines shown before "More"

// ---------- guesses ----------
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ")
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
/** Edit distance, for a near miss in spelling. */
function distance(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return d[b.length];
}
/**
 * Whether a guess names the identity: one of its names (any case, accents, "the" and punctuation aside), the name after
 * more words ("Albert Einstein" for Einstein, but not "Leonardo DiCaprio" for Leonardo), one letter off in five or two
 * in ten; for a person also the surname with any of the rest ("da Vinci", "Curie"). It errs towards no: the others can
 * count a guess that's right in other words (Elvis Presley for Elvis), but nobody can undo a yes.
 */
export function rightGuess(namesList, text, { person = false } = {}) {
  const g = norm(text).replace(/^the /, "");
  if (!g) return false;
  const ga = g.split(" "), gw = new Set(ga);
  for (const n of namesList) {
    const t = norm(n).replace(/^the /, "");
    if (!t) continue;
    if (g === t) return true;
    const tw = t.split(" ");
    if (ga.length > tw.length && tw.every((w, i) => ga[ga.length - tw.length + i] === w)) return true;
    if (person && tw.length > 1 && [...gw].every(w => tw.includes(w)) && gw.has(tw.at(-1)) && tw.at(-1).length >= 4) return true;
    const miss = distance(g, t);
    if ((t.length >= 5 && miss <= 1) || (t.length >= 10 && miss <= 2)) return true;
  }
  return false;
}
/** The names a guess at a player's identity may use. */
export function namesOf(who) {
  if (!who) return [];
  const w = who.id ? WHO[who.id] : null;
  return w ? [w.n, ...(w.a || [])] : [who.n];
}
const isPerson = who => !!who?.id && (homeDeck(who.id)?.id === "people" || homeDeck(who.id)?.id === "myth");
/** What a player's identity is, as the table says it: "a famous person", or "someone Mei picked". */
function whatOf(s, who, nameOfU) {
  if (!who) return "";
  if (who.by) return `someone or something ${nameOfU(who.by)} picked`;
  return (who.id && homeDeck(who.id)?.a) || "someone";
}

// ---------- the game ----------
const clean = t => String(t || "").replace(/\s+/g, " ").trim().slice(0, 60);
/** The database keeps no empty objects: put back what a state needs. */
function whole(s) {
  s.who ||= {}; s.turns ||= {}; s.done ||= {}; s.names ||= {}; s.writes ||= {};
  s.order = s.order ? Object.values(s.order) : [];
  return s;
}
/** Who's still guessing: dealt someone, not done, still at the table. */
const guessing = (s, here) => s.order.filter(u => !s.done[u] && here.has(u));
function deal(s, uids, rng) {
  const pool = s.deck === MIXED ? DECKS.flatMap(d => d.ids) : (deckOf(s.deck) || DECKS[0]).ids;
  const picked = shuffle(pool, rng).slice(0, uids.length);
  uids.forEach((u, i) => { s.who[u] = { id: picked[i], n: WHO[picked[i]].n }; });
}
/** The turn to the next player still guessing (after the one whose turn it was); its clock restarted. */
function passTurn(s, here, now) {
  const n = s.order.length;
  for (let k = 1; k <= n; k++) {
    const i = (s.turn + k) % n, u = s.order[i];
    if (!s.done[u] && here.has(u)) {
      s.turn = i;
      s.turnNo++;
      s.turns[u] = (s.turns[u] || 0) + 1;
      if (s.timer) s.deadline = now + s.timer * 1000;
      return u;
    }
  }
  return null;
}
function finish(s, u, how) {
  const got = Object.values(s.done).filter(d => d.how === "got").length;
  s.done[u] = { how, rank: how === "got" ? got + 1 : 0, turns: s.turns[u] || 1 };
}
const turnsWords = n => (n === 1 ? "on the first turn" : `in ${n} turns`);

export default {
  id: "whoami",
  name: "Who am I?",
  zh: "我是谁",
  min: 2,
  max: 12,
  css: "party-whoami.css",
  blurb: "Everyone sees who you are but you. Ask yes or no; guess first.",
  rules: [
    "Everyone is someone: a famous person, a god, a country, a dish, a brand, a painting (Menu: the deck), or, with \"You write them\", whoever the player before you wrote. Every phone shows you everyone's identity but your own, with a crib of facts under each to help you answer about it.",
    "In turn, ask the table yes-or-no questions about who you are, aloud (Am I alive? Am I European? Could I fit in a car?). The others answer from what they know and from the crib. Keep going while the answers are yes; at the first no, tap Next player.",
    "On your turn you may guess, on your phone: right, and you're done; wrong, and the turn passes. A guess that's right in other words can be counted by any of the others. Stuck? Give up, and the phone tells you. With a clock, a turn passes when it runs out.",
    "The first to guess wins. The game ends when only one is left, and the phone says who they were.",
  ],
  options: [
    { id: "deck", label: "Who you are", value: "people", choices: [...DECKS.map(d => [d.id, d.name]), [MIXED, "A mix of all"], [WRITE, "You write them"]] },
    { id: "timer", label: "A turn's clock", value: "0", choices: [["0", "None"], ["60", "1 minute"], ["120", "2 minutes"]] },
  ],

  start({ players, options, rng, now }) {
    const deck = options.deck || "people", timer = Number(options.timer) || 0, uids = players.map(p => p.uid);
    const s = { step: deck === WRITE ? "write" : "play", deck, timer, names: Object.fromEntries(players.map(p => [p.uid, p.name])),
      who: {}, order: shuffle(uids, rng), turn: 0, turnNo: 1, turns: {}, done: {}, guessNo: 0 };
    const first = s.names[s.order[0]];
    if (deck === WRITE) {
      // each writes for the player after them at the table
      s.writes = Object.fromEntries(players.map((p, i) => [p.uid, players[(i + 1) % players.length].uid]));
      s.say = "Each of you, write who the next player will be: someone, or something, the whole table knows. Don't let them see.";
      return s;
    }
    deal(s, uids, rng);
    s.turns[s.order[0]] = 1;
    if (timer) s.deadline = now + timer * 1000;
    s.say = `Everyone has someone to be. Look at the others' cards, not your own. ${first} starts: ask a yes-or-no question about who you are.`;
    return s;
  },

  advance(state, { players, inputs, now, rng }) {
    const s = whole(structuredClone(state)), here = new Set(players.map(p => p.uid));
    const nameOfU = u => players.find(p => p.uid === u)?.name || s.names[u] || "Someone";
    if (s.step === "write") {
      const writers = Object.keys(s.writes).filter(u => here.has(u));
      if (!writers.length || !writers.every(u => clean(inputs[u]?.write))) return null;
      const spare = shuffle(DECKS[0].ids, rng);
      for (const [w, t] of Object.entries(s.writes)) {
        const text = here.has(w) && clean(inputs[w]?.write);
        if (text) s.who[t] = { n: text, by: w };
        else { const id = spare.find(x => !Object.values(s.who).some(v => v.id === x)); s.who[t] = { id, n: WHO[id].n }; }   // a writer who left: the deck's
      }
      s.step = "play";
      s.turns[s.order[0]] = 1;
      if (s.timer) s.deadline = now + s.timer * 1000;
      delete s.writes;
      return { state: s, say: `Everyone has someone to be. Look at the others' cards, not your own. ${nameOfU(s.order[0])} starts: ask a yes-or-no question about who you are.` };
    }
    if (s.step !== "play") return null;
    const lines = [];
    let changed = false;
    const cur = s.order[s.turn];
    // a wrong guess counted by one of the others: right in other words
    const g = s.last;
    if (g && !g.right && !g.counted && !s.done[g.uid] && Object.entries(inputs).some(([u, v]) => u !== g.uid && here.has(u) && v?.count === g.no)) {
      g.counted = true;
      finish(s, g.uid, "got");
      lines.push(`Counted: ${nameOfU(g.uid)} was ${s.who[g.uid].n}.`);
      changed = true;
    }
    // the turn's move, tagged with the turn it was made in: a guess, next player, giving up; or someone moving it on
    const m = inputs[cur];
    const skip = Object.values(inputs).some(v => v?.skip === s.turnNo);
    let pass = false;
    if (s.done[cur]) pass = true;
    else if (!here.has(cur)) pass = true;                          // someone who left the table is skipped
    else if (m && m.turnNo === s.turnNo && m.guess) {
      const text = clean(m.guess).slice(0, 40), right = rightGuess(namesOf(s.who[cur]), text, { person: isPerson(s.who[cur]) });
      s.guessNo++;
      s.last = { uid: cur, text, right, no: s.guessNo };
      if (right) {
        finish(s, cur, "got");
        const rank = s.done[cur].rank;
        lines.push(`${nameOfU(cur)} asks: am I ${s.who[cur].n}? Yes! ${rank === 1 ? "First to get it" : "Got it"}, ${turnsWords(s.done[cur].turns)}.`);
      } else lines.push(`${nameOfU(cur)} asks: am I ${text}? No.`);
      pass = true;
    } else if (m && m.turnNo === s.turnNo && m.giveup) {
      finish(s, cur, "gave");
      lines.push(`${nameOfU(cur)} gives up, and was ${s.who[cur].n}.`);
      pass = true;
    } else if ((m && m.turnNo === s.turnNo && m.next) || skip) pass = true;
    else if (s.timer && s.deadline && now >= s.deadline) { lines.push("Time's up."); pass = true; }
    if (pass) changed = true;
    if (!changed) return null;
    const left = guessing(s, here);
    if (left.length <= 1) {
      s.step = "over";
      delete s.deadline;
      const first = Object.entries(s.done).find(([, d]) => d.rank === 1)?.[0];
      s.winners = first ? [first] : [];
      const rest = s.order.filter(u => !s.done[u] && s.who[u]);
      return { state: s, say: [...lines, `Game over.${first ? ` ${nameOfU(first)} got there first.` : ""}`, ...rest.map(u => `${nameOfU(u)} was ${s.who[u].n}.`)].join(" ") };
    }
    if (pass) {
      const next = passTurn(s, here, now);
      if (next) lines.push(`${nameOfU(next)}'s turn.`);
    }
    return { state: s, say: lines.join(" ") };
  },

  wakeAt: state => (state.step === "play" && state.timer ? state.deadline : null),

  view(stage, ctx) {
    const { me, players, inputs } = ctx, s = whole(structuredClone(ctx.state)), here = new Set(players.map(p => p.uid));
    const nameOfU = u => players.find(p => p.uid === u)?.name || s.names[u] || "Someone";
    const parts = [];
    if (s.step === "write") {
      const target = s.writes[me.uid];
      if (!target) parts.push(h("p", { class: "pk-line" }, "You joined after the game began: watch this one, play the next."));
      else {
        const sent = clean(inputs[me.uid]?.write);
        parts.push(h("p", { class: "pk-ask" }, `Who will ${nameOfU(target)} be?`));
        parts.push(h("p", { class: "pk-line wa-center" }, "Someone, or something, the whole table knows. Keep it from them."));
        const input = h("input", { class: "pk-input", maxlength: 60, autocomplete: "off", placeholder: sent || "A name", "aria-label": `Who ${nameOfU(target)} will be` });
        const go = () => { if (clean(input.value)) ctx.send({ write: clean(input.value) }); };
        input.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
        parts.push(input, button(sent ? `Change it (now: ${sent})` : "Done", go));
        ctx.keep(input);
      }
      const done = Object.keys(inputs).filter(u => clean(inputs[u]?.write));
      parts.push(h("p", { class: "pk-wait" }, waitingFor(players.filter(p => s.writes[p.uid]), done)));
      stage.replaceChildren(h("div", { class: "pk-col" }, ...parts));
      return;
    }
    const mine = s.who[me.uid], cur = s.order[s.turn], over = s.step === "over";
    const myTurn = !over && cur === me.uid && !s.done[me.uid];
    // your card: a question mark until you've got it (large on your turn, a line while you answer the others)
    const myCard = () => {
      if (!mine) return h("p", { class: "pk-line" }, "You joined after the cards were dealt: watch this one, play the next.");
      const d = s.done[me.uid];
      return h("div", { class: `wa-me${d ? " done" : ""}${myTurn || over || d ? "" : " small"}` },
        h("span", { class: "wa-me-label" }, d ? (d.how === "got" ? "You were" : "You gave up: you were") : over ? "You were" : "You are"),
        h("span", { class: "wa-me-who" }, d || over ? s.who[me.uid].n : "?"),
        h("span", { class: "wa-me-what" }, d ? (d.how === "got" ? `Got it ${turnsWords(d.turns)}${d.rank === 1 ? ", first" : ""}` : "") : whatOf(s, mine, nameOfU)));
    };
    // the last guess, and the others' say on it
    const lastGuess = () => {
      const g = s.last;
      if (!g || over) return [];
      const out = [h("p", { class: `wa-last${g.right || g.counted ? " right" : ""}` }, `${g.uid === me.uid ? "You" : nameOfU(g.uid)} guessed “${g.text}”: `,
        h("strong", {}, g.right ? "right" : g.counted ? "counted" : "no"))];
      if (!g.right && !g.counted && g.uid !== me.uid && !s.done[g.uid] && mine) {
        const sent = inputs[me.uid]?.count === g.no;
        out.push(button(sent ? "Counted: waiting…" : `Count it: ${nameOfU(g.uid)} is ${s.who[g.uid].n}`, () => ctx.send({ count: g.no }), { primary: false, disabled: sent, cls: "wa-small" }));
      }
      return out;
    };
    const clock = () => (!over && s.timer && s.deadline ? countdown(s.deadline, ctx.now, { total: s.timer * 1000 }) : null);
    let others = s.order.filter(u => u !== me.uid && s.who[u]);
    if (over) parts.push(endList(s, nameOfU, me.uid), myCard());
    else if (myTurn) {
      parts.push(myCard(), h("p", { class: "pk-ask" }, "Your turn"),
        h("p", { class: "pk-line wa-center" }, "Ask a yes-or-no question about who you are, aloud. Keep going while the answers are yes."),
        guessBox(s, ctx),
        h("div", { class: "wa-row" }, button("Next player", () => ctx.send({ next: true, turnNo: s.turnNo }), { primary: false }), giveUp(s, ctx)),
        clock(), ...lastGuess());
    } else {
      // someone else's turn: their card first, the one you answer from
      parts.push(h("p", { class: "pk-ask" }, `${nameOfU(cur)}'s turn: answer yes or no`));
      if (s.who[cur]) parts.push(h("ul", { class: "wa-cards" }, card(s, cur, ctx, nameOfU, cur, { open: true })));
      others = others.filter(u => u !== cur);
      parts.push(clock(), ...lastGuess(), myCard());
      if (me.driver && here.has(cur)) parts.push(button(`Move on from ${nameOfU(cur)}`, () => ctx.send({ skip: s.turnNo }), { primary: false, cls: "wa-small" }));
    }
    // everyone else's card: who they are, what's said of it, how they're doing
    if (others.length) {
      parts.push(h("h3", { class: "pa-h" }, over ? "Everyone" : myTurn ? "The others" : "The rest"));
      parts.push(h("ul", { class: "wa-cards" }, ...others.map(u => card(s, u, ctx, nameOfU, cur))));
    }
    stage.replaceChildren(h("div", { class: "pk-col" }, ...parts));
  },
};

/** The guess on your turn: a box, the names in the deck that fit what's typed (a tap guesses), and Guess. */
function guessBox(s, ctx) {
  const pool = s.deck === WRITE ? [] : s.deck === MIXED ? DECKS.flatMap(d => d.ids) : (deckOf(s.deck)?.ids || []);
  const input = h("input", { class: "pk-input", maxlength: 40, autocomplete: "off", autocapitalize: "words", placeholder: "Your guess", "aria-label": "Your guess" });
  const hints = h("div", { class: "wa-hints", role: "listbox", "aria-label": "Names that fit" });
  const send = text => { if (clean(text)) ctx.send({ guess: clean(text), turnNo: s.turnNo }); };
  const fill = () => {
    const q = norm(input.value);
    hints.replaceChildren();
    if (q.length < 2 || !pool.length) return;
    const hits = [];
    for (const id of pool) {
      const n = WHO[id]?.n;
      if (!n) continue;
      const t = norm(n);
      if (t.startsWith(q) || t.includes(` ${q}`)) hits.push(n);
      if (hits.length >= 6) break;
    }
    hints.append(...hits.map(n => h("button", { type: "button", class: "wa-hint", role: "option", onclick: () => send(n) }, n)));
  };
  input.addEventListener("input", fill);
  input.addEventListener("keydown", e => { if (e.key === "Enter") send(input.value); });
  ctx.keep(input, "guess");
  queueMicrotask(fill);                                       // the words kept from before a redraw bring their names back
  return h("div", { class: "wa-guess" }, h("div", { class: "wa-guess-row" }, input, button("Guess", () => send(input.value), { cls: "wa-guess-go" })), hints);
}

/** Another player's card: their name and how they're doing, who they are, the crib (the first lines, then More). */
const opened = new Set();
function card(s, u, ctx, nameOfU, cur, { open = false } = {}) {
  const who = s.who[u], w = who.id ? WHO[who.id] : null, d = s.done[u];
  const status = d ? (d.how === "got" ? `✓ ${turnsWords(d.turns)}` : "gave up") : u === cur ? "asking" : s.turns[u] ? `${s.turns[u]} turn${s.turns[u] > 1 ? "s" : ""}` : "";
  const crib = w?.c || [];
  const key = `${ctx.seq}:${u}`;
  // the one being asked shows the whole crib; the rest their first lines, and More
  const shown = open ? crib.length : SHOWN;
  const more = crib.length > shown ? h("details", { class: "wa-more", open: opened.has(key) || null }, h("summary", {}, `${crib.length - shown} more`),
    h("ul", { class: "wa-crib" }, ...crib.slice(shown).map(c => h("li", {}, c)))) : null;
  more?.addEventListener("toggle", () => { if (more.open) opened.add(key); else opened.delete(key); });
  const pic = w?.p ? h("span", { class: "wa-pic" }) : null;
  if (pic) showPicture(pic, w.p, { width: 120, alt: w.n }).catch(() => pic.remove());
  return h("li", { class: `wa-card${u === cur && !d ? " now" : ""}${d ? " done" : ""}` },
    h("div", { class: "wa-card-head" }, h("span", { class: "wa-name" }, nameOfU(u)), status ? h("span", { class: "wa-status" }, status) : null),
    h("div", { class: "wa-card-body" }, pic,
      h("div", { class: "wa-card-text" },
        h("span", { class: "wa-who" }, who.n),
        who.by ? h("span", { class: "wa-by" }, `picked by ${nameOfU(who.by)}`) : s.deck === MIXED && who.id ? h("span", { class: "wa-by" }, homeDeck(who.id)?.name || "") : null,
        crib.length ? h("ul", { class: "wa-crib" }, ...crib.slice(0, shown).map(c => h("li", {}, c))) : null, more)));
}

/** The end: the finishing order, who gave up, who was left. */
function endList(s, nameOfU, me) {
  const got = s.order.filter(u => s.done[u]?.how === "got").sort((a, b) => s.done[a].rank - s.done[b].rank);
  const gave = s.order.filter(u => s.done[u]?.how === "gave"), left = s.order.filter(u => !s.done[u] && s.who[u]);
  const row = (u, note, cls = "") => h("li", { class: `${cls}${u === me ? " me" : ""}` }, h("span", { class: "wa-end-name" }, nameOfU(u)), h("span", { class: "wa-end-who" }, s.who[u].n), h("span", { class: "wa-end-note" }, note));
  return h("ol", { class: "wa-end" },
    ...got.map((u, i) => row(u, turnsWords(s.done[u].turns), i === 0 ? "won" : "")),
    ...gave.map(u => row(u, "gave up", "out")),
    ...left.map(u => row(u, "last", "out")));
}

/** Give up: a second tap to be sure (a first tap that's a slip costs nothing). */
function giveUp(s, ctx) {
  const b = button("Give up", () => {
    if (b.dataset.sure) ctx.send({ giveup: true, turnNo: s.turnNo });
    else { b.dataset.sure = "1"; b.textContent = "Sure? Tap again"; setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = "Give up"; } }, 4000); }
  }, { primary: false, cls: "wa-giveup" });
  return b;
}

/** For the tests: what's said of an identity. */
export const cribOf = id => WHO[id]?.c || [];
