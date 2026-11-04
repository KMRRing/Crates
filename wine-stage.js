// The stage of the Wine course (course.js shows it above the words of each step): a step with a card of facts shows the card, a table
// of names and what they are; any other step shows a glass filled in the lesson's colour (red, white, rose, gold for sweet and fortified,
// fizz). No pictures are fetched: the glass is drawn here, so every step works offline and with nothing loaded.
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** A wine glass in the lesson's colour, as an SVG that follows the theme (wine.css names the colours). */
export function glass(tone = "red", cls = "wn") {
  const bubbles = tone === "fizz" ? `<g class="wn-bub"><circle cx="46" cy="52" r="1.6"/><circle cx="54" cy="44" r="1.3"/><circle cx="50" cy="60" r="1.5"/><circle cx="57" cy="56" r="1.2"/><circle cx="44" cy="38" r="1.2"/></g>` : "";
  return `<svg viewBox="0 0 100 120" class="${cls} t-${tone}" aria-hidden="true">
    <ellipse class="wn-shadow" cx="50" cy="114" rx="26" ry="3"/>
    <path class="wn-bowl" d="M28 14H72C72 44 64 66 50 68C36 66 28 44 28 14Z"/>
    <path class="wn-wine" d="M30 40H70C69 56 63 66 50 68C37 66 31 56 30 40Z"/>
    <path class="wn-rim" d="M28 14H72C72 44 64 66 50 68C36 66 28 44 28 14Z"/>
    <path class="wn-shine" d="M34 20C34 36 37 48 42 56"/>
    ${bubbles}
    <path class="wn-stem" d="M50 68V104M34 108H66"/>
  </svg>`;
}

export function wineStage() {
  let box = null, cur = null;
  const build = s => {
    cur = s;
    box.innerHTML = s.card
      ? `<div class="wn-card"><h4>${esc(s.card.head || "")}</h4><dl>${s.card.rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl></div>`
      : `<div class="wn-glass">${glass(s.tone)}</div>`;
  };
  return {
    mount(b) { box = b; box.classList.add("wn-stage"); },
    task: () => false,
    ready: () => true, label: () => "", submit: () => ({ ok: true }), hint() {},
    draw(s) { if (cur !== s || !box.firstChild) build(s); },
  };
}
