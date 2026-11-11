// Gears on the page (5 November 2026): the controller. It keeps the level in hand and the stars (pipes:train, pipes:trainstars), plays the
// rules of pipes-gear-engine.js through the flat view (pipes-view-2d.js), and draws what is DOM: the hand, the workings strip, the layer
// chips, the status line and the buttons. Placing: tap a tile to hold it, tap it again to turn it, tap a square to lay it (the turn that
// suits the square is taken unless you chose one); or drag a tile (or a laid piece) onto the board with the ghost riding above the finger.
// A laid piece taps round its turns; a long press (or the Lift toggle) takes it back up. Book I (the old levels) never turns.
// The board is one of two views with one interface: the flat SVG (pipes-view-2d.js) or the watch movement (pipes-view-3d.js, three.js, loaded only when
// wanted); the page asks for one with useView(), and where WebGL fails the flat one stays. Everything below touches the board through view.hit and view.project.
import { levelOn } from "./playlog.js";
import { el } from "./pipes-draw.js";
import * as E from "./pipes-gear-engine.js";
import { shapeOf, orientations, kindName, canonRot } from "./pipes-gear-shapes.js";
import { LEVELS, CHAPTERS, BOOKS, sigOf } from "./pipes-gear-book.js";
import { readRuns, readStars } from "./pipes-gear-keep.js";
import { createView, drawShape } from "./pipes-view-2d.js";
import * as F from "./pipes-gear-frac.js";
import { dailySpec, randomSpec } from "./pipes-gear-daily.js";
import { sure } from "./sure.js";
import { tick as tickSound } from "./pipes-sound.js";
import { load3d } from "./loading.js";

const STAR = "★", HOLLOW = "☆";
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const LONG_PRESS = 380, DRAG_PX = 9, LIFT_SQUARES = 1.25;

/** deps: { $, read, write, toast, frame (a partner's watching frame), openMenu, onSolved, reduced (), sound (), tilt () (the case follows the phone) } */
export function createPuzzle(deps) {
  const { $, read, write, toast, frame, openMenu, onSolved, reduced } = deps;
  const KEY = { run: "pipes:train", stars: "pipes:trainstars", daily: "pipes:daily" };
  const indexOf = id => LEVELS.findIndex(l => l.id === id);
  let saved = { v: 2, id: LEVELS[0].id, runs: {} }, stars = {};
  let L = null, laid = [], run = null, index = 0, view = null, spec = null, extra = null;      // extra: today's plate or a random one, in hand instead of a level
  let windMode = null, windTimer = 0, undoStack = [], hint = null, focus = null, looking = false, liftMode = false, drag = null, press = null, last = null, shownFor = "";
  let running = false, jamKey = "", kind = "2d", mod3d = null, crown = 0;

  // ---------- keeping ----------
  const firstOpen = () => (LEVELS.find(l => !stars[l.id]) || LEVELS[0]).id;
  function load() {
    saved = readRuns(read(KEY.run, null), LEVELS[0].id);
    stars = readStars(read(KEY.stars, {}));
    if (indexOf(saved.id) < 0) saved.id = firstOpen();
  }
  const persist = () => { if (!frame) write(KEY.run, saved); };
  const totalStars = () => Object.entries(stars).reduce((n, [id, s]) => n + (indexOf(id) >= 0 ? s : 0), 0);
  const starsOf = id => stars[id] || 0;
  const store = () => { run.laid = E.packLaid(laid); persist(); };

  // ---------- the level in hand ----------
  function open(id, { fresh = false, plate = null } = {}) {
    clearTimeout(press?.timer); press = null; drag = null; running = false;
    extra = plate;
    for (const k of Object.keys(saved.runs)) if (/^[rd]\d/.test(k) && !(plate && plate.id === k)) delete saved.runs[k];     // yesterday's and other random plates are not kept
    index = plate ? -1 : Math.max(0, indexOf(id));
    spec = plate || LEVELS[index];
    L = E.parseLevel(spec);
    levelOn("pipes", spec.id, plate ? (plate.daily ? `Daily ${plate.daily}` : "Random plate") : `${index + 1} · ${spec.name}`);
    if (!plate) saved.id = spec.id;
    let r = saved.runs[spec.id];
    if (!r || r.sig !== sigOf(spec) || fresh) r = saved.runs[spec.id] = { sig: sigOf(spec), laid: {}, sel: null, selRot: null, lifts: 0, hints: 0, solved: 0 };
    run = r;
    laid = E.unpackLaid(L, run.laid);
    clearTimeout(windTimer); windMode = null; crown = 0;
    undoStack = []; hint = null; jamKey = ""; focus = null; looking = false; liftMode = false;
    persist();
  }
  const handNow = () => E.handLeft(L, laid);
  const sel = () => (run.sel && (handNow()[run.sel] || 0) > 0 ? run.sel : null);
  const turnable = kind => L.rotate && orientations(kind).length > 1;
  const kindOfKey = key => (key.includes("@") ? E.pieceOf(key).kind : key);
  const layered = () => spec.v && (L.trains.some(t => t.barrel.l !== 1 || t.sink.l !== 1) || Object.keys(L.hand).some(k => shapeOf(kindOfKey(k), 0).layers[1] > 1) || L.cap.some(x => x > 0 && x < 3));

  // ---------- drawing ----------
  function ensureView() {
    if (view && view.kind === kind) {
      if (shownFor !== L.id) { view.setLevel(E.planOf(L)); shownFor = L.id; }
      return;
    }
    view?.dispose();
    view = null;
    if (kind === "3d" && mod3d) {
      try {
        view = mod3d.createView({ board: $("board"), onGesture: onBoardDown, onLost: lost });
        if (deps.tilt?.()) view.deviceTilt(true, true);         // asked for before: only listen (iOS keeps its permission for the visit)
      } catch (err) { console.warn("Gears: no 3D here.", err); view = null; kind = "2d"; toast("This browser can't draw 3D."); }
    }
    view ||= createView({ board: $("board"), onGesture: onBoardDown });
    view.setLevel(E.planOf(L));
    shownFor = L.id;
  }
  /** The movement (3D) or the flat plate. Where WebGL is not there the flat plate stays; returns the view now showing. */
  async function useView(want3d) {
    if (want3d && mod3d === null) { try { mod3d = await load3d(import("./pipes-view-3d.js")); } catch (err) { console.warn("Gears: 3D did not load.", err); mod3d = false; } }
    const next = want3d && mod3d ? "3d" : "2d";
    if (next === kind && view) return kind;
    kind = next; shownFor = "";
    view?.dispose(); view = null;
    if (L) { ensureView(); const res = render(); if (run.solved && res.solved) view.runNow?.(); }
    return kind;
  }
  /** The graphics card dropped the picture: the flat plate takes over (the player's choice is not changed). */
  function lost() { toast("The 3D view stopped: showing the flat plate."); setTimeout(() => useView(false), 0); }
  function draw(extra = {}) {
    ensureView();
    const f = E.frameOf(L, laid, { hint, focus, look: looking, state: crown, ...extra });
    f.solved = !!run.solved && f.res.solved;           // a level is only seen turning once it has been finished here
    // 9 Nov 2026, Korbi: "mechanical watch levels should have a wind button. winding a spring before it is connected to the escapement should rapidly unwind; once connected, it should
    // tick tock." Wind borrows the solved run: connected (an escape wheel meeting its goal) it runs at the going pace and the escapement ticks; not connected it spins ten times
    // faster with the escapement still, and stops.
    // 9 Nov 2026, Korbi: "if the watch isn't wound and mechanical, it shouldn't move. When wound, it should spin out, unless it's connected to an escapement, in which case the escapement
    // should start visibly working and the whole gear train jumps one second at a time." A mechanical level rests until Wind is pressed (`still`).
    // 11 Nov 2026, Korbi: in a mechanical movement no wheel shows its turn until it is wound (`blind`): the parity is reasoned, not watched
    if (mechanical()) { f.still = !windMode; f.solved = !!windMode; f.blind = !windMode; }
    if (windMode) { f.solved = true; if (windMode === "unwind") { f.unwind = true; f.T0 /= 10; } }
    last = f;
    view.draw(f);
    return f;
  }
  function render() {
    const f = draw();
    drawHand();
    drawWorkings(f.res);
    drawLayers();
    // 9 Nov 2026, Korbi: the "wants ×11/2" chips over the wheels are "quite distracting, middle of the screen": the workings strip says the same, so they show in Look only
    $("board").classList.toggle("show-chips", looking);
    drawText(f.res);
    return f.res;
  }
  /** One tile: a kind (or kind@rot) at the turn it will be laid in. */
  function tileFor(key) {
    const kind = kindOfKey(key), rot = key.includes("@") ? E.pieceOf(key).rot : (key === run.sel && run.selRot !== null ? run.selRot : 0);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pi-q pi-h";
    const svg = el("svg", { viewBox: "-3 -3 66 66", "aria-hidden": "true" });
    const sh = shapeOf(kind, rot);
    if (sh) drawShape(svg, sh, { pips: layered() });
    b.append(svg);
    b.dataset.key = key;
    const top = sh.wheels[sh.ports[0]?.w ?? 0];
    b.dataset.m = top.m;
    b.dataset.l = sh.layers[1];
    // 9 Nov 2026, Korbi: "sometimes it's unclear whether the level allows turning or not." A tile that turns carries ↻ (a single wheel has no turn, and Book I never turns).
    if (turnable(kind) && !key.includes("@")) { const t = document.createElement("i"); t.className = "pi-turn"; t.textContent = "↻"; t.setAttribute("aria-hidden", "true"); b.append(t); }
    // 9 Nov 2026, Korbi: "when there are multiple levels due to arbors, it's not very clear which part on the menu goes to what level on the watch. selecting 1/2/3 should make this obvious."
    // Every tile of a layered plate names the layers its wheels stand on, and a layer picked below dims the tiles that have no wheel on it.
    if (layered()) {
      const ls = [...new Set(sh.wheels.map(w => w.l))].sort(), tag = document.createElement("i");
      tag.className = "pi-lay";
      tag.textContent = ls.join("·");
      b.append(tag);
      b.dataset.on = ls.join("");
      if (focus) b.classList.add(ls.includes(focus) ? "lay-on" : "lay-off");
    }
    return b;
  }
  function drawHand() {
    const q = $("queue"), left = handNow(), cur = sel(), keys = E.handKinds(L);
    q.className = `pi-queue pi-hand${keys.length > 8 ? " many wrap" : keys.length > 6 ? " many" : ""}`;
    const label = document.createElement("span");
    label.className = "pi-q-label";
    label.textContent = "Hand";
    const tiles = keys.map(k => {
      const b = tileFor(k);
      b.classList.toggle("sel", cur === k);
      b.classList.toggle("none", !left[k]);
      b.disabled = !!run.solved;
      const n = document.createElement("b");
      n.className = "pi-n";
      n.textContent = left[k];
      b.append(n);
      b.setAttribute("aria-label", `${kindName(kindOfKey(k))}, ${left[k]} left`);
      b.setAttribute("aria-pressed", cur === k ? "true" : "false");
      b.addEventListener("pointerdown", e => onTileDown(e, k));
      b.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(k); } });
      return b;
    });
    q.replaceChildren(label, ...tiles);
  }

  /** The workings strip: for each train its barrel, the steps that change the speed, the stations and the sink with what it has and wants. */
  function drawWorkings(res) {
    const box = $("workings");
    box.hidden = !spec.v;
    if (!spec.v) return box.replaceChildren();
    const rows = E.workings(L, res).map(t => {
      const row = document.createElement("div");
      row.className = "pi-work";
      const tag = document.createElement("b");
      tag.className = `pi-w-id m${L.trains[t.index].barrel.m}`;
      tag.textContent = t.id;
      row.append(tag);
      for (const it of t.items) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `pi-w ${it.type}${it.comp ? ` ${it.comp.status}` : ""}`;
        if (it.type === "barrel") chip.textContent = `⟳ ${it.n}`;
        else if (it.type === "step") chip.textContent = `×${F.fmt(it.factor, true)}`;
        else {
          const cm = it.comp, w = cm?.want ? `×${F.fmt(cm.want, true)}` : "turn";
          chip.textContent = !cm ? "●" : cm.status === "ok" ? `✓ ${w}` : cm.status === "wrong" ? "wrong way" : cm.status === "off" || !cm.has ? `wants ${w}` : `×${F.fmt(cm.has, true)} → ${w}`;
          if (it.type === "station" && it.factor) chip.textContent = `×${F.fmt(it.factor, true)} · ${chip.textContent}`;
        }
        if (it.c !== undefined) chip.addEventListener("click", () => view.pulse?.(it.c));
        row.append(chip);
      }
      return row;
    });
    box.style.setProperty("--rows", rows.length);
    box.replaceChildren(...rows);
  }
  const mechanical = () => spec.power === "mech" || (!!spec.v && !spec.power && (L.trains.some(t => ["escape", "tourbillon"].includes(t.sink.goal?.type)) || spec.pins?.some(p => p.goal?.type === "escape")));
  /** The Wind button of a mechanical movement. */
  function wind() {
    if (frame || running || !last) return;
    const ok = !!run.solved || (last.res.comps || []).some(c => c.type === "escape" && c.status === "ok") || (last.res.comps || []).some(c => c.type === "tourbillon" && c.status === "ok");
    windMode = ok ? "tick" : "unwind";
    clearTimeout(windTimer);
    render();
    view.runNow?.();
    if (!ok) for (let i = 0; i < 6; i++) setTimeout(() => sound(0.5 - i * 0.05), i * 110);
    windTimer = setTimeout(() => { windMode = null; render(); }, ok ? 9000 : 1700);
  }
  function drawLayers() {
    const box = $("layers"), on = !!spec.v;
    box.hidden = !on;
    if (!on) return;
    const chips = [];
    if (layered()) {
      for (const [v, text] of [[null, "All"], [1, "1"], [2, "2"], [3, "3"]]) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `pi-layer${focus === v ? " now" : ""}`;
        b.textContent = text;
        b.setAttribute("aria-label", v ? `Show layer ${v}` : "Show every layer");
        b.addEventListener("click", () => { focus = v; hint = null; render(); });
        chips.push(b);
      }
      const label = document.createElement("small");
      label.textContent = "Layers";
      chips.unshift(label);
    }
    const turns = document.createElement("small");
    turns.className = "pi-turns";
    turns.textContent = L.rotate ? (mechanical() ? "↻" : "↻ Turn") : "No turning";
    chips.push(turns);
    if (L.clutch) {
      // 11 Nov 2026: the keyless works. The crown pushed in winds the barrel, pulled out it sets the hands; the same layout must run both ways
      const k = document.createElement("button");
      k.type = "button";
      k.className = `pi-layer pi-crown${crown ? " now" : ""}`;
      k.textContent = crown ? "Crown out" : "Crown in";
      k.setAttribute("aria-label", crown ? "The crown is pulled out, setting the hands: push it in" : "The crown is pushed in, winding: pull it out");
      k.addEventListener("click", () => { crown = 1 - crown; hint = null; render(); });
      chips.push(k);
    }
    if (mechanical()) {
      const w = document.createElement("button");
      w.type = "button";
      w.className = "pi-layer pi-wind";
      w.textContent = "Wind";
      w.setAttribute("aria-label", "Wind the mainspring");
      w.addEventListener("click", wind);
      chips.push(w);
    }
    const lookB = $("pzLook");
    lookB.hidden = false;
    lookB.textContent = looking ? "Done" : "Look";
    lookB.setAttribute("aria-pressed", looking ? "true" : "false");
    box.replaceChildren(...chips, lookB);
  }

  const WORD = ["clockwise", "counter-clockwise"];
  function textOf(res) {
    const left = res.left;
    if (run.solved) return `${spec.name} runs · ${STAR.repeat(run.solved)}${HOLLOW.repeat(3 - run.solved)}`;
    if (hint?.wrong?.length) return "The red squares aren't in an answer: lift those pieces";
    if (hint) return hint.done ? "Hint: nothing is left to lay" : "Hint: this piece goes in the dashed square, as drawn";
    if (res.messages.length && res.placed) return res.messages[0];
    if (!res.placed) {
      const ch = CHAPTERS.find(c => c.key === spec.chapter);
      return !extra && LEVELS.findIndex(l => l.chapter === spec.chapter) === index ? `${ch.name}: ${ch.rule}` : L.spare ? `${spec.name}: ${plural(L.total, "piece")} in the tray, more than the movement needs` : `${spec.name}: lay all ${plural(L.total, "piece")}`;
    }
    const cur = sel();
    if (left) return `${cur ? `Tap a square for the ${kindName(kindOfKey(cur)).split(",")[0]}${turnable(kindOfKey(cur)) ? " (tap the tile to turn it)" : ""}` : "Pick a piece from the hand"} · ${plural(left, "piece")} ${L.spare ? "in the tray" : "to lay"}`;
    return "";
  }
  function drawText(res) {
    $("status").textContent = textOf(res);
    $("stat1Label").textContent = extra ? (extra.daily ? "Today" : "Random") : "Level"; $("stat1").textContent = extra ? extra.chapter[0].toUpperCase() + extra.chapter.slice(1) : String(index + 1);
    $("stat3Label").textContent = L.spare ? "In tray" : "To lay"; $("stat3").textContent = run.solved ? "✓" : String(res.left);
    $("stat3").className = run.solved ? "met" : "";
    $("scoreLabel").textContent = "Stars";
    $("score").textContent = `${totalStars()}${STAR}`;
    const solved = !!run.solved;
    $("puzzleControls").classList.toggle("done", solved);
    $("pzUndo").hidden = solved; $("pzClear").hidden = solved; $("pzHint").hidden = solved;
    $("pzAgain").hidden = !solved; $("pzNext").hidden = !solved;
    $("pzLift").hidden = solved || !L.rotate;
    $("pzLift").setAttribute("aria-pressed", liftMode ? "true" : "false");
    $("pzLift").classList.toggle("on", liftMode);
    $("pzUndo").disabled = !undoStack.length;
    $("pzClear").disabled = !res.placed;
    $("pzNext").textContent = extra?.random ? "Another plate" : extra ? "The levels" : index + 1 < LEVELS.length ? "Next level" : "The levels";
  }

  // ---------- playing ----------
  const snap = () => { undoStack.push({ laid: laid.slice(), lifts: run.lifts, sel: run.sel, selRot: run.selRot }); if (undoStack.length > 300) undoStack.shift(); };
  const sound = pitch => { if (deps.sound?.()) tickSound(pitch); };
  function choose(k) {
    if (frame || run.solved) return;
    hint = null;
    if (sel() === k) {
      // the held tile again: turn it a quarter (through its distinct turns); a piece that has none puts it down
      const kind = kindOfKey(k);
      if (turnable(kind) && !k.includes("@")) {
        const os = orientations(kind), at = os.indexOf(canonRot(kind, run.selRot ?? 0));
        run.selRot = os[(at + 1) % os.length];
      } else run.sel = null;
    } else { run.sel = k; run.selRot = null; }
    persist();
    render();
  }
  /** The turn a piece of hand key `key` would be laid in on square c: the one chosen, or the one that suits the square. */
  const rotFor = (key, c) => (key.includes("@") ? E.pieceOf(key).rot : run.selRot !== null && key === run.sel ? run.selRot : E.bestTurn(L, laid, c, key));
  function layAt(c, key, rot) {
    const here = laid[c];
    snap();
    const r = E.lay(L, laid, c, key, rot);
    if (r === "swapped") run.lifts++;
    if (r === "laid" || r === "swapped") {
      if (r === "swapped") { run.sel = E.keyOf(L, here); run.selRot = L.rotate ? E.pieceOf(here).rot : null; }
      else { run.selRot = null; if (!(handNow()[key] > 0)) run.sel = null; }
      return true;
    }
    undoStack.pop();
    if (r === "click") toast("A click takes a single wheel only", 1600);
    else if (r === "ceiling") toast("A bridge is too low for that piece", 1600);
    return false;
  }
  function afterMove() {
    store();
    const res = render();
    const key = res.jams.join(",") + "|" + res.clashes.length;
    if (key !== "|0" && key !== jamKey) { sound(0.42); setTimeout(() => sound(0.34), 90); }
    jamKey = key;
    if (res.solved) solved(res);
  }
  function tap(c) {
    if (frame || run.solved || running) return;
    hint = null;
    if (L.fixed[c] || !L.cap[c]) return void render();
    const cur = sel(), here = laid[c];
    // 9 Nov 2026, Korbi: "in levels that allow turning, sometimes left clicking something doesn't turn it after putting it down." A tile of the same kind still held used to
    // swap with the laid piece (a no-op to the eye); the same kind turns it, only another kind swaps.
    const same = !!here && L.rotate && cur === E.keyOf(L, here);
    if (cur && here !== cur && !same) {
      if (!layAt(c, cur, rotFor(cur, c))) return void render();
    } else if (here) {
      const { kind } = E.pieceOf(here);
      snap();
      if (turnable(kind) && !liftMode) {
        E.turn(L, laid, c);
        run.lifts++;
      } else {
        E.lift(L, laid, c);
        run.lifts++;
        run.sel = E.keyOf(L, here); run.selRot = L.rotate ? E.pieceOf(here).rot : null;
      }
    } else {
      const keys = E.handKinds(L).filter(k => (handNow()[k] || 0) > 0);
      if (keys.length === 1) { run.sel = keys[0]; run.selRot = null; return tap(c); }
      toast("Pick a piece from the hand first", 1400);
      return void render();
    }
    afterMove();
  }
  /** Takes the piece on c back up into the hand (a long press). */
  function liftAt(c) {
    if (frame || run.solved || !laid[c]) return;
    snap();
    const had = E.lift(L, laid, c);
    run.lifts++;
    run.sel = E.keyOf(L, had); run.selRot = L.rotate ? E.pieceOf(had).rot : null;
    hint = null;
    if (navigator.vibrate) try { navigator.vibrate(12); } catch { /* none */ }
    afterMove();
  }
  function undo() {
    if (frame || run.solved || !undoStack.length) return;
    const s = undoStack.pop();
    laid = s.laid; run.lifts = s.lifts; run.sel = s.sel; run.selRot = s.selRot; hint = null;
    store();
    render();
  }
  function clearAll() {
    if (frame || run.solved || !laid.some(Boolean)) return;
    snap();
    laid = E.emptyLaid(L); run.sel = null; run.selRot = null; hint = null;
    store();
    render();
  }
  function solved(res) {
    run.solved = E.starsFor(L, run);
    if (extra?.daily) { const days = read(KEY.daily, {}) || {}; if (!(days[extra.daily] >= run.solved) && !frame) write(KEY.daily, { ...days, [extra.daily]: run.solved }); }
    else if (!extra && run.solved > starsOf(L.id)) { stars[L.id] = run.solved; if (!frame) write(KEY.stars, stars); }
    store();
    onSolved?.(run.solved);
    if (reduced()) { view.setMotion(false); render(); view.setMotion(true); return; }
    running = true;
    render();
    view.onTick = (k, total) => { sound(k <= total - 2 ? 1 + (k % 2) * 0.12 : 0.7); };
    view.animate({ type: "run" }, () => { running = false; });
  }
  async function giveHint() {
    if (frame || run.solved || running) return;
    if (!run.hints && !(await sure("A hint caps this level at one star. Show one?", { yes: "Hint" }))) return;
    hint = E.hintFor(L, laid);
    if (!hint) return;
    run.hints++;
    persist();
    render();
  }
  function again() { if (frame) return; open(L.id, { fresh: true, plate: extra }); ensureView(); render(); }
  function next() {
    if (frame) return;
    if (extra?.random) return void goRandom();
    if (extra) return go(saved.id);
    if (index + 1 >= LEVELS.length) return openMenu();
    go(LEVELS[index + 1].id);
  }
  function go(id) {
    open(id);
    ensureView();
    const res = render();
    if (run.solved && res.solved) { view.runNow?.(); }
  }
  /** Today's plate (the same for everyone), or a random one. Not kept as the level in hand: the levels come back with the menu. */
  async function goDaily(day) {
    const plate = await dailySpec(day);
    open(plate.id, { plate }); ensureView(); render();
    if (run.solved) view.runNow?.();
  }
  async function goRandom() {
    const plate = await randomSpec((Math.random() * 1e9) >>> 0, Object.keys(stars).length);
    open(plate.id, { plate, fresh: true }); ensureView(); render();
  }
  function look() { looking = !looking; hint = null; render(); }
  function toggleLift() { liftMode = !liftMode; render(); }

  // ---------- fingers: a drag from the hand, a drag of a laid piece, a long press ----------
  /** How far a square stands up the screen: the 3D plate leans back (and a tall case is turned a quarter), so the taller of a column's and a row's step. */
  const squarePx = () => {
    const [x0, y0] = view.project(0), [x1, y1] = view.project(Math.min(1, L.size - 1)), [x2, y2] = view.project(Math.min(L.cols, L.size - 1));
    const up = Math.max(Math.abs(y1 - y0), Math.abs(y2 - y0));
    void x1; void x2; void x0;
    return view.kind === "3d" ? Math.max(up, 36) : up || 48;
  };
  function beginDrag(key, rot, e) {
    drag = { key, rot, sq: squarePx(), at: null, moved: false };
    hint = null;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    void e;
  }
  function ghostFor(e, d = drag) {
    const hit = view.hit(e.clientX, e.clientY - d.sq * LIFT_SQUARES);
    if (!hit || hit.kind !== "cell") return null;
    const c = hit.c;
    if (L.fixed[c] || !L.cap[c]) return { c, ok: false, none: true };
    const rot = rotFor(d.key, c), kind = kindOfKey(d.key);
    const test = laid.slice();
    const tmp = E.pieceFor(L, d.key, rot);
    test[c] = tmp;
    const M = E.mesh(L, test), bad = M.jam.size + M.clash.length + M.tangle.length;
    return { c, kind, rot, ok: !bad };
  }
  function onMove(e) {
    if (!drag) return;
    if (!drag.moved && drag.start && Math.hypot(e.clientX - drag.start[0], e.clientY - drag.start[1]) < DRAG_PX) return;
    drag.moved = true;
    const g = ghostFor(e), tag = g ? `${g.c}.${g.rot}.${g.ok}` : "";
    if (tag === drag.tag) return;
    drag.tag = tag; drag.at = g && !g.none ? g : null;
    draw({ ghost: drag.at });
  }
  function onUp(e) {
    const d = drag;
    endDrag();
    if (!d) return;
    if (!d.moved) return;
    const g = ghostFor(e, d);
    if (g && !g.none && layAt(g.c, d.key, g.rot)) { hint = null; if (d.from !== undefined) undoStack.splice(-1, 1); }   // a move is one undo
    else if (d.from !== undefined) undoStack.pop(), laid = d.before, run.lifts = d.lifts;     // a lifted piece dropped nowhere goes back
    afterMove();
  }
  function onCancel() { const d = drag; endDrag(); if (d?.from !== undefined) { laid = d.before; run.lifts = d.lifts; } render(); }
  function endDrag() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    drag = null;
  }
  /** A pointer down on a tile in the hand: a tap holds it (or turns it), a drag carries it. */
  function onTileDown(e, key) {
    if (frame || run.solved || e.button > 0) return;
    if (!(handNow()[key] > 0)) return;
    e.preventDefault();
    const start = [e.clientX, e.clientY];
    const wasSel = sel() === key;
    ensureView();
    beginDrag(key, 0, e);
    drag.start = start; drag.wasSel = wasSel;
    // the first move past the threshold makes it a drag; letting go before is a tap
    const up = () => {
      window.removeEventListener("pointerup", up, true);
      if (!drag) return;
      if (!drag.moved) { endDrag(); choose(key); }
    };
    window.addEventListener("pointerup", up, true);
  }
  /** A pointer down on the board (from the view): a tap, a long press that lifts, or a drag of a laid piece. */
  function onBoardDown(g) {
    if (g.type === "cancel") {                                    // a second finger came down: the camera's, not the game's
      if (press) { press.done = true; clearTimeout(press.timer); }
      if (drag) onCancel();
      return;
    }
    if (g.type !== "down") return;
    if (frame || run.solved || running) return;
    const hit = view.hit(g.clientX, g.clientY);
    if (!hit || hit.kind !== "cell") { if (sel()) { run.sel = null; run.selRot = null; persist(); render(); } return; }
    const c = hit.c, start = [g.clientX, g.clientY], mine = !!laid[c];
    press = { c, start, done: false, timer: 0 };
    const clear = () => { clearTimeout(press?.timer); window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cn); };
    const mv = e => {
      if (!press || press.done) return;
      if (Math.hypot(e.clientX - start[0], e.clientY - start[1]) < DRAG_PX) return;
      press.done = true; clearTimeout(press.timer);
      if (!mine) return;
      // a laid piece dragged off: it is lifted and carried (a move counts as a correction)
      const had = laid[c], before = laid.slice(), lifts = run.lifts;
      snap();
      E.lift(L, laid, c);
      run.lifts++;
      run.sel = E.keyOf(L, had); run.selRot = L.rotate ? E.pieceOf(had).rot : null;
      beginDrag(run.sel, run.selRot ?? 0, e);
      drag.from = c; drag.before = before; drag.lifts = lifts; drag.moved = true;
      onMove(e);
    };
    const up = () => { const p = press; clear(); if (p && !p.done) { p.done = true; tap(c); } };
    const cn = () => clear();
    press.timer = setTimeout(() => { if (press && !press.done) { press.done = true; clear(); if (mine) liftAt(c); } }, LONG_PRESS);
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cn);
  }

  // ---------- the levels, in the menu ----------
  function levelList(onPick) {
    const all = document.createElement("div");
    all.className = "pi-levels";
    for (const book of BOOKS) {
      const bh = document.createElement("h3");
      bh.className = "pi-book";
      bh.textContent = `Book ${book.key}: ${book.name}`;
      all.append(bh);
      CHAPTERS.filter(ch => ch.book === book.key).forEach(ch => {
        const head = document.createElement("h4"), grid = document.createElement("div");
        head.className = "pi-chap";
        head.textContent = ch.name;
        grid.className = "pi-lgrid";
        LEVELS.forEach((l, n) => {
          if (l.chapter !== ch.key) return;
          const b = document.createElement("button"), won = starsOf(l.id);
          b.type = "button";
          b.className = `pi-lv${won ? " done" : ""}${l.id === saved.id ? " now" : ""}`;
          b.setAttribute("aria-label", `Level ${n + 1}, ${l.name}${won ? `, ${plural(won, "star")}` : ""}`);
          if (l.id === saved.id) b.setAttribute("aria-current", "true");
          const num = document.createElement("b"), st = document.createElement("small");
          num.textContent = String(n + 1);
          st.textContent = won ? STAR.repeat(won) + HOLLOW.repeat(3 - won) : HOLLOW.repeat(3);
          b.append(num, st);
          b.addEventListener("click", () => onPick(l.id));
          grid.append(b);
        });
        all.append(head, grid);
      });
    }
    return all;
  }

  load();
  return {
    show() { $("queue").hidden = false; $("board").hidden = false; $("workings").hidden = false; shownFor = ""; view?.dispose(); view = null; go(saved.id); },
    hide() { $("queue").hidden = true; $("board").hidden = true; $("workings").hidden = true; $("layers").hidden = true; view?.stop?.(); },
    pause() { view?.stop?.(); running = false; },
    resume() { view?.resume?.(); if (run?.solved && last?.solved) view?.runNow?.(); },
    resize() { if (last) view?.draw(last); },
    useView, get viewKind() { return kind; },
    look, toggleLift, levelList, go, goDaily, goRandom, again, next, undo, clear: clearAll, hint: giveHint, tap,
    get id() { return saved.id; },
    get level() { return spec; },
    get isDaily() { return !!extra?.daily; },
    get isPlate() { return !!extra; },
    dailyStars: day => (read(KEY.daily, {}) || {})[day] || 0,
    get index() { return index; },
    get run() { return run; },
    get stars() { return stars; },
    get laid() { return laid; },
    get res() { return last?.res; },
    get view() { return view; },
    firstOpen, totalStars,
    count: LEVELS.length,
    solvedCount: () => LEVELS.filter(l => stars[l.id]).length,
  };
}
