// The interaction kit for courses on course.js: ten ways for a lesson step to ask the reader to do something, each drawn on the course's stage. A course's stage owns one kit
// (`createKit({ onResult })`) and hands it the steps that are the kit's: course.js is unchanged. Wire it in the stage like this:
//   mount(box, api) { kit.mount(box, api); … }          one listener on the stage box; it only acts while a kit step is showing
//   task: s => kit.owns(s) || …                          a kit step is a task: Next waits until it is done
//   submits: s => kit.owns(s) ? kit.submits(s) : …       pair and order are judged by the sheet's Check button; the rest judge as the reader taps
//   ready: kit.ready(s, st)   label: kit.label(s)   submit: kit.submit(s, st)   hint: kit.hint(s, st)   draw: kit.draw(s, st)
//   and for a step that is not the kit's (words, a choice) with `fig` in it: box.innerHTML = kit.plain(s, st) (the figure, with a "check" badge when s.check)
// `onResult(step, ok)` is called once per step for the review pile: a wrong move is the first answer's miss; done with no wrong move is a hit. Types without a right answer
// (reveal, explore, decide, toggle, an ungoaled slider) are never reported.
//
// A step is { id, kind: "kit", kit: <type>, say, why, fig?, check?, ...the type's fields }. `say` (40 to 90 words) is shown by the sheet; `why` ends the step; `check: true`
// marks a fact nobody has verified yet (the stage shows a small "check" tag; tests list them). Types and fields (caps are in `validate`, which tests/lesson-kit.mjs runs):
//   pair     pairs: [[left, right]…]          2 to 5 pairs. Tap a left card, then its partner; Undo; Check keeps the right pairs (green) and sends the others back.
//   order    items: [text…] (right order)     3 to 5. Tap a card, then a numbered place; tap a placed card to take it back; Reset; Check keeps the places that are right.
//   bins     bins: [name…], items: [{ t, bin, why? }]   2 to 3 bins, up to 6 items. Tap an item, then its bin; a wrong bin says why and the item stays.
//   tf       items: [{ t, a (true|false), why }]        1 to 4 statements; True or False under each; the reason shows at once.
//   reveal   cards: [{ head, body }]          2 to 6 terms; tap one to open it; done when all have been opened.
//   explore  fig (a graph whose nodes carry `note`)       tap a part of the diagram to read what it does; done when every part has been opened.
//   slider   min, max, step, init, unit, bands: [{ from, text, tone? }], marks?: [{ at, label }], goal?: [lo, hi], need?, label?   drag a value; the band it falls in says what
//            follows. Done at the goal if there is one, else once `need` (default 2) different bands have been seen.
//   decide   actor, options: [{ label, bites }]     pick a move; what constrained it shows. Done after the first pick; the others can still be tried.
//   toggle   fig (nodes/edges with `layer`), toggles: [{ id, label, on? }], rules: [{ if: ["a", "!b"], text }], dflt, need?   switch layers or veto players on the diagram; the first
//            rule whose conditions hold says what happens. Done when `need` (default 3) different results have been seen.
//   build    fig (a graph with `slot` nodes), pieces: [{ id (the slot's id), label }]   2 to 5. Tap a piece, then its place on the diagram.
// Any step, kit or not, may carry `fig` (a lesson-figs.js spec) to be drawn with it. Touch targets are 2.75rem; sizes are rem; colours are tokens (lesson-kit.css).
import { figHtml } from "./lesson-figs.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
/** A small stable number for a string (FNV-1a). */
export function hash(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
/** 0..n-1 in a fixed order that depends on the id, never the identity (so the answer is never already in place). */
export function shuffled(id, n) {
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => hash(`${id}:${a}`) - hash(`${id}:${b}`) || a - b);
  if (n > 1 && idx.every((v, i) => v === i)) idx.push(idx.shift());
  return idx;
}

export const KIT_TYPES = ["pair", "order", "bins", "tf", "reveal", "explore", "slider", "decide", "toggle", "build"];
/** Types whose answer is judged by the sheet's Check button. */
const BY_BUTTON = new Set(["pair", "order"]);
/** Types with a right answer (the others are never reported to the review). */
const SCORED = s => ["pair", "order", "bins", "tf", "build"].includes(s.kit) || (s.kit === "slider" && !!s.goal);

// ---------- the types: state, drawing and moves, all pure but for the drawing's string ----------
const bandAt = (s, v) => { let b = null; s.bands.forEach((x, i) => { if (v >= x.from) b = i; }); return b; };
const ruleAt = (s, on) => {
  const i = s.rules.findIndex(r => r.if.every(c => (c[0] === "!" ? !on[c.slice(1)] : !!on[c])));
  return i;
};
const chip = (cls, attrs, inner, dis = false) => `<button type="button" class="lk-chip${cls ? ` ${cls}` : ""}" ${attrs}${dis ? " disabled" : ""}>${inner}</button>`;
const figOf = (s, o = {}) => (s.fig ? `<div class="lk-fig">${figHtml(s.fig, o)}</div>` : "");
const panel = (html, cls = "") => `<div class="lk-panel${cls ? ` ${cls}` : ""}" aria-live="polite">${html}</div>`;

const TYPES = {
  pair: {
    init: (s, st) => { st.link = {}; st.lock = {}; st.sel = null; st.hist = []; st.rs = shuffled(s.id, s.pairs.length); },
    html(s, st) {
      const no = i => Object.keys(st.link).filter(k => st.link[k] != null).sort((a, b) => a - b).indexOf(String(i)) + 1;
      const linkedTo = j => Object.keys(st.link).find(i => st.link[i] === j);
      const left = s.pairs.map((p, i) => {
        const lk = st.link[i] != null, cls = `${st.lock[i] ? "ok" : lk ? "on" : ""}${st.sel === i ? " sel" : ""}${st.flash?.includes(i) ? " no" : ""}`;
        return chip(cls, `data-l="${i}"`, `<i class="lk-n">${st.lock[i] ? "✓" : lk ? no(i) : ""}</i><span>${esc(p[0])}</span>`, !!st.lock[i]);
      }).join("");
      const right = st.rs.map(j => {
        const i = linkedTo(j), lk = i != null, cls = `${st.lock[j] ? "ok" : lk ? "on" : ""}`;
        return chip(cls, `data-r="${j}"`, `<i class="lk-n">${st.lock[j] ? "✓" : lk ? no(Number(i)) : ""}</i><span>${esc(s.pairs[j][1])}</span>`, !!st.lock[j]);
      }).join("");
      return `${figOf(s)}<div class="lk-cols"><div class="lk-col">${left}</div><div class="lk-col">${right}</div></div>`
        + `<div class="lk-tools"><button type="button" class="lk-tool" data-undo ${st.hist.length ? "" : "disabled"}>Undo</button></div>`;
    },
    act(s, st, a) {
      st.flash = null;
      if (a.t === "l") {
        if (st.lock[a.i]) return;
        if (st.link[a.i] != null) { delete st.link[a.i]; st.sel = a.i; } else st.sel = st.sel === a.i ? null : a.i;
      } else if (a.t === "r") {
        if (st.lock[a.j]) return;
        const other = Object.keys(st.link).find(i => st.link[i] === a.j);
        if (st.sel == null) { if (other != null) { delete st.link[other]; st.sel = Number(other); } return; }
        if (other != null) delete st.link[other];
        st.link[st.sel] = a.j; st.hist.push(st.sel); st.sel = null;
      } else if (a.t === "undo") {
        while (st.hist.length) { const i = st.hist.pop(); if (st.link[i] != null && !st.lock[i]) { delete st.link[i]; break; } }
        st.sel = null;
      }
    },
    ready: (s, st) => s.pairs.every((_, i) => st.lock[i] || st.link[i] != null),
    submit(s, st) {
      st.flash = [];
      s.pairs.forEach((_, i) => { if (st.lock[i]) return; if (st.link[i] === i) st.lock[i] = true; else { st.flash.push(i); delete st.link[i]; } });
      const right = s.pairs.filter((_, i) => st.lock[i]).length;
      st.sel = null; st.hist = [];
      return right === s.pairs.length ? { ok: true } : { ok: false, why: `${right} of ${s.pairs.length} pairs are right and stay in place; the others are back. Try them again.` };
    },
    hint(s, st) { s.pairs.forEach((_, i) => { st.lock[i] = true; st.link[i] = i; }); st.sel = null; },
    complete: (s, st) => s.pairs.every((_, i) => st.lock[i]),
    help: "Tap a card on the left, then its partner on the right. Check when every card has one.",
  },

  order: {
    init: (s, st) => { st.slots = s.items.map(() => null); st.lock = {}; st.sel = null; st.rs = shuffled(s.id, s.items.length); },
    html(s, st) {
      const slots = s.items.map((_, k) => {
        const v = st.slots[k];
        return chip(`slot${st.lock[k] ? " ok" : ""}${v != null && !st.lock[k] ? " on" : ""}${st.flash?.includes(k) ? " no" : ""}`, `data-slot="${k}"`, `<i class="lk-n">${st.lock[k] ? "✓" : k + 1}</i><span>${v != null ? esc(s.items[v]) : ""}</span>`, !!st.lock[k]);
      }).join("");
      const tray = st.rs.filter(i => !st.slots.includes(i)).map(i => chip(st.sel === i ? "sel" : "", `data-item="${i}"`, `<span>${esc(s.items[i])}</span>`)).join("");
      return `${figOf(s)}<div class="lk-cols"><div class="lk-col">${slots}</div><div class="lk-col">${tray}</div></div>`
        + `<div class="lk-tools"><button type="button" class="lk-tool" data-reset>Reset</button></div>`;
    },
    act(s, st, a) {
      st.flash = null;
      if (a.t === "item") { st.sel = st.sel === a.i ? null : a.i; }
      else if (a.t === "slot") {
        if (st.lock[a.k]) return;
        if (st.sel != null) { st.slots[a.k] = st.sel; st.sel = null; } else st.slots[a.k] = null;
      } else if (a.t === "reset") { st.slots = st.slots.map((v, k) => (st.lock[k] ? v : null)); st.sel = null; }
    },
    ready: (s, st) => st.slots.every(v => v != null),
    submit(s, st) {
      st.flash = [];
      st.slots.forEach((v, k) => { if (st.lock[k]) return; if (v === k) st.lock[k] = true; else { st.flash.push(k); st.slots[k] = null; } });
      const right = s.items.filter((_, k) => st.lock[k]).length;
      return right === s.items.length ? { ok: true } : { ok: false, why: `${right} of ${s.items.length} are in the right place and stay; the others are back in the tray.` };
    },
    hint(s, st) { st.slots = s.items.map((_, i) => i); s.items.forEach((_, k) => { st.lock[k] = true; }); st.sel = null; },
    complete: (s, st) => s.items.every((_, k) => st.lock[k]),
    help: "Tap a card, then the place for it. Tap a placed card to take it back.",
  },

  bins: {
    init: (s, st) => { st.put = {}; st.sel = null; st.rs = shuffled(s.id, s.items.length); },
    html(s, st) {
      const items = st.rs.filter(i => st.put[i] == null).map(i => chip(`${st.sel === i ? "sel" : ""}${st.bad === i ? " no" : ""}`, `data-item="${i}"`, `<span>${esc(s.items[i].t)}</span>`)).join("");
      const bins = s.bins.map((b, k) => `<button type="button" class="lk-bin${st.sel != null ? " live" : ""}" data-bin="${k}"><b>${esc(b)}</b>${s.items.map((it, i) => (st.put[i] === k ? `<em>${esc(it.t)}</em>` : "")).join("")}</button>`).join("");
      return `${figOf(s)}<div class="lk-cols"><div class="lk-col">${items}</div><div class="lk-col">${bins}</div></div>`;
    },
    act(s, st, a) {
      st.bad = null;
      if (a.t === "item") st.sel = st.sel === a.i ? null : a.i;
      else if (a.t === "bin" && st.sel != null) {
        const it = s.items[st.sel];
        if (it.bin === a.k) { st.put[st.sel] = a.k; st.say = it.why ? `Right: ${it.why}` : ""; }
        else { st.bad = st.sel; st.miss = true; st.say = `Not ${s.bins[a.k]}. ${it.why || ""}`.trim(); }
        st.sel = null;
      }
    },
    complete: (s, st) => s.items.every((_, i) => st.put[i] != null),
    hint(s, st) { s.items.forEach((it, i) => { st.put[i] = it.bin; }); st.sel = null; },
    help: "Tap an item, then the box it belongs in.",
  },

  tf: {
    init: (s, st) => { st.ans = {}; },
    html(s, st) {
      const rows = s.items.map((it, i) => {
        const a = st.ans[i], right = a != null && a === it.a;
        const btn = (v, label) => `<button type="button" class="lk-tfb${a === v ? (right ? " ok" : " no") : a != null && it.a === v ? " ok" : ""}" data-tf="${i}" data-v="${v}" ${a != null ? "disabled" : ""}>${label}</button>`;
        return `<div class="lk-tfr${a != null ? (right ? " ok" : " no") : ""}"><p>${esc(it.t)}</p><div class="lk-tfs">${btn(true, "True")}${btn(false, "False")}</div></div>`;
      }).join("");
      return `${figOf(s)}<div class="lk-tfl">${rows}</div>`;
    },
    act(s, st, a) {
      if (a.t !== "tf" || st.ans[a.i] != null) return;
      const it = s.items[a.i];
      st.ans[a.i] = a.v;
      if (a.v !== it.a) st.miss = true;
      st.say = `${a.v === it.a ? "Right" : "Not quite"}: ${it.why}`;
    },
    complete: (s, st) => s.items.every((_, i) => st.ans[i] != null),
    hint(s, st) { s.items.forEach((it, i) => { st.ans[i] = it.a; }); },
    help: "True or false? Tap one under each statement.",
  },

  reveal: {
    init: (s, st) => { st.seen = {}; st.cur = null; },
    html(s, st) {
      const chips = s.cards.map((c, k) => chip(`${st.cur === k ? "sel" : ""}${st.seen[k] ? " seen" : ""}`, `data-card="${k}"`, `<i class="lk-n">${st.seen[k] ? "✓" : ""}</i><span>${esc(c.head)}</span>`)).join("");
      const c = st.cur != null ? s.cards[st.cur] : null;
      return `${figOf(s)}<div class="lk-chips">${chips}</div>${panel(c ? `<b>${esc(c.head)}</b> ${esc(c.body)}` : esc(TYPES.reveal.help))}`;
    },
    act(s, st, a) { if (a.t === "card") { st.cur = a.k; st.seen[a.k] = true; } },
    complete: (s, st) => s.cards.every((_, k) => st.seen[k]),
    hint(s, st) { s.cards.forEach((_, k) => { st.seen[k] = true; }); },
    help: "Tap a term to open it. Open them all.",
  },

  explore: {
    init: (s, st) => { st.seen = {}; st.cur = null; },
    html(s, st) {
      const n = s.fig.nodes.find(x => x.id === st.cur);
      return `<div class="lk-fig tap">${figHtml(s.fig, { seen: st.seen, sel: st.cur })}</div>${panel(n ? `<b>${esc(String(n.label).replace(/\n/g, " "))}</b> ${esc(n.note)}` : esc(TYPES.explore.help))}`;
    },
    act(s, st, a) { if (a.t === "node" && s.fig.nodes.find(x => x.id === a.id)?.note) { st.cur = a.id; st.seen[a.id] = true; } },
    complete: (s, st) => s.fig.nodes.filter(n => n.note).every(n => st.seen[n.id]),
    hint(s, st) { s.fig.nodes.forEach(n => { if (n.note) st.seen[n.id] = true; }); },
    help: "Tap a part of the diagram to see what it does.",
  },

  slider: {
    init: (s, st) => { st.v = s.init ?? s.min; st.bands = {}; const b = bandAt(s, st.v); if (b != null) st.bands[b] = true; },
    fig(s, st) {
      if (s.fig) return { ...s.fig, value: st.v };
      const to = i => (i + 1 < s.bands.length ? s.bands[i + 1].from : s.max);
      return { type: "scale", min: s.min, max: s.max, unit: s.unit, marks: s.marks || [], bands: s.bands.map((b, i) => ({ from: b.from, to: to(i), label: "", tone: b.tone })), value: st.v, alt: s.label || "Scale" };
    },
    html(s, st) {
      const b = bandAt(s, st.v), band = b != null ? s.bands[b] : null;
      return `<div class="lk-fig">${figHtml(TYPES.slider.fig(s, st))}</div>`
        + `<label class="lk-slide"><span>${esc(s.label || "Value")}: <b data-val>${st.v}${esc(s.unit || "")}</b></span><input type="range" min="${s.min}" max="${s.max}" step="${s.step || 1}" value="${st.v}" data-range aria-label="${esc(s.label || "Value")}"></label>`
        + `<div class="lk-panel${band?.tone ? ` t-${band.tone}` : ""}" data-read aria-live="polite">${esc(band ? band.text : TYPES.slider.help)}</div>`;
    },
    act(s, st, a) { if (a.t === "set") { st.v = a.v; const b = bandAt(s, a.v); if (b != null) st.bands[b] = true; } },
    complete: (s, st) => (s.goal ? st.v >= s.goal[0] && st.v <= s.goal[1] : Object.keys(st.bands).length >= Math.min(s.need ?? 2, s.bands.length)),
    hint(s, st) { if (s.goal) st.v = Math.round((s.goal[0] + s.goal[1]) / 2); else s.bands.forEach((_, i) => { st.bands[i] = true; }); },
    help: "Drag the slider and read what changes.",
  },

  decide: {
    init: (s, st) => { st.pick = null; st.seen = {}; },
    html(s, st) {
      const opts = s.options.map((o, i) => chip(`${st.pick === i ? "sel" : ""}${st.seen[i] ? " seen" : ""}`, `data-opt="${i}"`, `<span>${esc(o.label)}</span>`)).join("");
      const o = st.pick != null ? s.options[st.pick] : null;
      return `${figOf(s)}${s.actor ? `<p class="lk-actor">${esc(s.actor)}</p>` : ""}<div class="lk-opts">${opts}</div>${panel(o ? `<b>What bit:</b> ${esc(o.bites)}` : esc(TYPES.decide.help))}`;
    },
    act(s, st, a) { if (a.t === "opt") { st.pick = a.i; st.seen[a.i] = true; } },
    complete: (s, st) => st.pick != null,
    hint(s, st) { st.pick = 0; st.seen[0] = true; },
    help: "Choose a move. Then see what stood in the way.",
  },

  toggle: {
    init: (s, st) => { st.on = Object.fromEntries(s.toggles.map(t => [t.id, !!t.on])); st.rules = {}; st.rules[ruleAt(s, st.on)] = true; },
    html(s, st) {
      const chips = s.toggles.map(t => `<button type="button" class="lk-chip tog${st.on[t.id] ? " on" : ""}" data-tog="${esc(t.id)}" aria-pressed="${!!st.on[t.id]}"><i class="lk-n">${st.on[t.id] ? "✓" : ""}</i><span>${esc(t.label)}</span></button>`).join("");
      const r = ruleAt(s, st.on), text = r >= 0 ? s.rules[r].text : s.dflt || "";
      return `<div class="lk-fig">${figHtml(s.fig, { on: st.on })}</div><div class="lk-chips">${chips}</div>${panel(esc(text))}`;
    },
    act(s, st, a) { if (a.t === "tog") { st.on[a.id] = !st.on[a.id]; st.rules[ruleAt(s, st.on)] = true; } },
    complete: (s, st) => Object.keys(st.rules).length >= Math.min(s.need ?? 3, s.rules.length + (s.dflt ? 1 : 0)),
    hint(s, st) { s.rules.forEach((_, i) => { st.rules[i] = true; }); st.rules[-1] = true; },
    help: "Switch things on and off and read the result.",
  },

  build: {
    init: (s, st) => { st.placed = {}; st.sel = null; st.rs = shuffled(s.id, s.pieces.length); },
    html(s, st) {
      const tray = st.rs.filter(i => !st.placed[s.pieces[i].id]).map(i => chip(st.sel === i ? "sel" : "", `data-piece="${i}"`, `<span>${esc(s.pieces[i].label)}</span>`)).join("");
      return `<div class="lk-fig tap">${figHtml(s.fig, { placed: st.placed, bad: st.bad })}</div><div class="lk-chips">${tray || ""}</div>`;
    },
    act(s, st, a) {
      st.bad = null;
      if (a.t === "piece") st.sel = st.sel === a.i ? null : a.i;
      else if (a.t === "node" && st.sel != null) {
        const p = s.pieces[st.sel];
        if (!s.fig.nodes.find(n => n.id === a.id)?.slot || st.placed[a.id]) return;
        if (p.id === a.id) { st.placed[a.id] = p.label; st.say = ""; } else { st.bad = a.id; st.miss = true; st.say = "Not there. Think about what that part does."; }
        st.sel = null;
      }
    },
    complete: (s, st) => s.pieces.every(p => st.placed[p.id]),
    hint(s, st) { s.pieces.forEach(p => { st.placed[p.id] = p.label; }); st.sel = null; },
    help: "Tap a piece, then the empty place on the diagram where it goes.",
  },
};

/** Problems with a kit step's shape (the caps of the style: small exercises, short words). Empty when it is fine. */
export function validate(s) {
  const bad = [], t = TYPES[s.kit];
  if (!t) return [`unknown kit type ${s.kit}`];
  const n = (what, len, lo, hi) => { if (!Array.isArray(len) || len.length < lo || len.length > hi) bad.push(`${what}: ${lo} to ${hi} wanted, ${len?.length ?? 0} given`); };
  if (s.kit === "pair") { n("pairs", s.pairs, 2, 5); if (s.pairs?.some(p => p.length !== 2 || !p[0] || !p[1])) bad.push("a pair needs two sides"); }
  if (s.kit === "order") { n("items", s.items, 3, 5); if (s.items && new Set(s.items).size !== s.items.length) bad.push("duplicate items"); }
  if (s.kit === "bins") { n("bins", s.bins, 2, 3); n("items", s.items, 2, 6); if (s.items?.some(i => !(i.bin >= 0 && i.bin < s.bins.length))) bad.push("an item names no bin"); if (s.bins && s.items && !s.bins.every((_, k) => s.items.some(i => i.bin === k))) bad.push("a bin is empty"); }
  if (s.kit === "tf") { n("items", s.items, 1, 4); if (s.items?.some(i => typeof i.a !== "boolean" || !i.why)) bad.push("a statement needs a|why"); }
  if (s.kit === "reveal") n("cards", s.cards, 2, 6);
  if (s.kit === "explore") { if (!s.fig || s.fig.type !== "graph") bad.push("explore needs a graph fig"); else if (s.fig.nodes.filter(x => x.note).length < 2) bad.push("explore needs notes on two parts or more"); }
  if (s.kit === "slider") { if (!(s.max > s.min) || !s.bands?.length) bad.push("slider needs min, max and bands"); else if (s.bands[0].from > s.min) bad.push("the first band must start at min"); if (s.goal && !(s.goal[0] <= s.goal[1])) bad.push("goal"); }
  if (s.kit === "decide") n("options", s.options, 2, 4);
  if (s.kit === "toggle") { n("toggles", s.toggles, 1, 4); if (!s.rules?.length || s.rules.some(r => !Array.isArray(r.if))) bad.push("toggle needs rules"); if (!s.fig) bad.push("toggle needs a fig"); }
  if (s.kit === "build") { n("pieces", s.pieces, 2, 5); const slots = s.fig?.nodes?.filter(x => x.slot).map(x => x.id) || []; if (!s.pieces?.every(p => slots.includes(p.id)) || slots.length !== s.pieces?.length) bad.push("pieces and slots must match one to one"); }
  return bad;
}

/**
 * The kit of one stage. onResult(step, ok): the review pile. Returns the calls listed at the top of this file.
 */
export function createKit({ onResult = () => {} } = {}) {
  let box = null, api = null, cur = null, curSt = null;
  const own = s => s?.kind === "kit" && !!TYPES[s.kit];
  const ks = (s, st) => { if (!st.k) { st.k = {}; TYPES[s.kit].init(s, st.k); } return st.k; };

  /** The first wrong move is the step's miss, once; a finish with no wrong move is its hit. */
  function report(s, k, finished) {
    if (!SCORED(s)) return;
    if (k.miss && !k.rep) { k.rep = true; onResult(s, false); }
    else if (finished && !k.miss && !k.rep) { k.rep = true; onResult(s, true); }
  }
  /** After a move: report a miss, and end the step when the type says it is complete (the types judged by the button end in submit). */
  function after(s, st, k) {
    report(s, k, false);
    if (!BY_BUTTON.has(s.kit) && TYPES[s.kit].complete(s, k) && !k.fin) {
      k.fin = true; report(s, k, true);
      api.answer({ ok: true, done: true, msg: s.why });
    } else api.changed();
  }
  function move(a) {
    if (!cur || !curSt || !own(cur) || (curSt.done && (SCORED(cur) || BY_BUTTON.has(cur.kit)))) return;   // the exploring types stay open once done
    const k = ks(cur, curSt);
    TYPES[cur.kit].act(cur, k, a);
    after(cur, curSt, k);
  }

  return {
    owns: own,
    mount(b, a) {
      box = b; api = a;
      box.addEventListener("click", e => {
        if (!own(cur)) return;
        const q = sel => e.target.closest(sel);
        let t;
        if ((t = q("[data-l]"))) move({ t: "l", i: Number(t.dataset.l) });
        else if ((t = q("[data-r]"))) move({ t: "r", j: Number(t.dataset.r) });
        else if (q("[data-undo]")) move({ t: "undo" });
        else if ((t = q("[data-slot]"))) move({ t: "slot", k: Number(t.dataset.slot) });
        else if (q("[data-reset]")) move({ t: "reset" });
        else if ((t = q("[data-bin]"))) move({ t: "bin", k: Number(t.dataset.bin) });
        else if ((t = q("[data-tf]"))) move({ t: "tf", i: Number(t.dataset.tf), v: t.dataset.v === "true" });
        else if ((t = q("[data-card]"))) move({ t: "card", k: Number(t.dataset.card) });
        else if ((t = q("[data-opt]"))) move({ t: "opt", i: Number(t.dataset.opt) });
        else if ((t = q("[data-tog]"))) move({ t: "tog", id: t.dataset.tog });
        else if ((t = q("[data-piece]"))) move({ t: "piece", i: Number(t.dataset.piece) });
        else if ((t = q("[data-item]"))) move({ t: cur.kit === "build" ? "piece" : "item", i: Number(t.dataset.item) });
        else if ((t = q("[data-node]"))) move({ t: "node", id: t.dataset.node });
      });
      box.addEventListener("keydown", e => {
        const t = e.target.closest?.("[data-node]");
        if (t && own(cur) && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); move({ t: "node", id: t.dataset.node }); }
      });
      // a slider is patched in place, so the thumb keeps the finger
      box.addEventListener("input", e => {
        const r = e.target.closest?.("[data-range]");
        if (!r || cur?.kit !== "slider" || (curSt.done && SCORED(cur))) return;
        const k = ks(cur, curSt);
        TYPES.slider.act(cur, k, { t: "set", v: Number(r.value) });
        const fig = box.querySelector(".lk-fig"), val = box.querySelector("[data-val]"), read = box.querySelector("[data-read]");
        if (fig) fig.innerHTML = figHtml(TYPES.slider.fig(cur, k));
        if (val) val.textContent = `${k.v}${cur.unit || ""}`;
        const b = bandAt(cur, k.v);
        if (read) { read.textContent = b != null ? cur.bands[b].text : TYPES.slider.help; read.className = `lk-panel${b != null && cur.bands[b].tone ? ` t-${cur.bands[b].tone}` : ""}`; }
        if (TYPES.slider.complete(cur, k) && !k.fin) after(cur, curSt, k);
      });
    },
    task: own,
    submits: s => own(s) && BY_BUTTON.has(s.kit),
    ready: (s, st) => (BY_BUTTON.has(s.kit) ? TYPES[s.kit].ready(s, ks(s, st)) : true),
    label: () => "Check",
    /** Judges a pair or an order: the right places stay, the others go back. */
    submit(s, st) {
      const k = ks(s, st), res = TYPES[s.kit].submit(s, k);
      if (!res.ok) k.miss = true;
      report(s, k, res.ok);
      if (res.ok) { k.fin = true; return { ok: true, msg: s.why, done: true }; }
      return res;
    },
    hint(s, st) {
      const k = ks(s, st);
      TYPES[s.kit].hint(s, k);
      k.miss = true; report(s, k, false);                              // shown the answer: it comes back in the review
      if (!BY_BUTTON.has(s.kit) && !k.fin) { k.fin = true; api.answer({ ok: true, done: true, msg: s.why }); }
    },
    draw(s, st) {
      cur = s; curSt = st;
      const k = ks(s, st), t = TYPES[s.kit];
      const note = st.done ? "" : k.say ? k.say : k.flash?.length ? "" : t.help;
      box.innerHTML = `<div class="lk lk-${s.kit}${st.done ? " done" : ""}">${t.html(s, k)}${["reveal", "explore", "decide", "toggle", "slider"].includes(s.kit) ? "" : `<p class="lk-note${k.say && k.miss ? " no" : ""}" aria-live="polite">${esc(note)}</p>`}${s.check ? '<span class="lk-check" title="Not yet verified">check</span>' : ""}</div>`;
    },
    /** The figure (and badge) of a step that is not the kit's, for a stage to draw. */
    plain(s) {
      cur = s;
      if (!s.fig) return "";
      return `<div class="lk lk-plain">${figOf(s)}${s.check ? '<span class="lk-check" title="Not yet verified">check</span>' : ""}</div>`;
    },
  };
}

/** The steps flagged `check: true`, for Korbi's audit (tests print them). */
export const flagged = steps => steps.filter(s => s.check);
/** Test hooks: the types' pure parts. */
export const _types = TYPES;
