// Guandan's course (Learn, in the menu): the game taught from nothing on the course's sheet (course.js) with a stage of
// its own, the cards drawn as the table draws them. Every question is put to the referee (tribute-engine.js): what a
// set of cards is (classify), what beats what (readingFor, beats), the tribute and its return, who rises; a lesson only
// describes a table, so the course can't disagree with the game. It teaches the game's rules: the 2022 competition rules
// (two decks, 27 cards each, the level's two hearts wild, tribute from the second hand).
//
// Cards are written rank and suit: 3s 10h Qd Ac, with SJ and BJ for the jokers (two decks: a card may be written twice).
// A step's table: level (the hand's level card, 2 by default), hand (the cards to pick from), top (the play to beat) with
// topBy (who made it), rows [{ label, zh, cards | text }] examples. An exercise's goal: tiles (tap the cards that are
// `what`, by `pred`: wild, level, joker), play (tap the cards of a play: `want` names its kind, and any `top` must be beaten),
// high (the highest single), tribute (the card you must pay), return (the card you may give back), choose (a button:
// `options`, `answer`). Quiz steps may carry check(), which the tests compare with the answer; any step quoting
// a figure carries proves().
import * as E from "./tribute-engine.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const RANK = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, T: 10, J: 11, Q: 12, K: 13, A: 14 };
const SUIT = { s: 0, h: 1, c: 2, d: 3 };

// ---------- cards as text ----------
/** Cards written "3s 10h BJ" as ids (two decks: the first free copy); taken: ids already used, shared across texts of one pack. */
export function cardsOf(text, taken = new Set()) {
  const out = [];
  for (const tok of String(text ?? "").trim().split(/\s+/).filter(Boolean)) {
    let copies;
    if (tok === "SJ") copies = [104, 105];
    else if (tok === "BJ") copies = [106, 107];
    else {
      const m = /^(10|[2-9TJQKA])([shcd])$/.exec(tok);
      if (!m) throw new Error(`no card "${tok}"`);
      const base = SUIT[m[2]] * 13 + RANK[m[1]] - 2;
      copies = [base, base + 52];
    }
    const id = copies.find(c => !taken.has(c));
    if (id === undefined) throw new Error(`"${tok}" written more than twice`);
    taken.add(id);
    out.push(id);
  }
  return out;
}
export const levelOf = step => step.level ?? 2;
/** A step's hand in the order the game keeps it, and the play to beat. */
export function tableOf(step) {
  const taken = new Set(), level = levelOf(step);
  const hand = E.sortHand(cardsOf(step.hand, taken), level), top = cardsOf(step.top, taken);
  return { level, hand, top, topReading: top.length ? E.readingFor(top, level, null) : null };
}
const kindOf = r => (r.sf ? "sf" : r.bomb ? "bomb" : r.type);
const KINDS = { single: "a single", pair: "a pair", triple: "three of a kind", full: "a full house", straight: "a straight", tube: "three pairs in a row", plate: "two triples in a row", bomb: "a bomb", sf: "a straight flush" };

// ---------- the answers judged ----------
function pickPred(step, id, level) {
  if (step.pred === "wild") return E.isWild(id, level);
  if (step.pred === "level") return !E.isJoker(id) && E.rankOf(id) === level;
  if (step.pred === "joker") return E.isJoker(id);
  return false;
}
/** A pick (indices into the hand) judged: tiles, play. */
export function judgePick(step, picked) {
  const { level, hand, top, topReading } = tableOf(step), idx = [...picked].sort((a, b) => a - b), ids = idx.map(i => hand[i]);
  if (step.goal === "tiles") {
    const right = hand.map((id, i) => (pickPred(step, id, level) ? i : -1)).filter(i => i >= 0);
    const wrong = idx.filter(i => !right.includes(i)), missed = right.filter(i => !idx.includes(i));
    if (!wrong.length && !missed.length) return { ok: true, msg: step.then || "Right." };
    return { ok: false, why: wrong.length ? `${E.cardName(hand[wrong[0]])} isn't ${step.what}.` : `You've missed ${missed.length}.` };
  }
  const all = E.classify(ids, level);
  if (!ids.length) return { ok: false, why: "Pick some cards." };
  if (!all.length) return { ok: false, why: "Those cards aren't a play: a single, a pair, three alike, a full house, a straight, three pairs or two triples in a row, or a bomb." };
  const r = E.readingFor(ids, level, topReading);
  if (!r) return { ok: false, why: `That's ${E.playName(all[0])}, which doesn't beat ${E.playName(topReading)}: the same kind and number of cards, higher, or a bomb.` };
  if (step.want && kindOf(r) !== step.want) return { ok: false, why: `That's ${E.playName(r)}; this time make ${KINDS[step.want]}.` };
  return { ok: true, msg: `${E.playName(r)[0].toUpperCase()}${E.playName(r).slice(1)}. ${step.then || ""}`.trim() };
}
/** The first pick (indices) a play step accepts: what Hint shows (smallest cards that do it). */
export function answerPick(step) {
  const { hand } = tableOf(step);
  if (step.goal === "tiles") return hand.map((id, i) => (pickPred(step, id, levelOf(step)) ? i : -1)).filter(i => i >= 0);
  const n = hand.length;
  let best = null;
  for (let m = 1; m < 1 << n; m++) {
    const idx = [...Array(n).keys()].filter(i => (m >> i) & 1);
    if (best && idx.length >= best.length) continue;
    if (judgePick(step, idx).ok) best = idx;
  }
  return best;
}
/** A card tapped (high, tribute, return) judged. */
export function judgeCard(step, i) {
  const { level, hand } = tableOf(step), id = hand[i];
  if (step.goal === "high") {
    const top = Math.max(...hand.map(c => E.valueOf(c, level)));
    return E.valueOf(id, level) === top ? { ok: true, msg: step.then || "Right." } : { ok: false, why: `${E.cardName(id)} isn't the highest: remember the level above the ace, and the jokers on top.` };
  }
  if (step.goal === "tribute") {
    const want = E.tributeCard(hand, level);
    if (E.isWild(id, level)) return { ok: false, why: "The wild card is the one card you never pay." };
    return E.valueOf(id, level) === E.valueOf(want, level) ? { ok: true, msg: step.then || "Right." } : { ok: false, why: `${E.cardName(id)} isn't your highest: you must pay the highest card you hold, bar the wild ones.` };
  }
  const ok = E.returnable(hand, level);
  if (ok.includes(id)) return { ok: true, msg: step.then || "Right." };
  return { ok: false, why: E.isJoker(id) || E.rankOf(id) > 10 ? `${E.cardName(id)} is above 10: a returned card must be a 10 or lower.` : `${E.cardName(id)} is a level card: not that one.` };
}
export function rightCards(step) {
  const { level, hand } = tableOf(step);
  if (step.goal === "high") { const top = Math.max(...hand.map(c => E.valueOf(c, level))); return hand.map((c, i) => (E.valueOf(c, level) === top ? i : -1)).filter(i => i >= 0); }
  if (step.goal === "tribute") { const v = E.valueOf(E.tributeCard(hand, level), level); return hand.map((c, i) => (!E.isWild(c, level) && E.valueOf(c, level) === v ? i : -1)).filter(i => i >= 0); }
  const ok = new Set(E.returnable(hand, level));
  return hand.map((c, i) => (ok.has(c) ? i : -1)).filter(i => i >= 0);
}
/** A button of a choose step. */
export function judgeChoice(step, o) {
  return o === step.answer ? { ok: true, msg: step.then || "Right." } : { ok: false, why: step.not?.[o] || step.why || "Not that." };
}
const PICKS = ["tiles", "play"], TAPS = ["high", "tribute", "return"];
const isTask = s => !!s.goal;
/** What a person taps to answer a step right (for looking at the stage with real taps). */
export function planOf(step) {
  if (PICKS.includes(step.goal)) return { clicks: answerPick(step).map(i => `.tc [data-i="${i}"]`), submit: true };
  if (TAPS.includes(step.goal)) return { clicks: [`.tc [data-i="${rightCards(step)[0]}"]`], submit: false };
  return { clicks: [`.tc [data-o="${step.answer}"]`], submit: false };
}

// ---------- scenes the referee plays (for facts) ----------
/** A hand's end as the referee reckons it: the order of going out (first, second, [third]) → the result. */
export function finishWith(order, { levels = [2, 2], level = 2, declarer = -1 } = {}) {
  const s = E.newGame({}, 3);
  s.levels = levels.slice(); s.declarer = declarer; s.level = level; s.handNo = declarer < 0 ? 0 : 1;
  const last = order.at(-1), low = cardsOf("3s 3h 4c"), keep = Array.from({ length: 4 }, () => low.slice());
  s.hands = [0, 1, 2, 3].map(i => (i === last ? [cardsOf("Ks")[0]] : keep[i].slice()));
  s.out = order.slice(0, -1);
  for (const o of s.out) s.hands[o] = [];
  s.turn = s.lead = last; s.top = null; s.passes = 0; s.phase = "play";
  E.act(s, last, { t: "play", cards: s.hands[last].slice() });
  return s.result;
}
/** The tribute at the start of a hand after `order`, on the deal of `seed`. */
export function tributeAfter(order, seed, level = 2) {
  const game = { v: 1, opts: { ...E.DEFAULTS }, levels: [level, 2], declarer: 0, handNo: 1, lastOrder: order, results: [] };
  return E.deal(game, seed);
}

// ---------- the stage ----------
/**
 * The stage on the course's sheet: the cards as the table draws them (examples in rows, the play to beat, your cards to
 * pick from) and, for an exercise, its buttons: tap cards then Check, tap the card, or tap the answer.
 */
export function cardStage() {
  let box = null, api = null, step = null, st = null;
  const face = (id, level) => (E.isJoker(id) ? `<span class="r">J<br>O<br>K<br>E<br>R</span>` : `<span class="r">${E.rankName(E.rankOf(id))}</span><span class="s">${E.SUITS[E.suitOf(id)]}</span>${E.isWild(id, level) ? '<span class="w" aria-hidden="true">★</span>' : ""}`);
  const cls = (id, level) => {
    const c = ["tb-card", "tc-card"];
    if (E.isJoker(id)) c.push("joker", E.rankOf(id) === E.BJ ? "big" : "small");
    else { if (E.suitOf(id) % 2 === 1) c.push("red"); if (E.rankOf(id) === level) c.push(E.isWild(id, level) ? "wild" : "level"); }
    return c.join(" ");
  };
  const card = (id, level, o = {}) => {
    const c = `${cls(id, level)}${o.sel ? " sel" : ""}${o.hint ? " hint" : ""}`;
    return o.i == null ? `<span class="${c}" aria-label="${E.cardName(id)}">${face(id, level)}</span>` : `<button type="button" class="${c}" data-i="${o.i}" aria-label="${E.cardName(id)}">${face(id, level)}</button>`;
  };
  const lineOf = (inner, n) => { const per = n <= 9 ? n : Math.ceil(n / 2); return `<span class="tc-line" style="--per:${per}" data-per="${per}">${inner}</span>`; };
  function fit() {
    const tc = box.querySelector(".tc");
    if (!tc) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const W = box.clientWidth, Hh = box.clientHeight;
    const per = Math.max(1, ...[...tc.querySelectorAll("[data-per]")].map(l => Number(l.dataset.per)));
    for (let w = Math.min(rem * 3.4, (W - 4) / (per * 1.1 + 0.1)); w >= rem * 1.4; w -= 1) {
      tc.style.setProperty("--tc-w", `${w.toFixed(1)}px`);
      if (tc.scrollHeight <= Hh - rem * 0.4 && tc.scrollWidth <= W + 1) break;
    }
  }
  return {
    mount(b, a) {
      box = b;
      api = a;
      box.addEventListener("click", e => {
        if (!step || st.done || !isTask(step)) return;
        const cd = e.target.closest("[data-i]"), op = e.target.closest("[data-o]");
        if (cd && PICKS.includes(step.goal)) {
          st.sel ??= new Set();
          const i = Number(cd.dataset.i);
          if (st.sel.has(i)) st.sel.delete(i); else st.sel.add(i);
          api.changed();
        } else if (cd && TAPS.includes(step.goal)) {
          st.tried = Number(cd.dataset.i);
          api.answer(judgeCard(step, Number(cd.dataset.i)));
        } else if (op) {
          st.tried = op.dataset.o;
          api.answer(judgeChoice(step, op.dataset.o));
        }
      });
    },
    task: isTask,
    submits: s => PICKS.includes(s.goal),
    ready: (s, t) => !!t.sel?.size,
    label: (s, t) => (s.goal === "play" ? (t.sel?.size === 1 ? "Play it" : `Play these ${t.sel?.size || ""}`.trim()) : "Check"),
    submit: (s, t) => judgePick(s, t.sel || []),
    hint(s, t) {
      t.show = true;
      if (PICKS.includes(s.goal)) t.sel = new Set(answerPick(s));
      else if (TAPS.includes(s.goal)) t.show = new Set(rightCards(s));
      else t.show = s.answer;
    },
    draw(s, t) {
      step = s;
      st = t;
      const parts = [], task = isTask(s) && !t.done, level = levelOf(s);
      if (s.hand != null && (s.level != null || s.goal)) parts.push(`<div class="tc-chips"><span>Level: ${E.rankName(level)}</span></div>`);
      if ((s.rows || []).length >= 3 && s.rows.every(r => r.text && !r.cards)) parts.push(`<div class="tc-table">${s.rows.map(r => `<div class="tc-trow"><span>${esc(r.label)}</span><b>${esc(r.text)}</b></div>`).join("")}</div>`);
      else for (const r of s.rows || []) {
        const ids = r.cards ? cardsOf(r.cards) : [];
        parts.push(`<div class="tc-row"><small>${esc(r.label || "")}${r.zh ? ` <i>${esc(r.zh)}</i>` : ""}</small>${ids.length ? lineOf(ids.map(id => card(id, r.level ?? level)).join(""), ids.length) : ""}${r.text ? `<b class="tc-word">${esc(r.text)}</b>` : ""}</div>`);
      }
      if (s.hand != null) {
        const { hand, top } = tableOf(s);
        if (top.length) parts.push(`<div class="tc-row tc-top"><small>${esc(s.topBy || "To beat")}</small>${lineOf(top.map(id => card(id, level)).join(""), top.length)}</div>`);
        const shown = t.show instanceof Set ? t.show : new Set();
        const click = task && (PICKS.includes(s.goal) || TAPS.includes(s.goal));
        parts.push(`<div class="tc-row"><small>${esc(s.handLabel || "Your cards")}</small>${lineOf(hand.map((id, i) => card(id, level, { i: click ? i : null, sel: t.sel?.has(i), hint: shown.has(i) })).join(""), hand.length)}</div>`);
      }
      if (task && s.goal === "choose") parts.push(`<div class="tc-opts">${s.options.map(o => `<button type="button" class="tc-opt${t.show === o ? " hint" : ""}${t.tried === o && t.show !== o ? " tried" : ""}" data-o="${esc(o)}">${esc(o)}</button>`).join("")}</div>`);
      box.innerHTML = `<div class="tc">${parts.join("")}</div>`;
      fit();
    },
  };
}
