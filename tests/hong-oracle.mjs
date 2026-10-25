// Hong's scorer against a second one written independently: the fan table of
// https://en.wikipedia.org/wiki/Hong_Kong_mahjong_scoring_rules (read 25 October 2026), applied by a separate program
// that reads a finished hand (its melds, its concealed tiles, the winning tile, the flowers, the winds and how the tile
// came) and never looks at the engine's state. Random winning hands, built to land on every pattern (flushes, honours,
// terminals, dragons, winds, all pungs, all chows; melds open and concealed, kongs, flowers, self-draws, robbed kongs,
// last tiles, kong replacements), must score the same fan in both. Where the two were first set side by side (150,000
// hands) the one difference was that the engine broke 門前清 and 坎坎糊 with a concealed kong; both now follow the table:
// a concealed kong is not an open meld. Then whether a set of tiles is a complete hand: the engine's `complete` against
// a plain search, on complete hands, hands one tile off and random ones.
import * as E from "../hong-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- the second scorer ----------
// Input is the finished hand, not the engine's state:
// { melds:[{t,k,open}], conc:[tiles incl. the winning tile], tile, how,
// flowers:[kinds], seatWind, roundWind, last, bloom, chain, heavenly, earthly, cap }.
const HON = k => k >= 27, WIND = k => k >= 27 && k <= 30, DRG = k => k >= 31 && k <= 33;
const TERM = k => k < 27 && (k % 9 === 0 || k % 9 === 8);
const suit = k => (k < 27 ? Math.floor(k / 9) : 3);
/** Every way to read tiles (sorted array) as `n` sets and a pair; each reading is {sets:[{t,k}], pair}. */
function readings(tiles, n) {
  const out = [];
  const go = (arr, sets, pair) => {
    if (!arr.length) { if (pair !== null && sets.length === n) out.push({ sets: sets.slice(), pair }); return; }
    const a = arr[0], rest = arr.slice(1);
    const rm = (x, ...ks) => { const r = x.slice(); for (const k of ks) { const i = r.indexOf(k); if (i < 0) return null; r.splice(i, 1); } return r; };
    if (pair === null) { const r = rm(arr, a, a); if (r) go(r, sets, a); }
    if (sets.length < n) {
      const p = rm(arr, a, a, a); if (p) go(p, [...sets, { t: "pung", k: a }], pair);
      if (a < 27 && a % 9 <= 6) { const c = rm(arr, a, a + 1, a + 2); if (c) go(c, [...sets, { t: "chow", k: a }], pair); }
    }
  };
  go(tiles.slice().sort((x, y) => x - y), [], null);
  return out;
}
const isComplete = (tiles, n) => readings(tiles, n).length > 0;
const ORPH = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
function oracle(h) {
  const cap = h.cap ?? 10, items = [], add = (zh, f) => items.push([zh, f]);
  const lim = (zh, f) => ({ fan: Math.min(f, cap), limit: true, items: [[zh, f]] });
  const n = 4 - h.melds.length;
  if (h.how === "flowers") return h.flowers.length >= 8 ? lim("八仙", 13) : { fan: Math.min(3, cap), limit: false, items: [["花糊", 3]] };
  const conc = h.conc;
  const orphans = h.melds.length === 0 && ORPH.every(k => conc.includes(k)) && conc.length === 14 && ORPH.reduce((s, k) => s + conc.filter(x => x === k).length, 0) === 14;
  if (!orphans && !isComplete(conc, n)) return { fan: -1, items: [], limit: false };
  if (h.heavenly) return lim("天糊", 13);
  if (h.earthly) return lim("地糊", 13);
  if (orphans) return lim("十三么", 13);
  const self = h.how === "self";
  const open = h.melds.some(m => m.open);          // 門前清: no OPEN meld (a concealed kong is not open)
  // everything that doesn't depend on the reading
  const base = [];
  const F = h.flowers, own = [34 + h.seatWind, 38 + h.seatWind];
  if (h.flag) {
    if (!F.length) base.push(["無花", 1]);
    else {
      const flo = [34, 35, 36, 37].every(k => F.includes(k)), sea = [38, 39, 40, 41].every(k => F.includes(k));
      if (flo) base.push(["一台花", 2]); else if (F.includes(own[0])) base.push(["正花", 1]);
      if (sea) base.push(["一台花", 2]); else if (F.includes(own[1])) base.push(["正花", 1]);
    }
  }
  if (h.chain >= 2 && self) base.push(["槓上槓", 8]);
  else { if (self) base.push(["自摸", 1]); if (self && h.bloom) base.push(["槓上開花", 1]); }
  if (!open) base.push(["門前清", 1]);
  if (h.how === "rob") base.push(["搶槓", 1]);
  if (h.last) base.push(["海底", 1]);
  let best = null;
  for (const r of readings(conc, n)) {
    const sets = [...h.melds.map(m => ({ t: m.t === "chow" ? "chow" : "pung", k: m.k, kong: m.t === "kong", open: m.open })), ...r.sets.map(s => ({ ...s, kong: false, open: false }))];
    // a pung finished by a discard is open (unless the tile finishes the pair instead)
    const tiles = [...sets.flatMap(s => (s.t === "chow" ? [s.k, s.k + 1, s.k + 2] : [s.k])), r.pair];
    const pungs = sets.filter(s => s.t === "pung"), chows = sets.filter(s => s.t === "chow");
    const kinds = new Set(tiles.filter(k => k < 27).map(suit)), hon = tiles.some(HON);
    const L = [];
    if (sets.filter(s => s.kong).length === 4) L.push(["十八羅漢", 13]);
    if (pungs.filter(s => WIND(s.k)).length === 4) L.push(["大四喜", 13]);
    if (tiles.every(HON)) L.push(["字一色", 10]);
    if (tiles.every(TERM)) L.push(["清么九", 10]);
    if (!open && h.melds.every(m => !m.open) && h.melds.length === 0 && kinds.size === 1 && !hon) {
      const c = Array(9).fill(0); for (const k of conc) c[k % 9]++;
      if (c[0] >= 3 && c[8] >= 3 && c.every(x => x >= 1)) L.push(["九子連環", 10]);
    }
    if (pungs.length === 4 && h.melds.every(m => !m.open) && (self || r.pair === h.tile)) L.push(["坎坎糊", 10]);
    if (L.length) { L.sort((a, b) => b[1] - a[1]); const x = lim(L[0][0], L[0][1]); if (!best || x.fan > best.fan) best = x; continue; }
    const it = [...base];
    if (kinds.size === 1 && !hon) it.push(["清一色", 7]); else if (kinds.size === 1 && hon) it.push(["混一色", 3]);
    if (pungs.length === 4) it.push(["對對糊", 3]); else if (chows.length === 4) it.push(["平糊", 1]);
    if (hon && tiles.some(TERM) && tiles.every(k => HON(k) || TERM(k))) it.push(["混么九", 1]);
    const dp = pungs.filter(s => DRG(s.k)).length;
    if (dp === 3) it.push(["大三元", 8]); else if (dp === 2 && DRG(r.pair)) it.push(["小三元", 5]); else for (const s of pungs) if (DRG(s.k)) it.push(["番", 1]);
    const wp = pungs.filter(s => WIND(s.k)).length;
    if (wp === 3 && WIND(r.pair)) it.push(["小四喜", 6]);
    else for (const s of pungs) if (WIND(s.k)) { if (s.k - 27 === h.seatWind) it.push(["門風", 1]); if (s.k - 27 === h.roundWind) it.push(["圈風", 1]); }
    const raw = it.reduce((s, x) => s + x[1], 0), x = { fan: Math.min(raw, cap), raw, limit: false, items: it };
    if (!best || x.fan > best.fan || (x.fan === best.fan && x.raw > (best.raw ?? 0))) best = x;
  }
  return best;
}

// ---------- random winning hands ----------
let seed = 5; const N = 30000;
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const pick = a => a[Math.floor(rnd() * a.length)];
const MODES = ["any", "any", "flush", "flushhon", "hon", "term", "dragons", "winds", "pungs", "chows"];
function tileFor(mode, suitPick) {
  switch (mode) {
    case "flush": return suitPick * 9 + Math.floor(rnd() * 9);
    case "flushhon": return rnd() < 0.3 ? 27 + Math.floor(rnd() * 7) : suitPick * 9 + Math.floor(rnd() * 9);
    case "hon": return 27 + Math.floor(rnd() * 7);
    case "term": return pick([0, 8, 9, 17, 18, 26]);
    case "dragons": return rnd() < 0.5 ? 31 + Math.floor(rnd() * 3) : Math.floor(rnd() * 34);
    case "winds": return rnd() < 0.5 ? 27 + Math.floor(rnd() * 4) : Math.floor(rnd() * 34);
    default: return Math.floor(rnd() * 34);
  }
}
/** A random finished hand: its melds, concealed sets and pair, or null if the tiles don't exist. */
function gen() {
  const mode = pick(MODES), sp = Math.floor(rnd() * 3), used = Array(34).fill(0), take = (k, n) => { used[k] += n; return used[k] <= 4; };
  const nm = pick([0, 0, 1, 2, 3, 4, 4]), melds = [], sets = [];
  const mkSet = (allowChow = true) => {
    const chowOK = allowChow && mode !== "hon" && mode !== "term" && mode !== "pungs" && mode !== "dragons" && mode !== "winds";
    if (mode === "chows") { const k = sp * 9 + Math.floor(rnd() * 7); return { t: "chow", k }; }
    if (chowOK && rnd() < 0.5) { const k = (mode === "flush" || mode === "flushhon" ? sp : Math.floor(rnd() * 3)) * 9 + Math.floor(rnd() * 7); return { t: "chow", k }; }
    return { t: "pung", k: tileFor(mode, sp) };
  };
  for (let i = 0; i < nm; i++) {
    const s = mkSet(); const kong0 = s.t === "pung" && rnd() < 0.4, open = s.t === "chow" || !kong0 || rnd() < 0.5;
    const kong = kong0;
    melds.push({ t: kong ? "kong" : s.t, k: s.k, open });
    const tiles = s.t === "chow" ? [s.k, s.k + 1, s.k + 2] : kong ? [s.k, s.k, s.k, s.k] : [s.k, s.k, s.k];
    for (const t of tiles) if (!take(t, 1)) return null;
  }
  for (let i = nm; i < 4; i++) { const s = mkSet(); sets.push(s); const tiles = s.t === "chow" ? [s.k, s.k + 1, s.k + 2] : [s.k, s.k, s.k]; for (const t of tiles) if (!take(t, 1)) return null; }
  const pair = mode === "chows" ? Math.floor(rnd() * 34) : tileFor(mode, sp);
  if (!take(pair, 2)) return null;
  const conc = [...sets.flatMap(s => (s.t === "chow" ? [s.k, s.k + 1, s.k + 2] : [s.k, s.k, s.k])), pair, pair];
  return { melds, conc };
}
let n = 0, diffs = new Map(), seen = 0;
while (n < N) {
  const g = gen(); if (!g) continue;
  n++;
  const how = pick(["self", "discard", "discard", "rob"]), tile = pick(g.conc);
  const seat = Math.floor(rnd() * 4), dealer = Math.floor(rnd() * 4), round = Math.floor(rnd() * 4);
  const nfl = pick([0, 0, 1, 2, 3, 4, 5]), fl = []; while (fl.length < nfl) { const f = 34 + Math.floor(rnd() * 8); if (!fl.includes(f)) fl.push(f); }
  if (rnd() < 0.1) for (let k = 34; k < 38; k++) if (!fl.includes(k)) fl.push(k);
  const flags = { afterKong: false, kongChain: 0, lastDraw: false, finalDiscard: false, heavenly: false, earthly: false };
  if (how === "self" && rnd() < 0.2) { flags.afterKong = true; flags.kongChain = pick([1, 1, 2]); }
  if (rnd() < 0.15) { if (how === "self" && !flags.afterKong) flags.lastDraw = true; if (how === "discard") flags.finalDiscard = true; }
  const st = E.deal({ seed: 7, dealer, round, opts: { flowers: true, minFan: 3 } });
  const conc = g.conc.slice(); const hand = conc.slice(); if (how !== "self") hand.splice(hand.indexOf(tile), 1);
  st.seats[seat] = { hand: hand.sort((a, b) => a - b), melds: g.melds.map(m => ({ ...m, from: m.open ? 0 : -1 })), flowers: fl, river: [], passBlock: false };
  st.flags = { ...st.flags, ...flags };
  const e = E.scoreWin(st, { seat, tile, how, from: (seat + 1) % 4 });
  const seatWind = (seat - dealer + 4) % 4;
  const o = oracle({ melds: g.melds, conc, tile, how, flowers: fl, seatWind, roundWind: round, last: flags.lastDraw || flags.finalDiscard, bloom: flags.afterKong, chain: flags.kongChain, flag: true, cap: 10, heavenly: false, earthly: false });
  if (e.fan !== o.fan) {
    const key = `${e.limit ? "L" : ""}${e.items.map(i => i.zh).join("+")} | ${o.items.map(i => i[0]).join("+")}`;
    const kinds = new Set(); // a short label of what differs
    const eN = new Set(e.items.map(i => i.zh)), oN = new Set(o.items.map(i => i[0]));
    const tag = [...oN].filter(x => !eN.has(x)).map(x => "+" + x).concat([...eN].filter(x => !oN.has(x)).map(x => "-" + x)).join(" ");
    const d = diffs.get(tag) || { count: 0, ex: null }; d.count++; d.ex ??= { melds: g.melds, conc, tile, how, e: `${e.fan}:${e.items.map(i => i.zh + i.fan).join(" ")}`, o: `${o.fan}:${o.items.map(i => i[0] + i[1]).join(" ")}` };
    diffs.set(tag, d);
  }
}
check(diffs.size === 0, `${N} random winning hands score the same fan in the engine and in the independent scorer${diffs.size ? ` (${[...diffs.values()].reduce((a, d) => a + d.count, 0)} differ, first: ${JSON.stringify([...diffs.values()][0].ex)})` : ""}`);

// ---------- is it a complete hand ----------
seed = 11;
let total = 0, agree = 0, completeSeen = 0;
for (let i = 0; i < 20000; i++) {
  const g = gen(); if (!g) continue;
  const n = g.sets ? 0 : 4 - g.melds.length;
  const tiles = g.conc.slice();
  const mode = i % 3;                                                   // as built, one tile changed, or a random draw of as many
  if (mode === 1) tiles[Math.floor(rnd() * tiles.length)] = Math.floor(rnd() * 34);
  if (mode === 2) for (let j = 0; j < tiles.length; j++) tiles[j] = Math.floor(rnd() * 34);
  const c = E.counts(tiles);
  if (c.some(x => x > 4)) continue;
  total++;
  const want = isComplete(tiles, n), got = E.complete(c.slice(), n);
  if (want) completeSeen++;
  if (want === got) agree++; else if (agree + 1 < total) console.log("  differ:", JSON.stringify({ tiles, n, want, got }));
}
check(total > 10000 && agree === total && completeSeen > 3000, `${total} sets of tiles (${completeSeen} complete): the engine and a plain search agree on every one`);
const orph = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
check(E.orphans(E.counts([...orph, 0])) && E.orphans(E.counts([...orph, 33])) && !E.orphans(E.counts([...orph, 1])) && !E.orphans(E.counts([...orph.slice(1), 1, 1])), "thirteen orphans: each of the thirteen once and any one of them again, nothing else");

console.log(bad ? `hong oracle: ${bad} failed` : "hong oracle: the engine scores as the published table does");
process.exit(bad ? 1 : 0);
