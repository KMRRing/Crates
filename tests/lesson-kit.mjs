// The interaction kit for courses (lesson-kit.js, lesson-figs.js, lesson-kit.css): every step type played through its moves in Node (the types are pure state machines, the stage
// only draws them), the caps that keep exercises small, the figures, and the wiring in a stage. Run: node tests/lesson-kit.mjs
import fs from "fs";
import { createKit, validate, KIT_TYPES, shuffled, _types as T } from "../lesson-kit.js";
import { figHtml, FIG_TYPES } from "../lesson-figs.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const read = f => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

// a fake stage box: records listeners and the markup, so draw and the moves can be run without a browser
function harness(onResult = () => {}) {
  const box = { html: "", fn: {}, classList: { add() {} }, addEventListener(t, f) { (this.fn[t] ||= []).push(f); }, querySelector: () => null, set innerHTML(v) { this.html = v; }, get innerHTML() { return this.html; } };
  const log = [], api = { changed: () => log.push("changed"), answer: r => log.push(["answer", r]) };
  const kit = createKit({ onResult });
  kit.mount(box, api);
  const click = (attr, val, extra = {}) => { const el = { dataset: { [attr]: val, ...extra }, closest: sel => (sel === `[data-${attr}]` ? el : null) }; box.fn.click.forEach(f => f({ target: el })); };
  return { box, kit, log, api, click };
}
const GRAPH = { type: "graph", w: 300, h: 120, nodes: [{ id: "a", x: 60, y: 30, label: "Upper house", note: "Reviews bills.", layer: "u" }, { id: "b", x: 200, y: 30, label: "Lower house", note: "Starts bills." }, { id: "c", x: 130, y: 90, label: "Head\nof state", note: "Signs bills." }], edges: [{ a: "a", b: "c", layer: "u" }, { a: "b", b: "c", kind: "dash", label: "sends" }] };
const SLOTS = { type: "graph", w: 300, h: 100, nodes: [{ id: "s1", x: 70, y: 40, label: "", slot: true }, { id: "s2", x: 220, y: 40, label: "", slot: true }], edges: [{ a: "s1", b: "s2" }] };

const STEPS = {
  pair: { id: "t.pair", kind: "kit", kit: "pair", say: "x", why: "w", pairs: [["Habeas corpus", "Test of detention"], ["Veto", "Refusal to sign"], ["Quorum", "Minimum present"], ["Writ", "Court order"]] },
  order: { id: "t.order", kind: "kit", kit: "order", say: "x", why: "w", items: ["Propose", "Debate", "Vote", "Sign"] },
  bins: { id: "t.bins", kind: "kit", kit: "bins", say: "x", why: "w", bins: ["Federal", "Unitary"], items: [{ t: "Germany", bin: 0, why: "Länder" }, { t: "France", bin: 1 }, { t: "Switzerland", bin: 0 }] },
  tf: { id: "t.tf", kind: "kit", kit: "tf", say: "x", why: "w", items: [{ t: "A is so", a: true, why: "because" }, { t: "B is so", a: false, why: "since not" }] },
  reveal: { id: "t.rev", kind: "kit", kit: "reveal", say: "x", why: "w", cards: [{ head: "One", body: "first" }, { head: "Two", body: "second" }] },
  explore: { id: "t.exp", kind: "kit", kit: "explore", say: "x", why: "w", fig: GRAPH },
  slider: { id: "t.sl", kind: "kit", kit: "slider", say: "x", why: "w", min: 0, max: 100, step: 1, init: 10, unit: "%", label: "Votes in favour", bands: [{ from: 0, text: "Fails" }, { from: 50, text: "Simple majority", tone: "ok" }, { from: 67, text: "Two thirds" }], marks: [{ at: 50, label: "50%" }, { at: 67, label: "2/3" }] },
  sliderGoal: { id: "t.slg", kind: "kit", kit: "slider", say: "x", why: "w", min: 0, max: 100, init: 10, goal: [60, 70], bands: [{ from: 0, text: "Low" }, { from: 60, text: "There" }] },
  decide: { id: "t.dec", kind: "kit", kit: "decide", say: "x", why: "w", actor: "You are the president.", options: [{ label: "Decree", bites: "A court strikes it" }, { label: "Bill", bites: "The upper house blocks it" }] },
  toggle: { id: "t.tog", kind: "kit", kit: "toggle", say: "x", why: "w", fig: GRAPH, toggles: [{ id: "u", label: "Upper house", on: true }, { id: "v", label: "Court" }], rules: [{ if: ["u", "v"], text: "Both veto" }, { if: ["u"], text: "Upper only" }], dflt: "No veto", need: 3 },
  build: { id: "t.bld", kind: "kit", kit: "build", say: "x", why: "w", fig: SLOTS, pieces: [{ id: "s1", label: "Parliament" }, { id: "s2", label: "Cabinet" }] },
};

// ---------- shape and caps ----------
check(KIT_TYPES.length === 10 && KIT_TYPES.every(t => T[t]), "ten step types, each with its state machine");
check(Object.values(STEPS).every(s => validate(s).length === 0), `the sample of each type is valid${Object.values(STEPS).map(validate).flat().join(", ")}`);
check(validate({ ...STEPS.pair, pairs: [...STEPS.pair.pairs, ["a", "b"], ["c", "d"]] }).length === 1, "a pair step with six pairs is refused (5 at most)");
check(validate({ ...STEPS.order, items: ["a", "b", "c", "d", "e", "f"] }).length === 1 && validate({ ...STEPS.order, items: ["a", "b"] }).length === 1, "an order step has 3 to 5 items");
check(validate({ ...STEPS.bins, items: STEPS.bins.items.map(i => ({ ...i, bin: 0 })) }).length >= 1, "a bin with nothing in it is refused");
check(validate({ ...STEPS.build, pieces: [STEPS.build.pieces[0]] }).length >= 1, "build pieces and slots must match");
check(validate({ ...STEPS.explore, fig: { ...GRAPH, nodes: GRAPH.nodes.map(n => ({ ...n, note: undefined })) } }).length >= 1, "explore needs notes");
check(shuffled("a", 5).join() === shuffled("a", 5).join() && shuffled("q", 4).some((v, i) => v !== i), "the shuffle is fixed and never the identity");

// ---------- figures ----------
const FIGS = {
  graph: GRAPH, timeline: { type: "timeline", from: 1700, to: 1900, items: [{ at: 1776, label: "Declaration" }, { at: 1789, label: "Constitution" }, { at: 1848, label: "Swiss text" }] },
  scale: { type: "scale", min: 0, max: 100, unit: "%", marks: [{ at: 50, label: "50%" }], bands: [{ from: 0, to: 50, label: "no" }, { from: 50, to: 100, label: "yes", tone: "ok" }], value: 40 },
  bars: { type: "bars", rows: [{ label: "A", value: 3 }, { label: "B", value: 9, tone: "b" }], unit: " seats" }, seats: { type: "seats", parties: [{ label: "X", n: 40, tone: "a" }, { label: "Y", n: 35, tone: "b" }, { label: "Z", n: 25 }] },
  stack: { type: "stack", rows: [{ label: "Constitution" }, { label: "Statute", sub: "ordinary law" }, { label: "Regulation" }] },
};
check(FIG_TYPES.every(t => FIGS[t]) && Object.keys(FIGS).length === FIG_TYPES.length, "every figure type has a sample");
check(Object.entries(FIGS).every(([t, f]) => { const h = figHtml(f); return h.startsWith("<svg") && h.endsWith("</svg>") && !/NaN|undefined|Infinity/.test(h); }), "every figure draws, with no NaN or undefined in it");
{
  const seatsN = (figHtml(FIGS.seats).match(/class="lf-seat/g) || []).length;
  check(seatsN === 100, `a hemicycle draws one dot per seat (${seatsN})`);
  const h = figHtml(GRAPH, { on: { u: false } });
  check((h.match(/class="lf-node[^"]* off"/g) || []).length === 1, "a node whose layer is off is dimmed, the others are not");
  check(figHtml({ type: "nope" }) === "", "an unknown figure type draws nothing");
  check(!/<script|onerror/i.test(figHtml({ ...GRAPH, nodes: [{ id: "x", x: 1, y: 1, label: "<script>" }] })), "labels are escaped");
}

// ---------- the types, played ----------
{ // pair
  const s = STEPS.pair, st = {}; T.pair.init(s, st);
  check(!T.pair.ready(s, st), "pair: not ready until every card has a partner");
  [0, 1, 2].forEach(i => { T.pair.act(s, st, { t: "l", i }); T.pair.act(s, st, { t: "r", j: i }); });
  T.pair.act(s, st, { t: "l", i: 3 }); T.pair.act(s, st, { t: "r", j: 0 });
  check(st.link[3] === 0 && st.link[0] === undefined, "pair: a partner taken by another card moves to the new one");
  T.pair.act(s, st, { t: "undo" });
  check(st.link[3] === undefined && T.pair.html(s, st).includes("data-undo"), "pair: undo takes back the last pair");
  T.pair.act(s, st, { t: "l", i: 0 }); T.pair.act(s, st, { t: "r", j: 0 });
  T.pair.act(s, st, { t: "l", i: 2 }); T.pair.act(s, st, { t: "r", j: 3 });
  T.pair.act(s, st, { t: "l", i: 3 }); T.pair.act(s, st, { t: "r", j: 2 });
  check(T.pair.ready(s, st), "pair: ready when all four are linked");
  const r1 = T.pair.submit(s, st);
  check(!r1.ok && /2 of 4/.test(r1.why) && st.lock[0] && st.lock[1] && !st.lock[2] && !st.lock[3] && st.link[3] === undefined && st.flash.includes(3), "pair: Check keeps the right pairs and returns the wrong ones, saying how many");
  T.pair.act(s, st, { t: "l", i: 2 }); T.pair.act(s, st, { t: "r", j: 2 });
  T.pair.act(s, st, { t: "l", i: 3 }); T.pair.act(s, st, { t: "r", j: 3 });
  const r2 = T.pair.submit(s, st);
  check(r2.ok && T.pair.complete(s, st), "pair: the last pair right ends it");
  check(new Set(T.pair.html(s, { link: {}, lock: {}, hist: [], sel: null, rs: shuffled(s.id, 4) }).match(/data-r="\d"/g)).size === 4, "pair: every right-hand card is drawn once");
}
{ // order
  const s = STEPS.order, st = {}; T.order.init(s, st);
  T.order.act(s, st, { t: "item", i: 2 }); T.order.act(s, st, { t: "slot", k: 0 });
  check(st.slots[0] === 2 && st.sel == null, "order: tap a card then a place puts it there");
  T.order.act(s, st, { t: "slot", k: 0 });
  check(st.slots[0] === null, "order: tapping a placed card takes it back");
  [2, 1, 0, 3].forEach((it, k) => { T.order.act(s, st, { t: "item", i: it }); T.order.act(s, st, { t: "slot", k }); });
  check(T.order.ready(s, st), "order: ready with all places filled");
  const r = T.order.submit(s, st);
  check(!r.ok && /1 of 4/.test(r.why) === false && /\d of 4/.test(r.why) && st.lock[3], "order: partial feedback keeps the places that are right");
  T.order.act(s, st, { t: "reset" });
  check(st.lock[3] && st.slots[3] === 3 && st.slots[0] === null, "order: Reset clears the places not yet locked");
  [0, 1, 2].forEach(k => { T.order.act(s, st, { t: "item", i: k }); T.order.act(s, st, { t: "slot", k }); });
  check(T.order.submit(s, st).ok, "order: the right order ends it");
}
{ // bins, tf
  const s = STEPS.bins, st = {}; T.bins.init(s, st);
  T.bins.act(s, st, { t: "item", i: 0 }); T.bins.act(s, st, { t: "bin", k: 1 });
  check(st.miss && st.bad === 0 && st.put[0] == null && /Not Unitary/.test(st.say), "bins: a wrong box says so and the item stays");
  [[0, 0], [1, 1], [2, 0]].forEach(([i, k]) => { T.bins.act(s, st, { t: "item", i }); T.bins.act(s, st, { t: "bin", k }); });
  check(T.bins.complete(s, st), "bins: complete when all are placed");
  const f = STEPS.tf, g = {}; T.tf.init(f, g);
  T.tf.act(f, g, { t: "tf", i: 0, v: false }); T.tf.act(f, g, { t: "tf", i: 0, v: true });
  check(g.ans[0] === false && g.miss, "tf: the first answer stands");
  T.tf.act(f, g, { t: "tf", i: 1, v: false });
  check(T.tf.complete(f, g), "tf: complete when every statement is answered");
}
{ // reveal, explore, slider, decide, toggle, build
  let s = STEPS.reveal, st = {}; T.reveal.init(s, st);
  T.reveal.act(s, st, { t: "card", k: 0 }); T.reveal.act(s, st, { t: "card", k: 1 });
  check(T.reveal.complete(s, st) && T.reveal.html(s, st).includes("second"), "reveal: done when all are opened, and the open one is shown");
  s = STEPS.explore; st = {}; T.explore.init(s, st);
  T.explore.act(s, st, { t: "node", id: "a" }); T.explore.act(s, st, { t: "node", id: "b" });
  check(!T.explore.complete(s, st), "explore: not done while a part is unopened");
  T.explore.act(s, st, { t: "node", id: "c" });
  check(T.explore.complete(s, st) && T.explore.html(s, st).includes("Signs bills."), "explore: done when every part has been opened");
  s = STEPS.slider; st = {}; T.slider.init(s, st);
  check(!T.slider.complete(s, st) && T.slider.html(s, st).includes("Fails"), "slider: the band at the start is read out");
  T.slider.act(s, st, { t: "set", v: 55 });
  check(T.slider.complete(s, st) && T.slider.html(s, st).includes("Simple majority") && T.slider.fig(s, st).value === 55, "slider: two bands seen is done; the figure's pin follows the value");
  s = STEPS.sliderGoal; st = {}; T.slider.init(s, st);
  T.slider.act(s, st, { t: "set", v: 30 });
  check(!T.slider.complete(s, st), "slider: a goal is not met by moving about");
  T.slider.act(s, st, { t: "set", v: 65 });
  check(T.slider.complete(s, st), "slider: inside the goal range is done");
  s = STEPS.decide; st = {}; T.decide.init(s, st);
  T.decide.act(s, st, { t: "opt", i: 1 });
  check(T.decide.complete(s, st) && T.decide.html(s, st).includes("upper house blocks"), "decide: a pick shows what constrained it");
  s = STEPS.toggle; st = {}; T.toggle.init(s, st);
  check(!T.toggle.complete(s, st) && T.toggle.html(s, st).includes("Upper only"), "toggle: the starting rule is shown");
  T.toggle.act(s, st, { t: "tog", id: "v" }); T.toggle.act(s, st, { t: "tog", id: "u" }); T.toggle.act(s, st, { t: "tog", id: "v" });
  check(T.toggle.complete(s, st) && T.toggle.html(s, st).includes("No veto"), "toggle: three different results seen is done; the default text covers the rest");
  s = STEPS.build; st = {}; T.build.init(s, st);
  T.build.act(s, st, { t: "piece", i: 0 }); T.build.act(s, st, { t: "node", id: s.pieces[0].id === "s1" ? "s2" : "s1" });
  check(st.miss && st.bad && Object.keys(st.placed).length === 0, "build: a wrong place is refused and counts as a miss");
  s.pieces.forEach((p, i) => { T.build.act(s, st, { t: "piece", i }); T.build.act(s, st, { t: "node", id: p.id }); });
  check(T.build.complete(s, st) && figHtml(s.fig, { placed: st.placed }).includes("Parliament"), "build: done when every piece is on its place, and the figure shows it");
}

// ---------- through the stage's calls (what a course's stage does) ----------
{
  const hits = [], h = harness((s, ok) => hits.push([s.id, ok])), s = STEPS.tf, st = {};
  h.kit.draw(s, st);
  check(h.kit.owns(s) && h.kit.task(s) && !h.kit.submits(s) && h.box.html.includes("lk-tfr"), "tf is a task judged as the reader taps, drawn on the stage");
  h.click("tf", "0", { v: "true" });
  h.click("tf", "1", { v: "false" });
  check(h.log.some(l => l[0] === "answer" && l[1].ok && l[1].done && l[1].msg === "w") && hits.length === 1 && hits[0][1] === true, "tapping the last statement ends the step with its reason and reports a hit");
  const hits2 = [], h2 = harness((x, ok) => hits2.push(ok)), st2 = {};
  h2.kit.draw(STEPS.tf, st2); h2.click("tf", "0", { v: "false" }); h2.click("tf", "0", { v: "true" });
  check(hits2.length === 1 && hits2[0] === false, "a wrong tap reports one miss, once");
  const h3 = harness(), st3 = {};
  h3.kit.draw(STEPS.pair, st3);
  check(h3.kit.submits(STEPS.pair) && !h3.kit.ready(STEPS.pair, st3), "pair is judged by the Check button and is not ready empty");
  h3.kit.hint(STEPS.pair, st3);
  check(h3.kit.ready(STEPS.pair, st3) && h3.kit.submit(STEPS.pair, st3).ok, "the hint places the answer; Check then accepts it");
  const h4 = harness(), st4 = { done: true }; h4.kit.draw(STEPS.decide, st4);
  h4.click("opt", "1");
  check(h4.log.length > 0 && h4.box.html.includes("Bill"), "an exploring step stays live after it is done");
  const h5 = harness(), st5 = {}; h5.kit.draw({ ...STEPS.reveal, check: true }, st5);
  check(h5.box.html.includes("lk-check"), "a step flagged check shows its tag");
  check(h5.kit.plain({ kind: "quiz", fig: FIGS.bars, id: "q" }).includes("<svg") && h5.kit.plain({ kind: "quiz", id: "q" }) === "", "a step that is not the kit's can still carry a figure");
}

// ---------- wiring, sizes, looks ----------
const css = read("lesson-kit.css"), js = read("lesson-kit.js") + read("lesson-figs.js");
check(!/alert\(|confirm\(|prompt\(/.test(js), "no native pop-up");
check(/min-height: 2\.75rem/.test(css) && !/min-height: [12]\.[0-6]\d*rem/.test(css.split("lk-chip {")[1]?.split("}")[0] || ""), "chips are at least 2.75rem tall");
check(["--ink", "--sheet", "--tile", "--brass", "--ln-in", "--ln-ok", "--ln-no"].every(v => css.includes(v)) && !/#[0-9a-fA-F]{6}\b(?![^{]*\))/.test(css.replace(/var\(--ln-(ok|no), #[0-9A-F]{6}\)/g, "")), "colours come from tokens (fallbacks only inside var())");
check(/html\[data-theme="office"\]/.test(css), "Office has its own rule");
check(/lesson-kit\.css/.test(read("constitutions.html")), "constitutions.html links the kit's stylesheet");
check(/createKit/.test(read("constitutions-stage.js")), "the Constitutions stage uses the kit");
check(fs.existsSync(new URL("../docs/lesson-kit.md", import.meta.url)), "docs/lesson-kit.md exists");

if (bad) process.exitCode = 1;
