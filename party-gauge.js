// Gauge, the game of a clue placed on a scale (Wavelength's mechanics): each round one player, in turn round the table,
// chooses a scale between two opposites (Cold to Hot, Underrated to Overrated), sees a hidden target somewhere on it,
// and gives a clue that sits there ("lukewarm tea", a little left of the middle); everyone else turns a dial on their
// phone to where they think the clue sits. The nearer the target, the more points: 4 in the bullseye, 3 beside it, 2
// at its edge. Each for themselves, the clue-giver scoring what the guessers scored on average; or together, one dial
// for the table, the middle of everyone's needles, for a score the table shares.
import { CARDS } from "./party-gauge-cards.js";
import { h, button, countdown, waitingFor, scoreList, names } from "./party-kit.js";
import { shuffle } from "./party-core.js";

/** The target's bands, from the middle out: how far from the target a needle may be (on a dial of 100) for the points. */
export const BANDS = [[2.5, 4], [7.5, 3], [12.5, 2]];
export const pointsFor = (needle, target) => { const d = Math.abs(needle - target); for (const [w, p] of BANDS) if (d <= w) return p; return 0; };
/** The table's needle, playing together: the middle of everyone's (one wild needle doesn't drag it, as an average would). */
export const median = vs => { const a = [...vs].sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
/** Playing together, the verdict on the table's points a round; "In tune" or better counts as a win for everyone. */
export const VERDICTS = [[3.4, "Mind readers"], [2.6, "In tune"], [2, "Close enough"], [1.2, "Some static"], [0, "Different stations"]];
export const verdictOf = avg => VERDICTS.find(([at]) => avg >= at)[1];
const WIN_AT = 2.6;
const REVEAL_MS = 12000;
/** A scale's two ends in the table's language. */
export const endsOf = (lang, i) => { const c = CARDS[i]; return lang === "zh" ? [c[2], c[3]] : lang === "both" ? [`${c[0]} ${c[2]}`, `${c[1]} ${c[3]}`] : [c[0], c[1]]; };
const clean = t => String(t || "").replace(/\s+/g, " ").trim().slice(0, 40);
const ON_TARGET = { 4: "Bullseye", 3: "Close", 2: "At the edge", 0: "Missed" };

// ---------- the game ----------
const whole = s => {
  for (const k of ["order", "deck", "offer", "log"]) s[k] = s[k] ? Object.values(s[k]) : [];
  s.scores ||= {}; s.names ||= {};
  if (s.result) { s.result.needles ||= {}; s.result.pts ||= {}; }
  return s;
};
const guessersOf = (s, players) => players.filter(p => s.order.includes(p.uid) && p.uid !== s.psychic);
/** The next round: the next player round the table who's still here gives the clue, from a choice of two scales. */
function deal(s, players, now, rng) {
  const here = new Set(players.map(p => p.uid)), n = s.order.length;
  for (let k = 1; k <= n; k++) { const u = s.order[(s.seat + k) % n]; if (here.has(u)) { s.seat = (s.seat + k) % n; break; } }
  s.psychic = s.order[s.seat];
  s.offer = [s.deck[2 * s.rn], s.deck[2 * s.rn + 1]];
  s.target = Math.round((2.5 + rng() * 95) * 2) / 2;       // anywhere its bullseye is whole on the dial
  s.step = "clue";
  delete s.card; delete s.clue; delete s.result;
  if (s.clock) s.deadline = now + s.clock * 1000; else delete s.deadline;
  const name = players.find(p => p.uid === s.psychic)?.name || s.names[s.psychic];
  return `Round ${s.rn + 1} of ${s.rounds}: ${name} gives the clue.`;
}
/** After a round: the next, or the end. */
function onward(s, players, now, rng, nameOfU) {
  if (s.rn + 1 >= s.rounds) {
    s.step = "over";
    delete s.deadline;
    if (s.mode === "together") {
      const played = s.log.filter(r => !r.skipped).length, avg = played ? s.total / played : 0;
      s.verdict = verdictOf(avg);
      s.winners = avg >= WIN_AT ? [...s.order] : [];
      return `That was the last round. The table scored ${s.total || 0} in ${played} ${played === 1 ? "round" : "rounds"}: ${s.verdict}.`;
    }
    const top = Math.max(...s.order.map(u => s.scores[u] || 0));
    s.winners = top > 0 ? s.order.filter(u => (s.scores[u] || 0) === top) : [];
    return `That was the last round. ${s.winners.length ? `${names(s.winners.map(nameOfU))} ${s.winners.length > 1 ? "win" : "wins"}, with ${top}.` : "Nobody scored."}`;
  }
  s.rn++;
  return deal(s, players, now, rng);
}

export default {
  id: "gauge",
  name: "Gauge",
  min: 2,
  max: 12,
  css: "party-gauge.css",
  blurb: "Place a clue on a scale between two opposites; the others turn a dial to find it.",
  rules: [
    "Each round one player gives the clue, in turn round the table. They choose a scale between two opposites (Cold to Hot, Underrated to Overrated) and see where the target is on it, hidden from everyone else (on their phone it stays covered until they tap Show the target, and covers itself again once the clue is given); then they write a clue that sits there: “lukewarm tea” a little left of the middle of Cold to Hot, “Paris” somewhere towards Overrated. Then they say nothing more.",
    "Everyone else turns the dial on their phone to where they think the clue sits, and locks it in. The target is a band of points: 4 in the bullseye, 3 beside it, 2 at its edge.",
    "Each for themselves: you score what your needle scored, and the clue-giver scores what the guessers scored on average, so a clue that only you would get scores little. Together: talk it over; the table's needle is the middle of everyone's, and the table plays for its score, “In tune” or better counting as a win for everyone.",
  ],
  options: [
    { id: "mode", label: "Play", choices: [["each", "Each for themselves"], ["together", "Together"]], value: "each" },
    { id: "rounds", label: "Rounds", choices: [["1", "Once round the table"], ["2", "Twice round"]], value: "1" },
    { id: "lang", label: "Scales", choices: [["en", "English"], ["zh", "中文"], ["both", "Both"]], value: "en" },
    { id: "clock", label: "A clock for the clue and the dial", choices: [["0", "None"], ["60", "1 minute"], ["90", "90 seconds"]], value: "0" },
  ],
  need: (players, options) => (options.mode !== "together" && players.length < 3 ? "Each for themselves needs 3 players: with two, play Together" : ""),

  start({ players, options, rng, now }) {
    const mode = options.mode === "together" ? "together" : "each", rounds = players.length * (options.rounds === "2" ? 2 : 1);
    const s = { mode, lang: ["en", "zh", "both"].includes(options.lang) ? options.lang : "en", clock: Number(options.clock) || 0, rounds, rn: 0,
      order: players.map(p => p.uid), names: Object.fromEntries(players.map(p => [p.uid, p.name])), seat: Math.floor(rng() * players.length) - 1,
      deck: shuffle(CARDS.map((_, i) => i), rng).slice(0, 2 * rounds), log: [], ...(mode === "together" ? { total: 0 } : { scores: Object.fromEntries(players.map(p => [p.uid, 0])) }) };
    s.say = `Gauge: ${rounds} rounds, ${mode === "together" ? "played together, one dial for the table" : "each for themselves"}. ${deal(s, players, now, rng)}`;
    return s;
  },

  advance(state, { players, inputs, now, rng }) {
    const s = whole(structuredClone(state)), here = new Set(players.map(p => p.uid));
    const nameOfU = u => players.find(p => p.uid === u)?.name || s.names[u] || "Someone";
    const mine = u => (inputs[u]?.rn === s.rn ? inputs[u] : null);
    const late = s.deadline && now >= s.deadline;
    if (s.step === "clue") {
      const said = mine(s.psychic), clue = clean(said?.clue);
      if (!clue) {
        if (here.has(s.psychic) && !late) return null;
        // the clue-giver gone, or out of time: the round goes unplayed
        s.log.push({ psychic: s.psychic, skipped: true });
        return { state: s, say: `${nameOfU(s.psychic)} ${here.has(s.psychic) ? "ran out of time" : "has left"}: no clue this round. ${onward(s, players, now, rng, nameOfU)}` };
      }
      s.card = s.offer[said.card === 1 ? 1 : 0];
      s.clue = clue;
      s.step = "dial";
      if (s.clock) s.deadline = now + s.clock * 1000;
      const [l, r] = endsOf(s.lang === "zh" ? "zh" : "en", s.card);
      return { state: s, say: `${nameOfU(s.psychic)}'s clue: ${clue}. Somewhere between ${l} and ${r}. Turn your dial.` };
    }
    if (s.step === "dial") {
      const guessers = guessersOf(s, players).map(p => p.uid);
      const needle = u => { const v = mine(u)?.needle; return typeof v === "number" && v >= 0 && v <= 100 ? v : null; };
      if (guessers.length && !guessers.every(u => mine(u)?.lock && needle(u) !== null) && !late) return null;
      // when the clock runs out, a needle moved but not locked counts where it is
      const needles = Object.fromEntries(guessers.filter(u => needle(u) !== null).map(u => [u, needle(u)]));
      const pts = Object.fromEntries(Object.entries(needles).map(([u, v]) => [u, pointsFor(v, s.target)]));
      s.result = { needles, pts };
      const lines = [];
      const entry = { psychic: s.psychic, card: s.card, clue: s.clue, target: s.target };
      if (s.mode === "together") {
        const vs = Object.values(needles);
        if (vs.length) {
          s.result.table = median(vs);
          s.result.tablePts = pointsFor(s.result.table, s.target);
        } else s.result.tablePts = 0;
        s.total = (s.total || 0) + s.result.tablePts;
        entry.pts = s.result.tablePts;
        lines.push(vs.length ? `The table's needle: ${ON_TARGET[s.result.tablePts]}${s.result.tablePts ? `, ${s.result.tablePts} points` : ""}.` : "No needles, no points.");
      } else {
        for (const [u, p] of Object.entries(pts)) s.scores[u] = (s.scores[u] || 0) + p;
        const got = Object.values(pts), psy = got.length ? Math.round(got.reduce((a, b) => a + b, 0) / got.length) : 0;
        s.result.psy = psy;
        s.scores[s.psychic] = (s.scores[s.psychic] || 0) + psy;
        entry.pts = psy;
        for (const p of [4, 3, 2]) {
          const who = Object.keys(pts).filter(u => pts[u] === p).map(nameOfU);
          if (who.length) lines.push(p === 4 ? `Bullseye for ${names(who)}!` : `${p} for ${names(who)}.`);
        }
        if (!got.some(p => p)) lines.push("Nobody hit the target.");
        lines.push(`${nameOfU(s.psychic)} scores ${psy} for the clue.`);
      }
      s.log.push(entry);
      s.step = "reveal";
      s.deadline = now + REVEAL_MS;
      return { state: s, say: lines.join(" ") };
    }
    if (s.step === "reveal") {
      const all = players.filter(p => s.order.includes(p.uid)).map(p => p.uid);
      if (now < s.deadline && !(all.length && all.every(u => mine(u)?.next))) return null;
      return { state: s, say: onward(s, players, now, rng, nameOfU) };
    }
    return null;
  },

  wakeAt: state => (state.step === "reveal" || ((state.step === "clue" || state.step === "dial") && state.clock) ? state.deadline ?? null : null),

  view(stage, ctx) {
    const { me, players, inputs } = ctx, s = whole(structuredClone(ctx.state));
    const nameOfU = u => players.find(p => p.uid === u)?.name || s.names[u] || "Someone";
    const playing = s.order.includes(me.uid), psychic = me.uid === s.psychic, guessers = guessersOf(s, players);
    const sent = u => (inputs[u]?.rn === s.rn ? inputs[u] : null);
    const initial = u => [...nameOfU(u)][0]?.toUpperCase() || "?";
    const side = [], main = [];
    // what's to do about the dial: under it on a phone; held sideways, in the left column beside it, where there's room
    const both = make => { side.push(h("div", { class: "gg-twin side" }, make())); main.push(h("div", { class: "gg-twin main" }, make())); };
    if (s.step !== "over") {
      side.push(h("div", { class: "gg-head" }, h("span", {}, `Round ${s.rn + 1} of ${s.rounds}`),
        h("span", {}, s.mode === "together" ? `The table: ${s.total || 0}` : playing ? `${s.scores[me.uid] || 0} points` : "")));
    }
    if (s.step === "clue") {
      if (psychic) {
        const key = `${ctx.seq}:${s.rn}`;
        if (choice.key !== key) Object.assign(choice, { key, i: 0 });
        const d = dialFor(`${key}:clue`);
        const pickScale = i => { choice.i = i; d.update({ ends: endsOf(s.lang, s.offer[i]) }); picks.forEach((b, j) => b.setAttribute("aria-checked", String(j === i))); };
        const picks = s.offer.map((c, i) => h("button", { type: "button", role: "radio", class: "gg-scale", "aria-checked": String(choice.i === i), onclick: () => pickScale(i) },
          h("span", {}, endsOf(s.lang, c)[0]), h("span", { class: "gg-arrow", "aria-hidden": "true" }, "⟷"), h("span", {}, endsOf(s.lang, c)[1])));
        side.push(h("p", { class: "pk-ask" }, "Your clue. Choose a scale:"), h("div", { class: "gg-scales", role: "radiogroup", "aria-label": "Scales" }, ...picks));
        d.update({ ends: endsOf(s.lang, s.offer[choice.i]), interactive: false, mine: null, others: [], table: null });
        // the box to type in above the dial: a phone's keyboard covers the bottom of the screen
        const input = h("input", { class: "pk-input", maxlength: 40, autocomplete: "off", placeholder: "Your clue", "aria-label": "Your clue" });
        const go = () => { const t = clean(input.value); if (t) ctx.send({ clue: t, card: choice.i, rn: s.rn }); };
        input.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
        ctx.keep(input, `clue${s.rn}`);
        main.push(h("div", { class: "gg-row" }, input, button("Send", go)), d.el, peek(d, `${key}:clue`, s.target),
          h("p", { class: "gg-note" }, "Something that sits where the target is on the scale. Then say nothing more."));
      } else {
        side.push(h("p", { class: "pk-ask" }, `${nameOfU(s.psychic)} is choosing a scale and thinking of a clue…`));
        const d = dialFor(`${ctx.seq}:${s.rn}:wait`);
        d.update({ ends: ["", ""], target: null, interactive: false, mine: null, others: [], table: null });
        main.push(d.el);
      }
      if (s.clock && s.deadline) main.push(countdown(s.deadline, ctx.now, { total: s.clock * 1000 }));
    } else if (s.step === "dial") {
      const ends = endsOf(s.lang, s.card);
      side.push(h("div", { class: "gg-clue" }, h("span", { class: "gg-clue-by" }, `${nameOfU(s.psychic)}'s clue`), h("span", { class: "gg-clue-text" }, s.clue)));
      const d = dialFor(`${ctx.seq}:${s.rn}:dial`);
      const guessing = guessers.some(p => p.uid === me.uid), locked = !!sent(me.uid)?.lock;
      if (guessing && d.value === null) d.value = typeof sent(me.uid)?.needle === "number" ? sent(me.uid).needle : 50;
      // the others' needles: seen by the clue-giver always, and by everyone when the table plays together
      const showOthers = psychic || s.mode === "together";
      const others = showOthers ? guessers.filter(p => p.uid !== me.uid && typeof sent(p.uid)?.needle === "number").map(p => ({ v: sent(p.uid).needle, label: initial(p.uid), locked: !!sent(p.uid).lock })) : [];
      const vs = guessers.map(p => (p.uid === me.uid ? d.value : sent(p.uid)?.needle)).filter(v => typeof v === "number");
      d.update({ ends, target: null, veiled: false, onTap: null, interactive: guessing && !locked, mine: guessing ? d.value : null, others,
        table: s.mode === "together" && vs.length > 1 ? median(vs) : null,
        onDrop: v => ctx.send({ needle: v, lock: false, rn: s.rn }) });
      main.push(d.el);
      if (psychic) main.push(peek(d, `${ctx.seq}:${s.rn}:dial`, s.target));
      if (guessing) both(() => (locked ? button("Locked in · Change", () => ctx.send({ needle: d.value, lock: false, rn: s.rn }), { primary: false })
        : button("Lock in", () => ctx.send({ needle: d.value, lock: true, rn: s.rn }))));
      else if (psychic) side.push(h("p", { class: "gg-note" }, s.mode === "together" ? "Say nothing: watch them argue." : "Say nothing: watch the needles."));
      if (s.mode === "together") side.push(h("p", { class: "gg-note" }, "Talk it over. The table's needle (dashed) is the middle of everyone's."));
      if (s.clock && s.deadline) main.push(countdown(s.deadline, ctx.now, { total: s.clock * 1000 }));
      main.push(h("p", { class: "pk-wait" }, waitingFor(guessers, guessers.map(p => p.uid).filter(u => sent(u)?.lock))));
    } else if (s.step === "reveal") {
      const r = s.result || { needles: {}, pts: {} }, ends = endsOf(s.lang, s.card);
      side.push(h("div", { class: "gg-clue" }, h("span", { class: "gg-clue-by" }, `${nameOfU(s.psychic)}'s clue`), h("span", { class: "gg-clue-text" }, s.clue)));
      const d = dialFor(`${ctx.seq}:${s.rn}:reveal`);
      d.update({ ends, target: s.target, interactive: false, mine: null, table: s.mode === "together" ? r.table ?? null : null,
        others: Object.entries(r.needles).map(([u, v]) => ({ v, label: initial(u), mine: u === me.uid, locked: true })) });
      main.push(d.el);
      both(() => h("div", { class: "pk-col" },
        s.mode === "together" ? h("p", { class: `gg-verdict${r.tablePts ? " up" : ""}` }, h("span", {}, `The table: ${ON_TARGET[r.tablePts || 0]}`), h("strong", {}, `+${r.tablePts || 0}`)) : null,
        h("ul", { class: "gg-pts" }, ...Object.entries(r.needles).map(([u]) => h("li", {}, h("span", {}, nameOfU(u)), h("span", { class: "gg-pts-n" }, `${r.pts[u] || 0}`))),
          s.mode === "each" ? h("li", { class: "gg-psy" }, h("span", {}, `${nameOfU(s.psychic)}, the clue`), h("span", { class: "gg-pts-n" }, `${r.psy || 0}`)) : null),
        countdown(s.deadline, ctx.now, { total: REVEAL_MS }),
        playing ? button(sent(me.uid)?.next ? "Waiting for the others…" : s.rn + 1 >= s.rounds ? "See how it went" : "Next round", () => ctx.send({ next: true, rn: s.rn }),
          { primary: false, disabled: !!sent(me.uid)?.next }) : null));
    } else if (s.step === "over") {
      main.push(h("div", { class: "pk-verdict big" }, s.mode === "together" ? s.verdict || "" : s.winners?.length ? `${names(s.winners.map(nameOfU))} ${s.winners.length > 1 ? "win" : "wins"}` : "Nobody scored"));
      if (s.mode === "together") main.push(h("p", { class: "gg-total" }, `The table scored ${s.total || 0} in ${s.log.filter(x => !x.skipped).length} rounds`));
      else main.push(scoreList(s.order.map(u => ({ uid: u, name: nameOfU(u), score: s.scores[u] || 0 })), { winners: s.winners || [] }));
      main.push(h("ol", { class: "gg-log" }, ...s.log.map(x => x.skipped ? h("li", { class: "skipped" }, h("span", {}, `${nameOfU(x.psychic)}: no clue`), h("span", {}, ""))
        : h("li", {}, h("span", { class: "gg-log-what" }, h("strong", {}, x.clue), ` · ${endsOf(s.lang, x.card).join(" ⟷ ")} · ${nameOfU(x.psychic)}`), h("span", { class: "gg-pts-n" }, String(x.pts ?? 0))))));
    }
    stage.replaceChildren(h("div", { class: "gg-wrap" }, side.length ? h("div", { class: "pk-col gg-side" }, ...side) : null, h("div", { class: "pk-col gg-main" }, ...main)));
  },
};

// ---------- the target on the clue-giver's phone ----------
// Covered as each part of their turn begins (choosing the clue, then the guessing), so a glance over their shoulder or
// at the phone on the table finds nothing; shown while they ask to see it. Kept by the part's key through the redraws
// other players' moves cause.
const veil = { key: "", shown: false };
/** Whether the clue-giver is looking at the target in this part of their turn (key: the game, round and step); with
 *  `flip`, they've just tapped to show or hide it. */
export function seeing(key, flip = false) {
  if (veil.key !== key) Object.assign(veil, { key, shown: false });
  if (flip) veil.shown = !veil.shown;
  return veil.shown;
}
/** The clue-giver's button under the dial, Show the target or Hide the target, drawing the dial to match; a tap on the
 *  dial does the same (on a small phone the button can sit below the fold). */
function peek(d, key, target) {
  const b = button("", () => flip(), { primary: false, cls: "gg-peek" });
  const draw = () => {
    const on = seeing(key);
    b.textContent = on ? "Hide the target" : "Show the target";
    b.setAttribute("aria-pressed", String(on));
    d.update({ target: on ? target : null, veiled: !on });
  };
  const flip = () => { seeing(key, true); draw(); };
  d.update({ onTap: flip });
  draw();
  return b;
}

// ---------- the dial ----------
// A half disc from one end of the scale (0, on the left) to the other (100), its needle turned by a finger. One dial a
// step lives on through the redraws other players' moves cause (they come mid-drag), keeping where your needle is.
const choice = { key: "", i: 0 };
const dials = new Map();
const SVGNS = "http://www.w3.org/2000/svg";
const R = 100;
const at = (v, r) => { const a = Math.PI * (1 - v / 100); return [+(r * Math.cos(a)).toFixed(2), +(-r * Math.sin(a)).toFixed(2)]; };
const svg = (tag, attrs = {}) => { const el = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el; };
/** A band of the dial between two values and two radii. */
export function wedge(v0, v1, r0, r1) {
  const [x0, y0] = at(v0, r1), [x1, y1] = at(v1, r1), [x2, y2] = at(v1, r0), [x3, y3] = at(v0, r0);
  return `M${x0},${y0} A${r1},${r1} 0 0 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 0 0 ${x3},${y3} Z`;
}
const needlePath = (v, len) => { const [x, y] = at(v, len); return `M0,0 L${x},${y}`; };

function dialFor(key) {
  if (dials.has(key)) return dials.get(key);
  for (const k of dials.keys()) if (k.split(":")[0] !== key.split(":")[0] || dials.size > 6) dials.delete(k);   // another game's, or old
  const face = svg("svg", { viewBox: "-112 -112 224 120", class: "gg-dial" });
  face.append(svg("path", { class: "gg-face", d: `M${-R - 4},0 A${R + 4},${R + 4} 0 0 1 ${R + 4},0 Z` }));
  const ticks = svg("g", { class: "gg-ticks" });
  for (let v = 0; v <= 100; v += 5) { const [x0, y0] = at(v, v % 10 ? R - 3 : R - 7), [x1, y1] = at(v, R + 4); ticks.append(svg("line", { x1: x0, y1: y0, x2: x1, y2: y1 })); }
  const target = svg("g", { class: "gg-target" }), others = svg("g", { class: "gg-others" }), table = svg("g", { class: "gg-table" }), mine = svg("g", { class: "gg-mine" });
  const covered = svg("text", { class: "gg-veil", x: 0, y: -44, "text-anchor": "middle", "font-size": 11 });
  face.append(target, covered, ticks, others, table, mine, svg("circle", { class: "gg-hub", r: 7 }));
  const left = h("span", {}), right = h("span", {});
  const el = h("div", { class: "gg-dial-box" }, face, h("div", { class: "gg-ends" }, left, right));
  const d = { el, value: null, interactive: false, onDrop: null, onTap: null, update: null };
  const drawMine = () => {
    mine.replaceChildren();
    if (d.value === null || d.mineShown === false) return;
    const [x, y] = at(d.value, R - 12);
    mine.append(svg("path", { class: "gg-needle", d: needlePath(d.value, R - 6) }), svg("circle", { class: "gg-knob", cx: x, cy: y, r: 7 }));
    face.setAttribute("aria-valuenow", String(d.value));
  };
  d.update = (o = {}) => {
    if ("ends" in o) { left.textContent = o.ends[0]; right.textContent = o.ends[1]; }
    if ("target" in o) {
      target.replaceChildren();
      if (o.target !== null && o.target !== undefined) {
        for (const [w, p] of [...BANDS].reverse()) {
          target.append(svg("path", { class: `gg-b${p}`, d: wedge(Math.max(0, o.target - w), Math.min(100, o.target + w), 16, R) }));
        }
        for (const [off, p] of [[-10, 2], [-5, 3], [0, 4], [5, 3], [10, 2]]) {
          const v = o.target + off;
          if (v < 1 || v > 99) continue;
          const [x, y] = at(v, R - 18);
          const t = svg("text", { class: `gg-bn gg-bn${p}`, x, y: y + 3.5, "text-anchor": "middle", "font-size": 10 });
          t.textContent = String(p);
          target.append(t);
        }
      }
    }
    if ("others" in o) {
      others.replaceChildren();
      for (const n of o.others || []) {
        const [x, y] = at(n.v, R + 1);
        others.append(svg("path", { class: `gg-other${n.mine ? " me" : ""}${n.locked ? " locked" : ""}`, d: needlePath(n.v, R - 10) }));
        const g = svg("g", { class: `gg-tag${n.mine ? " me" : ""}`, transform: `translate(${x},${y})` });
        g.append(svg("circle", { r: 6.5 }));
        const t = svg("text", { y: 3, "text-anchor": "middle", "font-size": 8 });
        t.textContent = n.label;
        g.append(t);
        others.append(g);
      }
    }
    if ("table" in o) {
      table.replaceChildren();
      if (typeof o.table === "number") table.append(svg("path", { class: "gg-table-needle", d: needlePath(o.table, R - 4) }));
    }
    if ("interactive" in o) {
      d.interactive = !!o.interactive;
      face.classList.toggle("live", d.interactive);
      if (d.interactive) { face.setAttribute("role", "slider"); face.setAttribute("tabindex", "0"); face.setAttribute("aria-valuemin", "0"); face.setAttribute("aria-valuemax", "100"); face.setAttribute("aria-label", "Your needle"); }
      else { face.removeAttribute("role"); face.removeAttribute("tabindex"); }
    }
    if ("veiled" in o) { el.classList.toggle("veiled", !!o.veiled); covered.textContent = o.veiled ? "Tap to see the target" : ""; }
    if ("onTap" in o) { d.onTap = o.onTap; face.classList.toggle("tap", !!o.onTap); }
    if ("onDrop" in o) d.onDrop = o.onDrop;
    if ("mine" in o) { d.mineShown = o.mine !== null; if (o.mine !== null && typeof o.mine === "number") d.value = o.mine; drawMine(); }
  };
  // turning the needle: a finger anywhere on the dial points it there
  const valueAt = e => {
    const m = face.getScreenCTM();
    if (!m) return d.value;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    let a = Math.atan2(-p.y, p.x);
    if (a < 0) a = p.x < 0 ? Math.PI : 0;                    // below the hub: the nearer end
    return Math.round(Math.min(100, Math.max(0, 100 * (1 - a / Math.PI))) * 2) / 2;
  };
  let dragging = false;
  const move = e => { if (!dragging) return; d.value = valueAt(e); drawMine(); e.preventDefault(); };
  const up = e => {
    if (!dragging) return;
    dragging = false;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    d.value = valueAt(e);
    drawMine();
    d.onDrop?.(d.value);
  };
  face.addEventListener("pointerdown", e => {
    if (!d.interactive) return;
    dragging = true;
    d.value = valueAt(e);
    drawMine();
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    e.preventDefault();
  });
  face.addEventListener("click", () => { if (!d.interactive) d.onTap?.(); });   // the clue-giver's dial: see the target, or hide it
  let keyed = 0;
  face.addEventListener("keydown", e => {
    if (!d.interactive || !["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp"].includes(e.key)) return;
    const step = (e.shiftKey ? 5 : 1) * (e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 1);
    d.value = Math.min(100, Math.max(0, (d.value ?? 50) + step));
    drawMine();
    clearTimeout(keyed);
    keyed = setTimeout(() => d.onDrop?.(d.value), 500);
    e.preventDefault();
  });
  dials.set(key, d);
  return d;
}
