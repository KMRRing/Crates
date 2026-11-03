// The table of Solitaire, drawn and touched: the cards of solitaire-engine.js's game as the suite's cards (cards.js) laid
// out to fit the box they are in, a tap that asks the page where a card goes, and a drag that carries a card or a run
// to the place it lands. The page (solitaire.js) and the course (solitaire-course.js) both use it; neither keeps any
// state in it: render(game) draws what the game is, and a move comes back through onMove.
//
// Cards are as wide as the columns allow (at least 44px on a phone for Klondike and FreeCell; Spider's ten columns
// make them narrower); a column that grows fans its cards closer together to stay in the box, so the table never
// changes size mid-game. Each card is one element placed with a transform, so a move is a short slide.
import { cardHtml } from "./cards.js";
import { scale } from "./wide.js";
import { VARIANTS, RANKS, tableOf, TAB, FND, WST, STK, CEL, place, kindOf, indexOf, maxRun, cardsAt, destinations, whyNot, faceUp } from "./solitaire-engine.js";

const FSLOT = [3, 2, 1, 0];                        // the foundations left to right: ♠ ♥ ♣ ♦, so the colours alternate
const ASPECT = 1.4;                                // a card is 3.5em by 2.5em
const TAB_REF = 3.9;                               // card heights the tableau is made for: a column longer than that fans in
const DRAG = 7;                                    // px (a tablet's rem grows it) a finger moves before a press is a drag
const SUITS = ["♦", "♣", "♥", "♠"];
const AT = /translate\(([-\d.]+)px, ([-\d.]+)px\)/;

/**
 * A table in `root` (an empty element with room). opts: { onTap({ place, n, uid, kind }), onMove({ f, t, n }),
 * onReject(text), readonly, fourColour }.
 * → { render(game, { hint, lit, bad, instant }), resize(), setFourColour(on), slotRect(place), cardAt(uid), destroy() }.
 */
export function createBoard(root, opts = {}) {
  let variant = null, V = null, T = null, G = null, extra = {};
  let cw = 0, ch = 0, gap = 0, x0 = 0, yTab = 0, W = 0, H = 0, fanDown = 0, fanUp = 0;
  const els = new Map(), slots = [], drops = [];
  let where = new Map(), cardY = new Map(), colEnd = [];
  let pressing = null, dragging = null;
  const seen = new Map();                          // uid → the transform last set, so a still card costs nothing
  const readonly = !!opts.readonly;
  root.classList.add("so-board");
  root.classList.toggle("four", !!opts.fourColour);

  // ---------- the elements ----------
  function build(id) {
    for (const e of els.values()) e.remove();
    for (const s of slots) s.el.remove();
    for (const e of drops) e.remove();
    els.clear(); slots.length = 0; drops.length = 0; seen.clear();
    variant = id; V = VARIANTS[id]; T = tableOf(id);
    const slot = (cls, p, html = "") => { const el = document.createElement("div"); el.className = `so-slot ${cls}`; el.innerHTML = html; root.appendChild(el); slots.push({ el, p, cls }); };
    for (let i = 0; i < V.cols; i++) slot("tab", place(TAB, i));
    if (V.game === "klondike") {
      slot("stock", place(STK), `<i class="so-turn" aria-hidden="true"></i><b class="so-count"></b>`);
      slot("waste", place(WST));
      for (let s = 0; s < 4; s++) slot(`fnd s${s}`, place(FND, s), `<i class="so-ghost">${SUITS[s]}</i>`);
    } else if (V.game === "freecell") {
      for (let i = 0; i < 4; i++) slot("cell", place(CEL, i));
      for (let s = 0; s < 4; s++) slot(`fnd s${s}`, place(FND, s), `<i class="so-ghost">${SUITS[s]}</i>`);
    } else {
      for (let k = 0; k < 8; k++) slot("fnd run", place(FND, k));
      slot("stock", place(STK), `<b class="so-count"></b>`);
    }
    let html = "";
    for (let c = 0; c < V.cards; c++) html += cardHtml({ rank: RANKS[T.rank[c]], suit: T.suit[c] }, { cls: `s${T.suit[c]} back`, data: { id: c } });
    root.insertAdjacentHTML("beforeend", html);
    for (const e of root.querySelectorAll(".cd")) els.set(Number(e.dataset.id), e);
    root.dataset.game = V.game;
  }

  // ---------- where things go ----------
  function geometry() {
    W = root.clientWidth; H = root.clientHeight;
    if (!W || !H || !V) return false;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16, n = V.cols;
    const byWidth = (W - (n - 1) * Math.max(2, W * 0.008)) / n;
    const byHeight = H / (1 + 0.16 + (opts.rows ?? TAB_REF)) / ASPECT;       // a short box (a phone on its side) makes the cards smaller
    cw = Math.floor(Math.min(byWidth, byHeight, 6.6 * rem));
    ch = Math.round(cw * ASPECT);
    gap = Math.max(1, Math.floor((W - n * cw) / (n - 1)));
    x0 = Math.floor((W - (n * cw + (n - 1) * gap)) / 2);
    yTab = Math.round(ch * 1.16);
    fanDown = Math.max(3, Math.round(ch * 0.13));
    fanUp = Math.round(ch * 0.3);
    root.style.fontSize = `${cw / 2.5}px`;
    return true;
  }
  const colX = i => x0 + i * (cw + gap);
  /** The top left of a place: a column's start, or a slot. */
  function slotXY(p) {
    const k = kindOf(p), i = indexOf(p);
    if (k === TAB) return { x: colX(i), y: yTab };
    if (V.game === "klondike") {
      if (k === STK) return { x: colX(0), y: 0 };
      if (k === WST) return { x: colX(1), y: 0 };
      return { x: colX(3 + FSLOT.indexOf(i)), y: 0 };
    }
    if (V.game === "freecell") return k === CEL ? { x: colX(i), y: 0 } : { x: colX(4 + FSLOT.indexOf(i)), y: 0 };
    return k === STK ? { x: colX(V.cols - 1), y: 0 } : { x: colX(i), y: 0 };
  }
  /** A column's offsets between cards, drawn in when the column is longer than the room under the top row. */
  function fan(i) {
    const col = G.cols[i], room = H - yTab;
    let need = ch;
    for (let j = 0; j < col.length - 1; j++) need += j < G.down[i] ? fanDown : fanUp;
    if (need <= room || col.length < 2) return { d: fanDown, u: fanUp };
    const f = Math.max(0.04, (room - ch) / (need - ch));     // every card stays reachable, however long the column: a sliver of each if it must
    return { d: Math.max(1, fanDown * f), u: Math.max(1.5, fanUp * f) };
  }
  function layout(g) {
    const out = new Map(), at = (uid, x, y, z, up) => { out.set(uid, { x, y, z, up }); };
    where = new Map(); cardY = new Map(); colEnd = [];
    for (let i = 0; i < g.cols.length; i++) {
      const col = g.cols[i], { d, u } = fan(i);
      let y = yTab;
      col.forEach((uid, j) => {
        at(uid, colX(i), Math.round(y), 10 + j, j >= g.down[i]);
        where.set(uid, { place: place(TAB, i), idx: j });
        cardY.set(uid, Math.round(y));
        y += j < g.down[i] ? d : u;
      });
      colEnd[i] = col.length ? cardY.get(col[col.length - 1]) : yTab;
    }
    const stock = (sp) => g.stock.forEach((uid, j) => { at(uid, sp.x, sp.y, 1 + j, false); where.set(uid, { place: place(STK), idx: j }); });
    if (V.game === "klondike") {
      stock(slotXY(place(STK)));
      const wp = slotXY(place(WST)), w = g.waste, shown = V.draw === 3 ? Math.min(3, w.length) : 1;
      w.forEach((uid, j) => {
        const fromTop = w.length - 1 - j, x = fromTop < shown ? wp.x + (shown - 1 - fromTop) * Math.round(cw * 0.3) * (V.draw === 3 ? 1 : 0) : wp.x;
        at(uid, x, wp.y, 1 + j, true);
        if (fromTop === 0) where.set(uid, { place: place(WST), idx: j });
      });
    }
    if (V.game !== "spider") {
      for (let s = 0; s < 4; s++) {
        const p = slotXY(place(FND, s));
        for (let r = 0; r < g.found[s]; r++) {
          const uid = s * 13 + r;
          at(uid, p.x, p.y, 2 + r, true);
          if (r === g.found[s] - 1) where.set(uid, { place: place(FND, s), idx: r });
        }
      }
    }
    if (V.game === "freecell") {
      g.cells.forEach((uid, i) => {
        if (uid < 0) return;
        const p = slotXY(place(CEL, i));
        at(uid, p.x, p.y, 3, true);
        where.set(uid, { place: place(CEL, i), idx: 0 });
      });
    }
    if (V.game === "spider") {
      stock(slotXY(place(STK)));
      g.runs.forEach((run, k) => run.forEach((uid, j) => at(uid, colX(k), 0, 40 - j, true)));
    }
    return out;
  }

  // ---------- drawing ----------
  function render(g, ex = {}) {
    if (!V || g.v !== variant) build(g.v);
    G = g; extra = ex;
    if (!geometry()) return;
    const pos = layout(g);
    const hintFrom = new Set(), hintTo = new Set(), h = ex.hint;
    if (h) {
      cardsAt(g, h.f, h.n)?.forEach(u => hintFrom.add(u));
      if (kindOf(h.t) === TAB && g.cols[indexOf(h.t)]?.length) hintTo.add(g.cols[indexOf(h.t)].at(-1));
    }
    for (const [uid, el] of els) {
      const p = pos.get(uid);
      if (!p) { el.style.visibility = "hidden"; continue; }
      if (el.style.visibility) el.style.visibility = "";
      if (!dragging?.cards.includes(uid)) {
        const tf = `translate(${p.x}px, ${p.y}px)`;
        if (seen.get(uid) !== tf) { el.style.transform = tf; seen.set(uid, tf); }
        el.style.zIndex = p.z;
      }
      el.classList.toggle("back", !p.up);
      el.classList.toggle("hint-from", hintFrom.has(uid));
      el.classList.toggle("hint-to", hintTo.has(uid));
      el.classList.toggle("lit", !!ex.lit?.has(uid));
      el.classList.toggle("bad", !!ex.bad?.has(uid));
      el.setAttribute("aria-hidden", p.up ? "false" : "true");
    }
    for (const { el, p, cls } of slots) {
      const xy = slotXY(p);
      el.style.transform = `translate(${xy.x}px, ${xy.y}px)`;
      el.style.width = `${cw}px`; el.style.height = `${ch}px`;
      const k = kindOf(p), i = indexOf(p);
      let to = !!h && h.t === p && (k !== TAB || !g.cols[i].length);
      if (cls.startsWith("stock")) {
        const n = V.game === "spider" ? Math.floor(g.stock.length / 10) : g.stock.length;
        el.querySelector(".so-count").textContent = n ? String(n) : "";
        el.classList.toggle("empty", !g.stock.length);
        el.classList.toggle("recycle", V.game === "klondike" && !g.stock.length && g.waste.length > 0);
        to = !!h && kindOf(h.f) === STK;
      }
      if (cls.includes("run")) el.classList.toggle("full", i < g.runs.length);
      el.classList.toggle("hint-to", to);
    }
    if (ex.instant) { root.classList.add("still"); void root.offsetWidth; root.classList.remove("still"); }
  }

  // ---------- the finger ----------
  /** What a press on this element is: { place, n, uid, kind } or null. kind: "card", "stock", or "stuck" (a card that can't move). */
  function spotOf(target) {
    if (!G) return null;
    const card = target.closest(".cd");
    if (card) {
      const uid = Number(card.dataset.id), w = where.get(uid);
      if (!w) return null;
      const k = kindOf(w.place);
      if (k === STK) return { kind: "stock", place: w.place, n: 1, uid };
      if (k === TAB) {
        const i = indexOf(w.place), n = G.cols[i].length - w.idx;
        if (!faceUp(G, i, w.idx)) return null;
        return { kind: n <= maxRun(G, i) ? "card" : "stuck", place: w.place, n, uid };
      }
      if (k === FND && V.game !== "klondike") return null;
      return { kind: "card", place: w.place, n: 1, uid };
    }
    const slot = target.closest(".so-slot");
    if (slot?.classList.contains("stock")) return { kind: "stock", place: place(STK), n: 1, uid: -1 };
    return null;
  }
  const rectOf = (x, y, w, h) => ({ x, y, w, h });
  const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  /** The room a move to this place would land in: a column's whole length, or a slot. */
  function targetRect(p) {
    const k = kindOf(p), i = indexOf(p);
    if (k === TAB) return rectOf(colX(i), yTab, cw, colEnd[i] - yTab + ch * 1.3);
    const xy = slotXY(p);
    return rectOf(xy.x, xy.y, cw, ch);
  }
  /** Where the lead carried card is now. */
  const leadRect = () => { const m = AT.exec(seen.get(dragging.cards[0])); return rectOf(Number(m[1]) + dragging.dx, Number(m[2]) + dragging.dy - dragging.lift, cw, ch); };

  function down(ev) {
    if (readonly || ev.button > 0 || !G) return;
    const spot = spotOf(ev.target);
    if (!spot) return;
    ev.preventDefault();
    cancel(true);
    try { root.setPointerCapture(ev.pointerId); } catch { /* a synthetic event */ }
    pressing = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, spot, touch: ev.pointerType !== "mouse" };
  }
  function startDrag() {
    const { spot } = pressing, cards = cardsAt(G, spot.place, spot.n);
    if (!cards) return false;
    const targets = destinations(G, spot.place, spot.n);
    dragging = { cards, spot, targets, dx: 0, dy: 0, lift: pressing.touch ? Math.round(ch * 0.5) : 0, over: null };
    cards.forEach((u, j) => { const el = els.get(u); el.classList.add("dragging"); el.style.zIndex = 500 + j; });
    root.classList.add("carrying");
    targets.forEach((m, i) => {
      let d = drops[i];
      if (!d) { d = document.createElement("div"); d.className = "so-drop"; root.appendChild(d); drops[i] = d; }
      const k = kindOf(m.t), col = k === TAB ? G.cols[indexOf(m.t)] : null, xy = slotXY(m.t);
      d.style.transform = `translate(${xy.x}px, ${col?.length ? cardY.get(col.at(-1)) : xy.y}px)`;
      d.style.width = `${cw}px`; d.style.height = `${ch}px`;
      d.hidden = false;
    });
    for (let i = targets.length; i < drops.length; i++) drops[i].hidden = true;
    return true;
  }
  function move(ev) {
    if (!pressing || ev.pointerId !== pressing.id) return;
    const dx = ev.clientX - pressing.x, dy = ev.clientY - pressing.y;
    if (!dragging) {
      if (Math.hypot(dx, dy) <= DRAG * scale() || pressing.spot.kind !== "card" || !startDrag()) return;
    }
    dragging.dx = dx; dragging.dy = dy;
    for (const u of dragging.cards) {
      const m = AT.exec(seen.get(u));
      els.get(u).style.transform = `translate(${Number(m[1]) + dx}px, ${Number(m[2]) + dy - dragging.lift}px)`;
    }
    dragging.over = pickTarget();
    drops.forEach((d, i) => d.classList.toggle("over", !!dragging.over && dragging.targets[i] === dragging.over));
  }
  /** The legal place the carried cards are most over: at least a sixth of the lead card in it. */
  function pickTarget() {
    const r = leadRect();
    let best = null, bestA = 0;
    for (const t of dragging.targets) { const a = overlap(r, targetRect(t.t)); if (a > bestA) { bestA = a; best = t; } }
    return bestA >= cw * ch / 6 ? best : null;
  }
  function up(ev) {
    if (!pressing || ev.pointerId !== pressing.id) return;
    const { spot } = pressing;
    if (!dragging) { cancel(true); opts.onTap?.(spot); return; }
    const target = pickTarget(), r = leadRect();
    let reason = null;
    if (!target) {              // dropped on a column or slot that won't take it: say why
      const places = [];
      for (let i = 0; i < G.cols.length; i++) places.push(place(TAB, i));
      if (V.game !== "spider") for (let s = 0; s < 4; s++) places.push(place(FND, s));
      if (V.game === "freecell") for (let i = 0; i < 4; i++) places.push(place(CEL, i));
      let near = null, nearA = 0;
      for (const p of places) { const a = overlap(r, targetRect(p)); if (a > nearA) { nearA = a; near = p; } }
      if (near != null && nearA > cw * ch / 4) reason = whyNot(G, { f: spot.place, t: near, n: spot.n });
    }
    const cards = dragging.cards;
    cancel(!target);                                // dropped on a place, the cards slide on from where they were let go
    if (target) {
      for (const u of cards) seen.delete(u);
      opts.onMove?.({ f: target.f, t: target.t, n: target.n });
      if (G) render(G, extra);
    } else if (reason) opts.onReject?.(reason);
  }
  /** Ends a press; putBack: the carried cards go back where they were. */
  function cancel(putBack) {
    if (dragging) {
      const cards = dragging.cards;
      for (const u of cards) els.get(u).classList.remove("dragging");
      root.classList.remove("carrying");
      for (const d of drops) d.hidden = true;
      dragging = null;
      if (putBack) for (const u of cards) { const t = seen.get(u); if (t) els.get(u).style.transform = t; }
    }
    pressing = null;
  }
  root.addEventListener("pointerdown", down);
  root.addEventListener("pointermove", move);
  root.addEventListener("pointerup", up);
  root.addEventListener("pointercancel", () => { cancel(true); });
  root.addEventListener("contextmenu", e => e.preventDefault());
  const ro = new ResizeObserver(() => { if (G) { seen.clear(); render(G, { ...extra, instant: true }); } });
  ro.observe(root);

  return {
    render,
    resize() { if (G) { seen.clear(); render(G, { ...extra, instant: true }); } },
    setFourColour(on) { root.classList.toggle("four", !!on); },
    /** A place's box on the screen, for a test that touches it as a finger would. */
    slotRect(p) { const r = targetRect(p), b = root.getBoundingClientRect(); return { x: b.left + r.x, y: b.top + r.y, w: r.w, h: r.h }; },
    /** A card's place on the screen (its top left corner and size). */
    cardAt(uid) { const m = AT.exec(seen.get(uid) || ""), b = root.getBoundingClientRect(); return m ? { x: b.left + Number(m[1]), y: b.top + Number(m[2]), w: cw, h: ch } : null; },
    destroy() { ro.disconnect(); root.replaceChildren(); },
  };
}
