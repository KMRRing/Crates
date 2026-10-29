// Dandan's review of how a game went, for the end of it: who was ahead at the start of each turn, as the judge
// (dandan-eval.js) reads it, drawn as a chart of the game's advantage and disadvantage; and the record of games won,
// by whom they were played against. The rules note the chance as the game is played (`noteTurn`, in the state's `adv`,
// so it is the same on both phones at a table and survives a reload); the page draws it. Pure, no page:
// tests/dandan-advantage.mjs.
import { winChance } from "./dandan-eval.js";

// ---------- noting it as the game is played ----------
/** A turn and seat 0's chance of winning, in whole percent, as one number: the database keeps no nulls in a list, so a
 *  list of pairs would lose its place, and a list of these can't. */
export const pack = (turn, pct) => turn * 1000 + pct;
export const unpack = v => ({ turn: Math.floor(v / 1000), pct: v % 1000 });
/** A turn has begun: seat 0's chance by the judge, in the state's `adv` (a turn is noted once; the judge was learned
 *  from the start of turns, so that is where it is asked). */
export function noteTurn(s) {
  const adv = (s.adv ||= []);
  if (s.turn > (adv.length ? unpack(adv[adv.length - 1]).turn : 0)) adv.push(pack(s.turn, Math.round(winChance(s, 0) * 100)));
}

// ---------- the game's curve ----------
/** Whose turn it is (turns alternate, from the seat that went first). */
export const activeAt = (first, turn) => (turn % 2 === 1 ? first : 1 - first);
/**
 * The game as the seat saw it: `points`, the chance of winning at the start of each turn noted ({ turn, you }, whole
 * percent), and `end`, where it ended up (100 won, 0 lost, 50 both lost, null while it is on) at `endAt`, the turn after
 * the last. The biggest `swing` between two turns' starts, which turn it happened in and whose it was.
 */
export function curveOf(s, seat) {
  const byTurn = new Map();
  for (const v of s.adv || []) { const { turn, pct } = unpack(v); byTurn.set(turn, seat === 0 ? pct : 100 - pct); }
  const points = [...byTurn].sort((a, b) => a[0] - b[0]).map(([turn, you]) => ({ turn, you }));
  const end = s.over ? (s.winner < 0 ? 50 : s.winner === seat ? 100 : 0) : null;
  let swing = null;
  for (let i = 1; i < points.length; i++) {
    const delta = points[i].you - points[i - 1].you;
    if (!swing || Math.abs(delta) > Math.abs(swing.delta)) swing = { turn: points[i - 1].turn, by: activeAt(s.first, points[i - 1].turn), from: points[i - 1].you, to: points[i].you, delta };
  }
  return { points, end, endAt: Math.max(s.turn, points.at(-1)?.turn || 0) + 1, seat, first: s.first, swing };
}
/** A chart is worth drawing from two turns' starts. */
export const worthDrawing = c => c.points.length >= 2;

/** "your" or "Gill's": whose turn, in words. */
const whose = (names, seat, seatYou) => (seat === seatYou ? "your" : `${names[seat]}'s`);
/** The chart's caption: how long you were ahead, the lowest and the highest, and the biggest swing. */
export function captionOf(c, names) {
  if (!worthDrawing(c)) return "";
  const ahead = c.points.filter(p => p.you > 50).length, n = c.points.length;
  const low = c.points.reduce((a, p) => (p.you < a.you ? p : a)), high = c.points.reduce((a, p) => (p.you > a.you ? p : a));
  const out = [`Ahead at the start of ${ahead} of ${n} turns.`];
  if (c.end === 100 && low.you < 50) out.push(`Won from as low as ${low.you}% (turn ${low.turn}).`);
  else if (c.end === 0 && high.you > 50) out.push(`Lost from as high as ${high.you}% (turn ${high.turn}).`);
  const w = c.swing;
  if (w && Math.abs(w.delta) >= 5) out.push(`Biggest swing: during turn ${w.turn} (${whose(names, w.by, c.seat)} turn), ${w.delta > 0 ? "up" : "down"} ${Math.abs(w.delta)} points, ${w.from}% to ${w.to}%.`);
  return out.join(" ");
}
/** What a tapped point says: i the point's place (the last, past the points, is the end). */
export function readoutOf(c, i, names) {
  if (i >= c.points.length) return c.end == null ? "" : `The game's end: ${c.end === 100 ? "you won" : c.end === 0 ? `${names[1 - c.seat]} won` : "a draw"}.`;
  const p = c.points[i];
  return `Start of turn ${p.turn}, ${whose(names, activeAt(c.first, p.turn), c.seat)} turn: you ${p.you}%, ${names[1 - c.seat]} ${100 - p.you}%.`;
}

// ---------- the chart ----------
// Drawn to a 320 × 124 box, whatever size it's shown at: your chance up the side (the top is certain victory, the line
// across is even, the bottom certain defeat), the turns across, each turn's start a dot on the line; the area between
// the line and even is verdigris above it and oxblood below (clipped, so a crossing is exact), and the game's end is
// where the dashed line stops.
export const BOX = { w: 320, h: 124, l: 30, r: 310, t: 10, b: 100 };
const X = (c, turn) => {
  const lo = c.points[0].turn, span = Math.max(1, c.endAt - lo);
  return BOX.l + ((turn - lo) / span) * (BOX.r - BOX.l);
};
const Y = pct => BOX.t + ((100 - pct) / 100) * (BOX.b - BOX.t);
const f = n => Math.round(n * 10) / 10;
/** The place of a point (0 to the last turn noted, then the end), for a tap at x in the box. */
export function pointAt(c, x) {
  const xs = [...c.points.map(p => X(c, p.turn)), ...(c.end == null ? [] : [X(c, c.endAt)])];
  return xs.reduce((best, px, i) => (Math.abs(px - x) < Math.abs(xs[best] - x) ? i : best), 0);
}
/** The chart as SVG markup, with point `sel` marked (-1 for none). */
export function chartSvg(c, sel = -1) {
  if (!worthDrawing(c)) return "";
  const pts = c.points.map(p => [X(c, p.turn), Y(p.you)]), mid = Y(50);
  const line = pts.map(([x, y]) => `${f(x)},${f(y)}`).join(" ");
  const area = `M${f(pts[0][0])},${f(mid)} ${pts.map(([x, y]) => `L${f(x)},${f(y)}`).join(" ")} L${f(pts.at(-1)[0])},${f(mid)} Z`;
  const endX = X(c, c.endAt), endY = c.end == null ? null : Y(c.end);
  const label = (i, turn) => `<text x="${f(X(c, turn))}" y="${BOX.h - 6}" text-anchor="middle" font-size="9" class="dd-adv-x${i === sel ? " on" : ""}">${turn}</text>`;
  // a label to every few turns where there are many (games run to forty turns): twelve at the most, and the end (a turn's
  // label too near it is left out, or the two would run into one word)
  const step = Math.ceil(c.points.length / 12), first = c.points[0].turn, small = c.points.length > 30;
  const grid = [0, 25, 50, 75, 100].map(p => `<line x1="${BOX.l}" x2="${BOX.r}" y1="${f(Y(p))}" y2="${f(Y(p))}" class="dd-adv-grid${p === 50 ? " mid" : ""}"/>`).join("");
  const ys = [[100, "100"], [50, "50"], [0, "0"]].map(([p, t]) => `<text x="${BOX.l - 5}" y="${f(Y(p) + 3)}" text-anchor="end" font-size="9" class="dd-adv-y">${t}</text>`).join("");
  const dots = pts.map(([x, y], i) => `<circle cx="${f(x)}" cy="${f(y)}" r="${i === sel ? 4 : small ? 1.7 : 2.4}" class="dd-adv-dot${i === sel ? " on" : ""}"/>`).join("");
  const ending = endY == null ? "" : `<line x1="${f(pts.at(-1)[0])}" y1="${f(pts.at(-1)[1])}" x2="${f(endX)}" y2="${f(endY)}" class="dd-adv-end"/>`
    + `<circle cx="${f(endX)}" cy="${f(endY)}" r="${sel === c.points.length ? 5 : 3.6}" class="dd-adv-fin ${c.end === 100 ? "won" : c.end === 0 ? "lost" : "drawn"}"/>`;
  const selX = sel < 0 ? null : sel < c.points.length ? pts[sel][0] : endX;
  const mark = selX == null ? "" : `<line x1="${f(selX)}" x2="${f(selX)}" y1="${BOX.t}" y2="${BOX.b}" class="dd-adv-sel"/>`;
  return `<svg class="dd-adv" viewBox="0 0 ${BOX.w} ${BOX.h}" role="img" aria-label="${c.points.length} turns: your chance of winning at the start of each, from ${c.points[0].you}% to ${c.points.at(-1).you}%${c.end == null ? "" : c.end === 100 ? ", and you won" : c.end === 0 ? ", and you lost" : ", and it was a draw"}">`
    + `<defs><clipPath id="ddAdvUp"><rect x="0" y="0" width="${BOX.w}" height="${f(mid)}"/></clipPath><clipPath id="ddAdvDown"><rect x="0" y="${f(mid)}" width="${BOX.w}" height="${BOX.h}"/></clipPath></defs>`
    + grid + `<path d="${area}" class="dd-adv-up" clip-path="url(#ddAdvUp)"/><path d="${area}" class="dd-adv-down" clip-path="url(#ddAdvDown)"/>`
    + mark + `<polyline points="${line}" class="dd-adv-line"/>` + ending + dots + ys
    + `<text x="${BOX.l + 4}" y="${BOX.t + 9}" font-size="8" class="dd-adv-side">you ahead</text><text x="${BOX.l + 4}" y="${BOX.b - 4}" font-size="8" class="dd-adv-side">you behind</text>`
    + c.points.map((p, i) => ((p.turn - first) % step === 0 && (c.end == null || endX - X(c, p.turn) >= 18) ? label(i, p.turn) : "")).join("")
    + (c.end == null ? "" : `<text x="${f(endX)}" y="${BOX.h - 6}" text-anchor="middle" font-size="9" class="dd-adv-x${sel === c.points.length ? " on" : ""}">End</text>`)
    + `</svg>`;
}

// ---------- the record ----------
/** Who a game was played against, in the order the record lists them. */
export const OPPONENTS = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["friend", "A friend"]];
export const emptyRecord = () => ({ played: 0, won: 0, by: {}, last: "" });
/** The record as it stands (an older one has only what was played and won), with a game's result added: `vs` one of
 *  OPPONENTS' keys; a draw counts as played and not won. The last twenty results are kept, newest last: W, L or D.
 *  `game` says which game it was (when it began): the one counted last isn't counted again, and the record handed back
 *  is then the very one given, so a caller can tell. */
export function addResult(rec, { won, drawn = false, vs, game }) {
  if (game != null && rec?.game === game) return rec;
  const r = { ...emptyRecord(), ...rec, by: { ...(rec?.by || {}) } };
  if (game != null) r.game = game;
  r.played++;
  if (won) r.won++;
  if (vs) { const [p, w] = r.by[vs] || [0, 0]; r.by[vs] = [p + 1, w + (won ? 1 : 0)]; }
  r.last = `${r.last}${won ? "W" : drawn ? "D" : "L"}`.slice(-20);
  return r;
}
const pct = (w, p) => (p ? Math.round((100 * w) / p) : 0);
/** The record in words and rows: the total, a row for each kind of opponent played (and the games from before they were
 *  counted), and the last ten results, newest last. */
export function recordOf(rec) {
  const r = { ...emptyRecord(), ...rec };
  const rows = OPPONENTS.filter(([k]) => r.by?.[k]?.[0]).map(([k, label]) => ({ key: k, label, played: r.by[k][0], won: r.by[k][1], pct: pct(r.by[k][1], r.by[k][0]) }));
  const counted = rows.reduce((a, x) => a + x.played, 0), wonCounted = rows.reduce((a, x) => a + x.won, 0);
  if (r.played > counted) rows.push({ key: "earlier", label: "Earlier games", played: r.played - counted, won: r.won - wonCounted, pct: pct(r.won - wonCounted, r.played - counted) });
  return { played: r.played, won: r.won, pct: pct(r.won, r.played), rows, last: [...r.last.slice(-10)] };
}
