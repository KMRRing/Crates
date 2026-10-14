// What the party games draw with, so they look alike: an element maker, the big button, a card that hides its secret
// until tapped, a grid of players to pick from, who's still to answer, a clock counting down and the end's scores.
// Styles are in party.css (classes pk-…).

/** An element: h("p", { class: "x", onclick }, "text", child…). */
export function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) n.append(k instanceof Node ? k : String(k));
  return n;
}

/** The step's main button: the plate (primary) or a plain one. */
export const button = (text, onclick, { primary = true, disabled = false, cls = "" } = {}) =>
  h("button", { type: "button", class: `btn ${primary ? "primary " : ""}pk-btn ${cls}`.trim(), onclick, disabled }, text);

/**
 * A secret on your phone (your word, your role): hidden until you tap it, hidden again at the next tap, so a
 * neighbour glancing over sees nothing. `label` says what it is ("Your word"); content is text or an element. With a
 * `key` (the game's number, say) it stays as you left it through the redraws other players' moves cause; `open` is
 * how it starts.
 */
const shown = new Map();
export function secretCard(label, content, { open = false, key = null, note = "Tap to see it; tap again to hide it" } = {}) {
  const inner = content instanceof Node ? content : h("span", { class: "pk-secret-text" }, content);
  const id = key == null ? null : `${label}:${key}`;
  const now = id !== null && shown.has(id) ? shown.get(id) : open;
  const card = h("button", { type: "button", class: "pk-secret", "aria-expanded": String(now) },
    h("span", { class: "pk-secret-label" }, label), h("span", { class: "pk-secret-body" }, inner), h("span", { class: "pk-secret-note" }, note));
  card.addEventListener("click", () => {
    const next = card.getAttribute("aria-expanded") !== "true";
    card.setAttribute("aria-expanded", String(next));
    if (id !== null) shown.set(id, next);
  });
  return card;
}

/** The players to pick from (a vote, a guess): onPick(uid); `picked` is marked; `out` are shown but can't be picked. */
export function pickPlayer(players, { picked = null, exclude = [], out = [], onPick, label = "Players" } = {}) {
  const grid = h("div", { class: "pk-pick", role: "radiogroup", "aria-label": label });
  for (const p of players) {
    if (exclude.includes(p.uid)) continue;
    const gone = out.includes(p.uid);
    grid.append(h("button", { type: "button", role: "radio", "aria-checked": String(p.uid === picked), class: gone ? "out" : "", disabled: gone,
      onclick: () => onPick?.(p.uid) }, p.name));
  }
  return grid;
}

/** "Waiting for Mei and Ana", or "" when nobody is left. */
export function waitingFor(players, done) {
  const left = players.filter(p => !done.includes(p.uid)).map(p => p.name);
  if (!left.length) return "";
  return `Waiting for ${left.length === 1 ? left[0] : `${left.slice(0, -1).join(", ")} and ${left.at(-1)}`}`;
}

/** Joins names as a sentence does: "Mei", "Mei and Ana", "Mei, Ana and Bo". */
export const names = list => (list.length <= 1 ? list.join("") : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`);

/**
 * A clock counting down to `deadline` (the database's time), drawn as seconds left and a bar running out; `now` is
 * the table's clock. Stops itself when its element leaves the page.
 */
export function countdown(deadline, now, { total = null } = {}) {
  const span = total || Math.max(1, deadline - now());
  const n = h("span", { class: "pk-clock-n" }), bar = h("span", { class: "pk-clock-bar" });
  const el = h("div", { class: "pk-clock", role: "timer" }, n, h("span", { class: "pk-clock-track" }, bar));
  const draw = () => {
    if (!el.isConnected && el.dataset.drawn) return;
    el.dataset.drawn = "1";
    const left = Math.max(0, deadline - now());
    n.textContent = String(Math.ceil(left / 1000));
    bar.style.width = `${(100 * left) / span}%`;
    el.classList.toggle("low", left < 5000);
    if (left > 0) requestAnimationFrame(draw);
  };
  draw();
  return el;
}

/** The scores: [{ name, score, note }] best first, the winners marked. */
export function scoreList(rows, { winners = [] } = {}) {
  return h("ol", { class: "pk-scores" }, ...[...rows].sort((a, b) => b.score - a.score).map(r =>
    h("li", { class: winners.includes(r.uid) ? "won" : "" }, h("span", { class: "pk-score-name" }, r.name), r.note ? h("span", { class: "pk-score-note" }, r.note) : null, h("span", { class: "pk-score-n" }, String(r.score)))));
}
