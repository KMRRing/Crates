// Snap, the game of the one picture two cards share (Spot it's mechanics): 57 cards of 8 pictures each, built so that
// any two cards share exactly one picture. Your card is on your phone beside the pile's; the first to spot the picture
// they share, and tap it, wins the round. The tower: the pile's card is the winner's, their new card, and the most cards
// wins. The well: the winner's card goes onto the pile, and the first to get rid of their cards wins.
import { h, names } from "./party-kit.js";
import { shuffle } from "./party-core.js";

/** The pictures, one for each point of the plane: drawn by each phone's own emoji, which is all a player compares with. */
export const PICTURES = ["🍎", "🍋", "🍇", "🍓", "🥕", "🌶️", "🍄", "🧀", "🍦", "🍩", "☕", "🍷", "🎈", "🎁", "🔑", "🔒", "⚓", "⏰", "💡", "🔔",
  "📌", "✂️", "✏️", "📚", "🎸", "🎺", "🥁", "⚽", "🎯", "🚲", "🚗", "✈️", "🚀", "⛵", "🌞", "🌙", "⭐", "❄️", "⚡", "🔥", "💧", "🌈", "🌵",
  "🌻", "🍁", "🐱", "🐶", "🐼", "🐧", "🐢", "🐙", "🦋", "🐝", "🦉", "👻", "🎩", "❤️"];

/**
 * The 57 cards: the lines of the projective plane of order 7 (its points the pictures). A point is (x, y) on a 7 by 7
 * grid (x·7 + y), one of 7 slopes (49 + m) or the vertical (56); a line is y = m·x + b with its slope's point, x = c
 * with the vertical, or the 8 points at infinity. Any two lines meet in exactly one point: any two cards share one picture.
 */
export const CARDS = (() => {
  const q = 7, cards = [];
  for (let m = 0; m < q; m++) for (let b = 0; b < q; b++) cards.push([...Array.from({ length: q }, (_, x) => x * q + ((m * x + b) % q)), q * q + m]);
  for (let c = 0; c < q; c++) cards.push([...Array.from({ length: q }, (_, y) => c * q + y), q * q + q]);
  cards.push(Array.from({ length: q + 1 }, (_, i) => q * q + i));
  return cards;
})();
/** The one picture two cards share. */
export const shared = (a, b) => CARDS[a].find(p => CARDS[b].includes(p));
const GRACE = 400;          // taps this close to the first right one are weighed against it, by when they were made
const WON_MS = 1700;
export const LENGTHS = { short: { tower: 24, well: 6 }, long: { tower: 99, well: 99 } };

// ---------- the game ----------
const whole = s => {
  for (const k of ["order", "deck", "winners"]) s[k] = s[k] ? Object.values(s[k]) : [];
  s.hands ||= {}; s.names ||= {};
  for (const u of Object.keys(s.hands)) s.hands[u] = s.hands[u] ? Object.values(s.hands[u]) : [];
  return s;
};
const topOf = (s, u) => s.hands[u]?.at(-1);
const scoreOf = (s, u) => (s.hands[u] || []).length;

export default {
  id: "snap",
  name: "Snap",
  min: 2,
  max: 12,
  css: "party-snap.css",
  blurb: "Any two cards share one picture. Spot it on your card and the pile's before anyone else.",
  rules: [
    "57 cards of eight pictures, made so that any two cards share exactly one picture: never more, never none. Your card is on your phone, under the pile's.",
    "Spot the picture your card shares with the pile's and tap it, on either card: the first to tap it wins the round (taps a moment apart are judged by when they were made). A wrong tap holds you up for a second and a half.",
    "The tower: the pile's card is the winner's, their new card, and a new card goes on the pile; when the pile is gone, the most cards wins. The well: the cards are dealt out; the winner's card goes onto the pile, and the first with none left wins.",
  ],
  options: [
    { id: "mode", label: "Play", choices: [["tower", "The tower"], ["well", "The well"]], value: "tower" },
    { id: "length", label: "Length", choices: [["short", "Short"], ["long", "Long"]], value: "short" },
  ],

  start({ players, options, rng }) {
    const mode = options.mode === "well" ? "well" : "tower", len = LENGTHS[options.length === "long" ? "long" : "short"][mode];
    const deck = shuffle(CARDS.map((_, i) => i), rng), n = players.length;
    const s = { mode, order: players.map(p => p.uid), names: Object.fromEntries(players.map(p => [p.uid, p.name])), rn: 0, step: "spot", salt: Math.floor(rng() * 1e9) };
    s.centre = deck.pop();
    if (mode === "tower") {
      s.hands = Object.fromEntries(players.map(p => [p.uid, [deck.pop()]]));
      s.deck = deck.slice(-Math.min(deck.length, len));
    } else {
      const each = Math.min(len, Math.floor(deck.length / n));
      s.hands = Object.fromEntries(players.map((p, i) => [p.uid, deck.slice(i * each, (i + 1) * each)]));
      s.deck = [];
    }
    s.say = mode === "tower"
      ? `Snap, the tower: ${s.deck.length} cards on the pile. Spot the picture your card shares with the pile's, and tap it.`
      : `Snap, the well: ${s.hands[s.order[0]].length} cards each. Spot the picture your card shares with the pile's, and tap it: the first with no cards left wins.`;
    return s;
  },

  advance(state, { players, inputs, now }) {
    const s = whole(structuredClone(state)), here = new Set(players.map(p => p.uid));
    const nameOfU = u => players.find(p => p.uid === u)?.name || s.names[u] || "Someone";
    if (s.step === "spot") {
      const right = s.order.filter(u => here.has(u) && inputs[u]?.rn === s.rn && Number.isInteger(topOf(s, u)) && inputs[u].tap === shared(topOf(s, u), s.centre));
      if (!right.length) return null;
      if (!s.until) { s.until = now + GRACE; return { state: s }; }
      if (now < s.until) return null;
      // the first by when it was tapped, among the taps that reached the table in time
      const u = right.sort((a, b) => (inputs[a].at ?? 0) - (inputs[b].at ?? 0))[0];
      const pic = shared(topOf(s, u), s.centre);
      delete s.until;
      if (s.mode === "tower") s.hands[u].push(s.centre);
      else s.centre = s.hands[u].pop();
      s.win = { uid: u, pic };
      s.step = "won";
      s.deadline = now + WON_MS;
      return { state: s };
    }
    if (s.step === "won") {
      if (now < s.deadline) return null;
      const out = s.mode === "tower" ? !s.deck.length : s.order.some(u => !scoreOf(s, u));
      if (out || s.order.filter(u => here.has(u)).length < 2) {
        s.step = "over";
        delete s.deadline;
        if (s.mode === "tower") {
          const top = Math.max(...s.order.map(u => scoreOf(s, u)));
          s.winners = s.order.filter(u => scoreOf(s, u) === top);
          return { state: s, say: `The pile is gone. ${names(s.winners.map(nameOfU))} ${s.winners.length > 1 ? "win" : "wins"}, with ${top} cards.` };
        }
        const fewest = Math.min(...s.order.map(u => scoreOf(s, u)));
        s.winners = s.order.filter(u => scoreOf(s, u) === fewest);
        return { state: s, say: `${names(s.winners.map(nameOfU))} ${s.winners.length > 1 ? "have" : "has"} no cards left: ${s.winners.length > 1 ? "they win" : "a win"}!` };
      }
      if (s.mode === "tower") s.centre = s.deck.pop();
      s.rn++;
      s.step = "spot";
      delete s.win; delete s.deadline;
      return { state: s };
    }
    return null;
  },

  wakeAt: state => (state.step === "spot" ? state.until ?? null : state.step === "won" ? state.deadline ?? null : null),

  view(stage, ctx) {
    const { me, players } = ctx, s = whole(structuredClone(ctx.state));
    const nameOfU = u => players.find(p => p.uid === u)?.name || s.names[u] || "Someone";
    const playing = s.order.includes(me.uid), mine = playing ? topOf(s, me.uid) : null;
    const won = s.step === "won" ? s.win : null;
    const tap = pic => {
      if (s.step !== "spot" || !playing || Date.now() < lock.until) return;
      if (pic === shared(mine, s.centre)) { ctx.send({ tap: pic, rn: s.rn }); return; }
      // a wrong tap: held up a moment, so tapping everything isn't a way to win
      lock.until = Date.now() + 1500;
      stage.querySelectorAll(".sn-card.yours, .sn-card.pile").forEach(c => c.classList.add("held"));
      setTimeout(() => stage.querySelectorAll(".sn-card").forEach(c => c.classList.remove("held")), 1500);
    };
    const parts = [];
    parts.push(h("ul", { class: "sn-table" }, ...s.order.map(u => h("li", { class: `${won?.uid === u ? "won" : ""}${u === me.uid ? " me" : ""}` },
      h("span", { class: "sn-name" }, nameOfU(u)), h("span", { class: "sn-n" }, String(scoreOf(s, u)))))));
    if (s.step !== "over") {
      const held = Date.now() < lock.until ? " held" : "";
      parts.push(h("div", { class: "sn-cards" },
        card(s.centre, "pile", s.mode === "tower" ? `The pile · ${s.deck.length} more` : "The pile", tap, won?.pic, s.salt, held),
        mine !== null && mine !== undefined ? card(mine, "yours", s.mode === "well" ? `Yours · ${scoreOf(s, me.uid)} left` : `Yours · ${scoreOf(s, me.uid)} won`, tap, won?.pic, s.salt, held)
          : h("p", { class: "pk-line sn-watch" }, "You joined mid-game: watch this one."),
        // who won the round, over the cards, so nothing moves
        won ? h("p", { class: "sn-winner", role: "status" }, won.uid === me.uid ? "You!" : `${nameOfU(won.uid)}!`) : null));
    } else {
      parts.push(h("div", { class: "pk-verdict big" }, `${names(s.winners.map(nameOfU))} ${s.winners.length > 1 ? "win" : "wins"}`));
      parts.push(h("p", { class: "sn-status" }, s.mode === "tower" ? "Cards won, the most winning" : "Cards left, the fewest winning"));
    }
    stage.replaceChildren(h("div", { class: "pk-col sn-col" }, ...parts));
  },
};

const lock = { until: 0 };
/** A card: its eight pictures round a circle, each its own size and turn (the same every time the card is drawn). */
function card(i, cls, label, onTap, glow, salt, held) {
  let r = ((i + 1) * 2654435761 + salt) >>> 0;
  const rand = () => { r = (r + 0x6D2B79F5) >>> 0; let t = Math.imul(r ^ (r >>> 15), r | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pics = shuffle(CARDS[i], rand), turn0 = rand() * 360;
  const spots = pics.map((p, k) => {
    // one in the middle, seven round it, each a little off its place
    const a = ((turn0 + (k - 1) * (360 / 7) + (rand() - 0.5) * 18) * Math.PI) / 180, d = k ? 30 + (rand() - 0.5) * 4 : 0;
    const x = 50 + d * Math.cos(a), y = 50 + d * Math.sin(a), size = 0.8 + rand() * 0.42, spin = Math.floor(rand() * 360);
    return h("button", { type: "button", class: `sn-pic${p === glow ? " glow" : ""}`, style: `left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;--k:${size.toFixed(2)};--r:${spin}deg`,
      onclick: () => onTap(p) }, h("span", {}, PICTURES[p]));
  });
  return h("div", { class: `sn-card ${cls}${held}` }, h("span", { class: "sn-label" }, label), h("div", { class: "sn-face" }, ...spots));
}
