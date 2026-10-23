// Slipway's yard, the page's half: the assemblies one after another, a joint chosen by its tag on the 3D ship, what is
// fastened on it with the counts of each fastening under the ship, and the gale sent when it is fastened. The rules are
// slipway-yard.js's, the ship is drawn by slipway-yard-3d.js; slipway.js lends it the strip, the line under the ship and
// the dialogs, and the bench the parts come from.
import { ASSEMBLIES, KINDS, FIXINGS, stock, holdOf, allowed, usedOf, canAdd, fasten, launch, newRun, sound, missing, starsTotal, onJoint } from "./slipway-yard.js";
import { part, action, onPause, isPaused } from "./menu.js";

const FIT = "slipway:fit", FITTED = "slipway:fitted";
const starText = n => "★".repeat(n) + "☆".repeat(3 - n);
const num = v => (Math.round(v * 10) / 10).toFixed(1);
const FIX_NAME = { lash: "Lash", treenail: "Treenail", wedge: "Wedge", pin: "Pin" };

/**
 * The yard's screen. `env`: $ (by id), read and write (the page's keeping), scores() (the bench's parts, by id), sayBest()
 * (the games screen's stars, after a fitting), toast, sound, setMode(name), IN_FRAME.
 */
export function createFit(env) {
  const { $, read, write, scores, toast, sound: play, IN_FRAME } = env;
  let state = { v: 1, open: false, at: 0, runs: {} };
  let view = null, ready = null, marks = null, sending = 0;
  const A = () => ASSEMBLIES[state.at];
  const fitted = () => read(FITTED, {});
  const save = () => write(FIT, state);

  // ---------- the keeping ----------
  {
    const s = read(FIT, null);
    if (s?.v === 1 && ASSEMBLIES[s.at] && typeof s.runs === "object" && s.runs) {
      state = { v: 1, open: !!s.open, at: s.at, runs: {} };
      for (const [id, r] of Object.entries(s.runs)) { const a = ASSEMBLIES.findIndex(x => x.id === id); if (a >= 0 && r.job === a && sound(r)) state.runs[id] = r; }
    }
  }
  /** The run for the assembly in hand (made if it has none). */
  function run() {
    const a = A();
    return (state.runs[a.id] ??= newRun(state.at, (Math.random() * 2 ** 31) >>> 0));
  }
  const open = () => missing(A(), scores()).length === 0;

  // ---------- the 3D ship, made when first wanted ----------
  function ensureView() {
    return (ready ??= import("./slipway-yard-3d.js").then(m => {
      view = m.createYard($("yard"), { onPick: id => { pick(id); } });
      const c = view.canvas, pointers = new Map();
      let last = null, pinch = 0;
      c.addEventListener("pointerdown", e => {
        c.setPointerCapture?.(e.pointerId);
        pointers.set(e.pointerId, [e.clientX, e.clientY]);
        last = [e.clientX, e.clientY];
        if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
      });
      c.addEventListener("pointermove", e => {
        if (!pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, [e.clientX, e.clientY]);
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()], gap = Math.hypot(a[0] - b[0], a[1] - b[1]);
          view.orbit(0, 0, pinch ? gap / pinch : 1);
          pinch = gap;
        } else { view.orbit(e.clientX - last[0], e.clientY - last[1]); last = [e.clientX, e.clientY]; }
      });
      const up = e => { pointers.delete(e.pointerId); last = null; pinch = 0; };
      c.addEventListener("pointerup", up);
      c.addEventListener("pointercancel", up);
      c.addEventListener("wheel", e => { e.preventDefault(); view.orbit(0, 0, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
      c.addEventListener("contextmenu", e => e.preventDefault());
      return view;
    }).catch(err => { console.warn("Slipway: no WebGL here, so no yard.", err); $("noglYard").hidden = false; return null; }));
  }

  // ---------- the screen ----------
  let joint = null;                                            // the joint chosen, by id
  const jointOf = () => A().joints.find(j => j.id === joint) ?? A().joints[0];
  function pick(id) { joint = id; view?.select(id); render(); }

  /** Shows the yard (or, if it's the screen showing, draws it again). */
  async function show() {
    state.open = true;
    save();
    $("bench").hidden = true; $("yard").hidden = false;
    $("benchSide").hidden = true; $("yardSide").hidden = false;
    const v = await ensureView();
    if (!state.open) return;
    if (v) { v.visible = true; v.show(A(), run().fix); v.select(jointOf().id); if (marks) v.mark(marks); }
    render();
  }
  function hide() {
    state.open = false;
    save();
    $("bench").hidden = false; $("yard").hidden = true;
    $("benchSide").hidden = false; $("yardSide").hidden = true;
    if (view) view.visible = false;
  }

  function render() {
    const a = A(), r = run(), sc = scores(), lacks = missing(a, sc), j = jointOf(), kind = KINDS[j.kind], st = stock(sc);
    const best = fitted()[a.id];
    $("partName").textContent = a.name;
    $("partNo").textContent = `${state.at + 1} of ${ASSEMBLIES.length} · the yard`;
    $("partStars").textContent = best ? starText(best) : "";
    // the joint chosen: what it is, what it holds now, what the forecast says
    const i = a.joints.indexOf(j), hold = holdOf(a, j, onJoint(r, j.id), sc);
    if (lacks.length) $("line").innerHTML = `<b>Not yet.</b> Carve ${lacks.map(id => `the ${NAMES[id]}`).join(", ")} first.`;
    else if (r.done) $("line").innerHTML = `<b>Held</b> in ${r.done.tries + 1} gale${r.done.tries ? "s" : ""}: ${starText(r.done.stars)}. Fit it again for more stars.`;
    else $("line").innerHTML = `<b>${i + 1}. ${kind.name}</b> holds <b>${num(hold)}</b> · forecast <b>${num(j.load[0])}–${num(j.load[1])}</b><br>${kind.why}`;
    $("fixes").innerHTML = FIXINGS.map(f => {
      const ok = allowed(j, f.id) && !lacks.length && !r.done, n = onJoint(r, j.id)[f.id] ?? 0;
      const left = f.id === "lash" ? "free" : `${st[f.id] - usedOf(r, f.id)} left`;
      const v = KINDS[j.kind].value[f.id];
      return `<div class="sw-fix${allowed(j, f.id) ? "" : " no"}" data-fix="${f.id}"><span class="sw-fix-name">${FIX_NAME[f.id]}</span>`
        + `<span class="sw-fix-do"><button type="button" class="sw-step" data-d="-1" aria-label="Take a ${f.name.toLowerCase()} off" ${ok && n > 0 ? "" : "disabled"}>−</button><b>${allowed(j, f.id) ? n : "–"}</b><button type="button" class="sw-step" data-d="1" aria-label="Put a ${f.name.toLowerCase()} on" ${ok && canAdd(a, r, j.id, f.id, sc) ? "" : "disabled"}>+</button></span>`
        + `<small>${allowed(j, f.id) ? `${num(v)} · ${left}` : "not here"}</small></div>`;
    }).join("");
    $("yardActs").innerHTML = `<button type="button" class="btn sw-act" data-go="-1" aria-label="The assembly before">◀</button>`
      + (r.done ? `<button type="button" class="btn sw-act sw-wide" data-act="again">Fit it again</button>` : `<button type="button" class="btn primary sw-act sw-wide" data-act="gale" ${lacks.length || sending ? "disabled" : ""}>Send the gale</button>`)
      + `<button type="button" class="btn sw-act" data-go="1" aria-label="The assembly after">▶</button>`;
  }

  // ---------- taps ----------
  $("fixes").addEventListener("click", e => {
    const b = e.target.closest("[data-d]");
    if (!b || b.disabled || IN_FRAME || sending) return;
    const id = b.closest("[data-fix]").dataset.fix, r = run(), j = jointOf();
    if (!fasten(A(), r, j.id, id, Number(b.dataset.d), scores())) return;
    play(id === "pin" ? "chisel" : "plane");
    marks = null;
    view?.mark(null);
    view?.mend();
    view?.fasten(r.fix);
    save();
    render();
  });
  $("yardActs").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b || b.disabled || IN_FRAME || sending) return;
    if (b.dataset.go) { go(state.at + Number(b.dataset.go)); return; }
    if (b.dataset.act === "again") { delete state.runs[A().id]; marks = null; save(); redo(); return; }
    if (b.dataset.act === "gale") send();
  });
  /** Another assembly (round the ring of them). */
  function go(to) {
    state.at = (to + ASSEMBLIES.length) % ASSEMBLIES.length;
    joint = null;
    marks = null;
    save();
    redo();
  }
  function redo() { view?.mend(); view?.show(A(), run().fix); view?.select(jointOf().id); render(); }

  // ---------- the gale ----------
  function send() {
    const a = A(), r = run();
    const result = launch(a, r, scores());
    marks = result.joints;
    sending = 1;
    save();
    render();
    view?.mark(marks);
    play("gale");
    // The verdict is only read with the menu shut: a gale that ends under it waits for it to close.
    const after = () => { sending = 0; if (isPaused()) owed = () => verdict(a, r, result); else verdict(a, r, result); };
    if (view) view.gale(result.joints, after); else after();
  }
  let owed = null;
  onPause(() => {}, () => { const v = owed; owed = null; v?.(); });
  function verdict(a, r, result) {
    const all = fitted();
    if (result.held && result.stars > (all[a.id] ?? 0)) { all[a.id] = result.stars; write(FITTED, all); }
    if (result.held) env.sayBest(starsTotal(scores(), fitted()));
    const names = result.joints.filter(j => !j.ok).map(j => KINDS[a.joints.find(x => x.id === j.id).kind].name.toLowerCase());
    $("galeHead").textContent = result.held ? `${a.name}: ${["", "she'll hold", "well found", "a shipwright's fitting"][result.stars]}` : names.length > 2 ? `The gale took ${names.length} joints` : `The gale took the ${names.join(" and the ")}`;
    $("galeStars").textContent = result.held ? starText(result.stars) : "";
    $("galeBody").innerHTML = result.joints.map((j, i) => `<div class="${j.ok ? "" : "bad"}"><dt>${i + 1}. ${KINDS[a.joints.find(x => x.id === j.id).kind].name}</dt><dd>${num(j.hold)} v ${num(j.load)}</dd></div>`).join("");
    $("galeNote").textContent = result.held
      ? `${result.used} fastening${result.used === 1 ? "" : "s"} used; ${result.par} would have held this gale.${result.stars === 3 ? "" : " Fewer, and fewer gales lost on the way, for more stars."}`
      : `A joint holds if its fastenings, as strong as the weaker timber, are worth more than the gale's load. The next gale is another from the same forecast.`;
    $("galeNext").textContent = result.held ? "Next assembly" : "Fasten it again";
    $("galeNext").dataset.next = result.held ? "go" : "stay";
    if (!$("galeDlg").open) $("galeDlg").showModal();
    render();
  }
  $("galeNext").addEventListener("click", () => {
    $("galeDlg").close();
    if ($("galeNext").dataset.next === "go") go(state.at + 1);
  });
  $("galeAgain").addEventListener("click", () => { $("galeDlg").close(); });

  // ---------- the menu ----------
  function menu(body) {
    part(body, "play").append(action("Back to the bench", () => env.setMode("bench"), "primary"), action("Start this assembly over", () => { delete state.runs[A().id]; marks = null; save(); redo(); }));
    const list = document.createElement("ol"), all = fitted(), sc = scores();
    list.className = "sw-parts";
    ASSEMBLIES.forEach((a, i) => {
      const li = document.createElement("li"), b = document.createElement("button"), lacks = missing(a, sc);
      b.type = "button";
      b.className = i === state.at ? "cur" : "";
      b.innerHTML = `<span>${i + 1}. ${a.name}</span><small>${all[a.id] ? starText(all[a.id]) : lacks.length ? "to carve" : i === state.at ? "in hand" : ""}</small>`;
      b.addEventListener("click", () => { $("menuDlg").close(); go(i); });
      li.append(b);
      list.append(li);
    });
    part(body, "content").append(list);
  }

  if (state.open) setTimeout(() => env.setMode("yard"), 0);
  return {
    get open() { return state.open; },
    show, hide, menu, render,
    /** The bench's scores changed (a part was carved): what is open and how many there are. */
    parts() { if (state.open) render(); },
    get view() { return view; },
    get state() { return state; },
  };
}
const NAMES = { treenail: "treenail", wedge: "wedge", pin: "belaying pin", beam: "deck beam", sheave: "block shell", tiller: "tiller", frame: "frame", yard: "yard", stem: "stem", rudder: "rudder", mast: "masthead" };
