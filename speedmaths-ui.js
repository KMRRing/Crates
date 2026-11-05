// Speed maths and Fuel maths (README, Speed maths): the page both tiles share. A pool and a mode (speedmaths-engine.js) are
// dealt as a number pad, a clock and a score; this file keeps the runs, draws the card and takes the keys. The page's
// own file (speedmaths.js, speedfuels.js) says which pool it is and what happens when a round ends; nothing else
// differs. Together (duel.js): a race on the sprint's sums, the same ones for everyone, for the tile that has one.
import { MODES, POOLS, STREAK_STEP, STREAK_MAX, normOpts, startRun, dailyRun, matchRun, validRun, problemAt, submit, autoMatches, bonusNow, finish, missesOf, isBest } from "./speedmaths-engine.js";
import { BAND, chainRel, fmtNum, fmtAnswer, fmtTyped, fmtOff, askText, stepText, workingOf, slipOf } from "./speedmaths-core.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, ticks, action, line, mirror, onPause, isPaused, todayPart } from "./menu.js";
import { ramp } from "./ramp.js";
import { today, arrivedForToday, IN_FRAME } from "./suite.js";
import { createDuel } from "./duel.js";
import { sure } from "./sure.js";

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
/** A sum and its answer as the review tells it: a situation reads "8 crates at £37 each: total? → 296", a bare sum "3 + 4 = 7". */
const qa = p => `${p.prompt}${p.words ? " → " : " = "}${fmtAnswer(p.answer)}`;
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
// a watching frame (IN_FRAME) reads the partner's copy and writes nothing
const write = (key, v) => { if (IN_FRAME) return; try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const clockText = secs => { const s = Math.max(0, Math.ceil(secs)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const SAVE_EVERY = 5000;                        // ms between saves of a run's clock while it goes
const DIGITS_MAX = 10;
const KEEP_DAYS = 60;                           // days of Today's scores kept

/**
 * id: the tile ("speedmaths"), the prefix of everything kept; pool: what is dealt (speedmaths-engine.js POOLS); name; headline: the
 * mode whose best the games screen shows ("sprint" for the standard sprint, "chains"); duel: the tile has a race;
 * onRound(): a round's result is final (random mode moves on: the page's own file says so).
 */
export function createSpeed({ id, pool, name, headline = "sprint", duel: raced = false, onRound = () => {} }) {
  const P = POOLS[pool], ALL = P.kinds.map(([k]) => k);
  const KEY = { prefs: `${id}:prefs`, best: `${id}:best`, bests: `${id}:bests`, daily: `${id}:daily`, run: m => `${id}:run:${m}` };
  // the choices: the mode on the screen, and what the next sprint is made of (the operations, the range)
  const prefs = { mode: headline === "chains" ? "chains" : "sprint", kinds: ALL, range: P.range, ...read(KEY.prefs, {}) };
  // Today's is a button (todayPart, menu.js), not a mode to choose: a "daily" kept from before is read as the mode you had, and
  // today's run on the screen keeps the mode you left (`resting`), to come back to
  if (!MODES[prefs.mode] || prefs.mode === "daily") prefs.mode = headline === "chains" ? "chains" : "sprint";
  let resting = prefs.mode;
  Object.assign(prefs, normOpts(pool, prefs));
  const keepPrefs = () => write(KEY.prefs, { ...prefs, mode: prefs.mode === "daily" ? resting : prefs.mode });

  let run = null;               // the run on the screen
  let phase = "idle";           // idle (nothing going: Start, or Continue), running, over
  let D = null;                 // a race's match, when the run on the screen is one: { begun, n }
  let clockFrom = null, paused = false, savedAt = 0, typedTimer = 0, drawnCard = "";
  let said = null;              // the last answer: { grade, ok, problem, text, off, points } for the line under the answer
  const watching = IN_FRAME;

  // ---------- what a run is (and what counts) ----------
  const label = m => MODES[m].label;
  const isStandard = r => r.mode === "sprint" && r.opts.kinds.length === ALL.length && r.opts.range === P.range;
  /** Whether a finished run sets the games screen's best: the headline mode, and for the sprint only the standard one (all
   *  operations, the default range), since a sprint of additions to 20 is no match for one of everything. */
  const headlineRun = r => (headline === "chains" ? r.mode === "chains" : isStandard(r));
  const bestKey = r => (r.mode === "sprint" ? `sprint:${r.opts.range ?? ""}:${r.opts.kinds.join(",")}` : r.mode);
// Korbi, 4 November 2026: the menu is the minimum it needs to be. A sprint's range is the hidden ramp (`speedmaths:ramp`, up after a
  // sprint of ten sums or more with at most one in ten missed, down after one with four in ten missed; first step the saved range).
  const rangeNow = () => (P.ranges ? (prefs.range = ramp(pool, P.ranges.map(([r]) => r), { start: prefs.range })) : null);
  const optsText = o => (P.ranges ? `${o.kinds.map(k => P.kinds.find(([x]) => x === k)[1]).join(" ")}, ${P.ranges.find(([r]) => r === o.range)?.[1] ?? ""}`
    : o.kinds.length === ALL.length ? "all topics" : o.kinds.map(k => P.kinds.find(([x]) => x === k)[1].toLowerCase()).join(", "));

  const load = m => {
    const r = read(KEY.run(m), null);
    return validRun(r) && r.pool === pool && r.mode === m && (m !== "daily" || r.day === today()) ? r : null;
  };
  const fresh = m => (m === "daily" ? dailyRun(pool, today()) : startRun({ pool, mode: m, seed: randomSeed(), opts: { kinds: prefs.kinds, range: rangeNow() ?? prefs.range } }));

  // ---------- the clock ----------
  // used is the ms of clock gone: it grows while the run is on screen and standing, and stops while the menu, a sheet or
  // another page is up (menu.js's pause). A race's clock is the table's, from its start, and doesn't stop.
  const elapsed = () => (!run ? 0 : D ? Math.max(0, duel.now() - D.begun) : run.used + (clockFrom != null ? performance.now() - clockFrom : 0));
  const leftMs = () => (run ? (run.over ? 0 : run.secs * 1000 - elapsed()) : MODES[prefs.mode].secs * 1000);
  function clockRun() {
    if (watching || D || phase !== "running" || clockFrom != null || document.hidden || isPaused() || paused) return;
    clockFrom = performance.now();
    savedAt = clockFrom;
  }
  function clockPause() {
    if (clockFrom == null || !run) return;
    run.used += performance.now() - clockFrom;
    clockFrom = null;
  }
  onPause(() => { paused = true; clockPause(); save(); }, () => { paused = false; clockRun(); });

  // ---------- keeping the run ----------
  function save() {
    if (watching || !run || phase === "idle" && !run.i && !run.used) return;
    if (D) { duel.keep({ n: D.n, run }); return; }
    write(KEY.run(run.mode), { ...run, used: Math.round(elapsed()) });
  }
  /** The typed figure is kept as it is typed, a moment later, so the keys don't write on every tap. */
  function saveSoon() { clearTimeout(typedTimer); typedTimer = setTimeout(save, 350); }

  // ---------- counting a result (the moment it is final) ----------
  function count() {
    const r = run, score = r.score;
    const bests = read(KEY.bests, {}) || {}, key = bestKey(r), before = bests[key];
    r.fresh = isBest(before, score);
    r.was = before ?? null;                                      // the best before this run, for the result to say
    if (r.fresh) { bests[key] = score; write(KEY.bests, bests); }
    if (headlineRun(r) && isBest(read(KEY.best, null), score)) write(KEY.best, score);
    if (r.mode === "daily") {
      const days = read(KEY.daily, {}) || {};
      if (!(days[r.day] >= score)) days[r.day] = score;
      const keep = Object.keys(days).sort().slice(-KEEP_DAYS);
      write(KEY.daily, Object.fromEntries(keep.map(k => [k, days[k]])));
    }
  }

  // ---------- starting, answering, ending ----------
  function show(r) {
    run = r;
    said = null;
    phase = !r ? "idle" : r.over ? "over" : "idle";
    if (watching && r && !r.over) phase = "running";             // a watching frame shows the run as it stood
    drawnCard = "";
    render();
  }
  /** Starts the run on the screen (Continue), or a new one. */
  function begin() {
    if (watching || D || duel?.on || phase === "running") return;
    if (!run || run.over) run = fresh(prefs.mode);
    phase = "running";
    said = null;
    save();
    clockRun();
    render();
  }
  /** A new run of this mode, asking first if one is under way. */
  async function newRun() {
    if (watching || D || duel?.on || prefs.mode === "daily") return;
    if (run && !run.over && (run.i > 0 || run.used > 0) && !(await sure(`Leave the ${label(prefs.mode).toLowerCase()} under way? Its score is lost.`, { yes: "Start a new one", no: "Keep it" }))) return;
    clockPause();
    run = fresh(prefs.mode);
    phase = "idle";
    begin();
  }
  function answer() {
    if (phase !== "running" || !run || watching) return;
    if (leftMs() <= 0) { endRun(); return; }                    // a tap a hair after time is up doesn't count
    const res = submit(run, run.typed, Math.round(elapsed()));
    said = res;
    pop(res);
    if (D) { save(); tell(); } else save();
    drawnCard = "";
    render();
  }
  function endRun() {
    if (!run || run.over) return;
    clockPause();
    if (!D) run.used = run.secs * 1000;
    const sum = finish(run);
    if (!D && run.mode === "sprint" && P.ranges) { rangeNow(); if (sum.answered >= 10 && sum.missed * 10 <= sum.answered) ramp.won(true); else if (sum.answered >= 10 && sum.missed * 10 >= sum.answered * 4) ramp.lost(); rangeNow(); }
    phase = "over";
    said = null;
    if (D) { save(); tell(true); }
    else { count(); save(); onRound(); }
    drawnCard = "";
    render();
  }

  // ---------- the keys ----------
  const canType = () => phase === "running" && !!run && !watching && !paused && !isPaused();
  function press(k) {
    if (!canType()) return;
    if (leftMs() <= 0) { endRun(); return; }
    if (k === "go") { answer(); return; }
    if (k === "del") run.typed = run.typed.slice(0, -1);
    else if (k === "clear") run.typed = "";
    else if (k === ".") { if (!run.typed.includes(".")) run.typed += run.typed ? "." : "0."; }
    else if (/^\d$/.test(k)) { if (run.typed.replace(/\D/g, "").length < DIGITS_MAX) run.typed = run.typed === "0" ? k : run.typed + k; }
    else return;
    drawAnswer();
    if (autoMatches(run, run.typed)) answer();                  // an exact sum goes in by itself the moment it is right
    else saveSoon();
  }

  // ---------- drawing ----------
  function render() {
    drawHud();
    drawCard();
    drawAnswer();
    drawVerdict();
    $("pad").classList.toggle("off", phase !== "running" || watching);
    $("app").classList.toggle("sm-live", phase === "running" && !watching);       // the caret blinks where the answer goes
    $("app").classList.toggle("sm-over", phase === "over");                       // the pad gives its room to the result
  }
  function drawHud() {
    $("score").textContent = String(run?.score ?? 0);
    $("streak").textContent = String(run?.streak ?? 0);
    const b = run && !run.over ? bonusNow(run) : 0;
    $("bonus").textContent = b ? `+${b}` : "";
    drawClock();
  }
  function drawClock() {
    const left = Math.max(0, leftMs()) / 1000, total = run ? run.secs : MODES[prefs.mode].secs;
    $("clock").textContent = clockText(left);
    $("clock").closest(".sm-cell").classList.toggle("low", phase === "running" && left <= 10);
    $("bar").style.transform = `scaleX(${total ? Math.min(1, left / total) : 1})`;
  }
  function drawAnswer() {
    const live = phase === "running" && !!run;
    $("typed").textContent = live ? fmtTyped(run.typed) : "";
    const p = live ? problemAt(run) : null;
    // what the answer is in, and for an estimate or a chain to how many figures: beside the figure being typed, where the eye is
    $("unit").textContent = !p ? "" : p.kind === "sum" ? p.unit : `${p.unit}, to ${p.sf} s.f.`;
  }
  /** The line under the answer: how the last one went, and for a long one a way to its working. */
  function drawVerdict() {
    const v = $("verdict");
    v.replaceChildren();
    v.className = "sm-verdict";
    const a = phase === "running" ? said : null;
    if (!a) return;
    const p = a.problem, typedText = fmtTyped(a.text);
    let text;
    if (a.grade === "none") { v.classList.add("bad"); text = `Skipped. ${p.kind === "sum" ? qa(p) : `The answer was ${fmtAnswer(p.answer)}`}`; }
    else if (a.grade === "exact") { v.classList.add("good"); text = p.kind === "sum" ? "" : `Exact: ${fmtAnswer(p.answer)}`; }
    else if (a.grade === "close") {
      v.classList.add("good");
      // out by more than the band yet right: it is the exact figure rounded as asked (to 1 s.f., 11,664 is 10,000)
      text = a.off > (p.rel ?? BAND[p.sf]) + 1e-9 ? `Right to ${p.sf} s.f.: ${typedText} for ${fmtAnswer(p.answer)}` : `Close enough: ${typedText} for ${fmtAnswer(p.answer)}, ${fmtOff(a.off)} out`;
    }
    else {
      v.classList.add("bad");
      const slip = slipOf(a.x, p.answer);
      const why = slip > 0 ? `, ${slip === 1 ? "a zero" : `${slip} zeros`} too many` : slip < 0 ? `, ${slip === -1 ? "a zero" : `${-slip} zeros`} short` : p.sf ? `, ${fmtOff(a.off)} out` : "";
      text = p.kind === "sum" ? `${qa(p)}, not ${typedText}` : `${typedText} is wrong: the answer is ${fmtAnswer(p.answer)}${why}`;
    }
    if (!text) return;
    v.append(el("span", "sm-vtext", text));
    if (p.kind === "chain" && a.grade !== "exact") {
      const b = el("button", "link sm-why", "Working");
      b.type = "button";
      b.addEventListener("click", () => explain([{ problem: p, text: a.text, grade: a.grade }], "The working"));
      v.append(b);
    }
  }
  /** The points just earned, floating up from the score. */
  function pop(res) {
    const g = $("gain");
    g.textContent = res.ok ? `+${res.points}` : "";
    g.classList.remove("pop");
    void g.offsetWidth;
    if (res.ok) g.classList.add("pop");
    const t = $("typed");
    t.classList.remove("no");
    if (!res.ok) { void t.offsetWidth; t.classList.add("no"); }
  }

  // the card: the sum, or the start, or the result
  function drawCard() {
    const sig = `${phase}|${run?.i}|${run?.over}|${prefs.mode}|${run?.seed}|${duel?.on}|${phase === "idle" ? prefs.kinds.join("") + prefs.range : ""}`;
    if (sig === drawnCard) return;
    drawnCard = sig;
    const card = $("card");
    card.replaceChildren();
    card.scrollTop = 0;
    card.className = `sm-card fit-grow fit-scroll ${phase}`;
    if (phase === "running") card.append(problemCard(problemAt(run)));
    else if (phase === "over") card.append(overCard());
    else card.append(startCard());
  }
  function problemCard(p) {
    const box = el("div", `sm-q ${p.kind}`);
    if (p.kind === "sum") {
      box.append(el("p", p.words ? "sm-prompt words" : "sm-prompt", p.prompt));
      return box;
    }
    box.append(el("p", "sm-name", p.name), el("p", "sm-start", `${fmtNum(p.start.v)} ${p.start.say}`));
    const steps = el("ol", "sm-steps");
    for (const s of p.steps) {
      const li = el("li");
      li.append(el("span", "sm-do", stepText(s)), el("span", "sm-to", ` → ${s.to}`));
      steps.append(li);
    }
    box.append(steps);
    return box;
  }
  function startCard() {
    const box = el("div", "sm-screen");
    const m = prefs.mode, under = !!run && !run.over && (run.i > 0 || run.used > 0);
    box.append(el("p", "sm-name", label(m)), el("p", "sm-blurb", BLURB[m]));
    if (m === "sprint" && !watching) box.append(el("p", "sm-opts", optsText(run?.opts ?? prefs)));
    if (watching) { box.append(el("p", "sm-note", "Nothing under way.")); return box; }
    if (duel?.on) { box.append(el("p", "sm-note", "The match starts when everyone is ready.")); return box; }
    if (under) {
      const b = el("button", "btn wide primary", "Continue");
      b.type = "button";
      b.addEventListener("click", begin);
      box.append(el("p", "sm-note", `${clockText(leftMs() / 1000)} left, ${plural(run.score, "point")}`), b);
      if (m !== "daily") box.append(button("Start a new one", newRun, "link"));
    } else box.append(button(`Start ${m === "daily" ? "today's" : "the " + label(m).toLowerCase()}`, begin, "primary"));
    return box;
  }
  function overCard() {
    const r = run, box = el("div", "sm-screen sm-result");
    const closeCount = r.log.filter(e => e[2] === "c").length;
    const avg = r.log.length ? r.log.reduce((n, e) => n + e[3], 0) / r.log.length / 1000 : 0;
    box.append(el("p", "sm-name", r.mode === "daily" ? "Today's" : r.mode === "sprint" ? `${label(r.mode)}, ${optsText(r.opts)}` : label(r.mode)));
    box.append(el("p", "sm-big", String(r.score)), el("p", "sm-unit-big", plural(r.score, "point")));
    if (!D) {
      const said = r.mode === "daily" ? (r.fresh ? "Today's score is in" : `Your best daily is ${r.was}`)
        : r.fresh ? (r.was != null ? "A new best" : "A first score") : r.was != null ? `Best ${r.was}` : "";
      box.append(el("p", `sm-best${r.fresh ? " new" : ""}`, said));
    }
    const stats = el("ul", "sm-stats");
    for (const [n, w] of [[r.right, "right"], [r.missed, r.missed === 1 ? "miss" : "misses"], [r.top, "longest streak"], [`${avg.toFixed(1)} s`, "a sum"]]) {
      const li = el("li"); li.append(el("b", "", String(n)), el("span", "", w)); stats.append(li);
    }
    box.append(stats);
    if (closeCount) box.append(el("p", "sm-note", `${plural(closeCount, "answer")} close enough rather than exact.`));
    if (D) {
      box.append(button("The standings", () => duel.open(), "primary"));
    } else if (r.mode === "daily") {
      box.append(el("p", "sm-note", "A new set at midnight UTC, the same for everyone."), button(`Play the ${label(headline).toLowerCase()}`, () => switchTo(headline), "primary"));
    } else box.append(button("Play again", newRun, "primary"));
    if (r.missed) box.append(button(`What you missed (${r.missed})`, () => explain(missesOf(r), "What you missed")));
    return box;
  }
  function button(text, fn, kind = "") {
    const b = el("button", kind === "link" ? "link" : `btn wide${kind === "primary" ? " primary" : ""}`, text);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }

  // ---------- the working: what was missed, in full ----------
  function explain(items, title) {
    $("reviewTitle").textContent = title;
    const body = $("reviewBody");
    body.replaceChildren();
    if (!items.length) body.append(el("p", "sm-note", "Nothing missed."));
    for (const { problem: p, text, grade } of items) {
      const box = el("section", "sm-miss");
      if (p.kind === "sum") box.append(el("p", "sm-miss-q", `${qa(p)}${p.unit ? ` ${p.unit}` : ""}`));
      else {
        box.append(el("h4", "sm-miss-name", p.name), el("p", "sm-miss-start", `${fmtNum(p.start.v)} ${p.start.say}`));
        const ol = el("ol", "sm-steps");
        workingOf(p).forEach(w => ol.append(el("li", "", w)));
        box.append(ol, el("p", "sm-miss-q", `= ${fmtAnswer(p.answer)} ${p.unit} (${askText(p)})`));
      }
      const typedNow = text === "" ? "" : fmtTyped(text);
      if (grade === "none" || !typedNow) box.append(el("p", "sm-miss-you bad", "Skipped."));
      else if (grade === "close") box.append(el("p", "sm-miss-you good", `You typed ${typedNow}: close enough.`));
      else box.append(el("p", "sm-miss-you bad", `You typed ${typedNow}.`));
      body.append(box);
    }
    if (!$("reviewDlg").open) $("reviewDlg").showModal();
  }

  // ---------- the modes ----------
  const BLURB = {
    sprint: `${MODES.sprint.secs} seconds of sums. A right answer goes in by itself.`,
    estimate: `${MODES.estimate.secs} seconds of everyday figures, typed to 1 or 2 significant figures.`,
    chains: `${MODES.chains.secs} seconds of long ones: a figure and three steps or more, one answer.`,
    daily: `${MODES.daily.secs} seconds of all three, the same for everyone today. It counts once.`,
  };
  const setMode = m => { if (m !== "daily") resting = m; prefs.mode = m; keepPrefs(); };
  function switchTo(m) {
    if (!MODES[m] || watching) return;
    if (D) { $("mode").value = "sprint"; dd.sync(); return; }
    clockPause();
    save();
    setMode(m);
    $("mode").value = m;
    dd.sync();
    document.activeElement?.blur?.();
    show(load(m));
  }

  // ---------- the race ----------
  let duel = null;
  if (raced) {
    const sums = o => P.kinds.filter(([k]) => o.kinds.includes(k)).map(([, s]) => s).join(" ");
    duel = createDuel({
      game: id, name, accent: "--speed-in", line: $("duelLine"), toast,
      deal: () => ({ seed: randomSeed(), pool, opts: normOpts(pool, prefs), secs: MODES.sprint.secs }),
      describe: m => `Sprint, ${MODES.sprint.secs} seconds: ${sums(m.opts)} ${P.ranges.find(([r]) => r === m.opts.range)?.[1] ?? ""}. The same sums for everyone: the most points wins`,
      play: (m, { begun, kept, done, run: theirs, n }) => {
        D = { begun, n };
        const own = kept?.n === n && validRun(kept.run) && kept.run.seed === m.seed ? kept.run : matchRun(m);
        if (done && !own.over) { own.over = true; own.score = Number(theirs?.score) || own.score; }
        clockPause();
        show(own);
        phase = own.over ? "over" : "running";
        render();
        if (!own.over && leftMs() <= 0) endRun(); else if (!own.over) tell();
      },
      onLobby: () => { D = null; clockPause(); show(null); },
      onLeave: () => { D = null; show(load(prefs.mode)); },
      extra: () => { const items = run?.over ? missesOf(run, 8) : []; if (!items.length) return null; const ul = el("ul", "sm-extra"); for (const { problem: p, text } of items) ul.append(el("li", "", `${qa(p)}${text ? `, not ${fmtTyped(text)}` : ", skipped"}`)); return ul; },
      extraTitle: "What you missed",
    });
  }
  /** What the table sees of this run: its points, and once it is over, that it is. */
  function tell(done = false) {
    if (!duel || !D || !run) return;
    duel.report({ score: run.score, text: plural(run.score, "point"), ...(done ? { done: true, ms: Math.round(elapsed()) } : {}) });
  }

  // ---------- messages ----------
  let toastTimer = 0;
  function toast(msg, ms = 2600) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), ms);
  }

  // ---------- the menu ----------
  // Play: a new run. Content: the mode (the header's choice) and what the next sprint is made of. Together: the race.
  // About: the bests, and the rules.
  function openMenu() {
    const body = $("menuBody");
    body.replaceChildren();
    const content = part(body, "content");
    if (D || duel?.on) {
      duel.menu(part(body, "together"));
    } else {
      const play = part(body, "play");
      if (prefs.mode !== "daily") play.append(action(run && !run.over && (run.i > 0 || run.used > 0) ? `New ${label(prefs.mode).toLowerCase()}` : `Start the ${label(prefs.mode).toLowerCase()}`,
        () => (phase === "running" ? newRun() : begin()), "primary"));
      const got = (read(KEY.daily, {}) || {})[today()];
      todayPart(body, {
        done: got != null, result: got != null ? String(got) : "", play: () => { switchTo("daily"); begin(); }, playing: prefs.mode === "daily",
        back: prefs.mode === "daily" ? { text: `Back to the ${label(resting).toLowerCase()}`, fn: () => switchTo(resting) } : null,
      });
    }
    if (!D) content.append(mirror("Mode", $("mode")));
    if (P.ranges) content.append(ticks("Sprint operations", P.kinds, prefs.kinds, v => setKinds(v), Infinity, { all: true }));
    else content.append(ticks("Topics", P.kinds, prefs.kinds, v => setKinds(v), Infinity, { all: true }));
    const bests = read(KEY.bests, {}) || {}, about = part(body, "about");
    const top = [["sprint", "Sprint"], ["estimate", "Estimate"], ["chains", "Chains"]].map(([k, t]) => [t, k === "sprint" ? bests[`sprint:${P.range ?? ""}:${ALL.join(",")}`] : bests[k]]).filter(([, v]) => v != null);
    const days = read(KEY.daily, {}) || {};
    about.append(line(top.length ? `Bests: ${top.map(([t, v]) => `${t} ${v}`).join(", ")}${days[today()] != null ? `. Today's: ${days[today()]}` : ""}.` : "No score yet."));
    about.append(action("The rules", showRules, "link"));
    if (!$("menuDlg").open) $("menuDlg").showModal();
  }
  function setKinds(v) {
    prefs.kinds = v.length ? v : ALL;
    keepPrefs();
    refresh();
    if (!v.length) openMenu();                    // none ticked is all: the ticks say so
  }
  /** The start card says what the next sprint is made of: drawn again when the menu changes it. */
  function refresh() { drawnCard = ""; render(); }

  // ---------- the rules, from the engine's own numbers ----------
  function showRules() {
    const pc = x => `${Number((x * 100).toFixed(1))}%`;
    const exact = `<p><b>Exact sums.</b> A plain sum has one right answer, and it goes in by itself the moment you type it. ${P.ranges ? "The menu chooses the operations and how far the numbers reach; they reach further as a run goes on." : "The menu chooses the topics."}</p>`;
    $("rulesBody").innerHTML = `
      <p>${pool === "fuels" ? "The arithmetic of a fuel desk against the clock: barrels and tonnes, energy, carbon intensity, prices and the long chains that join them. The figures are the desk's, written into every sum that uses them." : "Mental arithmetic against the clock: plain sums, then the everyday figures of a shop, a kitchen and a road. Any rate a sum needs is written in it."}</p>
      <p><b>Modes.</b> Sprint, ${MODES.sprint.secs} seconds of one-step sums. Estimate, ${MODES.estimate.secs} seconds of figures typed to one or two significant figures. Chains, ${MODES.chains.secs} seconds of a figure and three steps or more. Today's, ${MODES.daily.secs} seconds of all three, the same for everyone and new at midnight UTC; it counts once.</p>
      ${exact}
      <p><b>Estimates and chains.</b> A significant figure (s.f.) is a digit that carries the size of a number: 4,031 to 2 s.f. is 4,000, and 0.0137 to 1 s.f. is 0.01. A sum that asks for 1 s.f. accepts an answer within ${pc(BAND[1])} of the exact figure, one that asks for 2 s.f. within ${pc(BAND[2])}, or exactly the exact figure rounded to that many. A chain is let off a little more for each step past the third (${pc(chainRel(2, 5))} for five steps at 2 s.f.), since the honest shortcuts pile up. The page says "close enough" when that is what it was, and shows the exact figure after every answer. A figure with a zero too many or too few is wrong, and the page says so.</p>
      <p><b>Score.</b> A sum is worth 1, an estimate or a chain 2 for each step (one more at 2 s.f.). Each ${STREAK_STEP} right in a row adds a point to every answer, up to ${STREAK_MAX}. A wrong answer or a skip ends the streak.</p>
      <p><b>Keys.</b> Tap the pad, or type: digits, the point, Backspace to take one off (hold it to clear), Enter for Go. Go with nothing typed skips the sum. Opening the menu or a sheet stops the clock.</p>
      <p><b>Kept.</b> A run under way is kept for each mode, so leaving or switching modes loses nothing. The best on the games screen is ${headline === "chains" ? "your best chains score" : "your best standard sprint (every operation, to 100)"}; other settings keep their own bests in the menu.</p>
      ${raced ? `<p><b>Together.</b> A race: a sprint of ${MODES.sprint.secs} seconds on the same sums for everyone, the most points winning.</p>` : ""}`;
    if (!$("rulesDlg").open) $("rulesDlg").showModal();
  }

  // ---------- wiring ----------
  const dd = dropdown($("mode"));
  bindSwitcher($("appsBtn"), id);
  const mark = document.querySelector(".mark-icon");
  if (mark) mark.innerHTML = APPS.find(a => a.id === id)?.logo || "";
  $("menuBtn").addEventListener("click", openMenu);
  $("menuClose").addEventListener("click", () => $("menuDlg").close());
  $("rulesClose").addEventListener("click", () => $("rulesDlg").close());
  $("reviewClose").addEventListener("click", () => $("reviewDlg").close());
  $("mode").addEventListener("change", () => switchTo($("mode").value));

  // the pad: a digit goes in as the finger lands (so quick tapping keeps up); a keyboard-activated button clicks with no pointer
  const KEYS = [["7"], ["8"], ["9"], ["del", "⌫"], ["4"], ["5"], ["6"], ["go", "Go"], ["1"], ["2"], ["3"], ["0"], ["."]];
  for (const [k, text] of KEYS) {
    const b = el("button", `sm-key k-${/^\d$/.test(k) ? "d" : k === "." ? "dot" : k}`, text ?? k);
    b.type = "button";
    b.dataset.k = k;
    b.tabIndex = -1;
    b.setAttribute("aria-label", { del: "Delete", go: "Go", ".": "Point" }[k] ?? k);
    $("pad").append(b);
  }
  {
    let hold = 0, held = false;
    $("pad").addEventListener("pointerdown", e => {
      const b = e.target.closest?.(".sm-key");
      if (!b || e.button > 0) return;
      e.preventDefault();
      held = false;
      clearTimeout(hold);
      if (b.dataset.k === "del") hold = setTimeout(() => { held = true; press("clear"); }, 450);
      else press(b.dataset.k);
      b.classList.add("down");
      setTimeout(() => b.classList.remove("down"), 110);
    });
    for (const ev of ["pointerup", "pointerleave", "pointercancel"]) $("pad").addEventListener(ev, e => {
      clearTimeout(hold);
      const b = e.target.closest?.(".sm-key");
      if (ev === "pointerup" && b?.dataset.k === "del" && !held) press("del");
    });
    $("pad").addEventListener("click", e => { const b = e.target.closest?.(".sm-key"); if (b && e.detail === 0) press(b.dataset.k); });
    $("pad").addEventListener("contextmenu", e => e.preventDefault());
  }
  document.addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector("dialog[open]") || e.target.closest?.("input, textarea, select")) return;
    if (phase === "idle" && !watching && (e.key === "Enter" || e.key === " ")) { if (!document.activeElement?.closest?.("button")) { begin(); e.preventDefault(); } return; }
    if (phase !== "running") return;
    if (/^\d$/.test(e.key) || e.key === ".") press(e.key);
    else if (e.key === "," ) press(".");
    else if (e.key === "Backspace") press("del");
    else if (e.key === "Enter") press("go");
    else if (e.key === "Escape") press("clear");
    else return;
    e.preventDefault();
  });
  // the clock: a quarter of a second is as fine as a run needs; a run stands still when the page is away
  setInterval(() => {
    if (watching || phase !== "running" || !run) return;
    if (leftMs() <= 0) { endRun(); return; }
    drawClock();
    if (clockFrom != null && performance.now() - savedAt > SAVE_EVERY) { savedAt = performance.now(); save(); }
  }, 250);
  document.addEventListener("visibilitychange", () => { if (document.hidden) { clockPause(); save(); } else { clockRun(); duel?.resync(); } });
  addEventListener("pageshow", e => { if (e.persisted) duel?.resync(); });
  addEventListener("pagehide", () => { clockPause(); save(); });

  // for tests and debugging
  window[`__${id}`] = { get run() { return run; }, get phase() { return phase; }, get prefs() { return prefs; }, get duel() { return duel; }, begin, press, answer, switchTo, newRun, endRun, explain, showRules, openMenu, refresh, problem: () => (run ? problemAt(run) : null) };

  // start: the mode on the screen, its run where it was left; Today's if the games screen's tile sent us for it
  const solo = (forToday = false) => {
    const under = load("daily"), m = forToday || (under && !under.over && (under.i > 0 || under.used > 0)) ? "daily" : prefs.mode;   // today's run under way is where you land
    if (m !== prefs.mode) setMode(m);
    $("mode").value = prefs.mode;
    dd.sync();
    show(load(prefs.mode));
  };
  const sentForToday = watching ? false : arrivedForToday();
  if (duel?.inAddress) duel.join().then(ok => { if (!ok) solo(sentForToday); });
  else solo(sentForToday);
  return { toast };
}
