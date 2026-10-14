// River's board: the Xiangqi board drawn in SVG (nine files by ten ranks of points, the river 楚河 漢界 across the
// middle, the palaces' diagonals, the marks where the cannons and soldiers start, each side's file numbers at its own
// edge), the pieces as discs with their characters, and the hand: tap a piece and then a point, or drag it, its legal
// points shown. Drawn afresh from what it's given each time; the last move slides into place.
import { charOf, fileOf, rankOf, pointOf, GENERAL } from "./river-rules.js";

const SVG = "http://www.w3.org/2000/svg";
const PAD_X = 0.62, PAD_Y = 0.98;
/** The board's drawing size in its own units: the grid (8 by 9 between the outer lines) and its margins. */
export const VIEW = { x: -PAD_X, y: -PAD_Y, w: 8 + 2 * PAD_X, h: 9 + 2 * PAD_Y };
const CJK = "'Songti TC','STSong','Noto Serif CJK TC','Noto Serif TC','Hiragino Mincho ProN','PMingLiU','MingLiU',serif";
const RED_NUM = "一二三四五六七八九", BLACK_NUM = "123456789";
const el = (tag, attrs = {}, text) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
};

/** A disc as markup, for the rules sheet and the logo: piece `v` (1–7, negative for Black), turned upside down if `flip`. */
export function discSvg(v, script = "traditional", { size = 2.4, unit = "rem", flip = false } = {}) {
  return `<svg class="rv-disc-pic" viewBox="-.5 -.5 1 1" width="${size}${unit}" height="${size}${unit}" aria-hidden="true">${discMarkup(v, script, flip)}</svg>`;
}
function discMarkup(v, script, flip) {
  const side = v > 0 ? "red" : "black";
  return `<g class="rv-pc ${side}"><circle class="rv-pc-edge" r=".47"/><circle class="rv-pc-face" r=".44"/><circle class="rv-pc-ring" r=".365"/>`
    + `<text class="rv-pc-ch" font-family="${CJK}" font-size=".5" text-anchor="middle" dominant-baseline="central"${flip ? ' transform="rotate(180)"' : ""}>${charOf(v, script)}</text></g>`;
}

/**
 * Mounts a board in `host`. onMove(from, to) is called for a move made by hand; legal(from) returns the points a piece
 * there may go to (empty when it isn't the hand's to move). Returns { draw(view) }: view is { pos, bottomRed, facing,
 * script, last: { from, to }, hint: { from, to }, hand (whether taps move pieces), slide (the last move animates),
 * tap (a tap on any point goes to onTap(point) instead: the course asking where a piece can go), marks (the course's
 * drawing: { dots, crosses, rings, arrows: [[from, to]], ok, no, zones: ["river", "palace-red", "palace-black"] },
 * points as numbers) }.
 */
export function mountBoard(host, { onMove, legal, onTap = () => {} }) {
  const svg = el("svg", { viewBox: `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`, class: "rv-svg", role: "img", "aria-label": "Xiangqi board" });
  host.replaceChildren(svg);
  let view = null, selected = null, drag = null, press = null;

  const xy = p => (view.bottomRed ? [fileOf(p), 9 - rankOf(p)] : [8 - fileOf(p), rankOf(p)]);
  const pointAt = (x, y) => {
    const f = Math.round(x), r = Math.round(y);
    if (f < 0 || f > 8 || r < 0 || r > 9 || Math.hypot(x - f, y - r) > 0.55) return -1;
    return view.bottomRed ? pointOf(f, 9 - r) : pointOf(8 - f, r);
  };
  const local = e => {
    const r = svg.getBoundingClientRect();
    return [VIEW.x + (e.clientX - r.left) / r.width * VIEW.w, VIEW.y + (e.clientY - r.top) / r.height * VIEW.h];
  };

  function grid() {
    const g = el("g", { class: "rv-lines" });
    g.append(el("rect", { class: "rv-wood", x: VIEW.x, y: VIEW.y, width: VIEW.w, height: VIEW.h, rx: ".12" }));
    g.append(el("rect", { class: "rv-frame", x: "-.17", y: "-.17", width: "8.34", height: "9.34" }));
    let d = "";
    for (let y = 0; y <= 9; y++) d += `M0 ${y}H8`;
    d += "M0 0V9M8 0V9";
    for (let x = 1; x < 8; x++) d += `M${x} 0V4M${x} 5V9`;           // the files break at the river, all but the edges
    d += "M3 0L5 2M5 0L3 2M3 7L5 9M5 7L3 9";                          // the palaces
    // the marks where cannons and soldiers start: little corners round the point, on the board's side only
    const mark = (x, y) => {
      const a = 0.09, b = 0.24;
      for (const sx of [-1, 1]) {
        if (x + sx < 0 || x + sx > 8) continue;
        for (const sy of [-1, 1]) d += `M${x + sx * a} ${y + sy * b}V${y + sy * a}H${x + sx * b}`;
      }
    };
    for (const y of [2, 7]) for (const x of [1, 7]) mark(x, y);
    for (const y of [3, 6]) for (const x of [0, 2, 4, 6, 8]) mark(x, y);
    g.append(el("path", { class: "rv-grid", d }));
    // the river's words, each half upright for the player nearest it
    const words = [["楚", 1.25], ["河", 2.45], ["漢", 5.55], ["界", 6.75]];
    for (const [w, x] of words) g.append(el("text", { class: "rv-river", x, y: 4.5, "font-family": CJK, "font-size": ".52", "text-anchor": "middle", "dominant-baseline": "central" }, w));
    // each player's file numbers at their own edge, counted from their right: Red's in Chinese, Black's in figures
    const nearRed = view.bottomRed;
    for (let x = 0; x <= 8; x++) {
      const near = nearRed ? RED_NUM[8 - x] : BLACK_NUM[8 - x], far = nearRed ? BLACK_NUM[x] : RED_NUM[x];
      g.append(el("text", { class: "rv-coord", x, y: 9 + 0.74, "font-family": CJK, "font-size": ".28", "text-anchor": "middle", "dominant-baseline": "central" }, near));
      g.append(el("text", { class: "rv-coord", x, y: -0.74, "font-family": CJK, "font-size": ".28", "text-anchor": "middle", "dominant-baseline": "central",
        ...(view.facing ? { transform: `rotate(180 ${x} -0.74)` } : {}) }, far));         // facing: the far numbers read from the far side
    }
    return g;
  }

  function disc(v, p, at, cls = "") {
    const [x, y] = at || xy(p);
    const farSide = view.bottomRed ? v < 0 : v > 0;
    const g = el("g", { class: `rv-pc ${v > 0 ? "red" : "black"}${cls ? ` ${cls}` : ""}` });
    g.style.transform = `translate(${x}px, ${y}px)`;
    g.innerHTML = `<circle class="rv-pc-shadow" cx=".035" cy=".07" r=".46"/>${discMarkup(v, view.script, view.facing && farSide).replace(/^<g[^>]*>|<\/g>$/g, "")}`;
    return g;
  }

  function draw(next) {
    if (next) view = next;
    if (!view) return;
    const { pos, last, hint } = view;
    svg.replaceChildren(grid());
    const marks = el("g", { class: "rv-marks" });
    if (last) {
      const [fx, fy] = xy(last.from), [tx, ty] = xy(last.to);
      marks.append(el("circle", { class: "rv-last-from", cx: fx, cy: fy, r: ".2" }), el("circle", { class: "rv-last-to", cx: tx, cy: ty, r: ".5" }));
    }
    const targets = selected != null && view.hand ? legal(selected) : [];
    svg.append(marks);
    if (view.marks) svg.append(courseMarks(view.marks, true));
    // a general in check glows
    const pieces = el("g", { class: "rv-pieces" });
    for (let p = 0; p < 90; p++) {
      const v = pos.b[p];
      if (!v || (drag && drag.from === p && drag.moved)) continue;
      if (view.slide && last && p === last.to) continue;             // drawn below, sliding in
      const g = disc(v, p, null, [selected === p && "sel", Math.abs(v) === GENERAL && view.check === p && "check"].filter(Boolean).join(" "));
      g.dataset.p = p;
      pieces.append(g);
    }
    svg.append(pieces);
    if (view.slide && last && pos.b[last.to]) {
      const g = disc(pos.b[last.to], last.to, xy(last.from), `slide${Math.abs(pos.b[last.to]) === GENERAL && view.check === last.to ? " check" : ""}`);
      pieces.append(g);
      const [x, y] = xy(last.to);
      requestAnimationFrame(() => requestAnimationFrame(() => { g.style.transform = `translate(${x}px, ${y}px)`; }));
      view = { ...view, slide: false };
    }
    const dots = el("g", { class: "rv-targets" });
    for (const q of targets) {
      const [x, y] = xy(q);
      dots.append(pos.b[q] ? el("circle", { class: "rv-target take", cx: x, cy: y, r: ".49" }) : el("circle", { class: "rv-target", cx: x, cy: y, r: ".13" }));
    }
    svg.append(dots);
    if (hint) {
      const [fx, fy] = xy(hint.from), [tx, ty] = xy(hint.to), len = Math.hypot(tx - fx, ty - fy), ux = (tx - fx) / len, uy = (ty - fy) / len;
      const sx = fx + ux * 0.3, sy = fy + uy * 0.3, ex = tx - ux * 0.32, ey = ty - uy * 0.32, w = 0.2;
      svg.append(el("path", { class: "rv-hint", d: `M${sx} ${sy}L${ex} ${ey}M${ex + (-ux * 0.28 + -uy * w)} ${ey + (-uy * 0.28 + ux * w)}L${ex + ux * 0.04} ${ey + uy * 0.04}L${ex + (-ux * 0.28 + uy * w)} ${ey + (-uy * 0.28 - ux * w)}` }));
    }
    if (view.marks) svg.append(courseMarks(view.marks, false));
    if (drag?.moved) {
      const g = disc(pos.b[drag.from], drag.from, [drag.x, drag.y], "drag");
      svg.append(g);
    }
  }

  /** The course's marks: zones under the pieces (under), dots, rings, crosses and arrows over them. */
  function courseMarks(m, under) {
    const g = el("g", { class: "rv-mk" });
    const box = (a, b, pad) => {
      const [x1, y1] = xy(a), [x2, y2] = xy(b);
      return { x: Math.min(x1, x2) - pad, y: Math.min(y1, y2) - pad, width: Math.abs(x2 - x1) + 2 * pad, height: Math.abs(y2 - y1) + 2 * pad };
    };
    if (under) {
      for (const z of m.zones || []) {
        if (z === "river") g.append(el("rect", { class: "rv-mk-zone", x: -0.35, y: 4.12, width: 8.7, height: 0.76, rx: ".1" }));
        if (z === "palace-red") g.append(el("rect", { class: "rv-mk-zone", ...box(pointOf(3, 0), pointOf(5, 2), 0.38), rx: ".14" }));
        if (z === "palace-black") g.append(el("rect", { class: "rv-mk-zone", ...box(pointOf(3, 7), pointOf(5, 9), 0.38), rx: ".14" }));
      }
      return g;
    }
    for (const p of m.rings || []) { const [x, y] = xy(p); g.append(el("circle", { class: "rv-mk-ring", cx: x, cy: y, r: ".52" })); }
    for (const p of m.dots || []) { const [x, y] = xy(p); g.append(el("circle", { class: "rv-mk-dot", cx: x, cy: y, r: ".15" })); }
    for (const p of m.ok || []) { const [x, y] = xy(p); g.append(el("circle", { class: "rv-mk-ok", cx: x, cy: y, r: ".22" })); }
    for (const p of [...(m.crosses || []), ...(m.no || [])]) {
      const [x, y] = xy(p), k = 0.2;
      g.append(el("path", { class: `rv-mk-x${(m.no || []).includes(p) ? " no" : ""}`, d: `M${x - k} ${y - k}L${x + k} ${y + k}M${x + k} ${y - k}L${x - k} ${y + k}` }));
    }
    for (const [a, b] of m.arrows || []) {
      const [fx, fy] = xy(a), [tx, ty] = xy(b), len = Math.hypot(tx - fx, ty - fy), ux = (tx - fx) / len, uy = (ty - fy) / len;
      const sx = fx + ux * 0.3, sy = fy + uy * 0.3, ex = tx - ux * 0.32, ey = ty - uy * 0.32, w = 0.2;
      g.append(el("path", { class: "rv-mk-arrow", d: `M${sx} ${sy}L${ex} ${ey}M${ex + (-ux * 0.28 + -uy * w)} ${ey + (-uy * 0.28 + ux * w)}L${ex + ux * 0.04} ${ey + uy * 0.04}L${ex + (-ux * 0.28 + uy * w)} ${ey + (-uy * 0.28 - ux * w)}` }));
    }
    return g;
  }

  // ---------- the hand ----------
  const mine = p => view?.hand && legal(p).length > 0;
  function tapAt(p) {
    if (selected != null && selected !== p && legal(selected).includes(p)) { const from = selected; selected = null; onMove(from, p); return; }
    selected = mine(p) && selected !== p ? p : null;
    draw();
  }
  svg.addEventListener("pointerdown", e => {
    if (view?.tap && e.button <= 0) {                               // the course asks for points, not moves
      const [x, y] = local(e), p = pointAt(x, y);
      if (p >= 0) onTap(p);
      e.preventDefault();
      return;
    }
    if (!view?.hand || e.button > 0) return;
    const [x, y] = local(e), p = pointAt(x, y);
    if (p < 0) { if (selected != null) { selected = null; draw(); } return; }
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, p, was: selected };
    try { svg.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
    if (mine(p)) { drag = { from: p, x, y, moved: false }; if (selected !== p) { selected = p; draw(); } }
    e.preventDefault();
  });
  svg.addEventListener("pointermove", e => {
    if (!drag || !press || e.pointerId !== press.id) return;
    const [x, y] = local(e);
    drag.x = x; drag.y = y;
    if (!drag.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 7) drag.moved = true;
    if (drag.moved) draw();
  });
  const release = e => {
    if (!press || e.pointerId !== press.id) return;
    const was = drag, start = press;
    drag = null; press = null;
    const [x, y] = local(e), p = pointAt(x, y);
    if (was?.moved) {
      if (p >= 0 && p !== was.from && legal(was.from).includes(p)) { selected = null; onMove(was.from, p); }
      else draw();
      return;
    }
    if (p < 0) { draw(); return; }
    if (was && p === start.p) { if (start.was === p) selected = null; draw(); return; }   // a tap picks a piece up; a second puts it down
    tapAt(p);
  };
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", () => { drag = null; press = null; draw(); });

  return {
    draw(next) { if (!next.hand || next.pos !== view?.pos) selected = null; draw(next); },
  };
}

/**
 * A small piece of board for the Rules sheet, as markup: `cols` by `rows` points, `pieces` as [x, y, v] (v as on the
 * board, negative for Black), `dots` where the piece may go, `crosses` where it may not, `ring` a point it captures.
 */
export function diagramSvg({ cols, rows, pieces = [], dots = [], crosses = [], rings = [], label = "" }, script = "traditional") {
  const pad = 0.55, w = cols - 1 + 2 * pad, h = rows - 1 + 2 * pad;
  let d = "";
  for (let y = 0; y < rows; y++) d += `M0 ${y}H${cols - 1}`;
  for (let x = 0; x < cols; x++) d += `M${x} 0V${rows - 1}`;
  const disc = ([x, y, v]) => `<g transform="translate(${x} ${y})">${discMarkup(v, script, false)}</g>`;
  const cross = ([x, y]) => `<path class="rv-dg-no" d="M${x - 0.16} ${y - 0.16}l.32 .32M${x + 0.16} ${y - 0.16}l-.32 .32"/>`;
  return `<svg class="rv-diagram" viewBox="${-pad} ${-pad} ${w} ${h}" width="${w * 1.45}rem" height="${h * 1.45}rem" role="img" aria-label="${label}">`
    + `<rect class="rv-wood" x="${-pad}" y="${-pad}" width="${w}" height="${h}" rx=".1"/><path class="rv-grid" d="${d}"/>`
    + dots.map(([x, y]) => `<circle class="rv-dg-yes" cx="${x}" cy="${y}" r=".13"/>`).join("")
    + pieces.map(disc).join("") + rings.map(([x, y]) => `<circle class="rv-dg-take" cx="${x}" cy="${y}" r=".5"/>`).join("") + crosses.map(cross).join("") + "</svg>";
}
