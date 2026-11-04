// Nine Men's Morris's board on the page, one component for the game and the course: the lines drawn once, a button over
// each of the 24 points for taps, and the pieces as elements that move (a slide from point to point, a piece growing
// where one is placed and shrinking where one is taken); nothing here decides anything, it draws what it is given. A
// piece has a dark face with a solid brass pip and a light face with a ring, so which is which never depends on colour
// alone; each carries a few thin slabs under its face that only the 3D view shows (morris-3d.css), so a piece turned
// like a draughtsman stands on the board.
import { N, COORD, MILLS, MILL_MASK, ptName } from "./morris-board.js";

const FILES = "abcdefg";
const NAME = { d: "dark", l: "light" };
const SLABS = 4;
const at = i => `left:${((COORD[i][0] + 0.5) / 7 * 100).toFixed(3)}%;top:${((COORD[i][1] + 0.5) / 7 * 100).toFixed(3)}%`;

/** The lines of the board in a 7 x 7 grid whose points sit at the middle of their cells. */
function linesSvg() {
  const c = i => `${COORD[i][0] + 0.5} ${COORD[i][1] + 0.5}`;
  const ring = r => `M${c(r * 8)}L${c(r * 8 + 2)}L${c(r * 8 + 4)}L${c(r * 8 + 6)}Z`;
  const spokes = [1, 3, 5, 7].map(p => `M${c(p)}L${c(16 + p)}`).join("");
  const mills = MILLS.map((m, k) => `<path class="mo-mill" data-k="${k}" d="M${c(m[0])}L${c(m[2])}"/>`).join("");
  return `<svg class="mo-lines" viewBox="0 0 7 7" preserveAspectRatio="none" aria-hidden="true"><path class="mo-rule" d="${[0, 1, 2].map(ring).join("")}${spokes}"/>${mills}</svg>`;
}
const pieceHtml = c => `<span class="mo-pc" data-c="${c}">${"<i class=\"mo-slab\"></i>".repeat(SLABS)}<i class="mo-top"></i></span>`;

/**
 * createBoard(box, { onTap, labels }) → { draw(view), el, pts }
 * view: { b (24 characters: "d", "l", "."), legal (points a move may go to: marked quietly), sel (the piece picked up),
 * take (pieces that may be taken now), last ({ f, t, x }: the move just made), hint ({ f, t, x }), marks ({ point:
 * "good" | "bad" | "pick" }), tap (points answer taps; default true), still (draw without moving) }
 */
export function createBoard(box, { onTap = () => {}, labels = true } = {}) {
  box.classList.add("mo-frame");
  if (!labels) box.classList.add("bare");
  box.innerHTML = `${labels ? `<i class="mo-corner"></i><div class="mo-files" aria-hidden="true">${[...FILES].map(f => `<i>${f}</i>`).join("")}</div>
    <div class="mo-ranks" aria-hidden="true">${[7, 6, 5, 4, 3, 2, 1].map(r => `<i>${r}</i>`).join("")}</div>` : ""}
    <div class="mo-grid" role="group" aria-label="The board">${linesSvg()}
      <div class="mo-pts">${Array.from({ length: N }, (_, i) => `<button type="button" class="mo-pt" data-pt="${i}" style="${at(i)}" aria-label="${ptName(i)}, empty"><b class="mo-dot"></b></button>`).join("")}</div>
      <div class="mo-pieces"></div></div>`;
  const grid = box.querySelector(".mo-grid"), layer = box.querySelector(".mo-pieces");
  const pts = [...box.querySelectorAll(".mo-pt")], mills = [...box.querySelectorAll(".mo-mill")];
  const els = Array(N).fill(null);                 // the piece standing on each point
  let prev = null;
  box.querySelector(".mo-pts").addEventListener("click", e => {
    const b = e.target.closest(".mo-pt");
    if (b && !grid.classList.contains("shut")) onTap(Number(b.dataset.pt));
  });

  function put(el, i) { el.style.left = `${((COORD[i][0] + 0.5) / 7 * 100).toFixed(3)}%`; el.style.top = `${((COORD[i][1] + 0.5) / 7 * 100).toFixed(3)}%`; }
  function grow(i, c, still) {
    layer.insertAdjacentHTML("beforeend", pieceHtml(c));
    const el = layer.lastElementChild;
    put(el, i);
    if (!still) { el.classList.add("off"); void el.offsetWidth; requestAnimationFrame(() => el.classList.remove("off")); }
    els[i] = el;
  }
  function shrink(el, still) {
    if (still) { el.remove(); return; }
    el.classList.add("off");
    setTimeout(() => el.remove(), 320);
  }

  function draw(view) {
    const b = view.b || ".".repeat(N), marks = view.marks || {};
    const still = !!view.still || prev === null, legal = new Set(view.legal || []), take = new Set(view.take || []);
    const last = view.last || null, hint = view.hint || null;
    if (still) for (let i = 0; i < N; i++) if (els[i]) { els[i].remove(); els[i] = null; }
    if (!still && prev && prev !== b) {
      // a piece that left a point and one that arrived on another, of the same colour, is one piece sliding; a point that
      // emptied with no arrival is a piece taken; one that filled with no departure is a piece placed. Anything more
      // tangled (a take-back, a new game) is redrawn as it stands.
      const changed = [];
      for (let i = 0; i < N; i++) if (prev[i] !== b[i]) changed.push(i);
      const sources = changed.filter(i => prev[i] !== "." && b[i] === ".");
      const dests = changed.filter(i => prev[i] === "." && b[i] !== ".");
      const flipped = changed.some(i => prev[i] !== "." && b[i] !== ".");
      if (flipped || sources.length > 2 || dests.length > 1) { for (let i = 0; i < N; i++) if (els[i]) { els[i].remove(); els[i] = null; } }
      else {
        let slid = null;
        for (const d of dests) {
          const s = sources.find(i => prev[i] === b[d]);
          if (s != null && els[s]) { els[d] = els[s]; els[s] = null; put(els[d], d); slid = s; } else { /* placed: the final pass grows it */ }
        }
        for (const s of sources) if (s !== slid && els[s]) { shrink(els[s], false); els[s] = null; }
      }
    }
    for (let i = 0; i < N; i++) {
      const c = b[i];
      if (c === ".") { if (els[i]) { shrink(els[i], still); els[i] = null; } }
      else if (!els[i]) grow(i, c, still);
      else if (els[i].dataset.c !== c) { shrink(els[i], true); grow(i, c, true); }
    }
    grid.classList.toggle("shut", view.tap === false);
    // mills drawn on the board, and each piece's marks
    const dm = bitsOf(b, "d"), lm = bitsOf(b, "l");
    const inMill = new Set();
    mills.forEach((m, k) => {
      const mk = MILL_MASK[k], on = (dm & mk) === mk || (lm & mk) === mk;
      m.classList.toggle("on", on);
      if (on) for (const p of MILLS[k]) inMill.add(p);
    });
    for (let i = 0; i < N; i++) {
      const pt = pts[i], el = els[i];
      const mk = marks[i] || "";
      pt.dataset.mark = mk;
      pt.classList.toggle("legal", legal.has(i) && b[i] === ".");
      pt.classList.toggle("from", !!last && last.f === i);
      pt.classList.toggle("tip", !!hint && hint.t === i && b[i] === ".");
      pt.setAttribute("aria-label", `${ptName(i)}, ${b[i] === "." ? "empty" : NAME[b[i]]}`);
      if (el) {
        el.classList.toggle("mill", inMill.has(i));
        el.classList.toggle("sel", view.sel === i);
        el.classList.toggle("take", take.has(i));
        el.classList.toggle("last", !!last && last.t === i);
        el.classList.toggle("tipf", !!hint && hint.f === i);
        el.classList.toggle("tipx", !!hint && hint.x === i);
        el.dataset.mark = mk;
      }
    }
    prev = b;
  }
  return { draw, el: box, pts, reset() { prev = null; } };
}
function bitsOf(b, c) { let m = 0; for (let i = 0; i < N; i++) if (b[i] === c) m |= 1 << i; return m; }
