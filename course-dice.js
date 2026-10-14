// The dice games' stage for a course (course.js): cups of dice, cups still down, bids, and the exercises a dice game
// asks: tap every die that counts for a bid (the stage judges each tap), or set a bid of your own and make it (the
// game judges it). The game says how its dice look (die(face, cls)), what counts (counts(hand, bid): how many dice of
// a cup count for a bid), what may follow what (follows(prev, bid, seats)), a bid's words (words(bid)), and judges a
// bid made (judge(step, bid) → { ok, msg } or { ok: false, why }).
//
// A step's stage: rows: [{ label, zh, dice ("1 4 4 2 6": a cup lifted) | cups (how many cups still down) | bid ("5 4",
// "5 4 z" plain: one shown large) | text (a word, as 开) }]; tap: the bid to count for, every die in the rows' cups
// tapped that counts (then: the words when all are found); goal: a bid to make after prev (the last bid, or none), at a
// table of seats (4 unless said), answer the bid Hint sets.
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** A bid written "5 4" (five 4s) or "5 4 z" (plain) as { n, f, z }; a bid on 1s is always plain. */
export function parseBid(text) {
  if (!text) return null;
  const [n, f, z] = String(text).trim().split(/\s+/);
  const b = { n: Number(n), f: Number(f), z: z === "z" || Number(f) === 1 };
  if (!(Number.isInteger(b.n) && b.n > 0 && Number.isInteger(b.f) && b.f >= 1 && b.f <= 6) || (z && z !== "z")) throw new Error(`no bid "${text}"`);
  return b;
}
/** A bid as the lessons write it. */
export const bidText = b => `${b.n} ${b.f}${b.z && b.f !== 1 ? " z" : ""}`;
/** A cup written "1 4 4 2 6" as its dice. */
export function parseDice(text) {
  const d = String(text).trim().split(/\s+/).map(Number);
  if (!d.length || d.some(x => !(Number.isInteger(x) && x >= 1 && x <= 6))) throw new Error(`no dice "${text}"`);
  return d;
}
/** Every die a tap exercise counts: [row, index] for each, from the rows' cups. */
export function countingDice(step, counts) {
  const bid = parseBid(step.tap), out = [];
  (step.rows || []).forEach((r, ri) => { if (r.dice) parseDice(r.dice).forEach((d, i) => { if (counts([d], bid)) out.push([ri, i]); }); });
  return out;
}

/** The stage. die(face, cls): a die's markup; counts, follows, words and judge as above. */
export function diceStage({ die, counts, follows, words, judge }) {
  let box = null, api = null, step = null, st = null;
  const seatsOf = s => s.seats || 4;
  const bidHtml = b => `<span class="ldi-bid"><b>${b.n}</b><span class="x">×</span>${die(b.f, "ldi-big")}${b.z && b.f !== 1 ? '<b class="ldi-zhai">斋</b>' : ""}</span>`;
  const head = (text, zh) => (text || zh ? `<small>${esc(text || "")}${zh ? ` <i>${esc(zh)}</i>` : ""}</small>` : "");
  const CUP = '<svg class="ldi-cup" viewBox="0 0 24 24" aria-hidden="true"><path class="body" d="M6.5 6h11l3 11.5q-8.5 2.8-17 0Z"/><path class="band" d="M4.1 14.6q7.9 2.3 15.8 0"/><path class="rim" d="M6.5 6h11"/></svg>';
  /** The bid set on the stage, kept to what may follow the last: the least of its face, or the start. */
  function setFor(s, t) {
    if (!t.bid) t.bid = s.start ? parseBid(s.start) : { ...(parseBid(s.prev) || { n: seatsOf(s), f: 2, z: false }) };
    return t.bid;
  }
  return {
    mount(b, a) {
      box = b;
      api = a;
      box.addEventListener("click", e => {
        if (!step || st.done) return;
        const d = e.target.closest("[data-die]");
        if (d && step.tap) {
          const key = d.dataset.die, face = Number(d.dataset.face), bid = parseBid(step.tap);
          st.found ??= [];
          st.no ??= [];
          if (st.found.includes(key) || st.no.includes(key)) return;
          if (counts([face], bid)) {
            st.found.push(key);
            if (st.found.length === countingDice(step, counts).length) api.answer({ ok: true, msg: step.then || "Every one found." });
            else api.changed();
          } else {
            st.no.push(key);
            api.answer({ ok: false, why: face === 1 ? `A one isn't counted for ${words(bid)}: a plain bid counts only the face itself.` : `A ${face} isn't counted for ${words(bid)}.` });
          }
          return;
        }
        const b = e.target.closest("[data-set]");
        if (b && step.goal && !b.disabled) {
          const bid = setFor(step, st), v = b.dataset.set;
          if (v === "less") bid.n = Math.max(1, bid.n - 1);
          else if (v === "more") bid.n += 1;
          else if (v === "zhai") bid.z = bid.f === 1 ? true : !bid.z;
          else { bid.f = Number(v); if (bid.f === 1) bid.z = true; }
          api.changed();
        }
      });
    },
    task: s => !!(s.tap || s.goal),
    // a bid exercise is made with the button under the words; a tap exercise is judged tap by tap
    submits: s => !!s.goal,
    submit: (s, t) => judge(s, setFor(s, t)),
    ready: (s, t) => follows(parseBid(s.prev), setFor(s, t), seatsOf(s)),
    label: (s, t) => `Bid ${words(setFor(s, t))}`,
    hint(s, t) {
      if (s.goal) t.bid = parseBid(s.answer);
      else t.show = true;
    },
    draw(s, t) {
      step = s;
      st = t;
      const counted = s.tap ? new Map(countingDice(s, counts).map(([r, i]) => [`${r}:${i}`, true])) : null;
      const parts = (s.rows || []).map((r, ri) => {
        let body;
        if (r.dice) {
          body = `<span class="ldi-dice">${parseDice(r.dice).map((d, i) => {
            const key = `${ri}:${i}`, found = t.found?.includes(key), no = t.no?.includes(key), shown = (t.show || t.done) && counted?.has(key);
            const cls = found ? "lit" : no ? "dim" : shown ? "lit hinted" : "";
            return s.tap && !t.done ? `<button type="button" class="ldi-die-btn" data-die="${key}" data-face="${d}" aria-pressed="${!!found}">${die(d, cls)}</button>` : die(d, cls);
          }).join("")}</span>`;
        } else if (r.cups) body = `<span class="ldi-cups" role="img" aria-label="${r.cups} cup${r.cups > 1 ? "s" : ""} down">${CUP.repeat(r.cups)}</span>`;
        else if (r.bid) body = bidHtml(parseBid(r.bid));
        else body = `<b class="lc-word">${esc(r.text || "")}</b>`;
        return `<div class="lc-row">${head(r.label, r.zh)}${body}</div>`;
      });
      if (s.tap && !t.done) parts.push(`<p class="ldi-found">${(t.found || []).length ? `${t.found.length} found` : "Tap the dice that count"}</p>`);
      if (s.goal) parts.push(setterHtml(s, setFor(s, t), t.done));
      box.innerHTML = `<div class="lc ldi">${parts.join("")}</div>`;
      fit(box);
    },
  };

  /**
   * The bid setter: fewer, the count, more, plain; the six faces, two to six and then the one (the highest plain). Bid
   * stays off while the bid doesn't follow the last, and the line under the faces says why.
   */
  function setterHtml(s, bid, done) {
    const off = done ? "disabled" : "";
    const faces = [2, 3, 4, 5, 6, 1].map(f => `<button type="button" class="ldi-face" data-set="${f}" aria-pressed="${bid.f === f}" aria-label="${f}s" ${off}>${die(f)}</button>`).join("");
    return `<div class="ldi-set">
      <div class="ldi-count"><button type="button" class="ldi-step" data-set="less" aria-label="One die fewer" ${done || bid.n <= 1 ? "disabled" : ""}>−</button>
        <b class="ldi-n" aria-live="polite">${bid.n}</b>
        <button type="button" class="ldi-step" data-set="more" aria-label="One die more" ${done || bid.n >= 5 * seatsOf(s) ? "disabled" : ""}>+</button>
        <button type="button" class="ldi-z" data-set="zhai" aria-pressed="${!!bid.z}" ${done || bid.f === 1 ? "disabled" : ""}>斋<small>${bid.f === 1 ? "ones" : "plain"}</small></button></div>
      <div class="ldi-faces" role="group" aria-label="The face">${faces}</div>
      <p class="ldi-says">${follows(parseBid(s.prev), bid, seatsOf(s)) ? "" : esc(judge(s, bid).why || "That doesn't beat the last bid yet")}</p>
    </div>`;
  }
}

/** The dice as large as the stage allows: a die a fifth of the width at most, the whole no taller than the stage. */
function fit(box) {
  const ld = box.firstElementChild, rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  let size = Math.min(3.4 * rem, (ld.clientWidth - 2 * rem) / 6.2, box.clientHeight / 6.5);
  const set = px => ld.style.setProperty("--ldi-die", `${Math.max(rem * 1.1, px)}px`);
  set(size);
  const kids = ld.children, over = () => kids[kids.length - 1].getBoundingClientRect().bottom - kids[0].getBoundingClientRect().top + rem * 0.6 - box.clientHeight;
  for (let k = 0; k < 4 && over() > 0 && size > rem * 1.1; k++) { size *= Math.max(0.6, 1 - over() / box.clientHeight - 0.02); set(size); }
}
