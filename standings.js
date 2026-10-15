// A table's standings, drawn the same in every game played by more than two (October 2026): who's ahead, by how
// much, and what the last round did to it. rank() is pure (tests/standings.mjs); leaderboard() draws the list with
// duel.css's rank rows, each player's dot in their seat's colour (--p0…--p5, style.css).

/** Rows best first, each with its rank; equal values share a rank. value(row) is what ranks (lower: less is better). */
export function rank(rows, { value = r => r.value, lower = false } = {}) {
  const v = r => Number(value(r)) || 0;
  const better = (a, b) => (lower ? v(a) < v(b) : v(a) > v(b));
  return [...rows].sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0))
    .map((r, _, all) => ({ ...r, rank: 1 + all.filter(o => better(o, r)).length }));
}

/** A signed amount as the rows show it: +120, −35, ±0. */
export const signed = (n, format = x => x.toLocaleString("en-GB")) => (n > 0 ? `+${format(n)}` : n < 0 ? `−${format(-n)}` : "±0");

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

/**
 * The standings as a ranked list. rows: [{ name, value (what ranks), shown (the score as words, else value
 * formatted), delta (this round's change, shown signed; omit for none), seat (the player's colour), me, note (a few
 * words under the name: their answer this round) }]. The leader is shaded, this device's player outlined.
 */
export function leaderboard(rows, { lower = false, format = x => x.toLocaleString("en-GB") } = {}) {
  const list = el("ol", "duel-rank standings");
  for (const r of rank(rows, { lower })) {
    const li = el("li", `${r.me ? "me" : ""}${r.rank === 1 ? " top" : ""}`);
    const who = el("b");
    if (r.seat != null) { const dot = el("i", "standings-dot"); dot.style.background = `var(--p${r.seat % 6})`; who.append(dot); }
    who.append(r.name || "Player");
    const name = el("span", "standings-who");
    name.append(who);
    if (r.note) name.append(el("small", "", r.note));
    li.append(el("span", "duel-pos", String(r.rank)), name);
    if (r.delta != null) li.append(el("span", `standings-delta${r.delta > 0 ? " up" : r.delta < 0 ? " down" : ""}`, signed(r.delta, format)));
    li.append(el("span", "duel-score", r.shown ?? format(Number(r.value) || 0)));
    list.append(li);
  }
  return list;
}
