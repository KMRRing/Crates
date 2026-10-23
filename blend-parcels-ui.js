// Blend's second mode on the page: the day's parcels on the dock, the tanks they go in, and each tank's specification shown
// as the range the parcels' certificates leave it in. The rules and the generation are blend-parcels.js's; blend.js owns
// the page, the mode and the first mode (orders), and hands this the "why" dialog and the menu's parts.
import { DESKS, STARS, DOCK, makeDeal, newRun, known, tankView, expected, load, test, close, fits, loaded } from "./blend-parcels.js";
import { COMPONENTS, PROPS, PRODUCTS } from "./blend-engine.js";
import { busy } from "./loading.js";
import { IN_FRAME } from "./suite.js";
import { action } from "./menu.js";

const KEY = "blend2:parcels";
const $ = id => document.getElementById(id);
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const euro = n => `${n < 0 ? "−\u2060" : ""}€${Math.abs(Math.round(n)).toLocaleString("en")}`;
const kilo = n => `${n < 0 ? "−" : ""}€${(Math.abs(n) / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1)}k`;
const starText = n => "★".repeat(n) + "☆".repeat(3 - n);
const LETTERS = "ABC";
const SHORT = { cet: "cetane", dens: "density", s: "sulphur", pah: "PAH", flash: "flash point", cfpp: "CFPP", visc: "viscosity", lub: "lubricity", ron: "RON", mon: "MON", rvp: "vapour pressure", e70: "E70", arom: "aromatics", olef: "olefins", benz: "benzene" };
const shortName = id => PRODUCTS[id].name.replace(/ \(.*/, "").replace(" diesel,", "").replace(" petrol,", "");
const num = (p, v) => (Number.isInteger(v) || Math.abs(v) >= 100 ? String(Math.round(v)) : v.toFixed(p === "visc" || p === "benz" ? 2 : 1));
const unitOf = p => (PROPS[p].unit && PROPS[p].unit !== "ppm" ? ` ${PROPS[p].unit}` : PROPS[p].unit === "ppm" ? " ppm" : "");
const limitText = (min, max) => (min != null && max != null ? `${min}–${max}` : min != null ? `≥ ${min}` : `≤ ${max}`);
const span = (p, a, b) => (Math.abs(b - a) < (p === "visc" || p === "benz" ? 0.005 : 0.05) ? num(p, a) : `${num(p, a)}…${num(p, b)}`);

export function createParcels({ explain, synced, starred }) {
  let S = { desk: 1, run: null, best: {}, stars: {}, ...read(KEY, {}) };
  let deal = null, run = null, sel = 0, dealing = 0;
  const save = () => { if (!IN_FRAME) try { localStorage.setItem(KEY, JSON.stringify({ ...S, run })); } catch { /* private mode */ } };

  // ---------- the day ----------
  /** Deals a desk: a saved day whole, else a fresh one (or the same seed over). The deal can take a moment, so the rete holds the screen. */
  function start(desk = S.desk, seed = null, resume = null) {
    const token = ++dealing, done = busy("Dealing the parcels");
    setTimeout(() => {
      try {
        if (token !== dealing) return;
        const s = seed ?? (Math.random() * 2 ** 31) >>> 0;
        deal = makeDeal(desk - 1, s);
        run = resume && resume.assign?.length === deal.parcels.length ? resume : newRun(deal);
        S.desk = desk;
        sel = 0;
        save();
        render();
      } finally { done(); }
    }, 20);
  }
  /** Opens the mode: the saved day if it is whole, else the desk's first. */
  function enter() {
    const r = S.run, ok = r && DESKS[r.desk - 1] && Number.isFinite(r.seed) && Array.isArray(r.assign) && Array.isArray(r.tested);
    if (ok) start(r.desk, r.seed, r); else start(S.desk);
  }

  // ---------- drawing ----------
  function render() {
    if (!deal) return;
    const D = DESKS[deal.desk - 1], closed = !!run.closed, kn = known(deal, run);
    select.value = String(deal.desk);
    synced();
    const views = deal.tanks.map((_, t) => tankView(deal, run, t, kn));
    $("bpTitle").textContent = `Desk ${D.id}: ${D.title}`;
    // the tanks
    const tanks = $("bpTanks");
    tanks.replaceChildren();
    tanks.style.setProperty("--tanks", String(deal.tanks.length));
    views.forEach(v => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `bp-tank ${v.state}`;
      b.setAttribute("aria-pressed", String(v.t === sel));
      const result = run.closed?.tanks[v.t];
      const badge = result ? (result.empty ? "empty" : result.ok ? "✓" : "✗") : { empty: "empty", pass: "✓", risk: `${Math.round(v.chance * 100)}%`, fail: "✗" }[v.state];
      b.innerHTML = `<span class="bp-t1"><b>${LETTERS[v.t]}</b> ${shortName(v.product)}</span><span class="bp-t2"><span>${Math.round(v.vol)} / ${v.cap} m³</span><b class="bp-t3">${badge}</b></span><i style="width:${Math.min(100, (v.vol / v.cap) * 100)}%"></i>`;
      b.addEventListener("click", () => { sel = v.t; render(); });
      tanks.append(b);
    });
    // the selected tank's specification, a range a line
    const v = views[sel], chips = $("bpSpec");
    chips.replaceChildren();
    for (const row of v.rows) {
      const chip = document.createElement("button"), p = row.p, lim = limitText(row.min, row.max);
      chip.type = "button";
      chip.className = `bl-chip ${row.state === "none" ? "" : row.state === "ok" ? "ok" : row.state === "risk" ? "risk" : "no"}`;
      const val = row.lo == null ? "–" : span(p, row.lo, row.hi);
      chip.innerHTML = `${PROPS[p].name} <b>${row.state === "none" ? lim : val}</b>${row.state === "ok" ? " ✓" : row.state === "risk" ? " ?" : row.state === "no" ? " ✗" : ""}`;
      chip.setAttribute("aria-label", `${PROPS[p].name}: ${row.state === "none" ? "empty tank" : val}, limit ${lim}, ${{ ok: "certain to pass", risk: "could fail", no: "sure to fail", none: "" }[row.state]}`);
      chip.addEventListener("click", () => explain(PROPS[p].name, `Spec ${lim}${unitOf(p)}. ${row.state === "none" ? "" : `This tank: ${val}${unitOf(p)}, ${{ ok: "on spec whatever the untested figures turn out to be", risk: "on spec only if the untested figures turn out kindly", no: "off spec whatever the untested figures turn out to be" }[row.state]}. `}${PROPS[p].why}`));
      chips.append(chip);
    }
    // the dock
    const box = $("bpParcels");
    const top = box.scrollTop;
    box.replaceChildren();
    deal.parcels.forEach((k, i) => {
      const u = kn[i].untested, row = document.createElement("div");
      row.className = "bl-row bp-row";
      const left = document.createElement("div");
      const name = document.createElement("div");
      name.className = "name";
      name.textContent = k.name.replace(/ \(.*\)/, "");
      if (k.bio) { const bio = document.createElement("span"); bio.className = "bio"; bio.textContent = k.bio > 1 ? "renewable ×2" : "renewable"; name.append(bio); }
      name.addEventListener("click", () => parcelDialog(i));
      const meta = document.createElement("div"), nt = document.createElement("div");
      meta.className = "meta";
      meta.textContent = `${k.vol} m³ · ${euro(k.price)}/m³`;
      nt.className = `meta${u.length ? " nt" : ""}`;
      nt.textContent = u.length ? `untested: ${u.map(p => SHORT[p]).join(", ")}` : "full certificate";
      left.append(name, meta, nt);
      const go = document.createElement("div");
      go.className = "bp-load";
      go.setAttribute("role", "group");
      go.setAttribute("aria-label", `Where ${k.name} goes`);
      const places = [...deal.tanks.map((_, t) => t), -1];
      for (const t of places) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = t < 0 ? "–" : LETTERS[t];
        b.setAttribute("aria-label", t < 0 ? "Sell on the dock" : `Load into tank ${LETTERS[t]}`);
        b.setAttribute("aria-pressed", String(run.assign[i] === t));
        b.disabled = closed || (t >= 0 && !fits(deal, run, i, t));
        b.addEventListener("click", () => {
          if (load(deal, run, i, t) === null) return;
          if (t >= 0) sel = t;
          save();
          render();
        });
        go.append(b);
      }
      row.append(left, go);
      box.append(row);
    });
    box.scrollTop = top;
    const onDock = run.assign.filter(a => a < 0).length;
    $("bpTotal").textContent = `${onDock ? `${onDock} on the dock` : "all loaded"} · test ${euro(deal.test)}`;
    // the day
    const anyLoaded = run.assign.some(a => a >= 0), risky = views.filter(x => x.state === "risk"), doomed = views.filter(x => x.state === "fail");
    if (closed) {
      const c = run.closed;
      $("bpSum").textContent = `Closed ${euro(c.profit)} · par ${euro(c.par)}`;
      $("bpVerdict").className = `bl-verdict ${c.profit > 0 ? "good" : "bad"}`;
      $("bpVerdict").textContent = `${starText(c.stars)} ${c.stars === 3 ? "Read the risk well." : c.stars ? "Closed in profit." : "A loss."}`;
    } else {
      $("bpSum").textContent = `Expected ${euro(expected(deal, run, kn))} · par ${euro(deal.par)}${run.tested.length ? ` · ${run.tested.length} test${run.tested.length > 1 ? "s" : ""}` : ""}`;
      $("bpVerdict").className = `bl-verdict${doomed.length ? " bad" : !risky.length && anyLoaded ? " good" : ""}`;
      $("bpVerdict").textContent = !anyLoaded ? "Load parcels into the tanks." : doomed.length ? `Tank ${LETTERS[doomed[0].t]} will fail: take something out.` : risky.length ? `Tank ${LETTERS[risky[0].t]} could fail (${Math.round(risky[0].chance * 100)}% to pass): test a parcel, or load something safer.` : "Every loaded tank passes whatever the untested figures are.";
    }
    $("bpClose").textContent = closed ? "Result" : "Close";
    $("bpClose").disabled = !closed && !anyLoaded;
  }

  // ---------- a parcel's certificate ----------
  let shown = -1;
  function parcelDialog(i = shown) {
    shown = i;
    const k = deal.parcels[i], kn = known(deal, run)[i], closed = !!run.closed;
    $("parcelTitle").textContent = `${k.name}, ${k.vol} m³`;
    const rows = deal.props.filter(p => kn.typical[p] != null).map(p => {
      const name = PROPS[p].name, open = k.open.includes(p), bought = open && !kn.untested.includes(p);
      if (!open || bought) return `<tr><td>${name}</td><td>${num(p, k.truth[p])}${unitOf(p)}</td><td>${bought ? "tested" : "certified"}</td></tr>`;
      const cell = closed ? `<td>actual ${num(p, k.truth[p])}${unitOf(p)}</td>` : `<td><button type="button" class="bp-test" data-p="${p}">Test ${euro(deal.test)}</button></td>`;
      return `<tr class="nt"><td>${name}</td><td>not tested: typically ${num(p, kn.typical[p])}, from ${num(p, kn.lo[p])} to ${num(p, kn.hi[p])}${unitOf(p)}</td>${cell}</tr>`;
    }).join("");
    $("parcelBody").innerHTML = `<p class="bl-why">${COMPONENTS[k.comp].note} Landed at ${euro(k.price)}/m³ (${euro(k.price * k.vol)} for the parcel). A parcel left on the dock is sold at ${Math.round(DOCK * 100)}% under what it cost.</p><table class="bp-cert"><tbody>${rows}</tbody></table>`;
    if (!$("parcelDlg").open) $("parcelDlg").showModal();
  }
  $("parcelBody").addEventListener("click", e => {
    const b = e.target.closest(".bp-test");
    if (!b || !test(deal, run, shown, b.dataset.p)) return;
    save();
    render();
    parcelDialog();
  });
  $("parcelClose").addEventListener("click", () => $("parcelDlg").close());

  // ---------- closing the tanks ----------
  function result() {
    const c = run.closed, D = DESKS[deal.desk - 1];
    $("resultHead").textContent = `Desk ${D.id}: ${euro(c.profit)}`;
    $("resultStars").textContent = starText(c.stars);
    const rows = c.tanks.map(x => {
      const off = x.verdict.filter(y => !y.ok).map(y => `${PROPS[y.p].name} ${num(y.p, y.value)}${unitOf(y.p)}, wanted ${limitText(y.min, y.max)}`);
      return `<div class="bp-res ${x.empty ? "" : x.ok ? "ok" : "no"}"><b>${LETTERS[x.t]} · ${shortName(x.product)}</b><span>${x.empty ? "empty" : `${Math.round(x.vol)} m³ ${x.ok ? "on spec" : "off spec"}`}</span><em>${x.empty ? "" : euro(x.profit)}</em>${off.length ? `<small>${off.join("; ")}</small>` : ""}</div>`;
    }).join("");
    $("resultBody").innerHTML = `${rows}<div class="bp-res"><b>Left on the dock</b><span></span><em>${euro(c.dock)}</em></div><div class="bp-res"><b>Tests bought</b><span>${run.tested.length}</span><em>${euro(-c.tests)}</em></div>`;
    $("resultNote").textContent = `Par is perfect information: the best loading if every figure were known, which no one has. It would have made ${euro(c.par)}; you made ${euro(c.profit)}.${c.stars < 3 ? ` Three stars is ${euro(Math.ceil(STARS.three * c.par))}.` : ""}`;
    $("resultNext").textContent = deal.desk === DESKS.length ? "Back to desk 1" : `Desk ${deal.desk + 1}`;
    if (!$("resultDlg").open) $("resultDlg").showModal();
  }
  function closeTanks() {
    if (run.closed) { result(); return; }
    if (!run.assign.some(a => a >= 0)) return;
    if (!confirm("Close the tanks? The receiving lab tests what is in them, and the day is final.")) return;
    const c = close(deal, run);
    S.best[deal.desk] = Math.max(S.best[deal.desk] ?? -Infinity, c.profit);
    S.stars[deal.desk] = Math.max(S.stars[deal.desk] ?? 0, c.stars);
    save();
    starred();
    render();
    result();
  }
  $("bpClose").addEventListener("click", closeTanks);
  $("resultNext").addEventListener("click", () => { $("resultDlg").close(); start(deal.desk === DESKS.length ? 1 : deal.desk + 1); });
  $("resultAgain").addEventListener("click", () => { $("resultDlg").close(); start(deal.desk); });
  $("resultClose").addEventListener("click", () => $("resultDlg").close());
  $("bpAbout").addEventListener("click", () => explain(`Desk ${deal.desk}: ${DESKS[deal.desk - 1].title}`, `${DESKS[deal.desk - 1].intro} ${HOW}`));

  // ---------- the menu and the header ----------
  /** The menu's content part: the desks, each with its best and stars, and a fresh day. */
  function menu(play, content, close_) {
    play.append(action("Start this day over", () => start(deal.desk, deal.seed), "primary"), action("A fresh day", () => start(deal.desk)));
    const list = document.createElement("div");
    list.className = "bl-levels";
    for (const D of DESKS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = S.stars[D.id] ? "done" : "";
      if (deal && D.id === deal.desk) b.setAttribute("aria-current", "true");
      const t = document.createElement("b"), r = document.createElement("span");
      t.textContent = `${D.id}. ${D.title}`;
      r.textContent = S.best[D.id] != null ? `best ${kilo(S.best[D.id])} ${starText(S.stars[D.id] || 0)}` : "";
      b.append(t, r);
      b.addEventListener("click", () => { close_(); start(D.id); });
      list.append(b);
    }
    content.append(list);
  }
  const select = $("desk");
  for (const D of DESKS) { const o = document.createElement("option"); o.value = String(D.id); o.textContent = `Desk ${D.id}`; select.append(o); }
  select.addEventListener("change", () => start(Number(select.value)));

  return {
    enter, menu, render,
    get desk() { return deal?.desk ?? S.desk; },
    /** The stars of every desk's best day, which the games screen counts with the orders'. */
    get stars() { return Object.values(S.stars).reduce((a, n) => a + n, 0); },
    sync() { select.value = String(deal?.desk ?? S.desk); },
    // for tests and debugging
    get deal() { return deal; }, get run() { return run; }, load: (i, t) => { load(deal, run, i, t); save(); render(); }, test: (i, p) => { test(deal, run, i, p); save(); render(); }, closeTanks, loaded: t => loaded(run, t), start,
  };
}
const HOW = "Parcels are on the dock, each with a certificate of analysis (COA, the seller's lab report) that leaves some figures untested; for those you only know what such a parcel typically shows, as a range. Load whole parcels into the tanks with A, B, C (or – to sell it on the dock at a small loss). A tank's figures are shown as the range its parcels leave them in, and the chance the tank passes. Buy a test to settle a figure, or load by the ones you know. Close the tanks and the receiving lab tests what is in each: a tank that meets its specification sells at the product's price plus its renewable credit; one that doesn't is downgraded and sold under cost.";
