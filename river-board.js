// River's board: the Xiangqi board drawn in SVG (nine files by ten ranks of points, the river 楚河 漢界 across the
// middle, the palaces' diagonals, the marks where the cannons and soldiers start, each side's file numbers at its own
// edge), the pieces as discs with their characters, and the hand: tap a piece and then a point, or drag it, its legal
// points shown. Drawn afresh from what it's given each time; the last move slides into place. The pieces carry their
// characters, or pictures (setPictures).
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

// The pieces as pictures (Menu, Pieces), for a player still learning the characters: each a chess cousin where there
// is one, drawn in a 45-unit box as the cburnett chess pieces are (Colin M.L. Burnett, CC BY-SA 3.0: the horse, the
// tower and the pawn are theirs, as chess-pieces.js has them): the general a crown, the advisor a shield crossed
// diagonally (it moves on the diagonals), the elephant an elephant, the horse a knight's head, the chariot a tower (it
// moves as a rook), the cannon a cannon on its wheel, the soldier a pawn. Filled in the side's colour; .cut in the
// disc's face colour.
const ICONS = {
  1: '<path d="M9 34 6.5 15l9 8 7-13 7 13 9-8L36 34Z"/><path d="M9 36.5h27V40H9z"/><circle cx="6.5" cy="13.5" r="2.4"/><circle cx="22.5" cy="8.5" r="2.4"/><circle cx="38.5" cy="13.5" r="2.4"/><circle class="cut" cx="22.5" cy="28" r="2.3"/>',
  2: '<path d="M22.5 6 37 11v11c0 9-6.5 14.8-14.5 18C14.5 36.8 8 31 8 22V11Z"/><path class="cut-line" d="M15.5 15.5l14 16m0-16-14 16"/>',
  3: '<ellipse cx="11.5" cy="20" rx="7.5" ry="10"/><ellipse cx="33.5" cy="20" rx="7.5" ry="10"/><ellipse cx="22.5" cy="18" rx="8.5" ry="9.5"/><path d="M18.5 23c0 8 1 13 4 16.5 1.5 1.5 4.5.5 3.5-2-1.5-3.5-.5-8.5.5-14.5Z"/><path class="cut-line" d="M15.8 12.5c-3.6 2.2-4.2 11.5-.6 16.5m13.6-16.5c3.6 2.2 4.2 11.5.6 16.5M17.6 27.6 14.4 32m13-4.4 3.2 4.4"/><circle class="cut" cx="19" cy="16.5" r="1.5"/><circle class="cut" cx="26" cy="16.5" r="1.5"/>',
  4: '<path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"/><path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.04-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-1-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-2 2.5-3c1 0 1 3 1 3"/><path class="cut" d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0m5.43-9.75a.5 1.5 30 1 1-.86-.5.5 1.5 30 1 1 .86.5"/><path class="cut" d="m24.55 10.4-.45 1.45.5.15c3.15 1 5.65 2.49 7.9 6.75S35.75 29.06 35.25 39l-.05.5h2.25l.05-.5c.5-10.06-.88-16.85-3.25-21.34s-5.79-6.64-9.19-7.16z"/>',
  5: '<path d="M9 39h27v-3H9zm3.5-7 1.5-2.5h17l1.5 2.5zm-.5 4v-4h21v4z"/><path d="M14 29.5v-13h17v13z"/><path d="M14 16.5 11 14h23l-3 2.5zM11 14V9h4v2h5V9h5v2h5V9h4v5z"/><path class="cut-line" d="M12 35.5h21m-20-4h19m-18-2h17m-17-13h17M11 14h23"/>',
  6: '<path d="M9.5 26.5 34.4 13.4c1.5-.8 3.3-.2 4 1.3l.9 2c.7 1.5 0 3.3-1.5 3.9L12 32Z"/><circle cx="17" cy="31" r="7.6"/><path d="M6 38.5h31V41H6z"/><circle class="cut" cx="17" cy="31" r="2.2"/><path class="cut-line" d="M17 24.6v12.8M10.6 31h12.8M33.6 13.8l2.8 6.3"/>',
  7: '<path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"/>',
};
let pictures = false;
/** Whether the pieces are drawn as pictures (Menu, Pieces) rather than characters; every board and disc after follows. */
export function setPictures(on) { pictures = !!on; }
/** A piece's mark without its disc, for a line of words (the pieces taken): its character, or its picture. */
export function pieceMark(v, script = "traditional") {
  return pictures ? `<svg class="rv-pic" viewBox="0 0 45 45" aria-hidden="true">${ICONS[Math.abs(v)]}</svg>` : charOf(v, script);
}

/** A disc as markup, for the rules sheet and the logo: piece `v` (1–7, negative for Black), turned upside down if `flip`. */
export function discSvg(v, script = "traditional", { size = 2.4, unit = "rem", flip = false } = {}) {
  return `<svg class="rv-disc-pic" viewBox="-.5 -.5 1 1" width="${size}${unit}" height="${size}${unit}" aria-hidden="true">${discMarkup(v, script, flip)}</svg>`;
}
function discMarkup(v, script, flip) {
  const side = v > 0 ? "red" : "black";
  const mark = pictures ? `<g class="rv-pc-pic" transform="${flip ? "rotate(180) " : ""}scale(.0138) translate(-22.5 -24)">${ICONS[Math.abs(v)]}</g>`
    : `<text class="rv-pc-ch" font-family="${CJK}" font-size=".5" text-anchor="middle" dominant-baseline="central"${flip ? ' transform="rotate(180)"' : ""}>${charOf(v, script)}</text>`;
  return `<g class="rv-pc ${side}"><circle class="rv-pc-edge" r=".47"/><circle class="rv-pc-face" r=".44"/><circle class="rv-pc-ring" r=".365"/>${mark}</g>`;
}

/**
 * Mounts a board in `host`. onMove(from, to) is called for a move made by hand; legal(from) returns the points a piece
 * there may go to (empty when it isn't the hand's to move). Returns { draw(view) }: view is { pos, bottomRed, facing,
 * script, last: { from, to }, arrows: [{ from, to, bad }] (the coach's moves in its green, a move it faults in
 * oxblood), hand (whether taps move pieces), slide (the last move animates),
 * tap (a tap on any point goes to onTap(point) instead: the course asking where a piece can go), marks (the course's
 * drawing: { dots, crosses, rings, arrows: [[from, to]], ok, no, zones: ["river", "palace-red", "palace-black"] },
 * points as numbers) }. reach(point), when given, makes a tap on one of the other side's pieces while it's the hand's
 * move show where that piece could go and which of its side it guards ({ moves, guards }, river-rules.js's reachOf);
 * onPeek(point, reach) hears of it (null when it's put away).
 */
export function mountBoard(host, { onMove, legal, onTap = () => {}, reach = null, onPeek = () => {} }) {
  const svg = el("svg", { viewBox: `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`, class: "rv-svg", role: "img", "aria-label": "Xiangqi board" });
  host.replaceChildren(svg);
  let view = null, selected = null, drag = null, press = null;
  let peek = null;                                                 // { p, moves, guards }: a piece of the other side's, looked at

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
    const { pos, last } = view;
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
      const g = disc(v, p, null, [selected === p && "sel", peek?.p === p && "peek", Math.abs(v) === GENERAL && view.check === p && "check"].filter(Boolean).join(" "));
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
    if (peek) {
      // the piece looked at: dashed rings round the pieces it guards, hollow dots where it could go, a ring where it takes
      const g = el("g", { class: `rv-peek ${pos.b[peek.p] > 0 ? "red" : "black"}` });
      for (const q of peek.guards) { const [x, y] = xy(q); g.append(el("circle", { class: "rv-peek-guard", cx: x, cy: y, r: ".5" })); }
      for (const q of peek.moves) {
        const [x, y] = xy(q);
        g.append(pos.b[q] ? el("circle", { class: "rv-peek-take", cx: x, cy: y, r: ".5" }) : el("circle", { class: "rv-peek-go", cx: x, cy: y, r: ".14" }));
      }
      svg.append(g);
    }
    for (const a of view.arrows || []) {
      const [fx, fy] = xy(a.from), [tx, ty] = xy(a.to), len = Math.hypot(tx - fx, ty - fy), ux = (tx - fx) / len, uy = (ty - fy) / len;
      const sx = fx + ux * 0.3, sy = fy + uy * 0.3, ex = tx - ux * 0.32, ey = ty - uy * 0.32, w = 0.2;
      svg.append(el("path", { class: `rv-hint${a.bad ? " bad" : ""}`, d: `M${sx} ${sy}L${ex} ${ey}M${ex + (-ux * 0.28 + -uy * w)} ${ey + (-uy * 0.28 + ux * w)}L${ex + ux * 0.04} ${ey + uy * 0.04}L${ex + (-ux * 0.28 + uy * w)} ${ey + (-uy * 0.28 - ux * w)}` }));
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
  /** A piece of the side not to move. */
  const theirs = p => !!view?.pos.b[p] && (view.pos.b[p] > 0) !== view.pos.red;
  function look(p) {
    const was = peek;
    peek = p != null && reach ? { p, ...(reach(p) || { moves: [], guards: [] }) } : null;
    if (peek || was) onPeek(peek?.p ?? null, peek);
  }
  function tapAt(p) {
    if (selected != null && selected !== p && legal(selected).includes(p)) { const from = selected; selected = null; look(null); onMove(from, p); return; }
    if (reach && theirs(p)) { selected = null; look(peek?.p === p ? null : p); draw(); return; }
    look(null);
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
    if (mine(p)) { drag = { from: p, x, y, moved: false }; if (selected !== p) { selected = p; look(null); draw(); } }
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
    draw(next) { if (!next.hand || next.pos !== view?.pos) { selected = null; if (peek) look(null); } draw(next); },
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
