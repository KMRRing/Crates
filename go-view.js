// Go's board, drawn as one SVG: the lines, the star points, the stones, the last move, the marks of scoring and the
// computer's estimate. Nothing here knows a rule; go.js hands over a model each time and gets taps back as points.
// Stones are gradients and stacked shapes, never an SVG filter (Safari blurs a filter on a picture that matters).

import { BLACK, WHITE } from "./go-rules.js";

const NS = "http://www.w3.org/2000/svg";
export const MARGIN = 0.95;                        // room round the lines for the coordinates, in line spacings
const LETTERS = "ABCDEFGHJKLMNOPQRST";

export function starPoints(n) {
  if (n === 9) return [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]];
  const lo = n === 13 ? 3 : 3, hi = n - 1 - lo, mid = (n - 1) / 2;
  return [[lo, lo], [hi, lo], [mid, mid], [lo, hi], [hi, hi], [lo, mid], [hi, mid], [mid, lo], [mid, hi]];
}

export function createBoard(host, { onTap }) {
  let model = null, size = 0;
  host.classList.add("go-svg-host");

  const pointAt = (e) => {
    const svg = host.querySelector("svg");
    if (!svg || !size) return -1;
    const r = svg.getBoundingClientRect(), span = size - 1 + 2 * MARGIN;
    const x = Math.round(((e.clientX - r.left) / r.width) * span - MARGIN);
    const y = Math.round(((e.clientY - r.top) / r.height) * span - MARGIN);
    return x < 0 || y < 0 || x >= size || y >= size ? -1 : y * size + x;
  };
  host.addEventListener("click", (e) => {
    if (!model || model.locked) return;
    const pt = pointAt(e);
    if (pt >= 0) onTap(pt);
  });

  function draw(m) {
    model = m;
    size = m.size;
    const n = size, span = n - 1 + 2 * MARGIN, o = MARGIN;
    let s = `<svg viewBox="0 0 ${span} ${span}" role="img" aria-label="Go board, ${n} by ${n}" preserveAspectRatio="xMidYMid meet">`;
    s += `<defs>
      <radialGradient id="go-gb" cx=".35" cy=".3" r=".8"><stop offset="0" style="stop-color: var(--go-black-hi)"/><stop offset=".7" style="stop-color: var(--go-black)"/></radialGradient>
      <radialGradient id="go-gw" cx=".35" cy=".3" r=".8"><stop offset="0" style="stop-color: var(--go-white-hi)"/><stop offset=".75" style="stop-color: var(--go-white)"/></radialGradient></defs>`;
    s += `<rect class="go-wood" x="0" y="0" width="${span}" height="${span}" rx=".25"/>`;
    // the lines and their coordinates
    let g = "";
    for (let i = 0; i < n; i++) {
      g += `M${o} ${o + i}H${o + n - 1}M${o + i} ${o}V${o + n - 1}`;
    }
    s += `<path class="go-lines" d="${g}"/>`;
    for (const [x, y] of starPoints(n)) s += `<circle class="go-star" cx="${o + x}" cy="${o + y}" r=".11"/>`;
    for (let i = 0; i < n; i++) {
      s += `<text class="go-coord" font-size=".36" x="${o + i}" y=".6" text-anchor="middle">${LETTERS[i]}</text><text class="go-coord" font-size=".36" x="${o + i}" y="${span - .28}" text-anchor="middle">${LETTERS[i]}</text>`;
      s += `<text class="go-coord" font-size=".36" x=".42" y="${o + i + .13}" text-anchor="middle">${n - i}</text><text class="go-coord" font-size=".36" x="${span - .42}" y="${o + i + .13}" text-anchor="middle">${n - i}</text>`;
    }
    // the computer's estimate of who owns what (a quiet square on each point), or the final count
    if (m.estimate) {
      for (let i = 0; i < n * n; i++) {
        const v = m.estimate[i];
        if (Math.abs(v) < 0.25) continue;
        s += `<rect class="go-est ${v > 0 ? "b" : "w"}" x="${o + (i % n) - .2}" y="${o + Math.floor(i / n) - .2}" width=".4" height=".4" opacity="${Math.min(.85, Math.abs(v) * .9).toFixed(2)}"/>`;
      }
    }
    if (m.owner) {
      for (let i = 0; i < n * n; i++) {
        const w = m.owner[i];
        if ((w !== BLACK && w !== WHITE) || (m.stones[i] === w && !m.dead.has(i))) continue;
        s += `<rect class="go-terr ${w === BLACK ? "b" : "w"}" x="${o + (i % n) - .17}" y="${o + Math.floor(i / n) - .17}" width=".34" height=".34"/>`;
      }
    }
    for (let i = 0; i < n * n; i++) {
      const c = m.stones[i];
      if (!c) continue;
      const cx = o + (i % n), cy = o + Math.floor(i / n), dead = m.dead.has(i);
      s += `<g class="go-stone${dead ? " dead" : ""}"><circle class="${c === BLACK ? "gb" : "gw"}" cx="${cx}" cy="${cy}" r=".485"/>`;
      if (dead) s += `<path class="go-x ${c === BLACK ? "on-b" : "on-w"}" d="M${cx - .2} ${cy - .2}L${cx + .2} ${cy + .2}M${cx + .2} ${cy - .2}L${cx - .2} ${cy + .2}"/>`;
      s += `</g>`;
    }
    if (m.last >= 0 && !m.dead.size) {
      const c = m.stones[m.last];
      s += `<circle class="go-last ${c === BLACK ? "on-b" : "on-w"}" cx="${o + (m.last % n)}" cy="${o + Math.floor(m.last / n)}" r=".23"/>`;
    }
    if (m.ko >= 0) s += `<rect class="go-ko" x="${o + (m.ko % n) - .18}" y="${o + Math.floor(m.ko / n) - .18}" width=".36" height=".36"/>`;
    if (m.hint >= 0) {                                   // the coach's move: a brass ring with a dot
      const hx = o + (m.hint % n), hy = o + Math.floor(m.hint / n);
      s += `<circle class="go-hint" cx="${hx}" cy="${hy}" r=".4"/><circle class="go-hint-dot" cx="${hx}" cy="${hy}" r=".1"/>`;
    }
    if (m.pending >= 0) {
      s += `<circle class="go-ghost ${m.toMove === BLACK ? "gb" : "gw"}" cx="${o + (m.pending % n)}" cy="${o + Math.floor(m.pending / n)}" r=".485"/>`;
    }
    s += `</svg>`;
    host.innerHTML = s;
  }
  return { draw };
}
