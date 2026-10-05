// Harbour's programs as the tape shows and edits them. A program is a row of items: an instruction (null for an empty
// hour) or a loop { n, body } that plays its body n times. On the tape every hour is a column, so timing between ships
// stays visible: a loop's first pass is its body, the passes after it are ghosts of it, and the first ghost carries
// the count. Editing a ghost edits the body, so a loop stays one thing. Loops don't nest: anything that would put a
// loop inside a loop unrolls the inner one. Every function returns a new program; tests/harbour.mjs checks them.
import { flatten } from "./harbour-engine.js";

const BACK = { N: "S", S: "N", E: "W", W: "E" };
export const isLoop = it => !!it && typeof it === "object";
const copy = it => (isLoop(it) ? { n: it.n, body: [...it.body] } : it);
const asLoop = (n, body) => (n >= 2 ? [{ n, body: [...body] }] : n === 1 ? [...body] : []);
const trim = p => { while (p.length && p[p.length - 1] == null) p.pop(); return p; };

/** How many hours a program spans, loops played out. */
export const width = prog => prog.reduce((n, it) => n + (isLoop(it) ? it.n * it.body.length : 1), 0);

/** Where each item sits on the tape. */
export function spans(prog) {
  let c = 0;
  return prog.map((it, i) => { const len = isLoop(it) ? it.n * it.body.length : 1, s = { i, start: c, len, loop: isLoop(it) }; c += len; return s; });
}

/** What a column holds: an instruction; a loop's body cell or one of its ghosts (b: the body cell it plays); or nothing yet. */
export function at(prog, col) {
  for (const s of spans(prog)) {
    if (col < s.start || col >= s.start + s.len) continue;
    if (!s.loop) return { kind: "op", i: s.i, op: prog[s.i] };
    const L = prog[s.i], k = col - s.start, len = L.body.length;
    return { kind: k < len ? "body" : "ghost", i: s.i, b: k % len, len, n: L.n, op: L.body[k % len], badge: k === len };
  }
  return { kind: "past", op: null };
}

/** Sets one hour (a ghost sets its body cell, so every pass changes). */
export function paint(prog, col, op) {
  const p = prog.map(copy), a = at(p, col);
  if (a.kind === "past") { while (width(p) < col) p.push(null); p.push(op); }
  else if (a.kind === "op") p[a.i] = op;
  else p[a.i].body[a.b] = op;
  return trim(p);
}

/** Puts items in before a column, shifting the rest later. Inside a loop they go into its body, unrolled. */
export function insert(prog, col, items) {
  const p = prog.map(copy), a = at(p, col);
  if (a.kind === "past") { while (width(p) < col) p.push(null); p.push(...items.map(copy)); }
  else if (a.kind === "op" || (a.kind === "body" && a.b === 0)) p.splice(a.i, 0, ...items.map(copy));
  else p[a.i].body.splice(a.kind === "ghost" && a.b === 0 ? a.len : a.b, 0, ...flatten(items));
  return trim(p);
}

/** Takes out the hours c0..c1, shifting the rest earlier. Hours of a loop's body go from every pass; hours of its
 * later passes only take passes away. */
export function remove(prog, c0, c1) {
  const out = [];
  for (const s of spans(prog)) {
    const it = prog[s.i], lo = Math.max(c0, s.start), hi = Math.min(c1, s.start + s.len - 1);
    if (lo > hi) { out.push(copy(it)); continue; }
    if (!s.loop) continue;
    const len = it.body.length, cut = new Set();
    let ghosts = 0;
    for (let c = lo; c <= hi; c++) { const k = c - s.start; if (k < len) cut.add(k); else ghosts++; }
    if (cut.size) { const body = it.body.filter((_, b) => !cut.has(b)); if (body.length) out.push(...asLoop(it.n, body)); }
    else out.push(...asLoop(it.n - Math.ceil(ghosts / len), it.body));
  }
  return trim(out);
}

/** The hours c0..c1 as items to paste: a loop wholly inside stays a loop, part of one is the hours it plays there. */
export function slice(prog, c0, c1) {
  const out = [];
  for (const s of spans(prog)) {
    const lo = Math.max(c0, s.start), hi = Math.min(c1, s.start + s.len - 1), it = prog[s.i];
    if (lo > hi) continue;
    if (!s.loop) out.push(it);
    else if (lo === s.start && hi === s.start + s.len - 1) out.push(copy(it));
    else for (let c = lo; c <= hi; c++) out.push(it.body[(c - s.start) % it.body.length]);
  }
  for (let c = Math.max(c0, width(prog)); c <= c1; c++) out.push(null);   // empty hours past the end keep the block's width
  return out;
}

/** Makes the hours c0..c1 a loop played twice. null if the range starts or ends inside a loop (loops don't nest). */
export function loop(prog, c0, c1) {
  for (const s of spans(prog)) {
    const end = s.start + s.len - 1, overlaps = c0 <= end && c1 >= s.start;
    if (s.loop && overlaps && !(c0 <= s.start && c1 >= end)) return null;
  }
  const body = flatten(slice(prog, c0, c1));
  return insert(remove(prog, c0, c1), c0, [{ n: 2, body }]);
}

/** A loop's count; 1 or less unrolls it to its body. */
export function setCount(prog, i, n) {
  const p = prog.map(copy);
  p.splice(i, 1, ...asLoop(Math.min(n, 99), p[i].body));
  return trim(p);
}

/** The way back: the hours played in reverse, every move turned round (N and S, E and W swap). */
export const backwards = items => flatten(items).reverse().map(op => BACK[op] || op);

/** The row one hour later (or earlier) in a loop of P hours: what falls off one end comes round to the other. This is
 * how a second ship runs the same route a few hours behind the first. */
export function shift(prog, P, later) {
  const p = prog.map(copy);
  while (width(p) < P) p.push(null);
  if (later) {
    const last = p.pop();
    if (isLoop(last)) { p.push(...asLoop(last.n - 1, last.body), ...last.body.slice(0, -1)); p.unshift(last.body[last.body.length - 1]); }
    else p.unshift(last);
  } else {
    const first = p.shift();
    if (isLoop(first)) { p.unshift(...first.body.slice(1), ...asLoop(first.n - 1, first.body)); p.push(first.body[0]); }
    else p.push(first);
  }
  return trim(p);
}
