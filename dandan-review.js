// Dandan's review: what the coach made of each decision of yours, kept across games. With the coach on Review (or Check,
// or Always) every move of yours is weighed as you make it (dandan-coach.js `verdict`); the ones it would have played
// otherwise by 5 points or more are kept here, counted by what they were about (the coach's themes), for a sheet that
// says which mistakes come most often and lists the plays to go through. Pure, no page: tests/dandan-review.mjs.
import { THEMES } from "./dandan-coach.js";
import { DECK } from "./dandan-cards.js";

/** A play the review keeps: the coach's move came out at least this much ahead (a share of the chance of winning). */
export const GAP = 0.05;
/** How many plays are kept, the newest: the counts by theme are kept for all of them. */
export const KEEP = 40;

export const emptyReview = () => ({ n: 0, m: 0, games: 0, game: null, kinds: {}, plays: [] });

/** The table in a line, at a decision: the turn, both lives, and the hand held. */
export function ctxOf(state, seat) {
  const seen = new Map();
  for (const id of state.hand?.[seat] || []) { const n = DECK[id]; if (n) seen.set(n, (seen.get(n) || 0) + 1); }
  const hand = [...seen].map(([n, k]) => (k > 1 ? `${n} ×${k}` : n)).join(", ");
  return `Turn ${state.turn} · you ${state.life[seat]} life, they ${state.life[1 - seat]} · ${hand ? `your hand: ${hand}` : "your hand is empty"}`;
}

/**
 * The review with one more decision weighed: `vd` the coach's verdict on the move (null when it agreed, or the move was
 * as good as the coach's near as can be told). A verdict of GAP or more is kept as a play and counted under its theme.
 * `game` says which game it was (when it began), `state` the table before the move. Returns a new review.
 */
export function noteDecision(rev, vd, { game = null, state, seat } = {}) {
  const r = { ...emptyReview(), ...rev, kinds: { ...(rev?.kinds || {}) }, plays: [...(rev?.plays || [])] };
  if (game != null && game !== r.game) { r.game = game; r.games++; }
  r.n++;
  if (vd && vd.gap >= GAP) {
    const pts = Math.round(100 * vd.gap), k = THEMES[vd.theme] ? vd.theme : "other", [count, sum] = r.kinds[k] || [0, 0];
    r.m++;
    r.kinds[k] = [count + 1, sum + pts];
    r.plays.unshift({ g: game, t: state.turn, k, p: pts, w: String(vd.words).slice(0, 700), c: ctxOf(state, seat) });
    r.plays.length = Math.min(r.plays.length, KEEP);
  }
  return r;
}

/** The themes the plays fall under, the most common first (then the costliest): { kind, title, lesson, count, share, avg } */
export function commonMistakes(rev, limit = 5) {
  return Object.entries(rev?.kinds || {})
    .map(([kind, [count, sum]]) => ({ kind, title: THEMES[kind]?.[0] || THEMES.other[0], lesson: THEMES[kind]?.[1] || THEMES.other[1], count, share: rev.m ? count / rev.m : 0, avg: Math.round(sum / count) }))
    .sort((a, b) => b.count - a.count || b.avg - a.avg)
    .slice(0, limit);
}
/** The plays kept, the costliest first or the newest (as kept), of one theme or all. */
export function playsOf(rev, { kind = null, order = "cost" } = {}) {
  const list = (rev?.plays || []).filter(p => !kind || p.k === kind);
  return order === "new" ? list : list.map((p, i) => [p, i]).sort((a, b) => b[0].p - a[0].p || a[1] - b[1]).map(x => x[0]);
}
const percent = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
/** What the review holds, in a sentence. */
export function headline(rev) {
  if (!rev?.n) return "";
  const says = `The coach weighed ${plural(rev.n, "decision", "decisions")} of yours in ${plural(rev.games, "game", "games")}.`;
  return rev.m
    ? `${says} It would have played ${rev.m === 1 ? "one" : rev.m} otherwise by ${Math.round(100 * GAP)} points or more (${percent(rev.m, rev.n)}%).`
    : `${says} None came out ${Math.round(100 * GAP)} points or more worse than its move.`;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const dayOf = g => (Number.isFinite(g) && g > 1e11 ? new Date(g).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "");
/**
 * The review sheet's body: the headline, the mistakes that come most often with the rule of thumb behind each, and the
 * plays (view.kind: only one theme's, view.order: "cost" or "new"). The buttons carry data-kind, data-order and
 * data-clear for the page to answer.
 */
export function reviewHtml(rev, view = {}) {
  if (!rev?.n) return `<p class="dd-rv-empty">Nothing weighed yet. Set the coach to Review (or Check, or Always) in the menu and play: it weighs each of your moves, and what it would have played otherwise, by 5 points or more, comes here. Review does it out of sight.</p>`;
  const kinds = commonMistakes(rev), kind = kinds.some(k => k.kind === view.kind) ? view.kind : null, order = view.order === "new" ? "new" : "cost";
  const plays = playsOf(rev, { kind, order });
  const clear = `<button type="button" class="dd-rv-link dd-rv-clear" data-clear="1">Clear the review</button>`;
  const head = `<p class="dd-rv-head">${esc(headline(rev))}</p>`;
  if (!rev.m) return head + clear;
  const list = kinds.map(k => `<li${k.kind === kind ? ' class="on"' : ""}><div class="dd-rv-k"><b>${esc(k.title)}</b><span>${plural(k.count, "play", "plays")} · ${k.avg} points worse on average</span></div><p>${esc(k.lesson)}</p><button type="button" class="dd-rv-link" data-kind="${k.kind}">${k.kind === kind ? "Showing these plays" : "Show these plays"}</button></li>`).join("");
  const rows = plays.map(p => `<li><div class="dd-rv-top"><b>${p.p} points worse</b><span>${[dayOf(p.g), `turn ${p.t}`].filter(Boolean).join(" · ")}</span></div><p class="dd-rv-ctx">${esc(p.c)}</p><p>${esc(p.w)}</p>${p.k !== "other" && !kind ? `<span class="dd-rv-tag">${esc(THEMES[p.k]?.[0] || "")}</span>` : ""}</li>`).join("");
  const seg = ([k, t]) => `<button type="button" data-order="${k}" aria-pressed="${k === order}">${t}</button>`;
  return `${head}
    <h3 class="dd-rv-h">Your most common mistakes</h3>
    <ol class="dd-rv-kinds">${list}</ol>
    <h3 class="dd-rv-h dd-rv-playsh">Plays the coach disagreed with${kind ? `: ${esc(THEMES[kind][0])} <button type="button" class="dd-rv-link" data-kind="">All plays</button>` : ""}</h3>
    <div class="dd-rv-seg" role="group" aria-label="Order">${[["cost", "Costliest first"], ["new", "Newest first"]].map(seg).join("")}</div>
    <ul class="dd-rv-plays">${rows}</ul>
    <p class="dd-rv-note">The newest ${KEEP} plays are kept; the counts above are of all of them. The chances are the coach's, from deals of the cards you couldn't see (Medium's model of the computer players, not of people).</p>
    ${clear}`;
}
