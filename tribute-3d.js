// Tribute's second view (Menu, View: Table or 3D; 23 October 2026, Korbi asking for "a mahjong and Guandan view that are
// similarly stylish, 3d design like, as the mtg one. Very clean. Full screen modes included."): the same game drawn as
// a table seen at an angle. The cloth is a plane tipped away from you (CSS perspective, as Dandan's battlefield is);
// the four seats stand round it, each a plate with a medallion, a fan of card backs and how many are left; the play to
// beat lies in the middle, laid out as the combination it is, with the plays it beat as words at their seats; the
// level and its wild card are on a brass plate. Cards move as the game does (dealt from the middle, played from your
// hand or a seat's backs, swept to whoever took the trick, tribute flown from the payer to the receiver), by the Web
// Animations API. It draws into #board3d inside the page's table (#table, so full screen puts the header and the
// levels on it as ever), and your hand, the coach's line and the buttons are the page's own, with the same marks on
// every card (data-id), so a tap means what it does in the table view and tribute.js's handlers serve both.
import * as E from "./tribute-engine.js";

const FACE = ["", "", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const PLACE = ["1st", "2nd", "3rd", "4th"];
const FLY_MS = 470, EASE = "cubic-bezier(.3, .7, .2, 1)", MOST_FLIGHTS = 14, RATIO = 1.4;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---------- what can be worked out without a page (tests/tribute.mjs) ----------
/** Where each seat sits for you: the slot's name, by seat (you at the foot, the next player at your right, your partner across). */
export const slotOf = (seat, me) => ["me", "right", "top", "left"][(seat - me + 4) % 4];
const nat = p => (p === 1 ? 14 : p);                             // a sequence's position 1 is the ace, low
/**
 * A play's cards as they lie on the table: [[ids]], one array to a run of cards that belong together. Alike cards
 * (a pair, three, a bomb) are one group, wilds last; a full house is its three then its pair; a straight, three pairs
 * and two triples run from the low card to the top with a wild set where it stands in (the ace first when it's low);
 * the jokers last. `reading` is the engine's ({ type, key, bomb }, sf when a straight flush: bomb 3, jokers: bomb 9).
 */
export function arrange(ids, level, reading) {
  const rank = id => E.rankOf(id);
  const look = (a, b) => rank(a) - rank(b) || E.suitOf(a) - E.suitOf(b) || a - b;
  const naturals = ids.filter(id => !E.isWild(id, level)).sort(look), wilds = ids.filter(id => E.isWild(id, level));
  const take = r => { const i = naturals.findIndex(id => rank(id) === r); return i >= 0 ? naturals.splice(i, 1)[0] : wilds.shift() ?? null; };
  const run = (top, len, each) => {
    const out = [];
    for (let p = top - len + 1; p < top + 1; p++) { const g = []; for (let k = 0; k < each; k++) { const id = take(nat(p)); if (id != null) g.push(id); } if (g.length) out.push(g); }
    return out;
  };
  const { type, key, bomb } = reading || {};
  let groups;
  if (type === "straight" || (type === "bomb" && bomb === 3)) groups = run(key, 5, 1);
  else if (type === "tube") groups = run(key, 3, 2);
  else if (type === "plate") groups = run(key, 2, 3);
  else if (type === "full") {
    const t = key === 15 ? level : key, three = [];
    while (three.length < 3) { const id = take(t); if (id == null) break; three.push(id); }
    groups = [three];
  } else groups = [[]];
  // whatever the reading didn't place (alike cards, a full house's pair, a joker pair) follows, wilds last
  const rest = [...naturals, ...wilds];
  if (groups[0].length === 0) groups = [rest];
  else if (rest.length) groups.push(rest);
  return groups.filter(g => g.length);
}
/** The room a layout takes, in card widths: each card a step (a fraction of a card) after the one before, a group a gap
 *  after the one before it, but only where a group is more than one card (in a straight every card is its own group). */
export function widthOf(groups, step, gap) {
  const n = groups.reduce((s, g) => s + g.length, 0), gapped = groups.some(g => g.length > 1);
  return 1 + (n - 1) * step + (gapped ? (groups.length - 1) * gap : 0);
}
export const STEP = 0.54, GAP = 0.3, STEP_LEAST = 0.3;
/**
 * The size a play is drawn at in a room of so many pixels: as large as the room's height lets a card be (at most `cap`,
 * `floor` at least), its width then fitted by drawing the cards closer, to a third of a card, and only then smaller.
 * { w: a card's width, step, gap } (a card's height is RATIO of its width).
 */
export function fitPlay(groups, room, cap = 90, floor = 22) {
  const byHeight = room.h / RATIO;
  let w = Math.max(floor, Math.min(cap, byHeight, room.w / widthOf(groups, STEP, GAP))), step = STEP, gap = GAP;
  if (w * widthOf(groups, STEP, GAP) > room.w) {
    // too long for the room: the cards closer, then the whole smaller
    const n = groups.reduce((s, g) => s + g.length, 0), gapped = groups.some(g => g.length > 1);
    const fixed = 1 + (gapped ? (groups.length - 1) * gap : 0), avail = room.w / w;
    step = n > 1 ? Math.max(STEP_LEAST, (avail - fixed) / (n - 1)) : STEP;
    if (w * widthOf(groups, step, gap) > room.w) w = Math.max(floor * 0.7, room.w / widthOf(groups, step, gap));
  }
  return { w, step, gap };
}
/** A play in words for its label: "a pair of 7s" as "Pair of 7s". */
export const playTitle = reading => { const s = E.playName(reading).replace(/^(an?|the) /, ""); return s.charAt(0).toUpperCase() + s.slice(1); };

// ---------- the cards, drawn for the plane ----------
// An eight-point star in a ring, drawn once: the jokers' mark (red and solid the big one, ink and open the small).
const STAR = (() => {
  const pts = [];
  for (let i = 0; i < 16; i++) { const a = (Math.PI * i) / 8 - Math.PI / 2, r = i % 2 ? 4.4 : 10.4; pts.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`); }
  return pts.join(" ");
})();
const emblem = big => `<svg class="t3-em ${big ? "big" : "small"}" viewBox="0 0 24 24" aria-hidden="true"><circle class="ring" cx="12" cy="12" r="11.2"/><polygon class="star" points="${STAR}"/><circle class="hub" cx="12" cy="12" r="2.1"/></svg>`;
/** A card's markup: its corner (rank over suit, a wild's star beside them, a joker's emblem), and its middle. The
 *  classes (tb-card, red, joker big or small, wild, level) are the page's own, set by its cardClass. */
export function cardFace(id, level) {
  if (E.isJoker(id)) {
    const big = E.rankOf(id) === E.BJ;
    return `<span class="t3i"><span class="t3r">${emblem(big)}</span></span><span class="t3m joker">${emblem(big)}<i>Joker</i></span>`;
  }
  const r = E.rankOf(id), glyph = E.SUITS[E.suitOf(id)], court = r >= 11 && r <= 13;
  const mid = court ? `<span class="t3m court"><b>${FACE[r]}</b><i>${glyph}</i></span>` : `<span class="t3m">${glyph}</span>`;
  return `<span class="t3i"><span class="t3r">${FACE[r]}</span><span class="t3s">${glyph}</span>${E.isWild(id, level) ? '<span class="t3w" aria-hidden="true">★</span>' : ""}</span>${mid}`;
}
const back = () => '<span class="t3b" aria-hidden="true"></span>';
// a crown, for the seat whose play is the one to beat
const CROWN = '<i class="t3-crown"><svg viewBox="0 0 20 15" aria-hidden="true"><path d="M2 13.5L1 4l5 4 4-6.5L14 8l5-4-1 9.5Z" fill="#E2B865" stroke="#7A5518" stroke-width="1.1" stroke-linejoin="round"/><path d="M2.6 11.6h14.8" stroke="#7A5518" stroke-width=".9"/></svg></i>';

/** The brass plate of the levels: the level this hand is played at and its wild card, both sides' levels. */
export function levelHtml({ level, levels, us, declarer, tail = "", cardClass }) {
  const wild = E.HEARTS * 13 + level - 2;
  const side = (team, label) => `<span class="t3-side${declarer === team || declarer < 0 ? " plays" : ""}"><small>${label}</small><b>${FACE[levels[team]]}</b></span>`;
  return `<span class="t3-lvplate"><span class="t3-lv"><small>Level</small><b>${FACE[level]}</b></span>`
    + `<span class="t3-wild"><span class="${cardClass(wild, level)} t3f t3-mini" aria-label="the wild card, ${E.cardName(wild)}">${cardFace(wild, level)}</span><small>wild</small></span>`
    + `<span class="t3-sides">${side(us, "Us")}${side(1 - us, "Them")}</span>${tail}</span>`;
}

// ---------- the view ----------
const still = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
/**
 * The view, given what it reads of tribute.js: the hand on the table (G(), S()), your seat (me()), a name (nameOf), the
 * seat the computer is thinking for (busy()), the hand's identity (handId()), the plays of the trick in hand (acts()),
 * the tribute's words (news()), the page's card classes, the strength of the levels, a seat that's `human`, and
 * `quiet`: a watching frame, which shows no motion.
 */
export function createTable3d(c) {
  const $ = id => document.getElementById(id);
  const box = $("board3d"), handBox = $("hand");
  box.innerHTML = `<div class="t3-field" id="t3field"><div class="t3-stage"><div class="t3-mat" id="t3mat">
      <div class="t3-inlay" id="t3inlay" aria-hidden="true"></div>
      <div class="t3-centre" id="t3centre" aria-live="polite"><div class="t3-play" id="t3play"></div><div class="t3-open" id="t3open"></div></div>
      ${["top", "left", "right", "me"].map(s => `<div class="t3-plate at-${s}" id="t3-${s}"></div>`).join("")}
    </div></div></div>`;
  document.body.insertAdjacentHTML("beforeend", '<div class="t3-fx" id="t3fx" aria-hidden="true"></div>');
  const fx = $("t3fx"), field = $("t3field"), mat = $("t3mat"), centre = $("t3centre"), playBox = $("t3play"), openBox = $("t3open"), inlay = $("t3inlay");
  const plates = { top: $("t3-top"), left: $("t3-left"), right: $("t3-right"), me: $("t3-me") };
  const G = () => c.G(), me = () => c.me();
  let last = null, held = false, dealAt = 0, dealNext = false;
  const running = new Set();                                    // the animations going, so a pause can hold them

  /** An element's contents, set only when they change (an animation on what's inside runs on rather than restarts). */
  const fill = (el, html) => { if (el._h !== html) { el.innerHTML = html; el._h = html; return true; } return false; };
  const classes = (el, cls) => { if (el.className !== cls) el.className = cls; };
  const moving = () => !still?.matches && !document.hidden && !c.quiet && !held;
  const seatOf = slot => (me() + ["me", "right", "top", "left"].indexOf(slot)) % 4;
  const faceCard = (id, level) => `<span class="${c.cardClass(id, level)} t3f t3-cd" data-id="${id}">${cardFace(id, level)}</span>`;

  // ---------- the seats ----------
  const initial = name => [...String(name || "?").trim()][0]?.toUpperCase() || "?";
  function plateHtml(seat, slot) {
    const g = G(), lv = g.levels?.[E.teamOf(seat)], n = g.hands[seat].length;
    const place = g.phase === "over" && g.result ? g.result.order.indexOf(seat) : g.out.indexOf(seat);
    const crown = g.phase === "play" && g.top && g.top.seat === seat;
    const fan = n ? `<span class="t3-fan" aria-hidden="true">${Array.from({ length: Math.min(5, n) }, (_, j) => `<span class="t3b" style="--j:${(j - (Math.min(5, n) - 1) / 2).toFixed(1)}"></span>`).join("")}</span>` : "";
    const tally = place >= 0 ? `<span class="t3-place p${place}">${PLACE[place]}</span>` : slot === "me" ? `<span class="t3-n${n <= 10 ? " few" : ""}" aria-label="${n} cards">${n}</span>` : `${fan}<span class="t3-n${n <= 10 ? " few" : ""}" aria-label="${n} cards">${n}</span>`;
    return `<span class="t3-med" aria-hidden="true"><b>${esc(initial(c.nameOf(seat)))}</b>${crown ? CROWN : ""}</span>`
      + `<span class="t3-info"><b class="t3-name">${esc(c.nameOf(seat))}</b><span class="t3-meta">${lv ? `Lv ${FACE[lv]}` : ""}</span></span><span class="t3-tally">${tally}</span><span class="t3-act"></span>`;
  }
  /** What a seat did in the trick under way, in words: its beaten play, or a pass (the play to beat is in the middle). */
  function actWords(seat) {
    const g = G(), a = c.acts()[seat];
    if (!a) return "";
    if (a.e === "pass") return "Pass";
    if (g.top && g.top.seat === seat) return "";
    const r = E.classify(a.cards, g.level).find(x => x.type === a.type && x.key === a.key) || { type: a.type, key: a.key, n: a.cards.length, bomb: a.bomb };
    return playTitle(r);
  }
  function drawPlates() {
    const g = G();
    for (const slot of ["top", "left", "right", "me"]) {
      const seat = seatOf(slot), el = plates[slot], n = g.hands[seat].length;
      const turn = (g.phase === "play" && g.turn === seat) || c.busy() === seat || (g.phase === "return" && E.waitingOn(g).includes(seat));
      const out = g.out.includes(seat) || (g.phase === "over" && n === 0);
      const mate = E.teamOf(seat) === E.teamOf(me());
      const top = g.phase === "play" && !!g.top && g.top.seat === seat, leads = g.phase === "play" && !g.top && g.turn === seat;
      classes(el, `t3-plate at-${slot} ${mate ? "mate" : "foe"}${turn && g.phase !== "over" ? " on" : ""}${out ? " out" : ""}${top ? " tobeat" : ""}${leads ? " leads" : ""}${c.busy() === seat ? " thinking" : ""}`);
      if (fill(el, plateHtml(seat, slot))) el.dataset.seat = seat;
      const act = el.querySelector(".t3-act"), words = g.phase === "over" ? "" : actWords(seat);
      if (act.textContent !== words) { act.textContent = words; act.classList.toggle("pass", words === "Pass"); }
      el.classList.toggle("said", !!words);
      el.setAttribute("aria-label", `${c.nameOf(seat)}, ${out ? "out" : `${n} cards`}${turn ? ", to play" : ""}`);
    }
  }

  // ---------- the middle: the play to beat, or how the hand opens, or how it ended ----------
  const labelOf = (seat, r) => `<span class="t3-label${r.bomb ? " bomb" : ""}"><b>${esc(c.who(seat))}</b> · ${esc(playTitle(r))}</span>`;
  function openHtml(w) {
    const g = G(), lines = c.news();
    const cell = (id, from, to, what) => `<span class="t3-xfer">${faceCard(id, g.level)}<span class="t3-cap">${esc(from)} → ${esc(to)}</span><small>${what}</small></span>`;
    let cards = "";
    if (g.shown != null && !g.tribute) cards = `<span class="t3-xfer">${faceCard(g.shown, g.level)}<span class="t3-cap">Turned up</span></span>`;
    if (g.tribute?.pays?.length) {
      cards = g.tribute.pays.map(p => cell(p.card, c.who(p.from), c.who(p.to), "tribute")).join("")
        + g.tribute.returns.filter(r => r.card != null).map(r => cell(r.card, c.who(r.from), c.who(r.to), "given back")).join("");
    }
    const style = `--cw:${w.toFixed(1)}px`;
    // the cards say it; words only where there are none (both big jokers held: no tribute)
    return `<span class="t3-lines">${cards ? `<span class="t3-xfers" style="${style}">${cards}</span>` : lines.map(l => `<span class="t3-line">${esc(l)}</span>`).join("")}</span>`;
  }
  /** The result of the hand, as words and the order they went out in. */
  function overHtml() {
    const g = G(), r = g.result, us = E.teamOf(me()), ours = r.team === us;
    const how = r.gain === 3 ? "first and second" : r.gain === 2 ? "first and third" : "first and last";
    return `<span class="t3-lines over"><span class="t3-verdict ${ours ? "win" : "lose"}">${ours ? "Your side goes" : "They go"} out ${how}</span>`
      + `<span class="t3-order">${r.order.map((s, i) => `<span class="${E.teamOf(s) === us ? "us" : ""}"><small>${PLACE[i]}</small>${esc(c.nameOf(s))}</span>`).join("")}</span>`
      + `<span class="t3-line">${ours ? "You rise" : "They rise"} ${r.gain} level${r.gain > 1 ? "s" : ""}, to ${FACE[r.levels[r.team]]}${r.passedA ? ", passing the ace" : ""}.${r.over ? ` ${r.winner === us ? "You win the match." : "They win the match."}` : ""}</span></span>`;
  }
  function drawMiddle() {
    const g = G(), cs = getComputedStyle(centre), px = v => parseFloat(v) || 0, rem = px(getComputedStyle(document.documentElement).fontSize) || 16;
    const room = { w: centre.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight), h: centre.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom) };
    const hw = px(getComputedStyle($("app")).getPropertyValue("--tb-cw")) || 2.6 * rem, cap = Math.max(hw * 1.45, 4.2 * rem);
    let play = "", open = "";
    if (g.phase === "over" && g.result) open = overHtml();
    else if (g.top) {
      // the play to beat, laid out as what it is, as large as the room lets it be, its label under it
      const r = g.top.reading, groups = arrange(g.top.cards, g.level, r), fit = fitPlay(groups, { w: room.w, h: room.h - 2.1 * rem }, cap);
      const gapped = groups.some(x => x.length > 1);
      let i = 0;
      const cards = groups.map(grp => grp.map((id, k) => {
        const m = i++ === 0 ? 0 : fit.step - 1 + (k === 0 && gapped ? fit.gap : 0);
        return `<span class="${c.cardClass(id, g.level)} t3f t3-cd" data-id="${id}" style="margin-left:calc(var(--cw) * ${m.toFixed(3)})">${cardFace(id, g.level)}</span>`;
      }).join("")).join("");
      play = `<span class="t3-cards${r.bomb ? " bomb" : ""}" style="--cw:${fit.w.toFixed(1)}px">${cards}</span>${labelOf(g.top.seat, r)}`;
    } else if (g.phase !== "over") {
      const lines = c.news(), seat = g.phase === "return" ? E.waitingOn(g)[0] : g.turn;
      const opening = lines.length && !g.log.some(e => e.e === "play" || e.e === "pass");
      const w = Math.max(22, Math.min(cap * 0.8, (room.h - 3 * rem) / RATIO / (g.tribute?.pays?.length > 1 ? 2 : 1)));
      open = (opening ? openHtml(w) : "") + (seat >= 0 ? `<span class="t3-call">${esc(c.who(seat))} ${g.phase === "return" ? (seat === me() ? "give" : "gives") + " a card back" : seat === me() ? "lead" : "leads"}</span>` : "");
    }
    fill(playBox, play);
    fill(openBox, open);
    centre.classList.toggle("has", !!play);
    if (inlay._lv !== g.level) { inlay._lv = g.level; inlay.innerHTML = `<b>${FACE[g.level]}</b>`; }
    inlay.classList.toggle("quiet", !!play || !!open);
    return playBox.querySelectorAll(".t3-cd");
  }

  // ---------- measuring: the plane is drawn from the field's own size ----------
  function size() {
    const fr = field.getBoundingClientRect();
    if (!fr.height) return false;
    field.style.setProperty("--fw", `${fr.width.toFixed(0)}px`);
    field.style.setProperty("--fh", `${fr.height.toFixed(0)}px`);
    return true;
  }

  // ---------- the screen as it was, before a new state is drawn ----------
  const centred = r => (r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } : null);
  /** Each card of your hand and of the middle, where it is on screen now, and the middle's cards as drawn. */
  function before() {
    if (!last || box.hidden || !moving()) return null;
    const hand = new Map(), trick = [];
    for (const el of handBox.querySelectorAll(".tb-card[data-id]")) hand.set(Number(el.dataset.id), centred(el.getBoundingClientRect()));
    for (const el of playBox.querySelectorAll(".t3-cd")) trick.push({ id: Number(el.dataset.id), at: centred(el.getBoundingClientRect()), html: el.outerHTML });
    return { hand, trick };
  }

  // ---------- motion ----------
  const plateAt = seat => centred((plates[slotOf(seat, me())].querySelector(".t3-fan, .t3-n, .t3-med") || plates[slotOf(seat, me())]).getBoundingClientRect());
  const track = a => { running.add(a); const done = () => running.delete(a); a.addEventListener("finish", done); a.addEventListener("cancel", done); return a; };
  /** A card flown from one place to another, turning over on the way where it's hidden at one end. */
  function fly(id, a, b, { up0 = true, up1 = true, delay = 0, el = null, ms = FLY_MS, fade = false } = {}) {
    if (!a || !b) return;
    const g = document.createElement("div"), h = Math.min(b.h, b.w * RATIO), w = h / RATIO, level = G().level;
    g.className = "t3-ghost";
    g.style.cssText = `width:${w}px;height:${h}px;left:${b.x - w / 2}px;top:${b.y - h / 2}px;--cw:${w}px`;
    g.innerHTML = `<div class="t3-gin"><div class="t3-gf">${faceCard(id, level)}</div><div class="t3-gb">${back()}</div></div>`;
    fx.append(g);
    if (el) { el.classList.add("t3-coming"); setTimeout(() => el.classList.remove("t3-coming"), ms + delay + 150); }
    const s0 = Math.max(0.2, a.h / (h || 1)), dx = a.x - b.x, dy = a.y - b.y;
    const t = { duration: ms, delay, easing: EASE, fill: "both" }, turn = x => `rotateY(${x ? 0 : 180}deg)`;
    g.firstElementChild.animate([{ transform: `${turn(up0)}` }, { transform: `rotateY(${up0 === up1 ? (up0 ? 0 : 180) : 90}deg) scale(1.12)`, offset: 0.5 }, { transform: `${turn(up1)}` }], t);
    const an = track(g.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${s0})`, opacity: 1 }, { transform: "none", opacity: fade ? 0 : 1 }], t));
    an.onfinish = () => {
      g.remove();
      if (!el) return;
      el.classList.remove("t3-coming");
      el.animate([{ scale: 1.1 }, { scale: 1 }], { duration: 200, easing: "ease-out" });
    };
  }
  /** The middle's old cards, swept to whoever took the trick, shrinking as they go. */
  function sweep(was, seat) {
    const to = plateAt(seat);
    if (!to || !was?.trick.length) return;
    was.trick.forEach((t, i) => {
      if (!t.at) return;
      const g = document.createElement("div");
      g.className = "t3-ghost sweep";
      g.style.cssText = `width:${t.at.w}px;height:${t.at.h}px;left:${t.at.x - t.at.w / 2}px;top:${t.at.y - t.at.h / 2}px;--cw:${t.at.w}px`;
      g.innerHTML = t.html.replace(/ style="[^"]*"/, "");
      fx.append(g);
      track(g.animate([{ transform: "none", opacity: 1 }, { transform: `translate(${to.x - t.at.x}px, ${to.y - t.at.y}px) scale(.3)`, opacity: 0 }],
        { duration: 520, delay: 160 + i * 22, easing: "cubic-bezier(.5, 0, .8, .4)", fill: "both" })).onfinish = () => g.remove();
    });
  }
  /** A word popped at a seat: a pass, or its place as it goes out. */
  function pop(seat, selector) {
    const el = plates[slotOf(seat, me())].querySelector(selector);
    if (el) track(el.animate([{ scale: 0.5, opacity: 0 }, { scale: 1.18, opacity: 1, offset: 0.55 }, { scale: 1, opacity: 1 }], { duration: 360, easing: "ease-out" }));
  }
  function deal() {
    const g = G(), n = g.hands.reduce((s, h) => s + h.length, 0);
    if (!n) return;
    const from = centred(field.getBoundingClientRect()), level = g.level;
    dealAt = performance.now();
    for (const slot of ["top", "left", "right"]) {
      const to = plateAt(seatOf(slot));
      for (let i = 0; i < 6; i++) fly(0, { ...from, h: to?.h || 40 }, { ...to, w: 26, h: 36 }, { up0: false, up1: false, delay: i * 60 + (slot === "top" ? 0 : slot === "left" ? 20 : 40), ms: 520, fade: true });
    }
    void level;
  }
  /** Your hand as it's dealt: each card rises from the middle in turn. A hand drawn again meanwhile (each move redraws it)
   *  picks the animation up where it was. */
  function dealIn() {
    if (!dealAt) return;
    const t = performance.now() - dealAt, cards = [...handBox.querySelectorAll(".tb-card")];
    if (t > 600 + cards.length * 24 || !moving()) { dealAt = 0; return; }
    const o = centred(field.getBoundingClientRect());
    cards.forEach((el, i) => {
      const r = el.getBoundingClientRect(), dx = o.x - (r.left + r.width / 2), dy = o.y - (r.top + r.height / 2);
      const a = el.animate([{ translate: `${dx}px ${dy}px`, scale: 0.45, opacity: 0 }, { translate: "0 0", scale: 1, opacity: 1 }], { duration: 480, delay: i * 24, easing: EASE, fill: "backwards" });
      a.currentTime = t;
    });
  }
  function motion(was, cards) {
    const g = G(), l = last;
    if (!l) return;
    const newHand = l.hand !== c.handId() || dealNext;
    dealNext = false;
    if (newHand) {
      if (moving()) deal();
      // the tribute paid as the hand begins is flown once the cards are dealt
      if (moving()) g.log.filter(e => e.e === "tribute").forEach((e, i) => flyGift(e, 1000 + i * 260));
      return;
    }
    const events = g.log.slice(l.len).slice(-MOST_FLIGHTS);
    let k = 0;
    for (const e of events) {
      if (e.e === "play") {
        const idx = new Map([...cards].map(el => [Number(el.dataset.id), el]));
        e.cards.forEach((id, j) => {
          const el = idx.get(id), a = e.seat === me() ? was?.hand.get(id) : plateAt(e.seat);
          if (el) fly(id, a, centred(el.getBoundingClientRect()), { up0: e.seat === me(), up1: true, delay: j * 40, el });
        });
      } else if (e.e === "pass") pop(e.seat, ".t3-act");
      else if (e.e === "trick") sweep(was, e.seat);
      else if (e.e === "return") flyGift(e, 0, was);
      else if (e.e === "out") pop(e.seat, ".t3-place");
      k++;
    }
  }
  /** A tribute card (or the card given back) flown from the one who gave it to the one who got it. */
  function flyGift(e, delay, was) {
    const a = e.from === me() && was?.hand.get(e.card) || plateAt(e.from), b = e.to === me() ? centred(handBox.getBoundingClientRect()) : plateAt(e.to);
    const big = a && { ...a, w: 44, h: 61 };
    fly(e.card, big, b && { ...b, w: 44, h: 61 }, { up0: true, up1: true, delay, ms: 760, fade: e.to === me() });
  }

  // ---------- the whole ----------
  /** Draw the table; `was`: what before() saw of the screen, for the cards' flights. */
  function draw(was) {
    const g = G();
    if (!g || box.hidden) return;
    size();
    drawPlates();
    const cards = drawMiddle();
    dealIn();
    if (last) motion(was, cards);
    last = { hand: c.handId(), len: g.log.length };
  }
  function empty() { last = null; }
  return {
    draw, before, empty,
    /** The next draw is a hand being dealt (a new match, the next hand), even though it's the first this page has drawn. */
    deal() { dealNext = true; if (!last) last = { hand: "", len: 0 }; },
    /** The pause: what's flying stands still, the glow round whose turn it is too (tribute.css). */
    hold(on) {
      held = on;
      box.classList.toggle("held", on);
      for (const a of running) { try { on ? a.pause() : a.play(); } catch { /* finished */ } }
    },
  };
}
