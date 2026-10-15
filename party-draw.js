// What Party's drawing games draw with (Sketch, Whispers, Forger, Gallery): a square of paper drawn on with a finger, in
// a few inks and three pens, and the same drawing on the other phones as it's drawn. A drawing travels as a short
// string: each stroke its ink and its pen, then its points on a grid of 1,024 a side, the first in four characters and
// each after it as its step from the one before, in two characters where the step is short (most are) and five where
// it isn't; the strokes joined by full stops. A minute and a half of drawing is a few kilobytes, small enough to send
// as it's drawn and for a game to keep a round's worth in the table. Pages for screens kept between redraws (party.js
// gives a game marked keepsView the same stage each time), so the pad under a finger and the box being typed in aren't
// rebuilt by the others' moves; and the matching of a typed guess to its answer.
import { h } from "./party-kit.js";

export const GRID = 1024;
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const VAL = Object.fromEntries([...B64].map((c, i) => [c, i]));
/** The paper, the same on every phone whatever its theme (a drawing is the same drawing everywhere): the eraser is its ink. */
export const PAPER = "#FFFDF6";
/** The inks, by their place in a stroke's first character. */
export const INKS = [
  { name: "Black", hex: "#25211D" }, { name: "Red", hex: "#D3392E" }, { name: "Orange", hex: "#EE8A22" },
  { name: "Yellow", hex: "#F2C21B" }, { name: "Green", hex: "#3E9A47" }, { name: "Sky blue", hex: "#45A6DD" },
  { name: "Blue", hex: "#2C5CB7" }, { name: "Purple", hex: "#7C4AAF" }, { name: "Pink", hex: "#E777A6" },
  { name: "Brown", hex: "#8A5A2F" }, { name: "Grey", hex: "#8D8983" }, { name: "Eraser", hex: PAPER },
];
export const ERASER = INKS.length - 1;
/** The pens' widths in the grid's units: fine, medium, broad. */
export const PENS = [7, 18, 44];
const MAX_TEXT = 40000;              // a page's limit (a long, busy drawing is under ten thousand)
const STEP = 3;                      // a point closer than this to the last one taken adds nothing a finger meant
const TOLERANCE = 1.6;               // how far a simplified stroke may stray from the finger's path

// ---------- a drawing as text ----------
const two = n => B64[n >> 6] + B64[n & 63];
const clamp = n => Math.max(0, Math.min(GRID - 1, Math.round(n)));
/** A stroke ({ c: ink, w: pen, p: [x0, y0, x1, y1, …] }) as its characters. */
export function strokeText({ c, w, p }) {
  let out = B64[c] + B64[w];
  for (let i = 0; i < p.length; i += 2) {
    const dx = p[i] - p[i - 2], dy = p[i + 1] - p[i - 1];
    // value 0 never begins a short step (a step of -31…31 is written as 1…63), so it marks a point written in full
    out += i && Math.abs(dx) <= 31 && Math.abs(dy) <= 31 ? B64[dx + 32] + B64[dy + 32] : `${i ? "A" : ""}${two(p[i])}${two(p[i + 1])}`;
  }
  return out;
}
/** Strokes as a drawing's text. */
export const encode = strokes => strokes.filter(s => s.p.length >= 2).map(strokeText).join(".");
/** A drawing's strokes from its text. It came from another phone, so anything it can't read is left out, not thrown. */
export function decode(text) {
  const out = [];
  for (const part of String(text || "").split(".")) {
    const s = readStroke(part);
    if (s) out.push(s);
  }
  return out;
}
function readStroke(t) {
  const v = i => VAL[t[i]];
  const c = v(0), w = v(1);
  if (c === undefined || w === undefined || c >= INKS.length || w >= PENS.length) return null;
  const p = [];
  let i = 2;
  const whole = () => {
    const d = [v(i), v(i + 1), v(i + 2), v(i + 3)];
    if (d.some(x => x === undefined)) return false;
    p.push(clamp((d[0] << 6) | d[1]), clamp((d[2] << 6) | d[3]));
    i += 4;
    return true;
  };
  if (!whole()) return null;
  while (i < t.length) {
    const a = v(i);
    if (a === 0) { i++; if (!whole()) break; continue; }
    const b = v(i + 1);
    if (a === undefined || b === undefined) break;
    p.push(clamp(p.at(-2) + a - 32), clamp(p.at(-1) + b - 32));
    i += 2;
  }
  return { c, w, p };
}

/**
 * Fewer points for the same line (Ramer–Douglas–Peucker): a point stays only where leaving it out would take the line
 * further than `tol` from where the finger went.
 */
export function simplify(p, tol = TOLERANCE) {
  const n = p.length / 2;
  if (n <= 2) return p.slice();
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const ax = p[2 * a], ay = p[2 * a + 1], dx = p[2 * b] - ax, dy = p[2 * b + 1] - ay, len = dx * dx + dy * dy;
    let far = 0, at = -1;
    for (let i = a + 1; i < b; i++) {
      const px = p[2 * i] - ax, py = p[2 * i + 1] - ay;
      const t = len ? Math.max(0, Math.min(1, (px * dx + py * dy) / len)) : 0;
      const d = (px - t * dx) ** 2 + (py - t * dy) ** 2;
      if (d > far) { far = d; at = i; }
    }
    if (at > 0 && far > tol * tol) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(p[2 * i], p[2 * i + 1]);
  return out;
}

// ---------- painting ----------
/** Paints strokes on a square canvas's context, `size` pixels a side: the paper, then each stroke. */
export function paint(g, strokes, size) {
  const k = size / GRID, at = v => (v + 0.5) * k;
  g.fillStyle = PAPER;
  g.fillRect(0, 0, size, size);
  g.lineCap = "round";
  g.lineJoin = "round";
  for (const { c, w, p } of strokes) {
    const ink = INKS[c]?.hex || INKS[0].hex, width = PENS[w] * k, n = p.length / 2;
    if (n < 2 || (n === 2 && p[0] === p[2] && p[1] === p[3])) {
      g.fillStyle = ink;
      g.beginPath();
      g.arc(at(p[0]), at(p[1]), width / 2, 0, 2 * Math.PI);
      g.fill();
      continue;
    }
    // straight from point to point: the points are the finger's path to within a pixel (simplify keeps every bend that
    // matters), so smoothing would only round off the corners it meant
    g.strokeStyle = ink;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(at(p[0]), at(p[1]));
    for (let i = 1; i < n; i++) g.lineTo(at(p[2 * i]), at(p[2 * i + 1]));
    g.stroke();
  }
}

/** A square of paper on the page: a canvas kept as sharp as the screen and as big as its box, repainted as it's resized. */
function sheet(cls) {
  const canvas = h("canvas", { class: "dr-canvas", "aria-hidden": "true" });
  const el = h("div", { class: `dr-paper ${cls}`.trim() }, canvas);
  let strokes = [], px = 0, queued = 0;
  const draw = () => {
    queued = 0;
    const r = el.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1), size = Math.round(Math.min(r.width, r.height) * dpr);
    if (!size) return;
    if (size !== px) { canvas.width = canvas.height = px = size; }
    paint(canvas.getContext("2d"), strokes, size);
  };
  const soon = () => { if (!queued) queued = requestAnimationFrame(draw); };
  new ResizeObserver(soon).observe(el);
  return { el, canvas, show(list) { strokes = list; soon(); }, now: draw };
}

/** A drawing shown, not drawn on: set(text) repaints it when it has changed. */
export function picture(text = "", { label = "The drawing", cls = "" } = {}) {
  const s = sheet(`dr-pic ${cls}`);
  s.el.setAttribute("role", "img");
  s.el.setAttribute("aria-label", label);
  let shown = null;
  const set = t => { t = t || ""; if (t === shown) return; shown = t; s.show(decode(t)); };
  set(text);
  return { el: s.el, set };
}

// ---------- the pad ----------
const ICONS = {
  undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7 4 12l5 5"/><path d="M4.5 12H14a5.5 5.5 0 0 1 0 11h-2" transform="translate(0 -5)"/></svg>',
  clear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13M10.5 10.5v6M13.5 10.5v6"/></svg>',
  eraser: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 15 9.5-9.5a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L12 19H8z"/><path d="M8.5 10.5l6 6M12 19h8"/></svg>',
};
const icon = name => { const s = h("span", { class: "dr-ico" }); s.innerHTML = ICONS[name]; return s; };

/**
 * The pad: paper to draw on (`paper`) and its tools (`tools`), placed by the game. Options: the strokes to start with
 * (a drawing sent before a reload), the inks offered (`inks`; one ink is a player's own colour, no swatches), which
 * tools, `single` (one stroke and no more: Forger's line, which the game takes or undoes), and onChange(why), called as
 * the drawing changes: "move" while a stroke is drawn, "end" when the finger lifts, "undo", "clear", or "full" when
 * the page can take no more. text() is the drawing as it travels; base(strokes) draws others' strokes beneath it.
 */
export function createPad({ strokes = [], inks = INKS.map((_, i) => i).filter(i => i !== ERASER), pen = 1,
  eraser = true, undo = true, clear = true, single = false, onChange = () => {} } = {}) {
  const s = sheet("dr-pad");
  const list = strokes.map(x => ({ ...x, p: x.p.slice() }));
  let on = true, live = null, pointer = null, text = null, armed = 0, beneath = [];
  const now = { ink: inks[0] ?? 0, pen }, last = { ink: now.ink };
  const show = () => s.show([...beneath, ...list, ...(live ? [live] : [])]);
  const changed = why => { text = null; onChange(why); };
  const spot = e => {
    const r = s.canvas.getBoundingClientRect();
    return [clamp(((e.clientX - r.left) / r.width) * GRID - 0.5), clamp(((e.clientY - r.top) / r.height) * GRID - 0.5)];
  };
  const add = e => {
    const [x, y] = spot(e), p = live.p;
    if (p.length && Math.hypot(x - p.at(-2), y - p.at(-1)) < STEP) return;
    p.push(x, y);
  };
  const move = e => {
    if (e.pointerId !== pointer || !live) return;
    for (const ev of e.getCoalescedEvents?.() || [e]) add(ev);
    show();
    changed("move");
    e.preventDefault();
  };
  const up = e => {
    if (e.pointerId !== pointer) return;
    if (live && e.type === "pointerup") add(e);
    finish();
  };
  function finish() {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    pointer = null;
    if (!live) return;
    live.p = simplify(live.p);
    list.push(live);
    live = null;
    show();
    changed("end");
    refresh();
  }
  const textNow = () => (text ??= encode(live ? [...list, live] : list));
  s.canvas.addEventListener("pointerdown", e => {
    if (!on || pointer !== null || (e.pointerType === "mouse" && e.button !== 0) || (single && list.length)) return;
    if (textNow().length > MAX_TEXT) { onChange("full"); return; }
    pointer = e.pointerId;
    live = { c: now.ink, w: now.pen, p: [] };
    add(e);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    show();
    changed("move");
    e.preventDefault();
  });
  const takeBack = () => {
    if (live || !list.length) return;
    list.pop();
    show();
    changed("undo");
    refresh();
  };

  // the tools: the inks as swatches, the pens as dots of their width in the ink, the eraser, undo, and clear (a second
  // tap within a few seconds to be sure)
  const tool = (cls, label, inner, onclick) => h("button", { type: "button", class: `dr-tool ${cls}`, "aria-label": label, title: label, onclick }, inner);
  const inkBtns = inks.length > 1 ? inks.map(i => {
    const b = h("button", { type: "button", class: "dr-ink", role: "radio", "aria-label": INKS[i].name, title: INKS[i].name, onclick: () => { now.ink = i; refresh(); } });
    b.style.setProperty("--dr-ink", INKS[i].hex);
    return b;
  }) : [];
  const penBtns = PENS.map((_, i) => h("button", { type: "button", class: `dr-pen dr-pen${i}`, role: "radio", "aria-label": ["Fine pen", "Medium pen", "Broad pen"][i],
    onclick: () => { now.pen = i; refresh(); } }, h("i")));
  const eraserBtn = eraser ? tool("dr-eraser", "Eraser", icon("eraser"), () => { now.ink = now.ink === ERASER ? last.ink : ERASER; refresh(); }) : null;
  const undoBtn = undo ? tool("dr-undo", "Undo", icon("undo"), takeBack) : null;
  const clearBtn = clear ? tool("dr-clear", "Clear the page", icon("clear"), () => {
    if (live || !list.length) return;
    if (Date.now() - armed > 2500) { armed = Date.now(); refresh(); setTimeout(refresh, 2600); return; }
    armed = 0;
    list.length = 0;
    show();
    changed("clear");
    refresh();
  }) : null;
  const tools = h("div", { class: "dr-tools" },
    inkBtns.length ? h("div", { class: "dr-inks", role: "radiogroup", "aria-label": "Ink" }, ...inkBtns) : null,
    h("div", { class: "dr-row" }, h("div", { class: "dr-pens", role: "radiogroup", "aria-label": "Pen" }, ...penBtns), eraserBtn, undoBtn, clearBtn));
  function refresh() {
    if (now.ink !== ERASER) last.ink = now.ink;
    inkBtns.forEach((b, j) => b.setAttribute("aria-checked", String(inks[j] === now.ink)));
    penBtns.forEach((b, j) => { b.setAttribute("aria-checked", String(j === now.pen)); b.style.setProperty("--dr-ink", INKS[last.ink].hex); });
    eraserBtn?.setAttribute("aria-pressed", String(now.ink === ERASER));
    if (undoBtn) undoBtn.disabled = !on || !list.length;
    if (clearBtn) { clearBtn.disabled = !on || !list.length; clearBtn.classList.toggle("armed", !!armed && Date.now() - armed <= 2500); }
    tools.classList.toggle("off", !on);
    s.el.classList.toggle("off", !on);
  }
  refresh();
  show();

  return {
    paper: s.el, tools,
    /** The drawing as it travels, the stroke under the finger included. */
    text: textNow,
    /** How many strokes it has, the one under the finger left out. */
    get count() { return list.length; },
    /** Whether it takes strokes (the clock run out, a turn over): a stroke under the finger is finished as it is. */
    enable(yes) { on = !!yes; if (!on && live) finish(); refresh(); },
    /** Takes back the last stroke (Forger's Redo), whatever the tools offer. */
    undo: takeBack,
    /** Others' strokes beneath this pad's (Forger's drawing so far): shown, not this pad's to undo or send. */
    base(strokesBelow) { beneath = strokesBelow; show(); },
  };
}

// ---------- sending a drawing as it's drawn ----------
/**
 * Sends a drawing as it changes: at once when a stroke ends (or is undone), at most every `ms` while one goes on, and
 * never the same text twice. push(urgent) sends get()'s text now or soon; flush() sends what's waiting.
 */
export function sender(send, get, ms = 300) {
  let last = null, at = 0, timer = 0;
  const go = () => { clearTimeout(timer); timer = 0; const t = get(); if (t === last) return; last = t; at = Date.now(); send(t); };
  return {
    push(urgent = false) {
      if (urgent || Date.now() - at >= ms) go();
      else if (!timer) timer = setTimeout(go, ms - (Date.now() - at));
    },
    flush: go,
    stop() { clearTimeout(timer); timer = 0; },
  };
}

// ---------- screens kept between redraws ----------
/**
 * A screen built once and then updated where it stands: build() makes its parts in `stage` and returns { update(ctx),
 * leave() }; while `key` (the step, the turn, the player's part in it) stays the same, the next redraw only updates it.
 * Returns the screen, its update already called with ctx.
 */
export function keep(stage, key, ctx, build) {
  let s = stage.__drawn;
  if (!s || s.key !== key) {
    s?.leave?.();
    stage.replaceChildren();
    s = { key, ...build() };
    stage.__drawn = s;
  }
  s.update?.(ctx);
  return s;
}

// ---------- guesses ----------
const ARTICLES = /^(?:a|an|the|some)\s+/;
const norm = s => String(s || "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(ARTICLES, "").replace(/[^\p{L}\p{N}]+/gu, "");
const han = s => /\p{Script=Han}/u.test(s);
// a word as it might be written, plural or not (horse, horses; box, boxes): two words are the same if they share one
const forms = w => [w, ...(w.length > 3 && w.endsWith("s") ? [w.slice(0, -1)] : []), ...(w.length > 4 && w.endsWith("es") ? [w.slice(0, -2)] : [])];
const same = (a, b) => forms(a).some(x => forms(b).includes(x));
function distance(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return d[b.length];
}
/**
 * Whether a typed guess names one of the answers (a word in English, its Chinese): case, accents, spaces, an article
 * and a plural aside, and a letter off in a word of six letters or more; Chinese exactly.
 */
export function guessIs(text, answers) {
  const g = norm(text);
  if (!g) return false;
  return answers.some(a => {
    const t = norm(a);
    if (!t) return false;
    if (han(t) || han(g)) return g === t;
    return same(g, t) || (t.length >= 6 && distance(g, t) <= 1);
  });
}
/** Whether a wrong guess is close (told only to the one who typed it): two letters off a word of five or more, or part of it. */
export function guessNear(text, answers) {
  const g = norm(text);
  if (!g || guessIs(text, answers)) return false;
  return answers.some(a => {
    const t = norm(a);
    if (!t || han(t) || han(g)) return false;
    return (t.length >= 5 && distance(g, t) <= 2) || (g.length >= 3 && t.length > g.length && t.includes(g) && g.length * 2 >= t.length);
  });
}
