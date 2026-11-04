// The stage of Yacht's lessons (course.js draws the words and buttons; yacht-course.js has the steps): the dice lying, a
// roll's caption, and the sheet of boxes with what these dice would score in each (the rules' own scoreOf). Two exercises:
// tap dice to hold them, or tap the box to write the dice in; both are judged when the button under the words is pressed.
import { CATS, scoreOf, totals, BONUS_AT } from "./yacht-rules.js";
import { die } from "./yacht-die.js";
import { IDS, parseDice, maskFor, judgeHold, judgePick } from "./yacht-course.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function yachtStage() {
  let box = null, api = null, step = null, st = null;
  const held = () => (st.held ||= [0, 0, 0, 0, 0]);
  return {
    mount(b, a) {
      box = b;
      api = a;
      box.addEventListener("click", e => {
        if (!step || st.done) return;
        const d = e.target.closest("[data-i]"), c = e.target.closest("[data-c]");
        if (d && step.hold) { held()[Number(d.dataset.i)] ^= 1; api.changed(); }
        else if (c && step.pick) { st.sel = Number(c.dataset.c); api.changed(); }
      });
    },
    task: s => !!(s.hold || s.pick),
    submits: () => true,
    ready: (s, t) => (s.hold ? (t.held || []).some(Boolean) : t.sel != null),
    label: (s, t) => (s.hold ? "Hold these" : t.sel != null ? `Write in ${CATS[t.sel].name}` : "Pick a box"),
    submit(s, t) {
      if (s.hold) {
        const res = judgeHold(s, t.held);
        if (res.ok) t.rolled = true;
        return res;
      }
      return judgePick(s, t.sel);
    },
    hint(s, t) {
      if (s.hold) t.held = maskFor(parseDice(s.dice), parseDice(s.hold));
      else t.sel = IDS.indexOf(s.pick);
    },
    draw(s, t) {
      step = s;
      st = t;
      const parts = [];
      const rolled = t.rolled && s.after;
      const faces = s.dice ? parseDice(rolled ? s.after : s.dice) : null;
      if (faces) {
        const mask = rolled ? maskFor(parseDice(s.dice), parseDice(s.hold)) : held();
        const live = !!s.hold && !t.done;
        const left = rolled ? s.left - 1 : s.left;
        const cap = left === 0 ? "No rolls left" : `${left} ${left === 1 ? "roll" : "rolls"} left`;
        parts.push(`<div class="lc-row"><small>${rolled ? "Rolled" : "The dice"} · ${cap}</small><div class="yc-dice">${faces.map((f, i) => {
          const cls = `ya-die-btn${mask[i] ? " held" : ""}`;
          return live ? `<button type="button" class="${cls}" data-i="${i}" aria-pressed="${!!mask[i]}" aria-label="Die showing ${f}">${die(f)}</button>` : `<span class="${cls}">${die(f)}</span>`;
        }).join("")}</div></div>`);
      }
      if (s.panel || s.pick || s.taken) parts.push(sheetHtml(s, t, faces));
      box.innerHTML = `<div class="lc yc">${parts.join("")}</div>`;
    },
  };
}

/** The boxes: those written (with their score), the open ones with what the dice would score, upper then lower. */
function sheetHtml(s, t, faces) {
  const taken = s.taken || {}, lit = s.panel?.lit || [], pickable = !!s.pick && !t.done;
  const cell = (cat, c) => {
    if (cat.id in taken) return `<span class="yc-box taken"><span class="n">${cat.name}</span><b>${taken[cat.id]}</b></span>`;
    const pts = faces ? scoreOf(c, faces) : null, cls = `yc-box${lit.includes(cat.id) ? " lit" : ""}${t.sel === c ? " sel" : ""}${pts === 0 ? " zero" : ""}`;
    const inner = `<span class="n">${cat.name}</span><b>${pts ?? "·"}</b>`;
    return pickable ? `<button type="button" class="${cls}" data-c="${c}">${inner}</button>` : `<span class="${cls}">${inner}</span>`;
  };
  const col = from => CATS.slice(from, from + 6).map((cat, k) => cell(cat, from + k)).join("");
  const sheet = IDS.map(id => (id in taken ? taken[id] : -1));
  const up = Object.keys(taken).some(id => IDS.indexOf(id) < 6) ? `<p class="yc-upper">Ones to Sixes ${totals(sheet).upper} of ${BONUS_AT}${totals(sheet).bonus ? `: bonus +${totals(sheet).bonus}` : ""}</p>` : "";
  return `<div class="yc-sheet" role="group" aria-label="${esc("Score boxes")}"><div>${col(0)}</div><div>${col(6)}</div></div>${up}`;
}
