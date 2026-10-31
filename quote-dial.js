// Quote's ruler (31 October 2026, Korbi: "do both: log scale dial, but also user can type"). A market is a bid and an ask;
// typing them is exact and slow on a phone, so a ruler above the boxes sets both by hand and the boxes show what it set (and
// moving a box moves the ruler). A magnitude (an area, a population, a length) is on a log ruler, where a doubling is the
// same distance anywhere on it, as the market's width counts it; a year on a plain one from 1000; a percentage from 0 to 100.
// Any other question has no ruler (a count, an age: a window round the truth would tell where it is).
//
// A ruler must not tell the answer, so a log ruler's five decades are placed by the question's own id, not the truth:
// the truth lies one, two or three decades from its left end, each as likely, and the ends are round numbers.
export const DECADES = 5;
const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/** The ruler for a question: { kind, lo, hi, ticks: [value…] }, or null when it has none. */
export function axisOf(q) {
  if (q.unit === "year") return { kind: "linear", lo: 1000, hi: 2050, ticks: [1000, 1250, 1500, 1750, 2000] };
  if (q.unit === "%" && q.scale !== "log" && q.truth >= 0 && q.truth <= 100) return { kind: "linear", lo: 0, hi: 100, ticks: [0, 25, 50, 75, 100] };
  if (q.scale === "log" && q.truth > 0) {
    const lo = 10 ** (Math.floor(Math.log10(q.truth)) - (1 + hash(q.id) % 3));
    return { kind: "log", lo: Number(lo.toPrecision(1)), hi: Number((lo * 10 ** DECADES).toPrecision(1)), ticks: Array.from({ length: DECADES + 1 }, (_, i) => Number((lo * 10 ** i).toPrecision(1))) };
  }
  return null;
}
const along = (a, v) => (a.kind === "log" ? Math.log10(v / a.lo) / Math.log10(a.hi / a.lo) : (v - a.lo) / (a.hi - a.lo));
/** Where a value is on the ruler, 0 to 1 (a value beyond an end is clamped to it). */
export const posOf = (a, v) => Math.min(1, Math.max(0, along(a, v)));
/** Whether a value lies off the ruler (the ruler shows it at the end, hollow). */
export const offOf = (a, v) => !(along(a, v) >= -1e-9 && along(a, v) <= 1 + 1e-9);
/** The value at a place on the ruler, rounded as someone typing would: two figures of a magnitude, a whole year or per cent. */
export function valueAt(a, p) {
  const t = Math.min(1, Math.max(0, p));
  if (a.kind === "log") return Number((a.lo * (a.hi / a.lo) ** t).toPrecision(2));
  return Math.round(a.lo + t * (a.hi - a.lo));
}
/** A tick's label: 100, 1k, 10k, 1M, 1bn, 0.01. */
export function labelOf(v) {
  if (v < 1) return String(v);
  if (v < 1e3) return String(v);
  if (v < 1e6) return `${v / 1e3}k`;
  if (v < 1e9) return `${v / 1e6}M`;
  if (v < 1e12) return `${v / 1e9}bn`;
  return `${v / 1e12}tn`;
}
/** The width a tap makes a market of, as a share of the ruler: ×/÷ 1.6 on a log ruler, 40 years either side, ten per cent. */
export const TAP_WIDTH = a => (a.kind === "log" ? (2 * Math.log10(1.6)) / DECADES : a.hi === 100 ? 0.2 : 80 / (a.hi - a.lo));

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
/**
 * The ruler on a page: `host` is where it goes. `onChange(bid, ask)` hears every move (the boxes show it); `use(q)` sets
 * the question's ruler (none: the space stays, the ruler hidden, so nothing changes size between questions); `show(bid, ask)`
 * draws a market typed in the boxes; `lock(on)` for a market that can't be changed (quoted, or not yours to make).
 * Drag a handle to move a side; drag the bar between them to move both; touch the ruler where there's no market to make
 * one there. Each handle is a slider for the keys (arrows a hundredth of the ruler, page keys a twentieth, home and end).
 */
export function mountDial(host, { onChange }) {
  host.classList.add("qt-dial");
  const track = el("div", "qt-dial-track"), bar = el("span", "qt-dial-bar"), ticks = el("div", "qt-dial-ticks");
  const handle = side => { const h = el("button", `qt-dial-h ${side}`); h.type = "button"; h.setAttribute("role", "slider"); h.dataset.side = side; h.setAttribute("aria-label", side === "bid" ? "Bid, on the ruler" : "Ask, on the ruler"); h.hidden = true; return h; };
  const hb = handle("bid"), ha = handle("ask");
  track.append(bar, hb, ha);
  host.append(track, ticks);
  let axis = null, bid = null, ask = null, locked = false, drag = null;

  const draw = () => {
    host.classList.toggle("none", !axis);
    host.classList.toggle("locked", locked || !axis);
    for (const [h, v] of [[hb, bid], [ha, ask]]) {
      h.hidden = !axis || v == null;
      h.disabled = locked;
      if (axis && v != null) {
        h.style.setProperty("--at", posOf(axis, v));
        h.classList.toggle("off", offOf(axis, v));
        h.setAttribute("aria-valuemin", axis.lo); h.setAttribute("aria-valuemax", axis.hi); h.setAttribute("aria-valuenow", v);
      }
    }
    const both = axis && bid != null && ask != null;
    bar.hidden = !both;
    if (both) { bar.style.setProperty("--from", posOf(axis, bid)); bar.style.setProperty("--to", posOf(axis, ask)); }
  };
  const emit = () => onChange(bid, ask);
  const pAt = e => { const r = track.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
  const set = (side, p) => {
    const v = valueAt(axis, p);
    if (side === "bid") bid = ask != null && v > ask ? ask : v; else ask = bid != null && v < bid ? bid : v;
  };

  host.addEventListener("pointerdown", e => {
    if (locked || !axis || e.button > 0) return;
    const p = pAt(e), onHandle = e.target.closest?.(".qt-dial-h");
    let mode;
    if (onHandle) mode = onHandle.dataset.side;
    else if (bid != null && ask != null && p > posOf(axis, bid) && p < posOf(axis, ask)) mode = "both";
    else if (bid == null && ask == null) { const w = TAP_WIDTH(axis); bid = valueAt(axis, p - w / 2); ask = valueAt(axis, p + w / 2); mode = "both"; }
    else mode = bid == null ? "bid" : ask == null ? "ask" : Math.abs(p - posOf(axis, bid)) <= Math.abs(p - posOf(axis, ask)) ? "bid" : "ask";
    drag = { mode, p, from: [bid, ask], id: e.pointerId };
    if (mode === "bid" || mode === "ask") set(mode, p);
    host.setPointerCapture?.(e.pointerId);
    e.preventDefault();
    draw(); emit();
  });
  host.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    const p = pAt(e);
    if (drag.mode === "both") {
      const [b0, a0] = drag.from, pb = posOf(axis, b0), pa = posOf(axis, a0);
      const d = Math.min(1 - pa, Math.max(-pb, p - drag.p));        // both stay on the ruler, keeping their width
      bid = valueAt(axis, pb + d); ask = valueAt(axis, pa + d);
    } else set(drag.mode, p);
    draw(); emit();
  });
  const end = e => { if (drag && e.pointerId === drag.id) drag = null; };
  host.addEventListener("pointerup", end);
  host.addEventListener("pointercancel", end);
  host.addEventListener("keydown", e => {
    const h = e.target.closest?.(".qt-dial-h");
    if (!h || locked || !axis) return;
    const side = h.dataset.side, v = side === "bid" ? bid : ask;
    const step = { ArrowLeft: -0.01, ArrowDown: -0.01, ArrowRight: 0.01, ArrowUp: 0.01, PageDown: -0.05, PageUp: 0.05 }[e.key];
    let p;
    if (step !== undefined) p = posOf(axis, v) + step; else if (e.key === "Home") p = 0; else if (e.key === "End") p = 1; else return;
    e.preventDefault();
    set(side, p);
    // two figures can't tell a hundredth apart low on a log ruler's decade: a key always moves
    const moved = side === "bid" ? bid : ask;
    if (moved === v && step !== undefined) set(side, p + step * 2);
    draw(); emit();
  });

  return {
    use(q) {
      axis = axisOf(q);
      ticks.replaceChildren(...(axis ? axis.ticks.map(v => { const t = el("span", "qt-dial-tick", axis.kind === "log" ? labelOf(v) : String(v)); t.style.setProperty("--at", posOf(axis, v)); return t; }) : []));
      bid = ask = null;
      draw();
    },
    show(b, a) { bid = Number.isFinite(b) ? b : null; ask = Number.isFinite(a) ? a : null; if (!drag) draw(); },
    lock(on) { locked = !!on; draw(); },
    get axis() { return axis; },
  };
}
