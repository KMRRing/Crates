// The plate on the Statecraft page: Kautilya's circle of states (the mandala), drawn from nothing. The would-be conqueror stands in the middle,
// his neighbours ring him as enemies, the states beyond them as friends, and so on outward; the lines join each ring to the next. Colours are
// the suite's tokens (statecraft.css), so it follows the theme and needs nothing fetched.
const RINGS = [{ n: 0, r: 0 }, { n: 6, r: 52 }, { n: 8, r: 95 }, { n: 10, r: 135 }];

export function plate() {
  const c = 150, pts = [], lines = [], rings = [];
  RINGS.forEach((ring, k) => {
    if (k) rings.push(`<circle class="sc-ring" cx="${c}" cy="${c}" r="${ring.r}"/>`);
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * Math.PI * 2 + k * 0.31, x = c + Math.sin(a) * ring.r, y = c - Math.cos(a) * ring.r;
      pts.push({ k, x, y });
    }
  });
  pts.forEach(p => {
    const prev = pts.filter(q => q.k === p.k - 1);
    if (!prev.length) return;
    const near = prev.reduce((b, q) => (Math.hypot(q.x - p.x, q.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? q : b));
    lines.push(`<line class="sc-link" x1="${near.x.toFixed(1)}" y1="${near.y.toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}"/>`);
  });
  const dots = pts.map(p => `<circle class="sc-node ${p.k % 2 ? "foe" : "friend"}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.k === 3 ? 6 : 7}"/>`).join("");
  return `<svg viewBox="0 0 300 300" class="sc-plate-svg" role="img" aria-label="A circle of states"><g>${rings.join("")}${lines.join("")}${dots}`
    + `<circle class="sc-node centre" cx="${c}" cy="${c}" r="12"/><path class="sc-crown" d="M143 153 L145 143 L150 149 L155 143 L157 153 Z"/></g></svg>`;
}
