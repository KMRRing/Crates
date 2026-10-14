// Decoy, the game of plausible lies (Fibbage's mechanics): a question whose answer few at the table know (what a saying
// means, a number from the trading desk or the history books, an odd fact with a blank); everyone writes a lie that
// might pass for the truth; then every lie and the truth are shown together, and each player picks the one they
// believe. Find the truth and score; fool someone with your lie and score for each one fooled. The house adds lies of
// its own when there are too few. The last question counts double.
import { SAYINGS, NUMBERS, FACTS } from "./party-decoy-bank.js";
import { h, button, countdown, waitingFor, scoreList, names } from "./party-kit.js";
import { shuffle } from "./party-core.js";

export const POINTS = { truth: 1000, fool: 500 };
export const DECKS = { sayings: SAYINGS, numbers: NUMBERS, facts: FACTS };
export const LENGTHS = [5, 8, 12];
// the answers stand long enough to read them all (and hear who fooled whom); everyone tapping Next moves on sooner
const revealMs = n => Math.min(20000, 6000 + 1500 * n);

// units that count things ("Number of OPEC member countries": how many, not "in countries"), and units said otherwise
const COUNTS = new Set(["countries", "employees", "people", "lines", "châteaux", "vineyards", "paintings", "works", "prizes", "children", "symphonies",
  "plays", "companies", "members", "bottles", "barrels"]);
const UNIT_WORDS = { million: "millions", "million men": "millions", "%": "per cent", "% ABV": "per cent alcohol by volume", $: "US dollars" };

/** A question as the game keeps it: what's asked (the label above it, the line under it), the truth, the house's lies. */
export function question(kind, item) {
  if (kind === "sayings") {
    const zh = item.l === "Chinese", sub = [item.l, item.say, item.lit ? `literally “${item.lit}”` : ""].filter(Boolean).join(" · ");
    return { kind, label: "What does it mean?", q: `“${item.w}”`, ...(sub ? { sub } : {}), t: item.t, x: item.x,
      voice: zh ? `What does this Chinese saying mean?${item.lit ? ` Literally, “${item.lit}”.` : ""}` : `What does “${item.w}” mean?` };
  }
  if (kind === "numbers") {
    // a year's question says so itself ("The year OPEC was founded"); a count's asks how many; a measure says its unit
    const year = item.u === "year", count = COUNTS.has(item.u), unit = `In ${UNIT_WORDS[item.u] || item.u}`;
    return { kind, label: year ? "What year?" : count ? "How many?" : "How much?", q: item.q, ...(year ? { year: true } : { sub: count ? "A number" : unit }), t: item.t, x: item.x, num: true,
      voice: year || count ? `${item.q}?` : `${item.q}, ${unit.toLowerCase()}?` };
  }
  return { kind, label: "Fill in the blank", q: item.q, t: item.t, x: item.x, voice: item.q.replace("___", "blank") };
}

// ---------- telling a lie from the truth ----------
const STOP = new Set(["a", "an", "the", "to", "of", "in", "on", "at", "and", "for", "by", "with", "its", "it", "is", "be", "your", "his", "her", "their", "one's"]);
const NUMWORD = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12" };
const norm = s => String(s || "").replace(/[’‘]/g, "'").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/(\d),(\d)/g, "$1$2").replace(/[^\p{L}\p{N}.']+/gu, " ").replace(/\.(?!\d)/g, " ").trim();
const stem = w => (NUMWORD[w] || (w.length > 4 && w.endsWith("ies") ? `${w.slice(0, -3)}y` : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w).replace(/'s?$/, ""));
const words = s => norm(s).split(" ").filter(w => w && !STOP.has(w)).map(stem);
const numbersIn = s => (String(s || "").replace(/(\d),(\d)/g, "$1$2").match(/\d+(\.\d+)?/g) || []).map(Number);
/** The number in an answer ("about 1,500 tonnes": 1500), or null. */
export const numberOf = s => { const m = String(s || "").replace(/(\d),(\d)/g, "$1$2").match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; };

/**
 * Whether an answer is the truth, or too near it to stand as a lie: the same number (a year exactly, any other within
 * half a percent); the same words, case, accents, articles and plurals aside; the whole truth and more ("emus and
 * kangaroos"); and for a short truth, most of its words and nothing else ("Minnie" for "Minnie Mouse"), or its number
 * ("38 mins" for "38 minutes"). It errs towards yes: a lie refused costs its author another go, a near-truth let
 * through makes a right pick a wrong one. A long truth (a saying's meaning) shares words with fair lies, so only the
 * whole of it counts there.
 */
export function isTruth(text, q) {
  if (q.num) {
    const x = numberOf(text), y = numberOf(q.t);
    return x !== null && y !== null && (q.year ? x === y : Math.abs(x - y) <= Math.abs(y) * 0.005);
  }
  const a = new Set(words(text)), b = new Set(words(q.t));
  if (!a.size || !b.size) return !!norm(text) && norm(text) === norm(q.t);
  if ([...b].every(w => a.has(w))) return true;
  if (b.size > 3) return false;
  if ([...a].every(w => b.has(w)) && a.size * 2 >= b.size) return true;
  const na = numbersIn(text), nb = numbersIn(q.t);
  return nb.length > 0 && nb.every(n => na.includes(n));
}
/** Whether two answers are the same answer (two players' same lie, a lie the house also tells). */
export function sameAnswer(a, b, q = {}) {
  if (q.num) { const x = numberOf(a), y = numberOf(b); return x !== null && x === y; }
  const x = words(a).join(" ");
  return !!x && x === words(b).join(" ");
}
/** A lie as the table sees it: a number written as the truth's are (1,500; a year as 1855), words without a full stop. */
export function shown(text, q) {
  const t = String(text || "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (!q.num) return t.replace(/[.!?]+$/, "");
  const n = numberOf(t);
  if (n === null) return "";
  return q.year ? String(Math.round(n)) : n.toLocaleString("en-GB", { maximumFractionDigits: 2 });
}
/** What's wrong with a lie, in words, or "" for a lie that stands (the house's own always do: they were written as lies). */
export function lieProblem(text, q) {
  const t = shown(text, q);
  if (!t) return q.num ? (q.year ? "Write a year." : "Write a number.") : "Write a lie.";
  if (isTruth(t, q) && !q.x.includes(t)) return "That's the truth, or too near it: write a lie instead.";
  return "";
}

// ---------- the game ----------
const whole = s => {
  for (const k of ["qs", "order", "opts"]) s[k] = s[k] ? Object.values(s[k]) : [];
  s.qs.forEach(q => { q.x = q.x ? Object.values(q.x) : []; });
  s.opts.forEach(o => { o.by = o.by ? Object.values(o.by) : []; });
  if (s.best) s.best.by = s.best.by ? Object.values(s.best.by) : [];
  s.scores ||= {}; s.picks ||= {}; s.gained ||= {}; s.names ||= {};
  return s;
};
const isLast = s => s.at === s.qs.length - 1;
/** The house lie offered to a player who asks the house to lie for them: a different one for each seat, where it can. */
export const houseLie = (s, uid) => { const q = s.qs[s.at]; return q.x.length ? q.x[(Math.max(0, s.order.indexOf(uid)) + s.at) % q.x.length] : ""; };
function ask(s, now) {
  s.step = "write";
  s.opts = [];
  s.picks = {};
  s.gained = {};
  if (s.clock) s.deadline = now + s.clock * 1000; else delete s.deadline;
  return `Question ${s.at + 1} of ${s.qs.length}${isLast(s) ? ", for double points" : ""}. ${s.qs[s.at].voice} Write a lie that might pass for the truth.`;
}
// a numbers pile with the years and the rest in turn: the bank has twice as many years as anything else
const interleave = (a, b) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => [a[i], b[i]]).flat().filter(Boolean);

export default {
  id: "decoy",
  name: "Decoy",
  min: 3,
  max: 12,
  css: "party-decoy.css",
  blurb: "Write a lie good enough to pass for the truth; then find the truth among the lies.",
  rules: [
    "A question whose answer few at the table know: what a saying means, a number (a year, a price, a distance), an odd fact with a blank. Everyone writes a lie that might pass for the truth: not the truth itself, which the phone refuses, nor anything too near it. Stuck? Let the house lie for you.",
    "Then every lie and the truth are shown together, in capitals so nobody's typing gives them away, and each player picks the one they believe (never their own). Find the truth: 1,000 points. Fool someone with your lie: 500 for each one fooled. When there are too few lies the house adds its own.",
    "The last question counts double. The most points wins.",
  ],
  options: [
    { id: "deck", label: "Questions", choices: [["mixed", "A mix"], ["sayings", "Sayings"], ["numbers", "Numbers"], ["facts", "Odd facts"]], value: "mixed" },
    { id: "length", label: "Questions in a game", choices: LENGTHS.map(n => [String(n), String(n)]), value: "8" },
    { id: "clock", label: "A clock for each step", choices: [["0", "None"], ["60", "1 minute"], ["90", "90 seconds"]], value: "0" },
  ],

  start({ players, options, rng, now }) {
    const n = LENGTHS.includes(Number(options.length)) ? Number(options.length) : 8, deck = DECKS[options.deck] ? options.deck : "mixed";
    const kinds = deck === "mixed" ? Object.keys(DECKS) : [deck];
    const pools = Object.fromEntries(kinds.map(k => [k, k === "numbers"
      ? interleave(shuffle(NUMBERS.filter(x => x.u !== "year"), rng), shuffle(NUMBERS.filter(x => x.u === "year"), rng))
      : shuffle(DECKS[k], rng)]));
    // a mix takes the decks in turn, so a game of eight has each kind more than once, then shuffles the questions
    const qs = Array.from({ length: n }, (_, i) => { const k = kinds[i % kinds.length]; return question(k, pools[k][Math.floor(i / kinds.length) % pools[k].length]); });
    const s = { deck, clock: Number(options.clock) || 0, qs: shuffle(qs, rng), at: 0, order: players.map(p => p.uid),
      names: Object.fromEntries(players.map(p => [p.uid, p.name])), scores: Object.fromEntries(players.map(p => [p.uid, 0])) };
    s.say = `Decoy: ${n} questions. ${ask(s, now)}`;
    return s;
  },

  advance(state, { players, inputs, now, rng }) {
    const s = whole(structuredClone(state)), here = players.filter(p => s.order.includes(p.uid)).map(p => p.uid);
    const nameOfU = u => players.find(p => p.uid === u)?.name || s.names[u] || "Someone";
    const q = s.qs[s.at], late = s.deadline && now >= s.deadline;
    const mine = u => (inputs[u]?.qn === s.at ? inputs[u] : null);           // what was sent for this question, not one before
    if (s.step === "write") {
      const lie = u => { const t = shown(mine(u)?.lie, q); return t && !lieProblem(t, q) ? t : ""; };
      if (!here.length || (!here.every(u => lie(u)) && !late)) return null;
      // the truth, the lies (the same lie twice is one, both its authors scoring from it), the house's to make up the
      // numbers: at least four to choose from, and one more than there are players
      const opts = [{ text: q.t, truth: true, by: [] }];
      for (const u of here) {
        const t = lie(u);
        if (!t) continue;
        const same = opts.find(o => !o.truth && sameAnswer(o.text, t, q));
        if (same) same.by.push(u); else opts.push({ text: t, by: [u] });
      }
      for (const x of shuffle(q.x, rng)) {
        if (opts.length >= Math.max(4, here.length + 1)) break;
        if (!opts.some(o => sameAnswer(o.text, x, q))) opts.push({ text: x, by: [], house: true });
      }
      s.opts = shuffle(opts, rng);
      s.step = "pick";
      if (s.clock) s.deadline = now + s.clock * 1000;
      return { state: s, say: "The lies are in. Which is the truth?" };
    }
    if (s.step === "pick") {
      const ok = u => { const i = mine(u)?.pick; return Number.isInteger(i) && !!s.opts[i] && !s.opts[i].by.includes(u); };
      if (!here.length || (!here.every(ok) && !late)) return null;
      const mult = isLast(s) ? 2 : 1;
      s.picks = Object.fromEntries(here.filter(ok).map(u => [u, inputs[u].pick]));
      s.gained = {};
      const add = (u, p) => { s.gained[u] = (s.gained[u] || 0) + p; s.scores[u] = (s.scores[u] || 0) + p; };
      for (const [u, i] of Object.entries(s.picks)) {
        const o = s.opts[i];
        if (o.truth) add(u, POINTS.truth * mult);
        else for (const a of o.by) add(a, POINTS.fool * mult);
      }
      const lines = [];
      s.opts.forEach((o, i) => {
        const fooled = Object.keys(s.picks).filter(u => s.picks[u] === i);
        if (o.truth || !fooled.length) return;
        lines.push(`${o.house ? "The house's" : `${names(o.by.map(nameOfU))}'s`} lie, ${o.text}, fooled ${names(fooled.map(nameOfU))}.`);
        // the game's best lie: the one that fooled the most at a go (the first, on a tie)
        if (!o.house && fooled.length > (s.best?.n || 0)) s.best = { text: o.text, by: o.by, n: fooled.length };
      });
      const ti = s.opts.findIndex(o => o.truth), found = Object.keys(s.picks).filter(u => s.picks[u] === ti);
      lines.push(`The truth: ${q.t}. ${found.length ? `${names(found.map(nameOfU))} found it.` : "Nobody found it."}`);
      s.step = "reveal";
      s.span = revealMs(s.opts.length);
      s.deadline = now + s.span;
      return { state: s, say: lines.join(" ") };
    }
    if (s.step === "reveal") {
      if (now < s.deadline && !(here.length && here.every(u => mine(u)?.next))) return null;
      if (isLast(s)) {
        s.step = "over";
        delete s.deadline;
        const top = Math.max(...s.order.map(u => s.scores[u] || 0));
        s.winners = top > 0 ? s.order.filter(u => (s.scores[u] || 0) === top) : [];
        const best = s.best ? ` The best lie: ${s.best.text}, by ${names(s.best.by.map(nameOfU))}.` : "";
        return { state: s, say: `That was the last question. ${s.winners.length ? `${names(s.winners.map(nameOfU))} ${s.winners.length > 1 ? "win" : "wins"}, with ${top.toLocaleString("en-GB")}.` : "Nobody scored."}${best}` };
      }
      s.at++;
      return { state: s, say: ask(s, now) };
    }
    return null;
  },

  wakeAt: state => (state.step === "reveal" || ((state.step === "write" || state.step === "pick") && state.clock) ? state.deadline ?? null : null),

  view(stage, ctx) {
    const { me, players, inputs } = ctx, s = whole(structuredClone(ctx.state)), q = s.qs[s.at];
    const nameOfU = u => players.find(p => p.uid === u)?.name || s.names[u] || "Someone";
    const playing = s.order.includes(me.uid), here = players.filter(p => s.order.includes(p.uid));
    const sent = u => (inputs[u]?.qn === s.at ? inputs[u] : null);
    const pts = n => (n || 0).toLocaleString("en-GB");
    // the question in a column of its own when the phone is held sideways, beside what's to do about it
    const side = [], parts = [];
    if (s.step !== "over") {
      side.push(h("div", { class: "dc-head" }, h("span", {}, `Question ${s.at + 1} of ${s.qs.length}`),
        isLast(s) ? h("span", { class: "dc-double" }, "Double points") : null, h("span", {}, playing ? `${pts(s.scores[me.uid])} points` : "")));
      const text = q.q.split("___").flatMap((bit, i) => (i ? [h("span", { class: "dc-blank", "aria-label": "blank" }), bit] : [bit]));
      side.push(h("div", { class: `dc-q ${q.kind}` }, h("span", { class: "dc-q-label" }, q.label), h("span", { class: "dc-q-text" }, ...text),
        q.sub ? h("span", { class: "dc-q-sub" }, q.sub) : null));
    }
    if (s.step === "write") {
      if (playing) {
        const mine = shown(sent(me.uid)?.lie, q);
        const hint = q.num ? (q.year ? "A year" : "A number") : q.kind === "sayings" && /^(to|a|an) /i.test(q.t) ? `${q.t.split(" ")[0].toLowerCase()} …` : "Your lie";
        const input = h("input", { class: "pk-input", maxlength: 60, autocomplete: "off", autocapitalize: "off", placeholder: hint, "aria-label": "Your lie", ...(q.num ? { inputmode: "decimal" } : {}) });
        const note = h("p", { class: "dc-note", role: "status" });
        const go = text => {
          const problem = lieProblem(text, q);
          if (problem) { note.textContent = problem; return; }
          note.textContent = "";
          ctx.send({ lie: shown(text, q), qn: s.at });
        };
        input.addEventListener("keydown", e => { if (e.key === "Enter") go(input.value); });
        ctx.keep(input, `lie${s.at}`);
        parts.push(h("div", { class: "dc-row" }, input, button(mine ? "Change" : "Send", () => go(input.value), { cls: "dc-send" })), note);
        parts.push(mine ? h("p", { class: "pk-line dc-center" }, "Your lie: ", h("strong", { class: "dc-mine" }, mine))
          : h("div", { class: "dc-help" }, button("Lie for me", () => go(houseLie(s, me.uid)), { primary: false })));
      } else parts.push(h("p", { class: "pk-line" }, "You joined mid-game: watch this one."));
      if (s.clock && s.deadline) parts.push(countdown(s.deadline, ctx.now, { total: s.clock * 1000 }));
      parts.push(h("p", { class: "pk-wait" }, waitingFor(here, here.map(p => p.uid).filter(u => shown(sent(u)?.lie, q)))));
    } else if (s.step === "pick") {
      const picked = sent(me.uid)?.pick;
      parts.push(h("p", { class: "pk-ask" }, playing ? "Which is the truth?" : "They're picking…"));
      parts.push(h("div", { class: "dc-opts", role: "radiogroup", "aria-label": "The answers" }, ...s.opts.map((o, i) => {
        const own = o.by.includes(me.uid);
        return h("button", { type: "button", role: "radio", class: `dc-opt${own ? " own" : ""}`, "aria-checked": String(picked === i), disabled: own || !playing,
          onclick: () => ctx.send({ pick: i, qn: s.at }) }, h("span", { class: "dc-opt-text" }, o.text), own ? h("span", { class: "dc-tag" }, "Your lie") : null);
      })));
      if (s.clock && s.deadline) parts.push(countdown(s.deadline, ctx.now, { total: s.clock * 1000 }));
      parts.push(h("p", { class: "pk-wait" }, waitingFor(here, here.map(p => p.uid).filter(u => Number.isInteger(sent(u)?.pick)))));
    } else if (s.step === "reveal") {
      const gain = s.gained[me.uid] || 0, mineAt = s.picks[me.uid];
      if (playing) {
        // what happened to you, both ways: what you picked, and whom your lie fooled
        const o = s.opts[mineAt], fooled = Object.keys(s.picks).filter(u => s.opts[s.picks[u]]?.by.includes(me.uid)).map(nameOfU);
        const what = [!o ? "You didn't pick" : o.truth ? "You found the truth" : o.house ? "The house's lie fooled you" : `${names(o.by.map(nameOfU))}'s lie fooled you`,
          fooled.length ? `yours fooled ${names(fooled)}` : ""].filter(Boolean).join("; ");
        parts.push(h("p", { class: `dc-gain${gain ? " up" : ""}` }, h("span", {}, what), h("strong", {}, `+${pts(gain)}`)));
      }
      parts.push(h("ul", { class: "dc-reveal" }, ...s.opts.map((o, i) => {
        const who = Object.keys(s.picks).filter(u => s.picks[u] === i).map(nameOfU);
        return h("li", { class: `${o.truth ? "truth" : o.house ? "house" : "lie"}${mineAt === i ? " picked" : ""}` },
          h("span", { class: "dc-opt-text" }, o.text),
          h("span", { class: "dc-opt-line" }, h("span", { class: "dc-opt-who" }, o.truth ? "The truth" : o.house ? "The house's lie" : `${names(o.by.map(nameOfU))}'s lie`),
            who.length || o.truth ? h("span", { class: "dc-opt-picks" }, who.length ? `${o.truth ? "found by" : "fooled"} ${names(who)}` : "nobody found it") : null));
      })));
      parts.push(countdown(s.deadline, ctx.now, { total: s.span || revealMs(s.opts.length) }));
      if (playing) parts.push(button(sent(me.uid)?.next ? "Waiting for the others…" : isLast(s) ? "See the scores" : "Next question", () => ctx.send({ next: true, qn: s.at }),
        { primary: false, disabled: !!sent(me.uid)?.next }));
    } else if (s.step === "over") {
      parts.push(h("div", { class: "pk-verdict big" }, s.winners?.length ? `${names(s.winners.map(nameOfU))} ${s.winners.length > 1 ? "win" : "wins"}` : "Nobody scored"));
      if (s.best) parts.push(h("p", { class: "dc-best" }, h("span", { class: "dc-q-label" }, "The best lie"), h("strong", { class: "dc-opt-text" }, s.best.text),
        h("span", {}, `${names(s.best.by.map(nameOfU))}'s lie fooled ${s.best.n === 1 ? "one player" : `${s.best.n} players`} at once`)));
      parts.push(scoreList(s.order.map(u => ({ uid: u, name: nameOfU(u), score: s.scores[u] || 0 })), { winners: s.winners || [] }));
    }
    if (s.step === "reveal" && s.order.length) parts.push(scoreList(s.order.map(u => ({ uid: u, name: nameOfU(u), score: s.scores[u] || 0, note: s.gained[u] ? `+${pts(s.gained[u])}` : "" }))));
    stage.replaceChildren(h("div", { class: "dc-wrap" }, side.length ? h("div", { class: "pk-col dc-side" }, ...side) : null, h("div", { class: "pk-col dc-main" }, ...parts)));
  },
};
