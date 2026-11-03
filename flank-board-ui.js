// Flank's board on the page, one component for the game and the course: 64 squares made once and changed in place, so a
// disc that turns is the same element turning (a transition in flank.css; the move is already in the game, this is only
// drawing). Squares are buttons: a tap is onTap(square). A disc has a dark face with a solid pip and a light face with a
// ring, so which is which never depends on colour alone.
import { sqName } from "./flank-board.js";

const FILES = "abcdefgh";
const NAME = { d: "dark", l: "light" };

/**
 * createBoard(box, { onTap, labels }) → { draw(view), el, cells }
 * view: { b (64 characters: "d", "l", "."), legal (squares to mark), last (the square just played), flips (the discs
 * that turned with it, which ripple outwards from last), hint (a square), marks ({ sq: "good" | "bad" | "pick" }),
 * tap (squares answer taps; default true), still (draw without moving) }
 */
export function createBoard(box, { onTap = () => {}, labels = true } = {}) {
  box.classList.add("fk-frame");
  box.innerHTML = `${labels ? `<i class="fk-corner"></i><div class="fk-files" aria-hidden="true">${[...FILES].map(f => `<i>${f}</i>`).join("")}</div>
    <div class="fk-ranks" aria-hidden="true">${[1, 2, 3, 4, 5, 6, 7, 8].map(r => `<i>${r}</i>`).join("")}</div>` : ""}
    <div class="fk-grid" role="group" aria-label="The board">${Array.from({ length: 64 }, (_, sq) => `<button type="button" class="fk-cell" data-sq="${sq}" aria-label="${sqName(sq)}, empty">
      <span class="fk-disc" data-on="0"><span class="fk-coin" data-s="d"><i class="fk-face d"></i><i class="fk-face l"></i></span></span><b class="fk-dot"></b></button>`).join("")}</div>`;
  if (!labels) box.classList.add("bare");
  const grid = box.querySelector(".fk-grid"), cells = [...grid.children];
  const parts = cells.map(c => ({ cell: c, disc: c.querySelector(".fk-disc"), coin: c.querySelector(".fk-coin") }));
  let prev = null;
  grid.addEventListener("click", e => {
    const c = e.target.closest(".fk-cell");
    if (c && !grid.classList.contains("shut")) onTap(Number(c.dataset.sq));
  });

  function draw(view) {
    const b = view.b || ".".repeat(64), legal = new Set(view.legal || []), flips = new Set(view.flips || []), marks = view.marks || {};
    const last = view.last ?? -1, still = !!view.still || prev === null;
    grid.classList.toggle("shut", view.tap === false);
    for (let sq = 0; sq < 64; sq++) {
      const { cell, disc, coin } = parts[sq], now = b[sq], was = prev ? prev[sq] : ".";
      const changed = now !== was;
      if (changed || prev === null) {
        if (now === ".") disc.dataset.on = "0";
        else if (was === "." || still) {
          // a disc placed: it appears already facing the way it will (no spinning in), then grows
          coin.classList.add("nt");
          coin.style.transitionDelay = "";
          coin.dataset.s = now;
          void coin.offsetWidth;
          coin.classList.remove("nt");
          disc.dataset.on = "1";
        } else {
          // a disc turned: the ripple runs outwards from the square played, a beat for each square of distance
          const d = last >= 0 && flips.has(sq) ? Math.max(Math.abs((sq >> 3) - (last >> 3)), Math.abs((sq & 7) - (last & 7))) : 0;
          coin.style.transitionDelay = still ? "0s" : `${Math.max(0, d - 1) * 0.07}s`;
          coin.dataset.s = now;
        }
        if (still) { disc.classList.add("nt"); coin.classList.add("nt"); void disc.offsetWidth; disc.classList.remove("nt"); coin.classList.remove("nt"); }
        cell.setAttribute("aria-label", `${sqName(sq)}, ${now === "." ? "empty" : NAME[now]}`);
      }
      cell.classList.toggle("legal", legal.has(sq) && now === ".");
      cell.classList.toggle("last", sq === last);
      cell.classList.toggle("fk-tip", sq === view.hint);
      const m = marks[sq] || "";
      cell.dataset.mark = m;
    }
    prev = b;
  }
  return { draw, el: box, cells, grid, reset() { prev = null; } };
}
