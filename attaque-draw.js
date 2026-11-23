// L'Attaque's board on the page: a 10 x 10 field with its two lakes, a button over each square for taps, and the pieces as
// elements that move (a step or a Scout's run slides; a piece that falls shrinks away). It draws what it is given and decides
// nothing. A piece you may read shows its rank (a numeral, or a mark for the Spy, the Bomb and the Flag); a hidden one shows
// its army's back. Each carries a few thin slabs behind its face that only the 3D view shows (attaque-3d.css), where the
// pieces stand up facing their owners, as the wooden ones do.
import { N, SIZE, LAKE, LABEL, NAMES, SIDES, FLAG, SPY, BOMB, squareName } from "./attaque-board.js";

const SLABS = 3;
const GLYPH = {
  [BOMB]: `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="12" r="5.6"/><path d="M12.6 7.6L15 5.2M15.4 2.6v1.4M17.8 5h-1.4M17.3 3.1l-1 1" fill="none"/></svg>`,
  [FLAG]: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2.5V18" fill="none"/><path d="M5.6 3.4H16l-3 3.6 3 3.6H5.6Z"/></svg>`,
  [SPY]: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M1.8 10.4Q10 2.6 18.2 10.4Q10 18.2 1.8 10.4Z" fill="none"/><circle cx="10" cy="10.4" r="2.7"/></svg>`,
};
/** A rank as the page shows it in words and on a piece. */
export const glyph = k => GLYPH[k] || `<b>${LABEL[k]}</b>`;
const at = (d, el) => { el.style.left = `${((d % SIZE) + 0.5) * 10}%`; el.style.top = `${(Math.floor(d / SIZE) + 0.5) * 10}%`; };

/**
 * createBoard(box, { onTap }) → { draw(view), el, reset() }
 * view: { pieces: [{ id, sq, side, kind (-1: its back), shown (yours, and the other side has seen it), moved (theirs, hidden,
 * and has moved) }], flip (Blue's view: the board turned round), sel (a square), legal (squares a move may go to), last ({ f, t }:
 * the move just made), hint ({ f, t }), clash (the square of the attack just made), area (the squares a setup may use), marks
 * (squares a lesson points at),
 * tap (squares answer taps; default true), still (draw without moving) }
 */
export function createBoard(box, { onTap = () => {} } = {}) {
  box.classList.add("at-frame");
  const lakes = [[4, 2], [4, 6]].map(([r, c]) => `<rect class="at-lake" x="${c}" y="${r}" width="2" height="2" rx=".18"/>`).join("");
  const rules = Array.from({ length: SIZE - 1 }, (_, i) => `M${i + 1} 0V${SIZE}M0 ${i + 1}H${SIZE}`).join("");
  box.innerHTML = `<div class="at-grid" role="group" aria-label="The board">
      <svg class="at-field" viewBox="0 0 ${SIZE} ${SIZE}" preserveAspectRatio="none" aria-hidden="true"><path class="at-rule" d="${rules}"/>${lakes}</svg>
      <div class="at-sqs">${Array.from({ length: N }, (_, d) => `<button type="button" class="at-sq${LAKE[d] ? " lake" : ""}" data-d="${d}"${LAKE[d] ? " disabled" : ""}></button>`).join("")}</div>
      <div class="at-pieces"></div></div>`;
  const grid = box.querySelector(".at-grid"), layer = box.querySelector(".at-pieces"), sqs = [...box.querySelectorAll(".at-sq")];
  sqs.forEach((b, d) => at(d, b));
  const els = new Map();                     // piece id → its element
  let flip = false, first = true;
  box.querySelector(".at-sqs").addEventListener("click", e => {
    const b = e.target.closest(".at-sq");
    if (b && !b.disabled && !grid.classList.contains("shut")) onTap(flip ? N - 1 - Number(b.dataset.d) : Number(b.dataset.d));
  });
  const disp = sq => (flip ? N - 1 - sq : sq);

  function face(el, pc) {
    const key = `${pc.side}:${pc.kind}`;
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    el.dataset.side = pc.side;
    el.classList.toggle("back", pc.kind < 0);
    el.querySelector(".at-top").innerHTML = pc.kind < 0 ? `<i class="at-crest"></i>` : glyph(pc.kind);
    el.dataset.k = pc.kind;
  }

  function draw(view) {
    const still = !!view.still || first;
    first = false;
    if (!!view.flip !== flip) { flip = !!view.flip; for (const el of els.values()) el.remove(); els.clear(); }
    const legal = new Set(view.legal || []), area = new Set(view.area || []), marks = new Set(view.marks || []), live = new Set();
    for (const pc of view.pieces || []) {
      live.add(pc.id);
      let el = els.get(pc.id);
      if (!el) {
        layer.insertAdjacentHTML("beforeend", `<span class="at-pc">${"<i class=\"at-slab\"></i>".repeat(SLABS)}<i class="at-top"></i></span>`);
        el = layer.lastElementChild;
        el.classList.add("still");
        at(disp(pc.sq), el);
        void el.offsetWidth;
        el.classList.remove("still");
        els.set(pc.id, el);
      } else if (still) { el.classList.add("still"); at(disp(pc.sq), el); void el.offsetWidth; el.classList.remove("still"); }
      else at(disp(pc.sq), el);
      face(el, pc);
      el.classList.toggle("shown", !!pc.shown);
      el.classList.toggle("moved", !!pc.moved);
      el.classList.toggle("sel", view.sel === pc.sq);
      el.classList.toggle("tipf", !!view.hint && view.hint.f === pc.sq);
      el.classList.toggle("last", !!view.last && view.last.t === pc.sq);
      el.classList.toggle("target", legal.has(pc.sq));                 // a piece the one picked up may attack
    }
    for (const [id, el] of els) {
      if (live.has(id)) continue;
      els.delete(id);
      if (still) el.remove();
      else { el.classList.add("off"); setTimeout(() => el.remove(), 360); }
    }
    grid.classList.toggle("shut", view.tap === false);
    const byPiece = new Map((view.pieces || []).map(p => [p.sq, p]));
    for (let sq = 0; sq < N; sq++) {
      const b = sqs[disp(sq)];
      if (LAKE[sq]) continue;
      b.classList.toggle("legal", legal.has(sq));
      b.classList.toggle("from", !!view.last && view.last.f === sq);
      b.classList.toggle("tip", !!view.hint && view.hint.t === sq);
      b.classList.toggle("clash", view.clash === sq);
      b.classList.toggle("area", area.has(sq));
      b.classList.toggle("mark", marks.has(sq));
      const pc = byPiece.get(sq);
      b.setAttribute("aria-label", `${squareName(sq)}, ${pc ? `${SIDES[pc.side]} ${pc.kind < 0 ? "piece" : NAMES[pc.kind]}` : "empty"}`);
    }
  }
  return { draw, el: box, reset() { first = true; } };
}
