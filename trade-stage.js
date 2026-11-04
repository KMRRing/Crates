// The stage of the History of trade course (course.js shows it above the words of each step): a map of the lesson with its places named, or
// the step's picture(s), or a card of facts (a reading list, a merchant power from kb/). A "tap the place" step is judged here: the dots are
// the answers. A picture is fetched from Wikipedia as it is shown (pics.js); one that cannot be had gives way to a quiet card with its caption,
// and the step's words never depend on it. Nothing here draws an atrocity: tests/trade.mjs keeps pictures to maps, objects, documents and art.
import { showPicture, OFFLINE_WIDTH } from "./pics.js";
import { mapSvg, placeOf } from "./trade-map.js";
import { PICS } from "./trade-pictures.js";
import { KB_POWERS } from "./trade-kb.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const POWER_ROWS = [["span", "When"], ["where", "Where"], ["traded", "Traded"], ["model", "How it worked"], ["ruled", "Ruled by"], ["fell", "Why it ended"], ["then", "What came after"], ["dark", "The cost"]];

export function tradeStage() {
  let box = null, api = null, cur = null, curSt = null, said = "";
  const caption = () => box.querySelector(".td-cap");

  function build(s, st) {
    cur = s; said = "";
    if (s.pic) {
      box.innerHTML = `<div class="td-pics n${Math.min(s.pic.length, 2)}">${s.pic.map(k => `<figure class="td-fig"><div class="td-cell"><div class="td-pic"></div><div class="td-miss" hidden><b>${esc(PICS[k].says)}</b><span>Picture not available</span></div></div><figcaption>${esc(PICS[k].says)}. Picture: Wikipedia, "${esc(PICS[k].title)}".</figcaption></figure>`).join("")}</div>`;
      s.pic.forEach((k, i) => {
        const fig = box.querySelectorAll(".td-fig")[i], node = fig.querySelector(".td-pic"), miss = fig.querySelector(".td-miss");
        showPicture(node, PICS[k].title, { width: OFFLINE_WIDTH, alt: PICS[k].says }).then(ok => { if (ok === false && cur === s) { fig.classList.add("gone"); miss.hidden = false; } });
      });
      return;
    }
    if (s.power && KB_POWERS[s.power]) {
      const p = KB_POWERS[s.power];
      box.innerHTML = `<div class="td-card"><h4>${esc(p.title || p.name)}</h4><dl>${POWER_ROWS.filter(([k]) => p[k]).map(([k, label]) => `<div><dt>${label}</dt><dd>${esc(p[k])}</dd></div>`).join("")}</dl></div>`;
      return;
    }
    if (s.card) {
      box.innerHTML = `<div class="td-card"><h4>${esc(s.card.head || "")}</h4><dl>${s.card.rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl></div>`;
      return;
    }
    box.innerHTML = `<div class="td-wrap">${mapSvg({ view: s.view, pts: s.pts, routes: s.routes, labels: !s.tap || !!st?.done })}<p class="td-cap" aria-live="polite">&nbsp;</p></div>`;
  }

  // a dot on the map: in a tap step it is an answer; elsewhere it names the place (with kb/'s note if it has one)
  function tapped(id) {
    const s = cur, p = placeOf(id);
    if (!s || !p) return;
    if (s.tap) {
      if (!api || s.__settled) return;
      if (id === s.tap.target) api.answer({ ok: true, msg: s.why, done: true });
      else { (s.__wrong ||= new Set()).add(id); api.answer({ ok: false, why: `That is ${p.name}. Try another.` }); }
      return;
    }
    said = id;
    const c = caption();
    if (c) c.textContent = [p.name, p.country, p.note].filter(Boolean).join(" · ") || p.name;
  }

  function paint(s, st) {
    if (s.pic || s.power || s.card) return;
    box.querySelectorAll(".td-pt").forEach(g => {
      const id = g.dataset.id;
      g.classList.toggle("ok", !!s.tap && st.done && id === s.tap.target);
      g.classList.toggle("hint", !!s.tap && !st.done && st.hint && id === s.tap.target);
      g.classList.toggle("no", !!s.tap && !!s.__wrong?.has(id) && !(st.done && id === s.tap.target));
      g.classList.toggle("dim", !!s.tap && st.done && id !== s.tap.target);
    });
    const c = caption();
    if (c && s.tap) c.textContent = st.done ? `${placeOf(s.tap.target)?.name}${placeOf(s.tap.target)?.country ? `, ${placeOf(s.tap.target).country}` : ""}` : "Tap a place on the map";
    else if (c && !said) c.textContent = "Tap a dot for its name";
  }

  return {
    mount(b, a) {
      box = b; api = a; box.classList.add("td-stage");
      box.addEventListener("click", e => { const g = e.target.closest(".td-pt"); if (g) tapped(g.dataset.id); });
    },
    task: s => !!s.tap,
    ready: () => true, label: () => "", hint() {},
    draw(s, st) {
      if (cur !== s || curSt !== st || !box.firstChild) { curSt = st; if (s.tap) { s.__wrong = new Set(); s.__settled = false; s.__named = false; } build(s, st); }
      if (s.tap && st.done && !s.__named) { s.__named = true; build(s, st); }
      if (s.tap) s.__settled = !!st.done;
      paint(s, st);
    },
  };
}
