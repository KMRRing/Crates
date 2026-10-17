// Hold'em's stage for its course (course.js): what a lesson shows over its words, drawn as the table draws it. A step may
// carry any of (cards written as text, "Ah Kd 7c", rank then suit d c h s):
//   hole: "Ah Kd" your two cards, with backs: n opponents' hands face down;
//   foes: ["Qs Qd"] hands face up beside yours; board: "7c 8d Qs" the cards turned up so far (five places, the rest empty);
//   each hand is named from the cards it makes with the board, and lit: true lights the five cards that make yours;
//   pick: 5 an exercise: tap the best five of your seven cards (the stage judges: any five of the same worth is right);
//   equity: [46, 54] each hand's share of the pot over every board still to come, as one bar;
//   outs: "2h 3h …" the unseen cards that make the hand, counted;
//   odds: { pot, call, equity? } what a call costs against the pot after it, against the equity if given;
//   layers: { put: [1000, 3000, 5000] } the pot in the layers the all-ins make (seats A, B, C…);
//   bets: [[label, amount | null, note?]] what was bet, as bars (null: the amount the question asks for, a "?");
//   rake: [200, 800, …] what the house takes of each pot at 5% and at 3%;
//   rule: [4, 6, 8, …] outs, and the chance of hitting by the river (the flop) or on the next card (the turn): the quick rule against the exact figure;
//   chen: ["Ah Kh", …] starting hands with their count (holdem-bot.js's);
//   ring: { seats, button, order? } a table seen from above: the button, the blinds and who acts first (order: the order of play after the flop);
//   ranks: true the ten hands, best first; terms: [[zh, jyutping, english]] words of the table.
// Every other exercise is a choice the course itself asks, so the stage otherwise only draws; what a choice asks for (an
// equity, a count of outs, the price of a call, the seats of the blinds) it keeps back until the choice is made.
import { cardHtml } from "./cards.js";
import { parseCards, score, describe, best5, rankOf, suitOf, RANKS, cardName } from "./holdem-eval.js";
import { chen } from "./holdem-bot.js";
import { blindsOf, rakeOf, layers, BLINDS } from "./holdem-rules.js";
import { HAND_EXAMPLES } from "./holdem-sheet.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmt = n => n.toLocaleString("en-GB");
const face = id => ({ rank: RANKS[rankOf(id)] === "T" ? "10" : RANKS[rankOf(id)], suit: suitOf(id) });
const card = (id, cls = "", data = {}) => cardHtml(face(id), { cls, label: cardName(id), data });

/** The chance, in percent, of hitting an out by the river from the flop (two cards to come, 47 unseen) or on the turn (one, 46). */
const C2 = n => (n * (n - 1)) / 2;
export const exactFlop = outs => 100 * (1 - C2(47 - outs) / C2(47));
export const exactTurn = outs => (100 * outs) / 46;
/** The layers of a pot from what each seat has put in (nobody folded). */
export const layersOf = put => layers({ seats: put.length, put, out: put.map(() => false) });
/** What the house takes of a pot of this size, split evenly between two players, at this percentage. */
export const rakeFor = (pot, pct) => rakeOf({ opts: { rake: pct }, put: [pot / 2, pot / 2] });
export const SEAT_NAMES = "ABCDEFGH";

/** A step's cards, parsed once: { hole, foes, board }. */
export function cardsOf(s) {
  return { hole: s.hole ? parseCards(s.hole) : [], foes: (s.foes || []).map(parseCards), board: s.board ? parseCards(s.board) : [] };
}

function ringSvg({ seats: n, button, order = false }, veil = false) {
  const { sb, bb } = blindsOf({ seats: n, button }), first = n === 2 ? button : (bb + 1) % n;
  const cx = 110, cy = 66, rx = 80, ry = 42;
  const at = (i, k = 1) => { const a = (Math.PI / 2) + (2 * Math.PI * i) / n; return [cx + k * rx * Math.cos(a), cy + k * ry * Math.sin(a)]; };
  const seatsSvg = Array.from({ length: n }, (_, i) => {
    const [x, y] = at(i, 1.12), tags = [];
    if (!veil) {
      if (order) { if (i === (button + 1) % n) tags.push("1st"); if (i === button) tags.push("last"); }
      else { if (i === sb) tags.push("SB"); if (i === bb) tags.push("BB"); if (i === first) tags.push("1st"); }
    }
    const [dx, dy] = at(i, 0.62), lit = !veil && (order ? i === (button + 1) % n || i === button : i === first);
    return `<g class="${lit ? "lit" : ""}"><circle class="hx-seat" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="12"/><text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle">${i + 1}</text>` +
      (i === button ? `<circle class="hx-dealer" cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="7"/><text class="hx-dtext" x="${dx.toFixed(1)}" y="${(dy + 3).toFixed(1)}" text-anchor="middle">D</text>` : "") +
      (tags.length ? `<text class="hx-tag" x="${x.toFixed(1)}" y="${(y + (y > cy ? 25 : -17)).toFixed(1)}" text-anchor="middle">${tags.join(" · ")}</text>` : "") + `</g>`;
  }).join("");
  const words = veil ? `A table of ${n}; the button is seat ${button + 1}.` : order ? `Seat ${(button + 1) % n + 1} acts first after the flop and the button, seat ${button + 1}, last.`
    : `The button is seat ${button + 1}; seat ${sb + 1} posts the small blind and seat ${bb + 1} the big blind; seat ${first + 1} acts first before the flop.`;
  return `<svg class="hx-ring" viewBox="0 0 220 140" role="img" aria-label="${esc(words)}"><ellipse class="hx-felt" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>${seatsSvg}</svg>`;
}

function layersHtml({ put }) {
  const ls = layersOf(put), top = Math.max(...ls.map(l => l.amount));
  const name = i => SEAT_NAMES[i];
  const label = (l, i) => (l.back ? `Back to ${name(l.seats[0])}` : i === 0 ? "Main pot" : "Side pot");
  return `<div class="hx-panel hx-layers">${ls.map((l, i) => `<div class="${l.back ? "back" : ""}"><span>${label(l, i)}<small>${l.back ? "" : l.seats.map(name).join(" ")}</small></span><i style="--w:${l.amount / top}"></i><b>${fmt(l.amount)}</b></div>`).join("")}</div>`;
}

/** What was bet, one bar each; an amount of null is what the question asks for. */
function betsHtml(rows) {
  const top = Math.max(1, ...rows.map(r => r[1] || 0));
  return `<div class="hx-panel hx-layers hx-bets">${rows.map(([label, amount, note]) => `<div><span>${esc(label)}<small>${esc(note || "")}</small></span>${amount == null ? `<i class="ask" style="--w:.55"></i><b>?</b>` : `<i style="--w:${amount / top}"></i><b>${fmt(amount)}</b>`}</div>`).join("")}</div>`;
}

/** What a call costs against the pot after it, as figures and a scale of 0 to 100%: the price a tick, your equity the fill. */
function oddsHtml({ pot, call, equity = null }, veil = false, compact = false) {
  const need = (100 * call) / (pot + call), has = equity != null, hide = veil && !has;
  const fig = (name, value, cls = "") => `<span class="${cls}">${name}<b>${value}</b></span>`;
  const verdict = veil || !has ? "" : equity >= need ? "ok" : "no";
  return `<div class="hx-panel hx-odds${compact ? " compact" : ""}"><div class="hx-figs">${fig("Pot", fmt(pot))}${fig("Call", fmt(call))}${fig("Needs", `${need.toFixed(0)}%`, hide ? "veil" : "")}${has ? fig("Equity", `${equity}%`, verdict) : ""}</div>` +
    `<div class="hx-meter${has ? "" : " bare"}${hide ? " veil" : ""}" style="--need:${need}%${has ? `;--have:${equity}%` : ""}"><i class="need"></i>${has ? `<i class="have ${verdict}"></i>` : ""}</div></div>`;
}

function rakeHtml(pots) {
  return `<table class="hx-panel hx-table"><thead><tr><th>Pot</th><th>House at 5%</th><th>at 3%</th></tr></thead><tbody>${pots.map(p => `<tr><td>${fmt(p)}</td><td>${fmt(rakeFor(p, 5))}</td><td>${fmt(rakeFor(p, 3))}</td></tr>`).join("")}</tbody></table>
    <p class="hx-note">The most the house takes: five big blinds, HK$${fmt(5 * BLINDS.big)}.</p>`;
}

function ruleHtml(outs) {
  return `<table class="hx-panel hx-table"><thead><tr><th>Outs</th><th>Flop ×4</th><th>exact</th><th>Turn ×2</th><th>exact</th></tr></thead><tbody>${outs.map(o => `<tr><td>${o}</td><td>${o * 4}%</td><td>${exactFlop(o).toFixed(1)}%</td><td>${o * 2}%</td><td>${exactTurn(o).toFixed(1)}%</td></tr>`).join("")}</tbody></table>`;
}

function termsHtml(terms) {
  return `<dl class="hx-terms">${terms.map(([zh, jp, en]) => `<div><dt>${esc(zh)}</dt><dd><i>${esc(jp)}</i>${esc(en)}</dd></div>`).join("")}</dl>`;
}

const ranksHtml = () => `<div class="hx-panel hx-ranks">${HAND_EXAMPLES.map(([name, cards, zh, jp], i) =>
  `<div><span class="n">${i + 1}</span><span class="cd-line">${parseCards(cards).map(id => card(id)).join("")}</span><span class="t"><b>${name}</b><small>${zh} ${jp}</small></span></div>`).join("")}</div>`;

/** A row's name beside its cards: who they are and, once there's a board, the hand they make. */
const who = (label, name) => `<span class="hx-who"><small>${esc(label)}</small>${name ? `<b class="hx-name">${esc(name)}</b>` : ""}</span>`;

export function holdemStage() {
  let box = null, api = null, step = null, st = null;
  /** A row of cards with its label and, once the board is dealt, the hand they make. */
  function rowHtml(label, hand, board, { pick = false, lit = null, you = false } = {}) {
    const all = [...hand, ...board], made = board.length >= 3 ? describe(score(all)) : null;
    const cls = id => (pick && st.sel?.has(id) ? "sel" : lit ? (lit.has(id) ? "lit" : "dim") : "");
    return `<div class="hx-row${you ? " you" : ""}">${who(label, made?.text)}<span class="cd-line">${hand.map(id => card(id, cls(id), pick ? { id } : {})).join("")}</span></div>`;
  }
  return {
    mount(b, a) {
      box = b;
      api = a;
      box.addEventListener("click", e => {
        const c = e.target.closest(".cd[data-id]");
        if (!c || !step?.pick || st.done) return;
        const id = Number(c.dataset.id);
        st.sel ??= new Set();
        if (st.sel.has(id)) st.sel.delete(id); else if (st.sel.size < step.pick) st.sel.add(id);
        api.changed();
      });
    },
    task: s => !!s.pick,
    ready: (s, t) => t.sel?.size === s.pick,
    label: (s, t) => (t.sel?.size === s.pick ? "That's my hand" : `Pick ${s.pick - (t.sel?.size || 0)} more`),
    submit(s, t) {
      const { hole, board } = cardsOf(s), all = [...hole, ...board], mine = score([...t.sel]), best = score(all);
      const name = describe(mine).text;
      return mine === best ? { ok: true, msg: `${name}: the best five of the seven.` } : { ok: false, why: `That five is ${name.toLowerCase()}: there's a better one in the seven.` };
    },
    hint(s, t) { const { hole, board } = cardsOf(s); t.sel = new Set(best5([...hole, ...board])); },
    draw(s, t) {
      step = s;
      st = t;
      const { hole, foes, board } = cardsOf(s), parts = [];
      // the rows of cards the step draws, and the room (in rem) its other parts take: the cards get what's left
      let n = 0, x = 0;
      const veil = !!s.quiz && !t.done, held = html => (veil ? `<div class="hx-veil" aria-hidden="true">${html}</div>` : html);
      const all = [...hole, ...board];
      const lit = s.lit || (s.pick && t.done) ? new Set(best5(all)) : null;
      if (s.pick) {
        // the seven cards in two lines, each a card to tap
        parts.push(`<div class="hx-row">${who("Board")}<span class="cd-line">${board.map(id => card(id, t.sel?.has(id) ? "sel" : lit ? (lit.has(id) ? "lit" : "dim") : "", { id })).join("")}</span></div>`);
        parts.push(rowHtml("Your cards", hole, board, { pick: true, lit, you: true }));
        n += 2;
      } else {
        // as the table sits: the others at the top, the board between, you at the foot
        for (const [i, f] of foes.entries()) { parts.push(rowHtml(foes.length > 1 ? `Them ${i + 1}` : "Them", f, board)); n++; }
        if (s.backs) { parts.push(`<div class="hx-row">${who(s.backs === 1 ? "Them" : `${s.backs} others`)}<span class="cd-line">${Array.from({ length: Math.min(s.backs, 3) }, () => `<span class="hx-pair"><span class="cd back" aria-hidden="true"></span><span class="cd back" aria-hidden="true"></span></span>`).join("")}</span></div>`); n++; }
        if (hole.length || board.length) {
          parts.push(`<div class="hx-row">${who("Board")}<span class="cd-line">${Array.from({ length: 5 }, (_, i) => (i < board.length ? card(board[i], lit ? (lit.has(board[i]) ? "lit" : "dim") : "") : `<span class="cd-slot"></span>`)).join("")}</span></div>`);
          n++;
        }
        if (hole.length) { parts.push(rowHtml("You", hole, board, { lit, you: true })); n++; }
      }
      if (s.outs) {
        const o = parseCards(s.outs);
        parts.push(`<div class="hx-row outs${veil ? " hx-veil" : ""}">${who(`${o.length} outs`)}<span class="cd-line">${o.map(id => card(id)).join("")}</span></div>`);
        n++;
      }
      if (s.chen) {
        parts.push(`<div class="hx-panel hx-chen">${s.chen.map(h => `<div><span class="cd-line">${parseCards(h).map(id => card(id)).join("")}</span><b${veil ? ' class="hx-veil"' : ""}>${chen(parseCards(h))}</b></div>`).join("")}</div>`);
        x += Math.ceil(s.chen.length / 2) * (s.chen.length === 1 ? 6.6 : 5.6) + .3;
      }
      if (s.equity) {
        const names = [hole.length ? "You" : null, ...foes.map((_, i) => (foes.length > 1 ? `Them ${i + 1}` : "Them"))].filter(Boolean);
        parts.push(held(`<div class="hx-panel hx-equity" role="img" aria-label="${names.map((nm, i) => `${nm} ${s.equity[i]}%`).join(", ")}">${s.equity.map((p, i) => `<i class="e${i}" style="--w:${p}"><b>${names[i]} ${p}%</b></i>`).join("")}</div>`));
        x += 3.2;
      }
      if (s.odds) { parts.push(oddsHtml(s.odds, veil, n > 0)); x += n > 0 ? 3.4 : 5.7; }
      if (s.bets) { parts.push(betsHtml(s.bets)); x += s.bets.length * 1.9 + 1.5; }
      if (s.layers) { parts.push(held(layersHtml(s.layers))); x += layersOf(s.layers.put).length * 1.9 + 1.5; }
      if (s.rake) { parts.push(held(rakeHtml(s.rake))); x += 3.5 + s.rake.length * 1.9; }
      if (s.rule) { parts.push(ruleHtml(s.rule)); x += 3.5 + s.rule.length * 1.9; }
      if (s.ring) parts.push(ringSvg(s.ring, veil));
      if (s.ranks) parts.push(ranksHtml());
      if (s.terms) { parts.push(termsHtml(s.terms)); x += 5.7; }
      box.innerHTML = `<div class="hx${s.ring ? " fill" : ""}" style="--n:${Math.max(1, n)};--x:${x}rem">${parts.join("")}</div>`;
    },
  };
}
