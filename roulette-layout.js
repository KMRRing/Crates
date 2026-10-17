// Roulette's betting layout, drawn to fit its box: the numbers three to a row with zero at the head, the dozens and the
// even-money bets along the side of the first column, the columns' 2 to 1 at the foot. Upright on a phone (zero at the
// top, the outside bets down the left); held sideways it lies as the table does (zero at the left, the outside bets
// along the bottom). The same plan serves both: worked out upright (x across, y down) and turned for sideways.
//
// layoutFor(width, height, sideways) gives the plan: svg(bets, …) draws it with the chips where each bet's chip goes,
// and betAt(x, y, mode) says which bet a tap at (x, y) places in a mode (number, split, street, corner, line). The page
// (roulette.js) keeps the bets; roulette-engine.js says what each is.
import { colourOf, label, numbersOf, kindOf } from "./roulette-engine.js";

const EVENS = [["low", "1–18"], ["even", "Even"], ["red", ""], ["black", ""], ["odd", "Odd"], ["high", "19–36"]];
const short = n => (n >= 1000 ? `${n / 1000}K` : String(n));

/**
 * The plan for a box of width × height: the cell sizes upright (e the even-money column, d the dozens, c a number's
 * width, z zero's height, r a row, k the columns' row), how big it all is, and how to turn it.
 */
export function layoutFor(width, height, sideways = false) {
  // upright: across is the box's width; sideways the plan is turned, so across is its height. Along: zero, twelve rows
  // and the columns' row; across: the even-money bets, the dozens (each .46 of a number's width) and three numbers.
  // Cells keep a sensible shape: upright no taller than .6 of their width, sideways no wider than 2.2 rows
  const across = sideways ? height : width, along = sideways ? width : height;
  let r = along / 14.6, c = across / 3.92;
  if (sideways) c = Math.min(c, r * 2.2); else r = Math.min(r, c * 0.6);
  const e = c * 0.46, d = c * 0.46, z = r * 1.5, k = r * 1.1;
  const W = e + d + 3 * c, H = z + 12 * r + k;
  // upright (x, y) to the box: as is, or turned so that y runs left to right and x runs up from the bottom
  const to = sideways ? (x, y) => [y, W - x] : (x, y) => [x, y];
  return { e, d, c, r, z, k, W, H, sideways, width: sideways ? H : W, height: sideways ? W : H, to };
}

// where each part lies, upright
const numberCell = (p, n) => { const i = n - 1, row = Math.floor(i / 3), col = i % 3; return { x: p.e + p.d + col * p.c, y: p.z + row * p.r, w: p.c, h: p.r }; };
const zeroCell = p => ({ x: p.e + p.d, y: 0, w: 3 * p.c, h: p.z });
const dozenCell = (p, i) => ({ x: p.e, y: p.z + i * 4 * p.r, w: p.d, h: 4 * p.r });
const evenCell = (p, i) => ({ x: 0, y: p.z + i * 2 * p.r, w: p.e, h: 2 * p.r });
const columnCell = (p, i) => ({ x: p.e + p.d + i * p.c, y: p.z + 12 * p.r, w: p.c, h: p.k });
const centre = cell => [cell.x + cell.w / 2, cell.y + cell.h / 2];

/** Where a bet's chip sits, upright: on its number, on the line between two, at the corner of four, on the outer edge. */
export function spotOf(p, key) {
  const kind = kindOf(key), nums = numbersOf(key), left = p.e + p.d;
  const at = n => (n === 0 ? centre(zeroCell(p)) : centre(numberCell(p, n)));
  switch (kind) {
    case "n": return at(nums[0]);
    case "s": {
      const [a, b] = [at(nums[0]), at(nums[1])];
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    }
    case "t": return [left, centre(numberCell(p, nums[0]))[1]];
    case "l": return [left, p.z + (Math.floor((nums[0] - 1) / 3) + 1) * p.r];
    case "c": { const a = numberCell(p, nums[0]); return [a.x + a.w, a.y + a.h]; }
    case "d": return centre(dozenCell(p, Number(key.slice(1)) - 1));
    case "k": return centre(columnCell(p, Number(key.slice(1)) - 1));
    default: return centre(evenCell(p, EVENS.findIndex(([k]) => k === key)));
  }
}

/**
 * The bet a tap at (x, y) in the box places, in a mode: "number" a straight bet on the number tapped; "split" with the
 * neighbour on the side nearest the tap; "street" its row; "corner" the four round the corner nearest; "line" its row
 * and the one on the side nearest. The outside bets answer every mode, and so does zero, which Macau's rules let you
 * bet on only by itself. Null outside the layout.
 */
export function betAt(p, X, Y, mode = "number") {
  // the tap, upright
  const [x, y] = p.sideways ? [p.W - Y, X] : [X, Y], left = p.e + p.d;
  if (x < 0 || y < 0 || x > p.W || y > p.H) return null;
  if (y >= p.z && y < p.z + 12 * p.r) {
    if (x < p.e) return EVENS[Math.min(5, Math.floor((y - p.z) / (2 * p.r)))][0];
    if (x < left) return `d${Math.min(3, Math.floor((y - p.z) / (4 * p.r)) + 1)}`;
  }
  if (y >= p.z + 12 * p.r) return x >= left ? `k${Math.min(3, Math.floor((x - left) / p.c) + 1)}` : null;
  if (x < left) return null;
  const col = Math.min(2, Math.floor((x - left) / p.c)), fx = (x - left) / p.c - col;
  if (y < p.z) return "n0";
  const row = Math.min(11, Math.floor((y - p.z) / p.r)), fy = (y - p.z) / p.r - row, n = row * 3 + col + 1;
  switch (mode) {
    case "split": {
      // the nearest side that has a number beyond it (zero, above the first row, takes no splits)
      const sides = [[fx, col > 0 && `s${n - 1}-${n}`], [1 - fx, col < 2 && `s${n}-${n + 1}`], [fy, row > 0 && `s${n - 3}-${n}`], [1 - fy, row < 11 && `s${n}-${n + 3}`]];
      return sides.filter(([, k]) => k).sort((a, b) => a[0] - b[0])[0][1];
    }
    case "street": return `t${row * 3 + 1}`;
    case "corner": {
      // the corner nearest, kept inside the numbers
      const cl = fx < 0.5 ? Math.max(0, col - 1) : Math.min(1, col), r0 = fy < 0.5 ? Math.max(0, row - 1) : Math.min(row, 10);
      return `c${r0 * 3 + cl + 1}`;
    }
    case "line": {
      const r0 = fy < 0.5 ? Math.max(0, row - 1) : Math.min(row, 10);
      return `l${r0 * 3 + 1}`;
    }
    default: return `n${n}`;
  }
}

/**
 * The layout as SVG markup: the cells (the numbers red and black, zero green), their names, and on top the chips of the
 * bets (`bets`: { key: HK$ }); `lit` the bets to light up (winners), `dolly` the number the marker stands on.
 */
export function layoutSvg(p, { bets = {}, lit = new Set(), dolly = null } = {}) {
  const parts = [], rect = (cell, cls, extra = "") => {
    const [x1, y1] = p.to(cell.x, cell.y), [x2, y2] = p.to(cell.x + cell.w, cell.y + cell.h);
    parts.push(`<rect class="${cls}" x="${Math.min(x1, x2).toFixed(1)}" y="${Math.min(y1, y2).toFixed(1)}" width="${Math.abs(x2 - x1).toFixed(1)}" height="${Math.abs(y2 - y1).toFixed(1)}"${extra}/>`);
  };
  const text = (cell, words, cls, size) => {
    const [cx, cy] = p.to(...centre(cell)), [x1, y1] = p.to(cell.x, cell.y), [x2, y2] = p.to(cell.x + cell.w, cell.y + cell.h);
    // words in a cell much taller than wide run up it; numbers always stand upright
    const tall = cls === "rl-word" && Math.abs(y2 - y1) > Math.abs(x2 - x1) * 1.6;
    parts.push(`<text class="${cls}" x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" font-size="${size.toFixed(1)}"${tall ? ` transform="rotate(-90 ${cx.toFixed(1)} ${cy.toFixed(1)})"` : ""}>${words}</text>`);
  };
  const unit = Math.min(p.r, p.c) * (p.sideways ? 0.42 : 0.62);
  rect({ x: 0, y: 0, w: p.W, h: p.H }, "rl-felt-bg");
  rect(zeroCell(p), `rl-cell green${dolly === 0 ? " dolly" : ""}`);
  text(zeroCell(p), "0", "rl-num", unit * 1.1);
  for (let n = 1; n <= 36; n++) {
    const cell = numberCell(p, n);
    rect(cell, `rl-cell ${colourOf(n)}${dolly === n ? " dolly" : ""}`);
    text(cell, label(n), "rl-num", unit);
  }
  ["1st 12", "2nd 12", "3rd 12"].forEach((w, i) => { rect(dozenCell(p, i), `rl-out${lit.has(`d${i + 1}`) ? " lit" : ""}`); text(dozenCell(p, i), w, "rl-word", unit * 0.72); });
  EVENS.forEach(([key, w], i) => {
    const cell = evenCell(p, i);
    rect(cell, `rl-out${lit.has(key) ? " lit" : ""}`);
    if (key === "red" || key === "black") {
      // red and black are diamonds, as on the felt
      const [cx, cy] = p.to(...centre(cell)), s = Math.min(cell.w, cell.h) * (p.sideways ? 0.3 : 0.32);
      parts.push(`<path class="rl-diamond ${key}" d="M${cx} ${cy - s * 1.3}L${cx + s} ${cy}L${cx} ${cy + s * 1.3}L${cx - s} ${cy}Z"/>`);
    } else text(cell, w, "rl-word", unit * 0.72);
  });
  for (let i = 0; i < 3; i++) { rect(columnCell(p, i), `rl-out${lit.has(`k${i + 1}`) ? " lit" : ""}`); text(columnCell(p, i), "2 to 1", "rl-word", unit * 0.68); }
  // the chips: each bet's, where it goes, its amount on it; a winner lit
  const chipR = Math.min(p.r * 0.5, p.c * 0.3);
  for (const [key, amount] of Object.entries(bets)) {
    if (!(amount > 0)) continue;
    const [cx, cy] = p.to(...spotOf(p, key));
    parts.push(`<g class="rl-chip${lit.has(key) ? " lit" : ""}"><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${chipR.toFixed(1)}"/><text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" font-size="${(chipR * (short(amount).length > 2 ? 0.72 : 0.9)).toFixed(1)}">${short(amount)}</text></g>`);
  }
  if (dolly != null) {
    // the dolly: the marker the dealer stands on the winning number, beside its figures
    const cell = dolly === 0 ? zeroCell(p) : numberCell(p, dolly), [ux, uy] = centre(cell);
    const [cx, cy] = p.to(ux + (p.sideways ? 0 : cell.w * 0.32), uy - (p.sideways ? cell.h * 0.3 : 0)), s = Math.min(p.r, p.c) * 0.42;
    parts.push(`<g class="rl-dolly"><circle cx="${cx.toFixed(1)}" cy="${(cy - s * 0.2).toFixed(1)}" r="${(s * 0.55).toFixed(1)}"/><rect x="${(cx - s * 0.32).toFixed(1)}" y="${(cy + s * 0.15).toFixed(1)}" width="${(s * 0.64).toFixed(1)}" height="${(s * 0.5).toFixed(1)}" rx="2"/></g>`);
  }
  return `<svg class="rl-layout-svg" viewBox="0 0 ${p.width.toFixed(1)} ${p.height.toFixed(1)}" width="${p.width.toFixed(1)}" height="${p.height.toFixed(1)}" role="img" aria-label="The betting layout">${parts.join("")}</svg>`;
}
