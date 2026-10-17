// The squeeze (咪牌): a card dealt face down to the biggest bet on its side, peeled back a little at a time. The card is
// drawn large with its pips laid out as a real card's (the squeeze is about the pips: peeling a long side shows
// whether there's a column of pips there at all, then how many), face down; drag in from any edge and the back peels
// away from that edge as far as the finger goes, the bent part showing a lighter band; let go and it lies flat again,
// unless it's mostly peeled, when it turns over. Turn it turns it at once. The page (baccarat.js) opens it over the
// felt and waits for the card to be turned.
import { RANKS, rankOf, suitOf } from "./baccarat-engine.js";

const W = 250, H = 350;                              // the card, in its own units (2.5 by 3.5, as cards.js's)
const SUITS = ["♦", "♣", "♥", "♠"];
// each rank's pips as [x, y] fractions of the card (a pip in the lower half is drawn upside down)
const L = .3, C = .5, R = .7;
const PIPS = {
  1: [[C, .5]],
  2: [[C, .2], [C, .8]],
  3: [[C, .2], [C, .5], [C, .8]],
  4: [[L, .2], [R, .2], [L, .8], [R, .8]],
  5: [[L, .2], [R, .2], [C, .5], [L, .8], [R, .8]],
  6: [[L, .2], [R, .2], [L, .5], [R, .5], [L, .8], [R, .8]],
  7: [[L, .2], [R, .2], [C, .35], [L, .5], [R, .5], [L, .8], [R, .8]],
  8: [[L, .2], [R, .2], [C, .35], [L, .5], [R, .5], [C, .65], [L, .8], [R, .8]],
  9: [[L, .2], [R, .2], [L, .4], [R, .4], [C, .5], [L, .6], [R, .6], [L, .8], [R, .8]],
  10: [[L, .2], [R, .2], [C, .3], [L, .4], [R, .4], [L, .6], [R, .6], [C, .7], [L, .8], [R, .8]],
};

/** A card's face as SVG content (W × H units): its corners, and its pips or, for a court card, a framed picture. */
export function faceSvg(id) {
  const r = rankOf(id), s = suitOf(id), red = s === 0 || s === 2, ink = red ? "var(--cd-red)" : "var(--cd-black)", mark = SUITS[s], name = RANKS[r];
  const corner = `<g fill="${ink}" font-weight="800" text-anchor="middle"><text x="24" y="42" font-size="38">${name}</text><text x="24" y="76" font-size="30">${mark}</text></g>`;
  let body;
  if (r >= 10) {
    // a court card: a framed panel with its letter and a crown, counted nothing
    body = `<rect x="52" y="58" width="146" height="234" rx="8" fill="none" stroke="${ink}" stroke-width="3"/><path d="M95 120L105 95L125 115L145 95L155 120Z" fill="${ink}" opacity=".85"/><text x="125" y="215" font-size="96" font-weight="800" text-anchor="middle" fill="${ink}">${name}</text><text x="125" y="268" font-size="40" text-anchor="middle" fill="${ink}">${mark}</text>`;
  } else {
    const big = r === 0 ? 120 : 52;
    body = PIPS[r + 1].map(([x, y]) => `<text x="${x * W}" y="${y * H}" font-size="${big}" text-anchor="middle" dominant-baseline="central" fill="${ink}"${y > .5 ? ` transform="rotate(180 ${x * W} ${y * H})"` : ""}>${mark}</text>`).join("");
  }
  return `<rect width="${W}" height="${H}" rx="18" fill="var(--cd-face)" stroke="var(--cd-edge)" stroke-width="3"/>${corner}<g transform="rotate(180 ${W / 2} ${H / 2})">${corner}</g>${body}`;
}
/** The card's back: the same blue and gilt lattice the table's backs wear. */
const BACK = `<pattern id="sq-lattice" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="16" height="16" fill="var(--cd-back)"/><path d="M0 0H16M0 0V16" stroke="var(--cd-back-line)" stroke-width="1.6" opacity=".45"/></pattern>`;

/**
 * Opens the squeeze over `host` for card `id`; label says whose card it is. Resolves once the card has been turned.
 */
export function squeeze(host, id, { label = "" } = {}) {
  return new Promise(resolve => {
    const box = document.createElement("div");
    box.className = "bq";
    box.innerHTML = `<p class="bq-head">${label}</p>
      <svg class="bq-card" viewBox="0 0 ${W} ${H}" role="img" aria-label="A card face down: drag in from an edge to peel it"><defs>${BACK}<clipPath id="sq-hide"><path class="bq-clip" d=""/></clipPath></defs>
        <g class="bq-face">${faceSvg(id)}</g>
        <g class="bq-back" clip-path="url(#sq-hide)"><rect width="${W}" height="${H}" rx="18" fill="url(#sq-lattice)" stroke="var(--cd-back-line)" stroke-width="3"/><rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="10" fill="none" stroke="var(--cd-back-line)" stroke-width="2.4" opacity=".8"/></g>
        <path class="bq-fold" d=""/></svg>
      <p class="bq-say">Drag in from an edge to peel it: a long side first shows the pips' columns</p>
      <button class="bc-btn primary bq-turn" type="button">Turn it</button>`;
    host.appendChild(box);
    const svg = box.querySelector(".bq-card"), clip = box.querySelector(".bq-clip"), fold = box.querySelector(".bq-fold");
    let edge = null, depth = 0, done = false;
    /** The back as it lies with `d` units peeled from an edge; the bent strip shown as a lighter band past the line. */
    function draw(d) {
      depth = Math.max(0, d);
      const e = edge || "bottom", k = Math.min(depth, e === "left" || e === "right" ? W : H), band = Math.min(k, 26);
      const rect = { bottom: [0, 0, W, H - k], top: [0, k, W, H - k], left: [k, 0, W - k, H], right: [0, 0, W - k, H] }[e];
      clip.setAttribute("d", `M${rect[0]} ${rect[1]}h${rect[2]}v${rect[3]}h${-rect[2]}Z`);
      // the bent part: a strip just past the peel line, its underside catching the light
      const strip = { bottom: [0, H - k, W, band], top: [0, k - band, W, band], left: [k - band, 0, band, H], right: [W - k, 0, band, H] }[e];
      fold.setAttribute("d", k > 0 ? `M${strip[0]} ${strip[1]}h${strip[2]}v${strip[3]}h${-strip[2]}Z` : "");
    }
    draw(0);
    const toCard = ev => { const m = svg.getScreenCTM(); return m ? new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse()) : null; };
    let start = null;
    svg.addEventListener("pointerdown", ev => {
      if (done) return;
      const p = toCard(ev);
      if (!p) return;
      // the nearest edge is the one peeled
      const dist = { left: p.x, right: W - p.x, top: p.y, bottom: H - p.y };
      edge = Object.entries(dist).sort((a, b) => a[1] - b[1])[0][0];
      start = p;
      try { svg.setPointerCapture(ev.pointerId); } catch { /* a synthetic event */ }
      ev.preventDefault();
    });
    svg.addEventListener("pointermove", ev => {
      if (!start || done) return;
      const p = toCard(ev);
      if (!p) return;
      draw({ bottom: start.y - p.y, top: p.y - start.y, left: p.x - start.x, right: start.x - p.x }[edge] + 6);
    });
    const release = () => {
      if (!start || done) return;
      start = null;
      const full = edge === "left" || edge === "right" ? W : H;
      if (depth > full * .72) turn();
      else { const from = depth, t0 = performance.now(); const step = now => { const f = Math.min(1, (now - t0) / 160); draw(from * (1 - f)); if (f < 1 && !done) requestAnimationFrame(step); }; requestAnimationFrame(step); }
    };
    svg.addEventListener("pointerup", release);
    svg.addEventListener("pointercancel", release);
    function turn() {
      if (done) return;
      done = true;
      edge = edge || "bottom";
      draw(edge === "left" || edge === "right" ? W : H);
      setTimeout(() => { box.remove(); resolve(); }, 380);
    }
    box.querySelector(".bq-turn").addEventListener("click", turn);
  });
}
