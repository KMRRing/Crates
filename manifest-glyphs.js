// The tally's pictures (manifest.js, fillBook): beside each question to come, a small stack of crates drawn in ink with what it
// asks about picked out in brass, so "this is what you're looking for" is seen before the stack lands (Korbi, 23 Nov 2026: "each
// question could get an illustrative 'this is what you're looking for' rendering"; "maybe a bit more accessible somehow"). A tier
// question lights that tier, a spot one a crate on it with a mark, a column's its column, the top its top crate, a count of one
// cargo its crates of that cargo, a weight a weight on the stack, the turned stack an arrow round it, a change and a swap the
// crates that changed. Only what the posting itself says is shown: which spot or column is marked comes with the question.
const X = 3, Y = 2, Z = 3;               // the little stack: three wide, two deep, three high
const W = 10, H = 5, U = 8;              // a cube's half-width, its top's half-depth, its height (px of the drawing)
const OX = 6, OY = 38;                   // where the stack's left corner on the quay sits

/** The corner of the stack's cell (x across, y back, z up) in the drawing, iso: x runs right and down, y right and up. */
const at = (x, y, z) => [OX + (x + y) * W, OY + (x - y) * H - z * U];
const pts = list => list.map(p => p.map(v => +v.toFixed(1)).join(",")).join(" ");
/** A cube's three faces seen: its top, its front (the x side) and its right (the y side). */
function cube(x, y, z, tone) {
  const p = (dx, dy, dz) => at(x + dx, y + dy, z + dz);
  const top = [p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1)], left = [p(0, 0, 0), p(1, 0, 0), p(1, 0, 1), p(0, 0, 1)], right = [p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), p(1, 0, 1)];
  return `<g class="g-${tone}"><polygon class="t" points="${pts(top)}"/><polygon class="l" points="${pts(left)}"/><polygon class="r" points="${pts(right)}"/></g>`;
}
/** The stack: every cell up to a height, painted far to near so the near ones cover the far; `tone(x, y, z)` "lit", "dim" or "ink". */
function stack(height, tone) {
  let out = "";
  for (let y = Y - 1; y >= 0; y--) for (let x = 0; x < X; x++) for (let z = 0; z < height(x, y); z++) out += cube(x, y, z, tone(x, y, z));
  return out;
}
const HEIGHT = (x, y) => [[3, 2, 2], [2, 3, 1]][y][x];
const svg = body => `<svg viewBox="0 0 72 56" aria-hidden="true">${body}</svg>`;
const mark = (x, y, z) => { const [cx, cy] = at(x + 0.5, y + 0.5, z + 1); return `<circle class="g-mark" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2.2"/>`; };

/** The picture for a question of the tally: its kind and, where the posting says it, the tier. SVG text. */
export function glyphFor(order) {
  const q = order.question || {}, type = order.type;
  const tier = q.tier ?? q.cell?.z;
  const all = () => "lit", none = () => "ink";
  switch (type) {
    case "total": return svg(stack(HEIGHT, all));
    case "count": return svg(stack(HEIGHT, (x, y, z) => ((x + y + z) % 3 === 0 ? "lit" : "ink")));
    case "most": return svg(stack((x, y) => (y ? 0 : [1, 3, 2][x]), x => (x === 1 ? "lit" : "ink")));     // three piles, the tallest lit
    case "tier": return svg(stack(HEIGHT, (x, y, z) => (z === tier ? "lit" : "dim")));
    case "spot": return svg(stack(HEIGHT, (x, y, z) => (z === tier && x === 1 && y === 0 ? "lit" : z === tier ? "ink" : "dim")) + mark(1, 0, tier ?? 0));
    case "top": return svg(stack(HEIGHT, (x, y, z) => (x === 1 && y === 0 && z === HEIGHT(1, 0) - 1 ? "lit" : "ink")) + mark(1, 0, HEIGHT(1, 0) - 1));
    case "column": return svg(stack(HEIGHT, (x, y) => (x === 1 && y === 1 ? "lit" : "dim")));
    case "load": return svg(stack(HEIGHT, (x, y, z) => (x === 1 && y === 1 ? (z === 0 ? "lit" : "ink") : "dim")) + arrowDown(1, 1, HEIGHT(1, 1)));
    case "fits": return svg(stack(HEIGHT, (x, y) => (x === 2 && y === 1 ? "lit" : "dim")) + ghost(2, 1, HEIGHT(2, 1), Z));
    case "weight": return svg(stack(HEIGHT, none) + weightMark());
    case "worth": return svg(stack(HEIGHT, none) + coinMark());
    case "turned": return svg(stack(HEIGHT, (x, y, z) => (x === 0 && y === 0 && z === 1 ? "lit" : "ink")) + mark(0, 0, 1) + turnArrow());
    case "which": return svg(stack(HEIGHT, none) + turnArrow());
    case "change": case "changeTurned": return svg(stack(HEIGHT, (x, y, z) => (x === 2 && y === 0 && z === 1 ? "lit" : "ink")) + (type === "changeTurned" ? turnArrow() : ""));
    case "swap": return svg(stack(HEIGHT, (x, y, z) => ((x === 0 && y === 0 && z === 2) || (x === 2 && y === 0 && z === 0) ? "lit" : "ink")) + swapArrow());
    default: return svg(stack(HEIGHT, none));
  }
}
/** A load: an arrow pressing down on the column from above. */
function arrowDown(x, y, h) {
  const [cx, cy] = at(x + 0.5, y + 0.5, h);
  return `<path class="g-line" d="M${cx} ${cy - 13}V${cy - 3}M${cx - 3} ${cy - 6}L${cx} ${cy - 2.5}L${cx + 3} ${cy - 6}"/>`;
}
/** Room: the empty places left on a column, up to the quay's tiers, dashed. */
function ghost(x, y, from, to) {
  let out = "";
  for (let z = from; z < to; z++) {
    const p = (dx, dy, dz) => at(x + dx, y + dy, z + dz);
    out += `<polygon class="g-ghost" points="${pts([p(0, 0, 0), p(1, 0, 0), p(1, 0, 1), p(0, 0, 1)])}"/><polygon class="g-ghost" points="${pts([p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), p(1, 0, 1)])}"/><polygon class="g-ghost" points="${pts([p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1)])}"/>`;
  }
  return out;
}
/** A weight (a merchant's bell weight) and a coin, in brass beside the stack. */
const weightMark = () => `<path class="g-solid" d="M58 15h8l2.5 9h-13z"/><circle class="g-line" cx="62" cy="12.5" r="2.4"/>`;
const coinMark = () => `<circle class="g-solid" cx="63" cy="17" r="6"/><circle class="g-edge" cx="63" cy="17" r="3.8"/>`;
/** A turn: an arrow half round the stack's foot. */
const turnArrow = () => `<path class="g-line" d="M8 48Q30 60 58 47M53.5 45.5L58 47L55 50.5"/>`;
/** A swap: a double arrow between the two that changed places. */
function swapArrow() {
  const [ax, ay] = at(0.5, 0.5, 3.15), [bx, by] = at(2.5, 0.5, 1.15);
  return `<path class="g-line" d="M${ax} ${ay}Q${(ax + bx) / 2 + 2} ${Math.min(ay, by) - 8} ${bx} ${by}M${bx - 4} ${by - 2}L${bx} ${by}L${bx - 1} ${by - 4.5}"/>`;
}
