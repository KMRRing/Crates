// Cue at a party: the same stream of cards as the one-phone Cue (cue.html), on every phone at once, with a player whose
// turn it is (X) who sees the same cue as everyone, a different one, or none (cue-turn.js has the rules, tests/cue-turn.mjs
// plays them). Anyone taps Next for the next card; the cooldown after each card runs on every phone from the same moment
// (the table's clock), and the host can change its length between cards. The one-phone Cue is untouched: Menu there,
// "Play on several phones", comes here.
import { h, button, pickPlayer } from "./party-kit.js";
import { narrate } from "./table.js";
import { clockAt } from "./cue-clock.js";
import { CATS, LEVELS } from "./cue-library.js";
import { SEES, WHO, begin, whole, nextCard, pickNext, mayPick, setCount, viewOf, revealOf, isOver, need, stepped } from "./cue-turn.js";

const COUNTS = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120];
const nameOf = (s, uid) => s.names?.[uid] || "Someone";
/** What the narrator and the strip say as a card comes up: whose turn it is, where the table knows. */
export function lineOf(s, you = null) {
  if (s.step === "pick") return `${s.x ? `${nameOf(s, s.x)}, p` : "P"}ick who goes next.`;
  const who = uid => (uid === you ? "Your" : `${nameOf(s, uid)}'s`);
  if (s.sees === "odd") return "Next card. Somebody has a different cue.";
  return `${who(s.x)} turn${s.sees === "none" ? ": no cue, guess it" : ""}.`;
}

/** The players at the table who are here now (awake), else everyone seated. */
const hereOf = branch => {
  const all = Object.entries(branch?.players || {}).filter(([, p]) => p && Number.isInteger(p.seat)).sort((a, b) => a[1].seat - b[1].seat);
  const up = all.filter(([, p]) => p.online !== false);
  return (up.length ? up : all).map(([uid]) => uid);
};

export default {
  id: "cue",
  name: "Cue",
  min: 2,
  max: 12,
  css: "party-cue.css",
  blurb: "A card on every phone. One player may see a different cue, or none.",
  rules: [
    "A card comes up on every phone: a question to answer, a word to act or describe, a sentence to finish. One player is X for each card, and what X sees is the Turn setting. The same cue as everyone: X is in the hot seat, going first. A different cue: X sees a twin of the card (or another card of its kind), and nobody is told who, X included; talk it over, find the odd one out, and Reveal shows who it was. No cue: X sees a blank card and works out the cue from what the others say and do, as in Heads Up.",
    "X comes round in turn, at random (everyone once before anyone twice) or chosen: the player whose turn it was picks the next, and the host picks the first. Anyone taps Next for the next card.",
    "A countdown runs on every phone from the same moment when a card comes up (a second to read first); at nought the card is over, and a Reveal tells what X saw. The host sets how long it is, in seconds, and can change it between cards. Who's playing sets how cheeky the cards are: Kids and family, Work-safe, or Friends; all of them are clean.",
  ],
  options: [
    { id: "deck", label: "Cards", choices: [["mix", "A mix"], ...CATS.map(c => [c.id, c.name])], value: "mix" },
    { id: "level", label: "Who's playing", choices: LEVELS, value: "2" },
    { id: "sees", label: "Player X sees", choices: SEES, value: "same" },
    { id: "who", label: "Player X is", choices: WHO, value: "turn" },
    { id: "count", label: "Countdown, seconds", choices: COUNTS.map(c => [String(c), c ? String(c) : "None"]), value: "10" },
  ],
  need: (players, options) => need(players, options),

  start({ players, options, rng, now }) {
    const s = begin({ players, options, rnd: rng, now });
    s.say = lineOf(s);
    return s;
  },
  advance: () => null,

  view(stage, ctx) {
    const s = whole(structuredClone(ctx.state)), me = ctx.me, here = ctx.players.filter(p => p.online).map(p => p.uid);
    const parts = [];
    const bump = (change, say = true) => ctx.act((st, b) => {
      const ok = change(st, hereOf(b));
      if (ok && say) narrate(b, lineOf(st));
      return ok;
    });

    if (s.step === "pick") {
      parts.push(h("p", { class: "pcu-top" }, `Card ${(s.cards || 0) + 1}`));
      if (mayPick(s, me.uid, me.host)) {
        parts.push(h("p", { class: "pk-ask" }, "Who goes next?"));
        parts.push(pickPlayer(ctx.players, { exclude: s.x === me.uid && !me.host ? [me.uid] : [], onPick: uid => bump((st, hr) => pickNext(st, s.n, uid, hr, Math.random, ctx.now())) }));
      } else parts.push(h("p", { class: "pk-wait pcu-wait" }, `${s.x && here.includes(s.x) ? nameOf(s, s.x) : "The host"} is picking who goes next`));
      stage.replaceChildren(h("div", { class: "pk-col pcu" }, ...parts));
      return;
    }

    const v = viewOf(s, me.uid);
    if (!v) { stage.replaceChildren(h("div", { class: "pk-col pcu" }, h("p", { class: "pk-wait" }, "Waiting for the next card"))); return; }
    const turn = s.sees === "odd" ? "Somebody has a different cue" : s.x === me.uid ? "Your turn" : `${nameOf(s, s.x)}'s turn`;
    parts.push(h("p", { class: "pcu-top" }, `${v.cat.name} · card ${s.cards}`, h("br"), h("b", {}, turn)));

    const len = (v.text || "").length, long = len > 40 ? "long" : len > 16 ? "mid" : "";
    const card = h("div", { class: `pcu-card ${v.blind ? "blind" : ""}`, "data-role": v.role },
      h("p", { class: "pcu-kind" }, v.blind ? "No cue for you" : v.kind),
      h("p", { class: `pcu-text ${long}`, style: `--n:${Math.max(1, ...(v.text || "?").split(" ").map(w => w.length))}` }, v.blind ? "?" : v.text),
      h("p", { class: "pcu-line" }, v.line));
    parts.push(card);

    // the cooldown: a second to read, then counted down on every phone from the moment the card came up
    const reveal = h("p", { class: "pcu-reveal", hidden: true }, revealOf(s));
    if (s.count > 0) parts.push(dial(s, ctx, card, reveal));
    const over = isOver(s, ctx.now());
    if (revealOf(s)) {
      reveal.hidden = !over;
      parts.push(reveal);
      if (!over) parts.push(button("Reveal", () => ctx.act(st => { if (st.n !== s.n) return false; st.revealed = true; }), { primary: false, cls: "pcu-reveal-btn" }));
    }
    parts.push(button("Next card", () => bump((st, hr) => nextCard(st, s.n, hr, Math.random, ctx.now()))));
    if (me.host) parts.push(stepper(s, ctx));
    stage.replaceChildren(h("div", { class: "pk-col pcu" }, ...parts));
  },
};

/** The ring of seconds under the card, drawn each frame from the table's clock until it is over. */
function dial(s, ctx, card, reveal) {
  const num = h("span", { class: "pcu-num" }), bar = h("span", { class: "pcu-bar" });
  const el = h("div", { class: "pcu-dial", role: "timer", "data-phase": "read" }, num, h("span", { class: "pcu-track" }, bar));
  let flashed = isOver(s, ctx.now());
  const tick = () => {
    if (el.dataset.on && !el.isConnected) return;
    el.dataset.on = "1";
    const c = clockAt(ctx.now() - s.at, s.count * 1000);
    el.dataset.phase = c.phase;
    num.textContent = c.n === null ? "" : String(c.n);
    bar.style.width = `${100 * c.left}%`;
    if (c.phase === "over") {
      reveal.hidden = false;
      if (!flashed) { flashed = true; card.classList.add("ding"); }
    } else requestAnimationFrame(tick);
  };
  tick();
  return el;
}

/** The host's cooldown stepper: the new length applies from the next card. */
function stepper(s, ctx) {
  const set = dir => ctx.act(st => setCount(st, stepped(st.count, dir)));
  return h("div", { class: "pcu-step" }, h("span", {}, s.count ? `Countdown ${s.count} s` : "No countdown"),
    h("button", { type: "button", class: "btn", "aria-label": "Shorter countdown", onclick: () => set(-1) }, "−"),
    h("button", { type: "button", class: "btn", "aria-label": "Longer countdown", onclick: () => set(1) }, "+"));
}
