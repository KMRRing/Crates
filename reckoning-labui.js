// The Feel lab on the page: one stretch of quay played with setting A, then again with B, then one tap ("A", "Same" or "B"), and
// the next comparison starts by itself. Also the "That felt wrong" flag, and "Use these" / "Copy results". The rules of the
// search, the stretches and the text are in reckoning-lab.js (tested in Node); this file is the buttons and the order of things.
// The page (reckoning.js) hands in `api`: play(def, values, onEnd) runs a stretch with those tunables and calls onEnd when it
// is over; leave() brings the real run back; flagInfo() says where the player is and the last lines of the swipe log.
import { DEFAULTS, setTune, resetTune } from "./reckoning-tune.js";
import { TESTS, Search, stretch, cleanFeel, resultsText, FEEL_KEY, MAX_FLAGS } from "./reckoning-lab.js";

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

export function createLab(api) {
  const $ = id => document.getElementById(id);
  let feel = cleanFeel(api.read(FEEL_KEY, null));
  let gen = 0;                       // a new one each time the lab starts or stops, so a timer from before does nothing
  let st = null;                     // { queue, i, test, search, vals: {A, B}, aLo, phase, again, n }
  const save = () => api.write(FEEL_KEY, feel);

  /** The tunables in force in the real game: the lab's results when they are in use, else today's. */
  const applied = () => { resetTune(); if (feel.use) setTune(feel.values); };
  const fmtVal = (t, v) => (t.binary ? t.names[v === t.binary[0] ? 0 : 1] : `${t.fmt(v)}${t.unit ? " " + t.unit : ""}`);

  // ---------- the panel ----------
  const panel = $("labPanel"), top = $("labTop"), big = $("labBig");
  function show(...rows) { panel.replaceChildren(...rows); panel.hidden = false; }
  function hide() { panel.hidden = true; panel.replaceChildren(); }
  const btn = (text, fn, cls = "") => { const b = el("button", `rk-lb ${cls}`, text); b.type = "button"; b.addEventListener("click", fn); return b; };
  const row = (cls, ...kids) => { const r = el("div", `rk-lrow ${cls}`); r.append(...kids); return r; };
  const say = (text, kind) => api.say(text, kind);

  function topline(text) { top.textContent = text; top.hidden = !text; }
  function letter(text) { big.textContent = text; big.hidden = !text; }

  // ---------- running a round ----------
  /** The menu's entry: a short round (the core tests), everything, or one test. */
  function home() {
    gen++; st = null; letter(""); topline("");
    if (api.inLab()) api.leave();
    const core = TESTS.filter(t => t.core);
    const list = el("div", "rk-ltests");
    for (const t of TESTS) {
      const b = btn(t.name + (t.key in feel.done ? `  ${fmtVal(t, feel.done[t.key])}` : ""), () => begin([t]), "rk-ltest");
      list.append(b);
    }
    show(
      el("p", "rk-lhead", "Feel lab"),
      el("p", "rk-lnote", "A stretch plays with A, then with B. Tap the one that felt better. About 40 taps for the round."),
      row("", btn(`Round of ${core.length}`, () => begin(core), "rk-lgo"), btn(`All ${TESTS.length}`, () => begin(TESTS))),
      list,
      row("", btn("Use these", useThese, "rk-lgo"), btn("Copy results", copy), btn("Defaults", defaults)),
      row("", btn("Close", close)));
  }

  function begin(tests) {
    gen++;
    st = { queue: tests, i: 0 };
    nextTest();
  }

  function nextTest() {
    if (st.i >= st.queue.length) return summary();
    const t = st.queue[st.i];
    st.test = t; st.search = new Search(t, feel.done[t.key] ?? DEFAULTS[t.key]);
    pair();
  }

  function pair() {
    const s = st.search, p = s.pair();
    st.aLo = Math.random() < 0.5;
    st.vals = { A: st.aLo ? p.lo : p.hi, B: st.aLo ? p.hi : p.lo };
    st.again = 0;
    play("A");
  }

  /** Plays the stretch with A's or B's value; A is followed by B by itself, and B by the question. */
  function play(which) {
    const g = ++gen, t = st.test;
    st.phase = which;
    hide();
    topline(`${t.name} · ${st.i + 1}/${st.queue.length} · ${which}\n${t.how}`);
    letter(which);
    const values = { ...feel.done, [t.key]: st.vals[which] };
    api.play(stretch(t.stretch, 17 + t.id.length * 31 + st.search.n * 7 + st.again), values, () => {
      if (g !== gen) return;
      if (which === "A") setTimeout(() => { if (g === gen) play("B"); }, 450);
      else ask();
    }, () => { if (g === gen) setTimeout(() => { if (g === gen) letter(""); }, 700); });
  }

  function ask() {
    const t = st.test;
    topline(`${t.name} · ${st.i + 1}/${st.queue.length}`);
    letter("");
    const rows = [
      el("p", "rk-lhead", "Which felt better?"),
      row("rk-l3", btn("A", () => answer("A"), "rk-lab-a"), btn("Same", () => answer("same")), btn("B", () => answer("B"), "rk-lab-b")),
    ];
    if (!t.binary) rows.push(row("rk-l2", btn(t.more, () => answer("more")), btn(t.less, () => answer("less"))));
    rows.push(row("rk-l3", btn("Again", again), btn("Skip", skip), btn("Stop", home)));
    show(...rows);
  }

  function again() { st.again++; st.replays = (st.replays || 0) + 1; play("A"); }

  function answer(ans) {
    const t = st.test, s = st.search, a = st.vals.A, b = st.vals.B;
    feel.results.push({ t: t.id, a, b, ans, ...(st.replays ? { again: st.replays } : {}) });
    st.replays = 0;
    const map = ans === "A" ? (st.aLo ? "lo" : "hi") : ans === "B" ? (st.aLo ? "hi" : "lo") : ans;
    s.answer(map);
    if (s.done) {
      feel.done[t.key] = s.result();
      say(`${t.name}: ${fmtVal(t, feel.done[t.key])}`, "good");
      st.i++;
      save();
      nextTest();
    } else { save(); pair(); }
  }

  function skip() { st.i++; st.replays = 0; nextTest(); }

  function summary() {
    api.leave(); gen++; letter(""); topline("");
    const list = el("div", "rk-lsum");
    const keys = Object.keys(feel.done);
    for (const k of keys) {
      const t = TESTS.find(x => x.key === k); if (!t) continue;
      list.append(el("p", "rk-lline", `${t.name}: ${fmtVal(t, feel.done[k])}   (was ${fmtVal(t, feel.use && k in feel.values ? feel.values[k] : DEFAULTS[k])})`));
    }
    if (!keys.length) list.append(el("p", "rk-lline", "Nothing settled yet."));
    show(el("p", "rk-lhead", "Done"), list,
      row("", btn("Use these", useThese, "rk-lgo")), row("", btn("Copy results", copy), btn("Defaults", defaults)), row("", btn("More tests", home), btn("Close", close)));
  }

  // ---------- results ----------
  function useThese() {
    feel.values = { ...feel.done }; feel.use = true; save(); applied();
    say("In use", "good"); close();
  }
  function defaults() {
    feel.use = false; feel.values = {}; save(); applied();
    say("Back to defaults", "good");
    close();
  }
  async function copy(e) {
    const text = resultsText(feel, `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC, screen ${innerWidth}x${innerHeight}`);
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch { /* below */ }
    if (!ok) {
      const ta = el("textarea", "rk-ltext"); ta.value = text; ta.readOnly = true; panel.append(ta);
      ta.focus(); ta.select();
      try { ok = document.execCommand("copy"); } catch { /* selected for a hand copy */ }
    }
    const b = e?.currentTarget; if (b) { const was = b.textContent; b.textContent = ok ? "Copied" : "Select and copy"; setTimeout(() => { b.textContent = was; }, 1800); }
  }
  function close() { gen++; st = null; letter(""); topline(""); hide(); if (api.inLab()) api.leave(); applied(); }

  // ---------- "That felt wrong" ----------
  let lastFlag = null, chipTimer = 0;
  function flag() {
    const info = api.flagInfo();
    if (!info) return;
    const where = st ? `lab, ${st.test.name}, ${st.phase} = ${fmtVal(st.test, st.vals[st.phase])}` : info.where;
    lastFlag = { at: new Date().toISOString().slice(0, 19).replace("T", " "), where, lines: info.lines };
    feel.flags.push(lastFlag); feel.flags = feel.flags.slice(-MAX_FLAGS); save();
    say("Flagged", "good");
    const chip = $("flagNote");
    chip.hidden = false; clearTimeout(chipTimer); chipTimer = setTimeout(() => { chip.hidden = true; }, 5000);
  }
  async function note() {
    const fl = lastFlag; $("flagNote").hidden = true;
    if (!fl) return;
    const t = await api.typed("What went wrong? (optional)", { placeholder: "a few words" });
    if (t) { fl.note = t.slice(0, 200); save(); }
  }
  $("flagBtn").addEventListener("click", flag);
  $("flagNote").addEventListener("click", note);

  applied();
  return { home, flag, close, applied, get feel() { return feel; }, reload() { feel = cleanFeel(api.read(FEEL_KEY, null)); } };
}
