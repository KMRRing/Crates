// A head-to-head on one deal (October 2026), for the games otherwise played alone: everyone at the table gets the same
// match (its seed and the game's options), each plays it through on their own phone, and the room keeps each player's
// score as it goes, so each sees the others'. It runs on together.js, in the pair's room or a party's (up to six): a
// lobby where each says Ready, a countdown to a start everyone shares, the match, and the result, ranked, with
// Rematch and Back to solo; the pair's record gets the result (reportDuo, through together.js). A game supplies how to
// deal a match and how to play one, reports its score as it goes, and keeps its solo run out of it; the rest is here.
import { createTogether } from "./together.js";
import { busy, sextant } from "./loading.js";
import { COUNTDOWN, freshDuel, isDuel, seated, slotOf, runOf, presentSlots, allReady, startAll, sayReady, noteRun, rematch, byScore, standings, isOver, resultOf } from "./duel-core.js";

export { COUNTDOWN, byScore, standings, runOf };

// ---------- the table, on a page ----------
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const first = name => String(name || "Player").split(" ")[0];
const roomInAddress = () => (new URLSearchParams(location.search).get("room") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
const CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

/**
 * game: the room branch, and the prefix of the run kept on this device (`<game>:duel`); name: the game's name in
 * words; app: this code's version of the match (a device with older code is updated); deal(): the match everyone
 * plays, { seed, …options }, dealt on the device that starts it; play(match, { begun, kept, done, run }): starts
 * this device's run (begun: the server time it started, for a clock, against now(); kept: what keep() last saved of
 * it here; done: it's already over, so show it as it ended; run: what the table has of it, for a device that takes
 * a seat over without anything kept); describe(match): what it is, in a few words; compare: a sort
 * comparator over runs (byScore); lower: a lower score is better; extra(): the game's own lines under the result (what
 * you missed), headed extraTitle; line: where the others' scores show (else a line under the header); accent: the game's enamel
 * variable; onLobby(match): the board before a match starts; onLeave(): back to solo; toast(msg).
 */
export function createDuel({ game, name, app = 1, deal, play, describe = () => "", compare, lower = false, extra = () => null,
  extraTitle = "Your run", line = null, accent = "--brass", onLobby = () => {}, onLeave = () => {}, toast = () => {} }) {
  compare ??= byScore(lower);
  const KEEP = `${game}:duel`;
  let cur = null;             // the table as last seen, with this device's finish laid over it until the database has it
  let offset = 0, stopOffset = null;
  let played = null;          // the match this device has started (play() called), by number
  let lobbyFor = null;        // the match the board was cleared for
  let shown = null, closedFor = null, timer = 0, ticker = 0, firstDrawn = null;
  let sending = null, queued = null, finish = null;   // reports on their way; this device's finish, until it's stored
  let said = "";              // the last report, so one that changes nothing isn't sent

  const now = () => Date.now() + offset;
  const me = () => together.room?.uid;
  const mySlot = () => slotOf(cur, me());
  const present = () => (cur ? presentSlots(cur, together.room?.here, game, me()) : []);

  const together = createTogether({
    game, app, toast, askName,
    valid: isDuel,
    slots: g => g?.people || 2,
    fresh: async (players, { ask } = {}) => freshDuel(players, { app, people: ask?.people, match: await deal() }),
    onState,
    onPresence: () => { if (cur) { maybeStart(); draw(); flush(); } },
    onLeave: () => { reset(); onLeave(); },
    result: g => resultOf(g, slotOf(g, me()), presentSlots(g, together.room?.here, game, me()), compare, lower),
  });

  // ---------- the table as it comes ----------
  function onState(val) {
    let g = val;
    if (finish && finish.n !== g.n) finish = null;                       // a new match came first: that one's gone
    if (finish) {
      if (runOf(g, finish.slot)?.done) finish = null;                    // stored
      else { g = structuredClone(g); noteRun(g, finish.slot, finish.n, finish.run, now()); if (!sending && !queued) { queued = finish; setTimeout(flush, 0); } }
    }
    cur = g;
    if (!stopOffset) stopOffset = together.room?.sync.serverOffset?.(ms => { offset = ms || 0; }) || (() => {});
    if (played != null && played !== g.n) { played = null; closedFor = null; clearTimeout(timer); }
    const r = runOf(g, mySlot());
    if (r?.begun && played !== g.n) {
      if (!r.done && r.begun > now()) countdown(r.begun);
      else begin(r);
    } else if (!r?.begun && lobbyFor !== g.n) { lobbyFor = g.n; try { onLobby(g.match); } catch (e) { console.error(e); } }
    maybeStart();
    draw();
    firstDrawn?.();
  }
  /** Everyone here is ready but nobody started it (say a player who wasn't ready left): this device starts it. */
  function maybeStart() {
    if (!cur || cur.start || !runOf(cur, mySlot())?.ready || !allReady(cur, present())) return;
    const pres = present(), n = cur.n;
    together.act(g => (g.n === n && !g.start && allReady(g, pres) ? startAll(g, now()) : false));
  }
  function countdown(at) {
    clearTimeout(timer);
    timer = setTimeout(() => { const r = runOf(cur, mySlot()); if (r?.begun) begin(r); }, Math.max(0, at - now()));
  }
  function begin(r) {
    if (!cur || played === cur.n) return;
    played = cur.n;
    lobbyFor = cur.n;
    clearTimeout(timer);
    let kept = null;
    try {
      const k = JSON.parse(localStorage.getItem(KEEP));
      if (k && k.code === together.room?.code && k.created === cur.created && k.n === cur.n) kept = k.state;
    } catch { /* nothing kept */ }
    if (!r.done) close();
    try { play(cur.match, { begun: r.begun, kept, done: !!r.done, run: r, n: cur.n }); }
    catch (e) { console.error(e); toast("Couldn't start the match"); }
    draw();
  }

  // ---------- what the game tells the table ----------
  /** This player's run as it stands: { score, text (a few words: "7 solved"), done, ms, … }; done once it's over. */
  function report(run) {
    if (!cur || played !== cur.n || runOf(cur, mySlot())?.done) return;
    const sig = `${cur.n}:${JSON.stringify(run)}`;
    if (sig === said) return;
    said = sig;
    queued = { n: cur.n, slot: mySlot(), run: { ...run } };
    if (run.done) {                                     // the result at once, not after the round trip
      finish = queued;
      const g = structuredClone(cur);
      noteRun(g, finish.slot, finish.n, finish.run, now());
      cur = g;
      closedFor = null;
      draw();
    }
    flush();
  }
  async function flush() {
    if (sending || !queued || !together.room) return;
    const job = sending = queued;
    queued = null;
    const ok = await together.act(g => noteRun(g, job.slot, job.n, job.run, now()));
    sending = null;
    if (!ok && job === finish && !queued) { queued = job; setTimeout(flush, 2500); }     // a finish must get there: again
    else flush();
  }
  /** Keeps this device's run of the match (any JSON), so a reload picks it up where it was. */
  function keep(state) {
    if (!cur) return;
    try { localStorage.setItem(KEEP, JSON.stringify({ code: together.room?.code, created: cur.created, n: cur.n, state })); } catch { /* private mode */ }
  }

  // ---------- the buttons ----------
  function ready() {
    const pres = present(), n = cur?.n;
    return together.act(g => (g.n === n ? sayReady(g, slotOf(g, me()), pres, now()) : false));
  }
  function startNow() {
    const n = cur?.n;
    return together.act(g => (g.n === n && runOf(g, slotOf(g, me()))?.ready ? startAll(g, now()) : false));
  }
  /** A new match, dealt here: everyone else says Ready again. */
  async function again() {
    const match = await deal();
    return together.act(g => rematch(g, slotOf(g, me()), match));
  }
  /** Whether someone else at the table is in the middle of this match (a new one would cut their run short). */
  const othersPlaying = () => !!cur && seated(cur).some(([id, p]) => id !== me() && runOf(cur, p.slot)?.begun && !runOf(cur, p.slot).done && present().includes(p.slot));
  const mineOn = () => { const r = runOf(cur, mySlot()); return !!r?.begun && !r.done; };
  /** A new match, asked first while this one's under way; false if not. */
  function newMatch() {
    if ((othersPlaying() || mineOn()) && !confirm("Start a new match? This one isn't over.")) return false;
    again();
    return true;
  }

  // ---------- the sheet: the lobby, the countdown, the standings and the result ----------
  let dlg = null;
  function sheet() {
    if (dlg) return dlg;
    dlg = el("dialog", "sheet menu-sheet duel-dlg");
    dlg.setAttribute("aria-label", `${name} together`);
    dlg.style.setProperty("--duel-in", `var(${accent})`);
    dlg.innerHTML = `<div class="pick-head"><h2></h2><button class="icon-btn menu-x" type="button" aria-label="Close" data-close>${CLOSE}</button></div><div class="duel-body"></div>`;
    const shut = () => { closedFor = `${cur?.n}/${shown}`; close(); };
    dlg.querySelector("[data-close]").addEventListener("click", shut);
    dlg.addEventListener("cancel", e => { e.preventDefault(); shut(); });
    dlg.addEventListener("click", e => { if (e.target === dlg) shut(); });     // the backdrop: outside the sheet
    document.body.appendChild(dlg);
    return dlg;
  }
  function open(what) {
    shown = what;
    closedFor = null;
    const d = sheet();
    if (!d.open) d.showModal();
    draw();
  }
  function close() {
    shown = null;
    clearInterval(ticker);
    if (dlg?.open) dlg.close();
  }
  /** What the sheet shows by itself: the lobby while this player's run hasn't begun, the countdown, then the result. */
  function due() {
    const r = runOf(cur, mySlot());
    if (!r?.begun) return "lobby";
    if (r.begun > now() && !r.done) return "count";
    return r.done ? "result" : null;
  }
  const what = () => due() || "standings";
  function draw() {
    drawLine();
    if (!cur) return;
    const want = due();
    if (want && want !== shown && closedFor !== `${cur.n}/${want}`) { shown = want; const d = sheet(); if (!d.open) d.showModal(); }
    if (shown === "count" && want !== "count") { close(); return; }
    if (!shown || !dlg?.open) return;
    const body = dlg.querySelector(".duel-body"), head = dlg.querySelector("h2");
    clearInterval(ticker);
    body.replaceChildren();
    if (shown === "lobby") drawLobby(head, body);
    else if (shown === "count") drawCount(head, body);
    else drawResult(head, body);
  }
  function drawLobby(head, body) {
    const r = runOf(cur, mySlot()), under = !!cur.start, pres = present();
    head.textContent = cur.n > 1 ? `${name}: match ${cur.n}` : `${name} together`;
    const said = describe(cur.match);
    if (said) body.append(el("p", "duel-what", said));
    const list = el("ul", "duel-seats");
    for (const [uid, p] of seated(cur)) {
      const run = runOf(cur, p.slot), here = pres.includes(p.slot);
      const li = el("li", uid === me() ? "me" : "");
      const st = run?.done ? `finished: ${run.text ?? run.score}` : run?.begun ? `playing: ${run.text ?? run.score ?? ""}` : run?.ready ? "ready" : here ? "not ready yet" : "not here";
      li.append(el("b", "", uid === me() ? `${first(p.name)} (you)` : first(p.name)), el("span", `duel-st${run?.ready || run?.begun ? " ok" : ""}`, st));
      list.append(li);
    }
    body.append(list);
    if (!r?.ready) {
      body.append(button(under ? "Play it" : "Ready", ready, "primary"));
      if (under) body.append(el("p", "duel-note", "The others have started: you start on a countdown of your own."));
    } else if (!under) {
      const waiting = seated(cur).filter(([, p]) => p.slot !== mySlot() && !runOf(cur, p.slot)?.ready).map(([, p]) => first(p.name));
      const wait = el("p", "duel-note");
      wait.append(sextant(), waiting.length ? `Waiting for ${list2(waiting)}` : "Waiting for someone to join");
      body.append(wait, button("Start without waiting", startNow, ""));
    }
    body.append(button("Back to solo", () => together.leave(), "link"));
  }
  function drawCount(head, body) {
    const r = runOf(cur, mySlot());
    head.textContent = cur.n > 1 ? `${name}: match ${cur.n}` : `${name} together`;
    const big = el("p", "duel-count");
    const tick = () => { const left = Math.ceil((r.begun - now()) / 1000); big.textContent = left > 0 ? String(left) : "Go"; if (left <= 0) clearInterval(ticker); };
    tick();
    ticker = setInterval(tick, 100);
    const who = standings(cur, compare).filter(x => x.run.begun === r.begun).map(x => (x.uid === me() ? "you" : first(x.name)));
    const said = describe(cur.match);
    body.append(big, el("p", "duel-note duel-mid", who.length > 1 ? `${list2(who)}, starting together` : "Starting"));
    if (said) body.append(el("p", "duel-what duel-mid", said));
  }
  function drawResult(head, body) {
    const pres = present(), over = isOver(cur, pres), rows = standings(cur, compare), me0 = mySlot();
    const mine = rows.find(x => x.slot === me0), tops = rows.filter(x => x.rank === 1);
    head.textContent = !mine?.run.done ? "The match so far" : !over ? "Your result"
      : tops.length > 1 ? (tops.some(x => x.slot === me0) ? "A draw" : `${list2(tops.map(x => first(x.name)))} share it`)
        : tops[0]?.slot === me0 ? "You win" : `${first(tops[0]?.name)} wins`;
    const list = el("ol", "duel-rank");
    for (const x of rows) {
      const li = el("li", `${x.slot === me0 ? "me" : ""}${over && x.rank === 1 ? " top" : ""}`);
      const state = x.run.done ? "" : pres.includes(x.slot) ? ", playing" : ", away";
      li.append(el("span", "duel-pos", x.run.done ? String(x.rank) : "·"), el("b", "", x.slot === me0 ? "You" : first(x.name)),
        el("span", "duel-score", `${x.run.text ?? x.run.score ?? 0}${state}`));
      list.append(li);
    }
    body.append(list);
    if (mine?.run.done && !over) {
      const still = rows.filter(x => !x.run.done).map(x => x.slot);
      const coming = seated(cur).filter(([, p]) => !runOf(cur, p.slot)?.begun && pres.includes(p.slot)).map(([, p]) => p.slot);
      const names = [...still, ...coming].map(s => first(seated(cur).find(([, p]) => p.slot === s)?.[1].name));
      if (names.length) {
        const wait = el("p", "duel-note");
        if ([...still, ...coming].some(s => pres.includes(s))) wait.append(sextant());
        wait.append(`${list2(names)} ${names.length > 1 ? "haven't" : "hasn't"} finished yet`);
        body.append(wait);
      }
    }
    if (mine?.run.done && (over || !othersPlaying())) body.append(button("Rematch", again, "primary"));
    body.append(button("Back to solo", () => together.leave(), "link"));
    if (mine?.run.done) {                                  // the game's own lines last, under the buttons: they can be long
      try {
        const more = extra();
        if (more) { const box = el("section", "duel-extra"); box.append(el("h4", "", extraTitle), more); body.append(box); }
      } catch (e) { console.error(e); }
    }
  }
  function button(text, fn, kind) {
    const b = el("button", kind === "link" ? "link duel-link" : `btn wide${kind === "primary" ? " primary" : ""}`, text);
    b.type = "button";
    b.addEventListener("click", () => { if (kind === "link") close(); fn(); });
    return b;
  }

  // ---------- the others' scores, as they play ----------
  let bar = line;
  function drawLine() {
    if (!together.room || !cur) { if (bar) { bar.hidden = true; bar.replaceChildren(); } return; }
    if (!bar) {
      bar = el("p", "duel-line");
      const top = document.querySelector("#app > .top");
      if (top) top.after(bar); else document.getElementById("app")?.prepend(bar);
    }
    if (!bar.dataset.bound) {
      bar.dataset.bound = "1";
      bar.classList.add("duel-bar");
      bar.setAttribute("role", "button");
      bar.tabIndex = 0;
      bar.addEventListener("click", () => open(what()));
      bar.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(what()); } });
    }
    bar.hidden = false;
    bar.replaceChildren();
    if (!together.online) { bar.append(sextant(), "Reconnecting…"); return; }
    const pres = present(), others = seated(cur).filter(([id]) => id !== me());
    if (!others.length) { bar.append(sextant(), "Waiting for the others"); return; }
    others.forEach(([, p], i) => {
      const run = runOf(cur, p.slot), here = pres.includes(p.slot);
      const say = run?.begun ? `${run.text ?? run.score ?? 0}${run.done ? " ✓" : ""}` : run?.ready ? "ready" : here ? "not ready" : "away";
      const span = el("span", `duel-who${here ? " on" : ""}`);
      span.append(el("b", "", first(p.name)), ` ${say}`);
      if (i) bar.append(" · ");
      bar.append(span);
    });
  }

  function reset() {
    clearTimeout(timer); clearInterval(ticker);
    stopOffset?.(); stopOffset = null;
    cur = null; played = null; lobbyFor = null; shown = null; closedFor = null; queued = null; finish = null;
    if (dlg?.open) dlg.close();
    drawLine();
  }

  /** Joins the match in the address (or `code`); resolves true once its table is drawn, false (solo) otherwise. */
  async function join(code = roomInAddress()) {
    if (code.length !== 4) return false;
    const done = busy("Joining the match");
    try {
      const drawn = new Promise(res => { firstDrawn = res; setTimeout(res, 8000); });
      if (!(await together.join(code))) return false;
      await drawn;
      return true;
    } finally { firstDrawn = null; done(); }
  }

  /** The menu's together part: a new match (Rematch once it's over), the match's sheet, Back to solo. */
  function menu(part) {
    const over = !!cur && isOver(cur, present());
    const b = (text, fn, kind = "") => {
      const x = el("button", kind === "link" ? "link menu-link" : `btn wide${kind === "primary" ? " primary" : ""}`, text);
      x.type = "button";
      x.addEventListener("click", () => { document.getElementById("menuDlg")?.close(); fn(); });
      return x;
    };
    part.append(b(over ? "Rematch" : "A new match", over ? again : newMatch, over ? "primary" : ""), b("The match", () => open(what())),
      b("Back to solo", () => together.leave(), "link"));
  }

  return {
    get on() { return !!together.room; },
    get inAddress() { return roomInAddress().length === 4; },
    get match() { return cur?.match || null; },
    /** Whether this device is playing a run of the match now (begun, not finished). */
    get playing() { const r = runOf(cur, mySlot()); return !!cur && played === cur.n && !!r?.begun && !r.done; },
    now, join, report, keep, menu, again, newMatch,
    leave: () => together.leave(),
    resync: () => together.resync(),
    open: () => open(what()),
    get together() { return together; },
  };
}

/** "a", "a and b", "a, b and c". */
function list2(names) {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

// ---------- the name a player goes by (the suite's, asked once) ----------
async function askName() {
  try { const saved = localStorage.getItem("crates:name"); if (saved) return saved; } catch { /* private mode */ }
  const dlg = el("dialog", "sheet duel-name");
  dlg.innerHTML = `<form method="dialog"><label for="duelName">Your name, so the others know who's playing</label>
    <input id="duelName" maxlength="24" autocomplete="nickname" enterkeyhint="go"><button class="btn primary wide" type="submit">Play</button></form>`;
  document.body.appendChild(dlg);
  dlg.showModal();
  const input = dlg.querySelector("input");
  input.focus();
  const name = await new Promise(res => dlg.addEventListener("close", () => res(input.value.trim()), { once: true }));
  dlg.remove();
  if (name) try { localStorage.setItem("crates:name", name); } catch { /* private mode */ }
  return name;
}
