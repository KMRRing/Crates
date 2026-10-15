// Forger, the drawing game of the artist who doesn't know what's being drawn (A Fake Artist Goes to New York's
// mechanics): everyone sees the kind of thing (an animal), and all but one, the forger, see the word (a giraffe). In
// turn, twice round the table, each adds one line to a drawing shared by every phone, in their own colour: enough to
// show the others they know the word, not so much that the forger can work it out. Then everyone votes for the forger.
// Caught with the most votes, the forger can still win by naming the word; otherwise the artists win the round.
import { KINDS, WORDS } from "./party-draw-words.js";
import { h, button, countdown, waitingFor, scoreList, names, secretCard, pickPlayer } from "./party-kit.js";
import { shuffle } from "./party-core.js";
import { createPad, picture, sender, keep, decode, encode, guessIs, INKS } from "./party-draw.js";

const LOOK_MS = 30000;            // to look at your card, unless everyone's ready sooner
const LINE_MS = 25000;            // to draw a line
const VOTE_MS = 60000;
const NAME_MS = 45000;            // the forger, caught, naming the word
const REVEAL_MS = 15000;
export const POINTS = { forger: 2, artist: 1 };
/** The players' colours, by seat: as far apart as the inks allow. */
export const COLOURS = [1, 6, 4, 2, 7, 0, 8, 9, 5, 10];
// the kinds a forger can bluff in (things people do are drawn as people, which gives nothing away), and their words
// that a line or two can begin to show
const DEALT = KINDS.filter(k => k.id !== "doing").map(k => k.id);
const BY_ID = new Map(WORDS.map(w => [w.id, w]));
const KIND = new Map(KINDS.map(k => [k.id, k]));

/** The kind and the word as the table plays them, and every answer the forger may name. */
export function cardOf(s) {
  const w = BY_ID.get(s.word), k = KIND.get(w?.kind);
  const say = (en, zh) => (s.lang === "zh" ? zh : s.lang === "both" ? `${zh} · ${en}` : en);
  return { kind: k ? say(k.en, k.zh) : "", word: w ? say(w.en[0], w.zh[0]) : "", sayKind: k?.en.toLowerCase() || "", sayWord: w?.en[0] || "", answers: w ? [...w.en, ...w.zh] : [] };
}
/** A player's line as the table keeps it: one stroke, in their own colour and the medium pen, or "". */
export function lineOf(text, ink) {
  const s = decode(text)[0];
  return s && s.p.length >= 2 ? encode([{ c: ink, w: 1, p: s.p }]) : "";
}
/** The vote: who has the most, alone (null on a tie, or no votes). */
export function accusedOf(votes) {
  const count = {};
  for (const v of Object.values(votes)) if (v) count[v] = (count[v] || 0) + 1;
  const top = Math.max(0, ...Object.values(count)), at = Object.keys(count).filter(u => count[u] === top);
  return top && at.length === 1 ? at[0] : null;
}

const whole = s => {
  for (const k of ["order", "forgers", "turns", "lines", "dealt"]) s[k] = s[k] ? Object.values(s[k]) : [];
  s.names ||= {}; s.scores ||= {}; s.colours ||= {}; s.votes ||= {}; s.ready ||= {};
  return s;
};
const nameOfIn = s => u => s.names[u] || "Someone";

/** A new round: the forger's turn, a word of a kind the party hasn't had, and the order of play (never the forger first). */
function deal(s, players, rng, now, shown) {
  const here = new Set(players.map(p => p.uid)), n = s.order.length;
  s.forger = s.forgers[s.round];
  if (!here.has(s.forger)) s.forger = shuffle(s.order.filter(u => here.has(u)), rng)[0] || s.forger;
  const was = new Map(shown.map((id, i) => [id, i])), dealt = new Set(s.dealt);
  const pool = shuffle(WORDS.filter(w => DEALT.includes(w.kind) && w.level <= 2 && !dealt.has(w.id)), rng);
  const w = pool.find(x => !was.has(x.id)) || pool.sort((a, b) => was.get(a.id) - was.get(b.id))[0] || WORDS[0];
  s.word = w.id;
  s.dealt.push(w.id);
  // the first to draw moves round the table each round, past the forger, who'd have nothing to go on
  let first = s.round % n;
  for (let i = 0; i < n && (s.order[first] === s.forger || !here.has(s.order[first])); i++) first = (first + 1) % n;
  const round = Array.from({ length: n }, (_, i) => s.order[(first + i) % n]).filter(u => here.has(u));
  s.turns = [...round, ...round];
  s.turn = 0;
  s.lines = [];
  s.votes = {};
  s.ready = {};
  delete s.accused; delete s.caught; delete s.guess; delete s.won; delete s.gained;
  s.step = "look";
  s.deadline = now + LOOK_MS;
  const c = cardOf(s);
  return { say: `Round ${s.round + 1} of ${s.rounds}. The kind: ${c.sayKind}. Everyone but the forger has the word: look at your card.`, show: [w.id] };
}
function nextTurn(s, players, now) {
  const here = new Set(players.map(p => p.uid)), nameOf = nameOfIn(s);
  while (s.turn < s.turns.length && !here.has(s.turns[s.turn])) s.turn++;
  if (s.turn >= s.turns.length) {
    s.step = "vote";
    s.deadline = now + VOTE_MS;
    return "Every line is in. Who's the forger? Vote on your phone.";
  }
  s.deadline = now + LINE_MS;
  const lap = s.turn === Math.floor(s.turns.length / 2) ? "Second time round. " : "";
  return `${lap}${nameOf(s.turns[s.turn])}'s line.`;
}
function settle(s, won, now) {
  s.won = won;
  s.gained = {};
  if (won === "forger") s.gained[s.forger] = POINTS.forger;
  else for (const u of s.order) if (u !== s.forger) s.gained[u] = POINTS.artist;
  for (const [u, p] of Object.entries(s.gained)) s.scores[u] = (s.scores[u] || 0) + p;
  s.step = "reveal";
  s.deadline = now + REVEAL_MS;
}

export default {
  id: "forger",
  name: "Forger",
  min: 4,
  max: 10,
  css: "party-draw.css",
  keepsView: true,
  blurb: "One line each on a shared drawing of a word only the forger doesn't know: find the forger, who can still win by naming it.",
  rules: [
    "Everyone sees the kind of thing being drawn (an animal), and all but one see the word (a giraffe) on their phone, hidden until tapped. The one without it is the forger, and has to bluff.",
    "In turn, twice round the table, each player adds one line to the drawing every phone shows, in their own colour: pen down, one stroke, pen up (Redo if it went wrong, then Done; 25 seconds a line). Draw enough to show you know the word, not so much that the forger can work it out. The forger draws too, as if they knew.",
    "Then everyone votes for the forger. With the most votes alone, the forger is caught, but can still win by naming the word; otherwise, or on a tie, the forger gets away. The forger winning scores them 2; the artists winning scores each of them 1. Three or five rounds, or once each as forger; the most points wins.",
  ],
  options: [
    { id: "lang", label: "Words", choices: [["en", "English"], ["zh", "中文"], ["both", "Both"]], value: "en" },
    { id: "rounds", label: "Rounds", choices: [["3", "3"], ["5", "5"], ["each", "Once each"]], value: "3" },
  ],

  start({ players, options, rng, now, shown }) {
    const order = players.map(p => p.uid), n = order.length;
    const rounds = options.rounds === "each" ? n : [3, 5].includes(Number(options.rounds)) ? Number(options.rounds) : 3;
    // each a forger in turn, in an order nobody knows, before anyone is twice
    const forgers = [];
    while (forgers.length < rounds) forgers.push(...shuffle(order, rng));
    const s = { lang: ["en", "zh", "both"].includes(options.lang) ? options.lang : "en", rounds, order, round: 0, dealt: [],
      names: Object.fromEntries(players.map(p => [p.uid, p.name])), scores: Object.fromEntries(order.map(u => [u, 0])),
      colours: Object.fromEntries(order.map((u, i) => [u, COLOURS[i % COLOURS.length]])), forgers: forgers.slice(0, rounds) };
    const r = deal(s, players, rng, now, shown || []);
    s.say = `Forger: ${rounds} rounds. ${r.say}`;
    s.show = r.show;
    return s;
  },

  advance(state, { players, inputs, now, rng, shown }) {
    const s = whole(structuredClone(state)), here = new Set(players.map(p => p.uid)), nameOf = nameOfIn(s);
    const mine = u => (inputs[u]?.round === s.round ? inputs[u] : null);
    const playing = s.order.filter(u => here.has(u));
    if (s.step === "look") {
      if (!playing.every(u => mine(u)?.ready) && now < s.deadline) return null;
      s.step = "draw";
      const said = nextTurn(s, players, now);
      return { state: s, say: s.step === "draw" ? `${nameOf(s.turns[s.turn])} starts: one line each, twice round.` : said };
    }
    if (s.step === "draw") {
      const u = s.turns[s.turn], v = mine(u)?.turn === s.turn ? mine(u) : null;
      if (here.has(u) && !v?.done && now < s.deadline) return null;
      const line = lineOf(v?.s, s.colours[u]);
      if (line) s.lines.push({ by: u, s: line });
      s.turn++;
      return { state: s, say: nextTurn(s, players, now) };
    }
    if (s.step === "vote") {
      const ok = u => { const v = mine(u)?.vote; return !!v && v !== u && s.order.includes(v); };
      if (!playing.every(ok) && now < s.deadline) return null;
      s.votes = Object.fromEntries(playing.filter(ok).map(u => [u, mine(u).vote]));
      const accused = accusedOf(s.votes);
      if (accused) s.accused = accused;
      s.caught = accused === s.forger;
      if (s.caught && here.has(s.forger)) {
        s.step = "name";
        s.deadline = now + NAME_MS;
        return { state: s, say: `${nameOf(accused)} has the most votes, and is the forger! ${nameOf(s.forger)} can still win by naming the word.` };
      }
      const c = cardOf(s);
      settle(s, s.caught ? "artists" : "forger", now);
      const why = s.caught ? `${nameOf(s.forger)}, the forger, was caught and has gone.` : accused ? `${nameOf(accused)} has the most votes, but the forger was ${nameOf(s.forger)}: the forger gets away.`
        : `The vote is tied, and the forger, ${nameOf(s.forger)}, gets away.`;
      return { state: s, say: `${why} The word was ${c.sayWord}.` };
    }
    if (s.step === "name") {
      const g = mine(s.forger)?.guess;
      if (typeof g !== "string" && here.has(s.forger) && now < s.deadline) return null;
      const c = cardOf(s), right = typeof g === "string" && guessIs(g, c.answers);
      s.guess = typeof g === "string" ? g.replace(/\s+/g, " ").trim().slice(0, 40) : "";
      settle(s, right ? "forger" : "artists", now);
      return { state: s, say: right ? `${nameOf(s.forger)} named it: ${c.sayWord}. The forger wins the round.`
        : `${s.guess ? `${nameOf(s.forger)} said ${s.guess}` : `${nameOf(s.forger)} named nothing`}: it was ${c.sayWord}. The artists win the round.` };
    }
    if (s.step === "reveal") {
      if (now < s.deadline && !(playing.length && playing.every(u => mine(u)?.next))) return null;
      s.round++;
      if (s.round >= s.rounds) {
        s.step = "over";
        delete s.deadline;
        const top = Math.max(0, ...s.order.map(u => s.scores[u] || 0));
        s.winners = top > 0 ? s.order.filter(u => (s.scores[u] || 0) === top) : [];
        return { state: s, say: `That's the game. ${s.winners.length ? `${names(s.winners.map(nameOf))} ${s.winners.length > 1 ? "win" : "wins"}, with ${top} points.` : "Nobody scored."}` };
      }
      const r = deal(s, players, rng, now, shown);
      return { state: s, say: r.say, show: r.show };
    }
    return null;
  },

  wakeAt: s => (["look", "draw", "vote", "name", "reveal"].includes(s.step) ? s.deadline ?? null : null),

  view(stage, ctx) {
    const s = whole(structuredClone(ctx.state)), me = ctx.me.uid;
    const role = !s.order.includes(me) ? "watcher" : me === s.forger ? "forger" : "artist";
    const key = s.step === "draw" ? `draw:${s.round}:${s.turn}:${s.turns[s.turn] === me}` : `${s.step}:${s.round}:${role}`;
    keep(stage, key, ctx, () => SCREENS[s.step](stage, s, role, ctx));
  },
};

// ---------- the screens ----------
const nameIn = (ctx, s) => u => ctx.players.find(p => p.uid === u)?.name || s.names[u] || "Someone";
const sentBy = (ctx, s, u) => (ctx.inputs[u]?.round === s.round ? ctx.inputs[u] : null);
const drawingOf = (s, live = "") => [...s.lines.map(l => l.s), live].filter(Boolean).join(".");
/** A player's name with their colour beside it. */
const chip = (s, nameOf, u, cls = "") => {
  const dot = h("i", { class: "fg-dot" });
  dot.style.setProperty("--dr-ink", INKS[s.colours[u]]?.hex || INKS[0].hex);
  return h("span", { class: `fg-chip ${cls}`.trim() }, dot, nameOf(u));
};
/** Your card, hidden until tapped and the same on every phone until then (its label too, so a glance gives nobody
 *  away): the word, or that you're the forger. */
const card = (s, role, open = false) => secretCard("Your card", role === "forger"
  ? h("span", { class: "fg-forger-card" }, h("span", {}, "You're the forger"), h("small", {}, "Draw as if you knew the word"))
  : cardOf(s).word, { key: `forger:${s.round}`, open });
/** The order of play, once round (it goes round twice): whose line it is, who has drawn this time round. */
function turnsLine(s, nameOf) {
  const half = s.turns.length / 2, lap = s.turn >= half ? 1 : 0;
  return h("div", { class: "fg-order" }, h("span", { class: "sk-label" }, lap ? "Second time round" : "First time round"),
    h("ol", { class: "fg-turns" }, ...s.turns.slice(0, half).map((u, i) => h("li", { class: lap * half + i < s.turn ? "done" : lap * half + i === s.turn ? "now" : "" }, chip(s, nameOf, u)))));
}
const scores = (s, nameOf, winners = []) => scoreList(s.order.map(u => ({ uid: u, name: nameOf(u), score: s.scores[u] || 0 })), { winners });

const SCREENS = {
  look(stage, s, role, ctx) {
    const nameOf = nameIn(ctx, s), c = cardOf(s), wait = h("p", { class: "pk-wait" });
    let cur = ctx, sent = false;
    const ready = role === "watcher" ? h("p", { class: "pk-line" }, "You joined mid-game: watch this one.")
      : button("I've seen it", () => { sent = true; cur.send({ ready: true, round: s.round }); ready.disabled = true; ready.textContent = "Ready"; });
    stage.append(h("div", { class: "dr-wrap fg-look" },
      h("p", { class: "fg-kind" }, h("span", { class: "sk-label" }, `Round ${s.round + 1} of ${s.rounds} · the kind`), h("strong", {}, c.kind)),
      role === "watcher" ? null : card(s, role, true),
      ready, countdown(s.deadline, ctx.now, { total: LOOK_MS }), wait));
    return { update(c2) { cur = c2; wait.textContent = waitingFor(c2.players.filter(p => s.order.includes(p.uid)), s.order.filter(u => sentBy(c2, s, u)?.ready)); if (sent) ready.disabled = true; } };
  },

  draw(stage, s, role, ctx) {
    const nameOf = nameIn(ctx, s), c = cardOf(s), who = s.turns[s.turn], mineTurn = who === ctx.me.uid;
    const box = h("div", { class: "dr-box fit-grow fit-box" }), under = h("div", { class: "fg-under" });
    stage.append(h("div", { class: "dr-wrap fg-draw" },
      h("div", { class: "dr-head" }, h("p", { class: "sk-top" }, h("span", { class: "sk-label" }, c.kind), mineTurn ? h("strong", { class: "fg-yours" }, "Your line") : h("strong", {}, chip(s, nameOf, who))),
        countdown(s.deadline, ctx.now, { total: LINE_MS })),
      box, h("div", { class: "dr-side" }, under, turnsLine(s, nameOf), role === "watcher" ? null : card(s, role))));
    let cur = ctx;
    if (mineTurn) {
      // your line: one stroke over the drawing so far, in your colour; Redo, then Done (the clock takes it as it stands)
      const flow = sender(text => cur.send({ round: s.round, turn: s.turn, s: text }), () => pad.text());
      const pad = createPad({ single: true, inks: [s.colours[cur.me.uid]], eraser: false, undo: false, clear: false,
        onChange: why => { flow.push(why !== "move"); paint(); } });
      pad.base(decode(drawingOf(s)));
      const redo = button("Redo", () => { pad.undo(); flow.flush(); paint(); }, { primary: false });
      const done = button("Done", () => { flow.flush(); cur.send({ round: s.round, turn: s.turn, s: pad.text(), done: true }); pad.enable(false); paint(true); });
      const hint = h("p", { class: "pk-line fg-note" }, "One line: pen down, one stroke, pen up.");
      const paint = (sent = false) => { redo.disabled = sent || !pad.count; done.disabled = sent || !pad.count; hint.hidden = !!pad.count; };
      box.append(pad.paper);
      under.append(hint, h("div", { class: "fg-row" }, redo, done));
      paint();
      return { leave() { flow.flush(); flow.stop(); pad.enable(false); } };
    }
    const pic = picture(drawingOf(s), { label: "The drawing so far" });
    box.append(pic.el);
    under.append(h("p", { class: "pk-line fg-note" }, `${nameOf(who)} is drawing a line…`));
    return { update(c2) { cur = c2; const v = sentBy(c2, s, who); pic.set(drawingOf(s, v?.turn === s.turn ? lineOf(v.s, s.colours[who]) : "")); } };
  },

  vote(stage, s, role, ctx) {
    const nameOf = nameIn(ctx, s), wait = h("p", { class: "pk-wait" }), grid = h("div", { class: "fg-vote" });
    stage.append(h("div", { class: "dr-wrap fg-votes" },
      h("div", { class: "dr-head" }, h("p", { class: "sk-top" }, h("span", { class: "sk-label" }, cardOf(s).kind), h("strong", {}, "Who's the forger?")), countdown(s.deadline, ctx.now, { total: VOTE_MS })),
      h("div", { class: "dr-box fit-grow fit-box" }, picture(drawingOf(s), { label: "The drawing" }).el),
      h("div", { class: "dr-side" }, role === "watcher" ? h("p", { class: "pk-line" }, "They're voting.") : grid, wait)));
    let cur = ctx;
    const paint = () => {
      const picked = sentBy(cur, s, cur.me.uid)?.vote || null;
      grid.replaceChildren(pickPlayer(cur.players.filter(p => s.order.includes(p.uid)), { picked, exclude: [cur.me.uid], label: "The forger", onPick: u => { cur.send({ vote: u, round: s.round }); } }));
    };
    return { update(c2) { cur = c2; if (role !== "watcher") paint(); wait.textContent = waitingFor(c2.players.filter(p => s.order.includes(p.uid)), s.order.filter(u => sentBy(c2, s, u)?.vote)); } };
  },

  name(stage, s, role, ctx) {
    const nameOf = nameIn(ctx, s), c = cardOf(s), clock = countdown(s.deadline, ctx.now, { total: NAME_MS });
    if (role !== "forger") {
      stage.append(h("div", { class: "dr-wrap fg-name" }, h("p", { class: "pk-ask" }, `${nameOf(s.forger)} is the forger, and is caught`),
        h("p", { class: "pk-line fg-note" }, `They can still win by naming the word. The kind: ${c.kind}.`), clock));
      return {};
    }
    let cur = ctx;
    const input = h("input", { class: "pk-input", maxlength: 40, autocomplete: "off", autocapitalize: "off", spellcheck: "false", enterkeyhint: "done", placeholder: "The word", "aria-label": "The word" });
    const go = () => { const t = input.value.replace(/\s+/g, " ").trim(); if (!t) return; input.disabled = true; send.disabled = true; cur.send({ guess: t, round: s.round }); };
    const send = button("Name it", go, { cls: "fg-send" });
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    stage.append(h("div", { class: "dr-wrap fg-name" }, h("p", { class: "pk-ask" }, "Caught! Name the word to win anyway"),
      h("p", { class: "pk-line fg-note" }, `The kind: ${c.kind}. One go, in either language.`), h("div", { class: "sk-row" }, input, send), clock,
      h("div", { class: "dr-box fit-grow fit-box" }, picture(drawingOf(s), { label: "The drawing" }).el)));
    return { update(c2) { cur = c2; } };
  },

  reveal(stage, s, role, ctx) {
    const nameOf = nameIn(ctx, s), c = cardOf(s), forger = s.forger;
    const verdict = s.won === "forger" ? (s.caught ? "Caught, but named it: the forger wins" : "The forger got away") : "Caught: the artists win";
    const votes = h("ul", { class: "fg-votes-list" }, ...s.order.filter(u => s.votes[u]).map(u => h("li", {}, chip(s, nameOf, u), h("span", { class: "fg-arrow" }, "→"), chip(s, nameOf, s.votes[u], s.votes[u] === forger ? "forger" : ""))));
    let cur = ctx;
    const next = role === "watcher" ? null : button(s.round + 1 >= s.rounds ? "See the scores" : "Next round", () => { cur.send({ next: true, round: s.round }); next.disabled = true; next.textContent = "Waiting for the others…"; }, { primary: false });
    stage.append(h("div", { class: "dr-wrap fg-reveal" },
      h("div", { class: "dr-head" }, h("p", { class: "sk-top" }, h("span", { class: "sk-label" }, "The word"), h("strong", { class: "sk-word-big" }, c.word)),
        h("p", { class: `pk-verdict ${s.won === "forger" ? "fg-forger" : "fg-artists"}` }, verdict)),
      h("div", { class: "dr-box fit-grow fit-box" }, picture(drawingOf(s), { label: "The drawing" }).el),
      h("div", { class: "dr-side" }, h("p", { class: "fg-who" }, "The forger: ", chip(s, nameOf, forger, "forger"), s.guess ? h("span", { class: "fg-guess" }, ` said “${s.guess}”`) : null),
        votes, countdown(s.deadline, ctx.now, { total: REVEAL_MS }), next, h("div", { class: "sk-board fit-scroll" }, scores(s, nameOf)))));
    return { update(c2) { cur = c2; } };
  },

  over(stage, s, role, ctx) {
    const nameOf = nameIn(ctx, s);
    stage.append(h("div", { class: "dr-wrap sk-over" },
      h("div", { class: "pk-verdict big" }, s.winners?.length ? `${names(s.winners.map(nameOf))} ${s.winners.length > 1 ? "win" : "wins"}` : "Nobody scored"),
      h("div", { class: "sk-board fit-grow fit-scroll" }, scores(s, nameOf, s.winners || []))));
    return {};
  },
};
