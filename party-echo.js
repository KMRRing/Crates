// Echo, the cooperative word game of one clue each (Just One's mechanics): each card, one player guesses and everyone
// else sees the word on their phone and writes one clue, one word, without seeing the others'. The same clue twice
// cancels out, both copies, before the guesser sees them, as does a clue that is the word itself or more than one word;
// the clue-givers look the clues over and may cancel or keep any more (a word of the same family, a translation). The
// guesser sees what's left and has one guess: right, and the card is won; wrong, and it's lost with the next card
// too; or pass, and only this one goes. The table plays for the most cards won out of the pile.
import { WORDS } from "./party-echo-words.js";
import { h, button, countdown, waitingFor } from "./party-kit.js";
import { shuffle } from "./party-core.js";

const RESULT_MS = 9000;                  // the answer stands this long before the next card
export const CARDS = [8, 13, 20];

// ---------- words and clues ----------
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, " ").trim();
const han = s => /\p{Script=Han}/u.test(s);
/** A word's stem, so a word and its family match: swim, swimmer and swimming; prince and princess; cat and cats. */
export function stem(w) {
  let s = norm(w).replace(/[\s-]+/g, "");
  if (han(s)) return s;
  for (const suf of ["ingly", "ings", "ing", "edly", "ed", "ers", "er", "esses", "ess", "es", "s", "ly"]) {
    if (s.length - suf.length >= 3 && s.endsWith(suf)) { s = s.slice(0, -suf.length); break; }
  }
  if (s.length > 3 && s.at(-1) === s.at(-2)) s = s.slice(0, -1);          // swimm, bigg
  if (s.length > 3 && s.endsWith("e")) s = s.slice(0, -1);                 // prince, bake
  return s;
}
/** The card's word as this table reads it: English, Chinese, or both. */
export function wordOf(state, i = state.card) {
  const w = WORDS[state.deck[i]];
  return state.lang === "en" ? w[0] : state.lang === "zh" ? w[1] : `${w[1]} · ${w[0]}`;
}
/**
 * Why a clue is out by itself, or null: none given, more than one word, the word itself (or of its family, or holding
 * one of its characters), or the same as another clue (a stem two clues share cancels both).
 */
export function autoOut(clues, word) {
  const words = word.flatMap(w => norm(w).split(" ")).filter(Boolean), stems = new Set(words.map(stem)), whole = word.map(w => norm(w).replace(/[\s-]+/g, ""));
  const chars = new Set([...word[1]].filter(c => han(c)));
  const count = {};
  for (const c of Object.values(clues)) if (c) { const k = stem(c); count[k] = (count[k] || 0) + 1; }
  const out = {};
  for (const [u, c] of Object.entries(clues)) {
    const t = norm(c);
    if (!t) out[u] = "none";
    else if (!han(t) && t.split(/[\s]+/).length > 1) out[u] = "words";
    else if (stems.has(stem(t)) || whole.some(w => w && (t.replace(/[\s-]+/g, "") === w || (w.length >= 4 && t.includes(w)))) || (han(t) && [...t].some(ch => chars.has(ch)))) out[u] = "word";
    else if (count[stem(t)] > 1) out[u] = "same";
    else out[u] = null;
  }
  return out;
}
export const OUT_WHY = { none: "no clue", words: "more than one word", word: "the word itself", same: "the same as another", hand: "cancelled by the table" };
/** Whether a clue is cancelled: by itself (unless the table kept it) or by the table. */
const isOut = c => (c.why && c.keep !== true) || c.cut === true;
/** A guess at the word, in either language: case, accents, spaces and punctuation aside, a letter off in six. */
export function rightGuess(state, text, i = state.card) {
  const w = WORDS[state.deck[i]], g = norm(text).replace(/[\s-]+/g, "");
  if (!g) return false;
  return w.some(x => {
    const t = norm(x).replace(/[\s-]+/g, "");
    return g === t || stem(g) === stem(t) || (!han(t) && t.length >= 6 && distance(g, t) <= 1);
  });
}
function distance(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) { let prev = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; } }
  return d[b.length];
}

// ---------- the score ----------
/**
 * Where the pile stands, from the cards played: { won, at (the next card), lost }. A right guess wins the card; a pass
 * loses it; a wrong guess loses it and the next card too, or a card already won when it was the last.
 */
export function tally(log, cards) {
  let won = 0, at = 0, lost = 0;
  for (const r of log) {
    if (r.outcome === "right") { won++; at++; }
    else if (r.outcome === "pass") { lost++; at++; }
    else if (at + 1 < cards) { lost += 2; at += 2; }
    else { lost++; at++; if (won) { won--; lost++; } }
  }
  return { won, at, lost };
}
/** The verdict on a score, by its share of the pile. */
export function verdict(won, cards) {
  const r = won / cards;
  return r === 1 ? "Every card: perfect" : r >= 0.85 ? "Superb" : r >= 0.7 ? "Very good" : r >= 0.55 ? "Not bad" : r >= 0.3 ? "A start" : "Try again";
}

// ---------- the game ----------
const whole = s => { s.log = s.log ? Object.values(s.log) : []; s.order = s.order ? Object.values(s.order) : []; s.deck = s.deck ? Object.values(s.deck) : []; s.clues ||= {}; s.names ||= {}; return s; };
const clean = t => String(t || "").replace(/\s+/g, " ").trim().slice(0, 30);
/** The next card, with the next guesser at the table (in seat order), the clock for the clues started. */
function deal(s, players, now) {
  const here = new Set(players.map(p => p.uid));
  const at = tally(s.log, s.cards).at;
  s.card = at;
  const n = s.order.length;
  for (let k = 1; k <= n; k++) { const u = s.order[(s.seat + k) % n]; if (here.has(u)) { s.seat = (s.seat + k) % n; break; } }
  s.guesser = s.order[s.seat];
  s.step = "clue";
  s.clues = {};
  delete s.guess;
  if (s.clock) s.deadline = now + s.clock * 1000; else delete s.deadline;
  const nameOfU = u => players.find(p => p.uid === u)?.name || s.names[u] || "Someone";
  return `Card ${at + 1} of ${s.cards}: ${nameOfU(s.guesser)} guesses. Everyone else, write one clue, one word, and keep it to yourself.`;
}

export default {
  id: "echo",
  name: "Echo",
  min: 3,
  max: 12,
  css: "party-echo.css",
  blurb: "One clue each, but the same clue twice cancels out. Find the word together.",
  rules: [
    "A game you play together, for the most cards won. Each card, one player guesses (in turn round the table) and everyone else sees the word on their phone and writes one clue: one word, without seeing anyone else's.",
    "Before the guesser sees them, the same clue twice cancels out, both copies (cat and cats are the same; so are swim and swimmer), and so does a clue that is the word itself, of its family, or more than one word. The clue-givers then look them over and may cancel any more (a translation, a word that's the same in other words) or keep one the phone cancelled; then they show the guesser.",
    "The guesser sees what's left and has one guess. Right, and the card is won. Wrong, and it's lost, and the next card with it (on the last card, a card already won). Or pass, and only this card goes. A guess that's right in other words can be counted by the clue-givers.",
    "So clue boldly, but not where everyone else will: the obvious clue is the one most likely to cancel out.",
  ],
  options: [
    { id: "lang", label: "Words", choices: [["en", "English"], ["zh", "中文"], ["both", "Both"]], value: "en" },
    { id: "cards", label: "Cards", choices: CARDS.map(n => [String(n), String(n)]), value: "13" },
    { id: "clock", label: "Clock for the clues", choices: [["0", "None"], ["60", "1 minute"], ["90", "90 seconds"]], value: "0" },
  ],

  start({ players, options, rng, now }) {
    const cards = CARDS.includes(Number(options.cards)) ? Number(options.cards) : 13;
    const s = { lang: options.lang || "en", cards, clock: Number(options.clock) || 0, deck: shuffle(WORDS.map((_, i) => i), rng).slice(0, cards + 1),
      order: players.map(p => p.uid), names: Object.fromEntries(players.map(p => [p.uid, p.name])), seat: Math.floor(rng() * players.length) - 1, log: [] };
    s.say = `Echo: ${cards} cards, played together. ${deal(s, players, now)}`;
    return s;
  },

  advance(state, { players, inputs, now }) {
    const s = whole(structuredClone(state)), here = new Set(players.map(p => p.uid));
    const nameOfU = u => players.find(p => p.uid === u)?.name || s.names[u] || "Someone";
    const givers = players.filter(p => p.uid !== s.guesser && s.order.includes(p.uid)).map(p => p.uid);
    // the next card, or the end once the pile is spent: a game played together, everyone wins it with seven cards in ten
    const onward = () => {
      const t = tally(s.log, s.cards);
      if (t.at < s.cards) return deal(s, players, now);
      s.step = "over";
      delete s.deadline;
      s.winners = t.won >= Math.ceil(s.cards * 0.7) ? s.order.filter(u => here.has(u)) : [];
      return `That's the last card. ${t.won} of ${s.cards}: ${verdict(t.won, s.cards).toLowerCase()}.`;
    };
    // a guesser who leaves mid-card: the card is lost (the next guesser has seen its word), and on to the next
    if ((s.step === "clue" || s.step === "check") && !here.has(s.guesser)) {
      s.log.push({ card: s.card, guesser: s.guesser, outcome: "pass", left: true });
      return { state: s, say: `${nameOfU(s.guesser)} has left; that card is lost. ${onward()}` };
    }
    if (s.step === "clue") {
      const all = givers.length && givers.every(u => clean(inputs[u]?.clue));
      if (!all && !(s.deadline && now >= s.deadline)) return null;
      const w = WORDS[s.deck[s.card]], given = Object.fromEntries(givers.map(u => [u, clean(inputs[u]?.clue)]));
      const out = autoOut(given, w);
      s.clues = Object.fromEntries(givers.map(u => [u, { text: given[u] || "", why: out[u] }]));
      s.step = "check";
      delete s.deadline;
      const cut = Object.values(s.clues).filter(isOut).length;
      return { state: s, say: `The clues are in.${cut ? ` ${cut} cancelled already.` : ""} Clue-givers, look them over, then show ${nameOfU(s.guesser)}.` };
    }
    if (s.step === "check") {
      if (!Object.entries(inputs).some(([u, v]) => v?.show && u !== s.guesser)) return null;
      s.step = "guess";
      const left = Object.values(s.clues).filter(c => !isOut(c)).length, all = Object.keys(s.clues).length;
      return { state: s, say: `${nameOfU(s.guesser)}, here are your clues: ${left} of ${all}.` };
    }
    if (s.step === "guess") {
      const m = inputs[s.guesser];
      if (!here.has(s.guesser)) s.guess = { pass: true, text: "" };
      else if (m?.guess && clean(m.guess)) s.guess = { text: clean(m.guess), right: rightGuess(s, m.guess) };
      else if (m?.pass) s.guess = { pass: true, text: "" };
      else return null;
      const outcome = s.guess.pass ? "pass" : s.guess.right ? "right" : "wrong";
      s.log.push({ card: s.card, guesser: s.guesser, outcome });
      s.step = "result";
      s.deadline = now + RESULT_MS;
      const t = tally(s.log, s.cards), word = WORDS[s.deck[s.card]][s.lang === "zh" ? 1 : 0];
      const head = outcome === "pass" ? `${nameOfU(s.guesser)} passes. It was ${word}.`
        : outcome === "right" ? `${nameOfU(s.guesser)} says ${s.guess.text}. Right!`
        : `${nameOfU(s.guesser)} says ${s.guess.text}. No: it was ${word}.${t.at > s.card + 1 ? " That costs the next card too." : ""}`;
      return { state: s, say: `${head} ${t.won} won so far.` };
    }
    if (s.step === "result") {
      // a wrong guess the clue-givers count: right in other words
      const last = s.log.at(-1);
      if (last.outcome === "wrong" && Object.entries(inputs).some(([u, v]) => v?.count && u !== s.guesser && here.has(u))) {
        last.outcome = "right";
        last.counted = true;
        s.guess.right = true;
        s.deadline = now + RESULT_MS;
        return { state: s, say: `Counted: ${tally(s.log, s.cards).won} won.` };
      }
      if (now < s.deadline) return null;
      return { state: s, say: onward() };
    }
    return null;
  },

  wakeAt: state => (state.step === "result" || (state.step === "clue" && state.clock) ? state.deadline ?? null : null),

  view(stage, ctx) {
    const { me, players, inputs } = ctx, s = whole(structuredClone(ctx.state));
    const nameOfU = u => players.find(p => p.uid === u)?.name || s.names[u] || "Someone";
    const t = tally(s.log, s.cards), guessing = me.uid === s.guesser, playing = s.order.includes(me.uid);
    const parts = [h("div", { class: "ec-head" },
      h("span", {}, s.step === "over" ? `${s.cards} cards played` : `Card ${Math.min(s.card + 1, s.cards)} of ${s.cards}`),
      h("span", { class: "ec-won" }, `${t.won} won`), h("span", {}, s.step === "over" ? "" : s.cards - t.at - 1 > 0 ? `${s.cards - t.at - 1} to come` : "last card"))];
    const theWord = () => h("div", { class: "ec-word" }, h("span", { class: "ec-word-label" }, `${nameOfU(s.guesser)} is guessing`), h("span", { class: "ec-word-text" }, wordOf(s)));
    const clueList = (showWho, tap) => h("ul", { class: "ec-clues" }, ...Object.entries(s.clues).map(([u, c]) => {
      const out = isOut(c), why = c.cut ? OUT_WHY.hand : c.why && c.keep !== true ? OUT_WHY[c.why] : "";
      return h("li", { class: `${out ? "out" : ""}${tap ? " tap" : ""}`, onclick: tap ? () => tap(u, c) : null, role: tap ? "button" : null, tabindex: tap ? "0" : null },
        h("span", { class: "ec-clue" }, c.text || "—"), showWho ? h("span", { class: "ec-by" }, nameOfU(u)) : null, why ? h("span", { class: "ec-why" }, why) : null);
    }));
    if (s.step === "clue") {
      if (guessing) {
        parts.push(h("p", { class: "pk-ask" }, "You're guessing"), h("p", { class: "pk-line ec-center" }, "The others are writing your clues. Don't peek."));
      } else if (playing) {
        parts.push(theWord());
        const sent = clean(inputs[me.uid]?.clue);
        const input = h("input", { class: "pk-input", maxlength: 30, autocomplete: "off", autocapitalize: "none", placeholder: sent || "One word", "aria-label": "Your clue" });
        const go = () => { if (clean(input.value)) ctx.send({ clue: clean(input.value) }); };
        input.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
        ctx.keep(input);
        parts.push(h("div", { class: "ec-row" }, input, button(sent ? "Change" : "Send", go, { cls: "ec-send" })));
        if (sent) parts.push(h("p", { class: "pk-line ec-center" }, `Your clue: `, h("strong", {}, sent)));
      } else parts.push(h("p", { class: "pk-line" }, "You joined mid-game: watch this card."));
      if (s.clock && s.deadline) parts.push(countdown(s.deadline, ctx.now, { total: s.clock * 1000 }));
      const givers = players.filter(p => p.uid !== s.guesser && s.order.includes(p.uid));
      parts.push(h("p", { class: "pk-wait" }, waitingFor(givers, Object.keys(inputs).filter(u => clean(inputs[u]?.clue)))));
    } else if (s.step === "check") {
      if (guessing) parts.push(h("p", { class: "pk-ask" }, "You're guessing"), h("p", { class: "pk-line ec-center" }, "The others are checking your clues."));
      else {
        parts.push(theWord(), h("p", { class: "pk-line ec-center" }, "Tap a clue to cancel it, or to keep one the phone cancelled. Then show the guesser."));
        parts.push(clueList(true, (u, c) => ctx.act(st => {
          const x = st.clues?.[u];
          if (!x || st.step !== "check") return false;
          // a tap flips it: one the phone cancelled is kept, one that stands is cancelled, and back
          if (x.why) { if (x.keep) delete x.keep; else x.keep = true; } else if (x.cut) delete x.cut; else x.cut = true;
        })));
        parts.push(button(`Show ${nameOfU(s.guesser)} the clues`, () => ctx.send({ show: true })));
      }
    } else if (s.step === "guess") {
      const left = Object.values(s.clues).filter(c => !isOut(c));
      if (guessing) {
        parts.push(h("p", { class: "pk-ask" }, left.length ? "Your clues" : "Every clue cancelled out"));
        parts.push(h("ul", { class: "ec-big" }, ...left.map(c => h("li", {}, c.text))));
        const gone = Object.keys(s.clues).length - left.length;
        if (gone) parts.push(h("p", { class: "pk-line ec-center" }, `${gone} cancelled`));
        const input = h("input", { class: "pk-input", maxlength: 30, autocomplete: "off", placeholder: "The word", "aria-label": "Your guess" });
        const go = () => { if (clean(input.value)) ctx.send({ guess: clean(input.value) }); };
        input.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
        ctx.keep(input);
        parts.push(h("div", { class: "ec-row" }, input, button("Guess", go, { cls: "ec-send" })));
        parts.push(button("Pass (lose only this card)", () => ctx.send({ pass: true }), { primary: false }));
      } else {
        parts.push(theWord(), h("p", { class: "pk-line ec-center" }, `${nameOfU(s.guesser)} sees ${left.length} clue${left.length === 1 ? "" : "s"}…`), clueList(true));
      }
    } else if (s.step === "result" || s.step === "over") {
      const last = s.log.at(-1), word = WORDS[s.deck[last.card]];
      const right = last.outcome === "right";
      if (s.step === "result") {
        parts.push(h("div", { class: `ec-verdict ${last.outcome}` },
          h("span", { class: "ec-verdict-head" }, last.outcome === "pass" ? "Passed" : right ? (last.counted ? "Counted" : "Right!") : "No"),
          h("span", { class: "ec-word-text" }, s.lang === "en" ? word[0] : s.lang === "zh" ? word[1] : `${word[1]} · ${word[0]}`),
          s.guess?.text ? h("span", { class: "ec-said" }, `${nameOfU(last.guesser)} said “${s.guess.text}”`) : null));
        if (last.outcome === "wrong" && !guessing && playing) parts.push(button(inputs[me.uid]?.count ? "Counted: waiting…" : "Count it: right in other words", () => ctx.send({ count: true }), { primary: false, disabled: !!inputs[me.uid]?.count }));
        parts.push(clueList(true), countdown(s.deadline, ctx.now, { total: RESULT_MS }));
      } else {
        parts.push(h("div", { class: "pk-verdict big" }, `${t.won} of ${s.cards}`), h("p", { class: "pk-ask" }, verdict(t.won, s.cards)));
        parts.push(h("ol", { class: "ec-log" }, ...s.log.map(r => h("li", { class: r.outcome },
          h("span", { class: "ec-log-word" }, WORDS[s.deck[r.card]][s.lang === "zh" ? 1 : 0]), h("span", { class: "ec-log-who" }, nameOfU(r.guesser)),
          h("span", { class: "ec-log-mark" }, r.outcome === "right" ? "✓" : r.outcome === "pass" ? "–" : "✗")))));
      }
    }
    stage.replaceChildren(h("div", { class: "pk-col" }, ...parts));
  },
};
