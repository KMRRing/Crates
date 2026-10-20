// Ladder together (README, Ladder, Together): the pair's duo match, or a party's table of up to six, on together.js.
// One table plays either game, chosen for the next one in the menu (and in the lobby, until it starts): a team's one
// ladder, each player holding some of its letters and seeing only those of the last word; or a race on the same three
// ladders, each on their own phone. The table's rules are ladder-table.js's; this is the page round them: joining,
// the lobby and its countdown (as duel.js runs a head-to-head), the others' progress, the result, the pair's record.
import { createTogether } from "./together.js";
import { joiningWords } from "./rooms.js";
import { busy, sextant } from "./loading.js";
import { part, choice, action, line } from "./menu.js";
import { newRun, steps, LEVELS, RULES } from "./ladder-engine.js";
import { MODES, RACE_LADDERS, dealFor, freshTable, isTable, defaultMode, teamMove, teamUndo, teamHint, teamOn, teamRun, startTable, raceReport, raceOrder, teamResult, raceOver } from "./ladder-table.js";
import { seated, slotOf, runOf, presentSlots, allReady, sayReady, noteRun, rematch, standings, resultOf } from "./duel-core.js";

const APP = 1;                       // this code's version of the table: a device with older code is updated
const KEEP = "ladder:match";         // this device's race through the match, so a reload carries on where it was
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const first = name => String(name || "Player").trim().split(/\s+/)[0];
const fmt = secs => { const s = Math.max(0, Math.round(secs)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const list = names => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);
const roomCode = () => (new URLSearchParams(location.search).get("room") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
const CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

export function createLadderRoom({ onState, toast, askName, solo, begin, prefs, keepPrefs }) {
  let cur = null;          // the table as last seen
  let offset = 0, stopOffset = null;
  let joining = null;      // the rete while sitting down
  let firstDrawn = null;
  let shownFor = null;     // the match whose ladder is on the page (race: n/i; team: n)
  let race = null;         // this device's race: { n, created, i, done: [{ over, hints }], begun }
  let sheet = null, sheetShows = null, closedFor = null, ticker = 0, countdown = 0;

  const now = () => Date.now() + offset;
  const me = () => together.room?.uid;
  const mySlot = () => slotOf(cur, me());
  const present = () => (cur ? presentSlots(cur, together.room?.here, "ladder", me()) : []);
  const people = () => seated(cur || {}).length || 2;

  /** The next match, dealt from this player's choices: the mode, the level, the letters, the rules. */
  function dealMatch(n = people(), mode = prefs.together || defaultMode(n)) {
    return dealFor(Math.floor(Math.random() * 2 ** 31), { n, mode, level: prefs.level, rules: prefs.rules, lengths: prefs.lengths });
  }

  const together = createTogether({
    game: "ladder", app: APP, toast, askName,
    valid: isTable,
    slots: g => g?.people || 2,
    fresh: (players, { ask } = {}) => freshTable(players, { app: APP, people: ask?.people || 2, match: dealMatch(ask?.people || 2) }),
    onState: val => { cur = structuredClone(val); seatedNow(); draw(); firstDrawn?.(); },
    onPresence: () => { if (cur) draw(); },
    onLeave: () => { reset(); solo(); },
    result: g => (g.match.mode === "team" ? teamResult(g) : resultOf(g, slotOf(g, me()), presentSlots(g, together.room?.here, "ladder", me()), raceOrder, true)),
  });
  const seatedNow = () => { joining?.(); joining = null; if (!stopOffset) stopOffset = together.room?.sync.serverOffset?.(ms => { offset = ms || 0; }) || (() => {}); };

  // ---------- what the table shows ----------
  function draw() {
    if (!cur) return;
    const mine = runOf(cur, mySlot()), M = cur.match;
    if (!mine?.begun) { shownFor = null; begin(null); openSheet("lobby"); maybeStart(); return; }
    if (mine.begun > now() && !mine.done) {
      openSheet("count");
      clearTimeout(countdown);
      countdown = setTimeout(draw, Math.max(0, mine.begun - now()) + 20);
      return;
    }
    if (sheetShows === "count" || sheetShows === "lobby") closeSheet();
    if (M.mode === "team") showTeam();
    else showRace(mine);
    if (over()) openSheet("result");
    onState();
  }
  const over = () => (cur.match.mode === "team" ? !!(teamOn(cur) && cur.team.done) : raceOver(cur, present()));
  /** The team's ladder as the page plays it: the table's rungs, the end word, who holds what. */
  function showTeam() {
    if (!teamOn(cur)) return;
    const P = cur.match.ladders[0], run = teamRun(cur);
    run.ms = cur.team.done ? cur.team.at - cur.start : 0;
    const g = { kind: "team", mode: "team", P: { ...P, say: null }, run, side: "top", team: cur.team, n: cur.n };
    shownFor = `t${cur.n}`;
    begin(g);
  }
  /** This player's race: the ladder they're on, carried on from what this device kept. */
  function showRace(mine) {
    if (!race || race.n !== cur.n || race.created !== cur.created) race = kept() || { n: cur.n, created: cur.created, i: 0, done: [], run: null };
    race.begun = mine.begun;
    const i = Math.min(race.i, cur.match.ladders.length - 1), P = cur.match.ladders[i], key = `r${cur.n}/${i}`;
    if (shownFor === key) return;
    shownFor = key;
    const run = race.run && race.run.top?.[0] === P.start ? race.run : newRun(P);
    begin({ kind: "race", mode: "race", P, run, side: race.side || "top", raceI: i, n: cur.n });
  }
  function kept() {
    try { const k = JSON.parse(localStorage.getItem(KEEP)); if (k && k.code === together.room?.code && k.created === cur.created && k.n === cur.n) return k; } catch { /* nothing kept */ }
    return null;
  }
  function keep(G) {
    if (!race || !cur || G?.mode !== "race") return;
    race.run = G.run; race.side = G.side;
    try { localStorage.setItem(KEEP, JSON.stringify({ ...race, code: together.room?.code })); } catch { /* private mode */ }
  }

  // ---------- the race, as it goes ----------
  let sent = "";
  function report(G) {
    if (!cur || G?.mode !== "race" || !race) return;
    const at = race.done.length, over = race.done.reduce((a, d) => a + d.over, 0), hints = race.done.reduce((a, d) => a + d.hints, 0) + (G.run.done ? 0 : G.run.hints);
    const done = at >= cur.match.ladders.length, ms = Math.max(0, now() - race.begun);
    const run = raceReport({ at, over, hints, ms, count: cur.match.ladders.length, done });
    const sig = JSON.stringify([cur.n, run.at, run.done, run.over, run.hints]);
    if (sig === sent) return;
    sent = sig;
    const n = cur.n, slot = mySlot();
    together.act(g => noteRun(g, slot, n, done ? { ...run, ms } : run, now()));
  }
  /** A ladder of the race climbed: the next one waits for the player's tap; the last ends their run. */
  function finish(G) {
    if (G.mode !== "race" || !race) return;
    if (race.done.length <= G.raceI) race.done.push({ over: Math.max(0, steps(G.run) - G.P.par), hints: G.run.hints, steps: steps(G.run) });
    if (race.done.length >= cur.match.ladders.length) race.finishedMs = Math.max(0, now() - race.begun);   // the race's clock stops
    race.run = null;
    keep(G);
    report(G);
  }
  function next(G) {
    if (G?.mode === "race" && race && race.done.length < cur.match.ladders.length) {
      race.i = race.done.length; race.run = null; race.side = "top";
      shownFor = null;
      draw();
      return;
    }
    openSheet(over() ? "result" : "standings");
  }

  // ---------- the team's moves, each a transaction on the table ----------
  /** A rung for the team: placed in the table's transaction, or refused (the page says why); a placed one draws when the table does. */
  async function move(G, word, outcome) {
    let r = "moved";
    const n = cur.n, slot = mySlot(), pres = present(), at = G.run.top.length - 1;
    const ok = await together.act(g => { r = teamMove(g, { n, slot, from: at, word, present: pres, now: now() }); return r === "placed" || r === "done"; });
    if (!ok && (r === "placed" || r === "done")) r = "moved";       // the save didn't go through
    if (r !== "placed" && r !== "done") outcome(r, word);
  }
  async function undo(G) {
    const n = cur.n, at = G.run.top.length - 1;
    const ok = await together.act(g => teamUndo(g, { n, from: at }));
    if (!ok) toast("Nothing to take off, or someone moved first");
  }
  async function hint(G) {
    const n = cur.n, at = G.run.top.length - 1;
    let w = null;
    await together.act(g => { w = teamHint(g, { n, from: at, now: now() }); return !!w; });
    if (w) toast(`Hint: ${w.toUpperCase()} (+30 s for the team)`);
  }
  /** Whose letter a position of the team's word is, as the page draws it: yours (or let go by someone away), or theirs. */
  function owner(G, p) {
    if (G?.mode !== "team" || !G.team) return null;
    const o = G.team.owners[p], mine = o === mySlot() || !present().includes(o);
    return { cls: mine ? "mine" : "theirs", who: `var(--p${(mine ? mySlot() : o) % 6})` };
  }
  const nameOf = slot => { const p = seated(cur).find(([, x]) => x.slot === slot)?.[1]; return p ? (slotOf(cur, me()) === slot ? "You" : first(p.name)) : "Someone"; };

  // ---------- the sheet: the lobby, the countdown, the result ----------
  function openSheet(what) {
    if (closedFor === `${cur?.n}/${what}`) return;
    sheetShows = what;
    if (!sheet) {
      sheet = el("dialog", "sheet menu-sheet duel-dlg");
      sheet.setAttribute("aria-label", "Ladder together");
      sheet.style.setProperty("--duel-in", "var(--ld-in)");
      sheet.innerHTML = `<div class="pick-head"><h2></h2><button class="icon-btn menu-x" type="button" aria-label="Close" data-close>${CLOSE}</button></div><div class="duel-body"></div>`;
      const shut = () => { closedFor = `${cur?.n}/${sheetShows}`; closeSheet(); };
      sheet.querySelector("[data-close]").addEventListener("click", shut);
      sheet.addEventListener("cancel", e => { e.preventDefault(); shut(); });
      sheet.addEventListener("click", e => { if (e.target === sheet) shut(); });
      document.body.append(sheet);
    }
    if (!sheet.open) sheet.showModal();
    drawSheet();
  }
  function closeSheet() { sheetShows = null; clearInterval(ticker); if (sheet?.open) sheet.close(); }
  function drawSheet() {
    if (!sheet?.open || !cur) return;
    const head = sheet.querySelector("h2"), body = sheet.querySelector(".duel-body"), M = cur.match;
    clearInterval(ticker);
    body.replaceChildren();
    head.textContent = cur.n > 1 ? `Ladder: game ${cur.n}` : "Ladder together";
    if (sheetShows === "lobby") drawLobby(body, M);
    else if (sheetShows === "count") drawCount(body, M);
    else drawResult(head, body, M);
  }
  const describe = M => {
    const L = LEVELS[M.level]?.label || "Easy";
    return M.mode === "team"
      ? `Team: one ${L} ladder of ${M.ladders[0].start.length} letters. Each of you holds some of its letters, changes only those, and sees only those of the last word.`
      : `Race: the same ${M.ladders.length} ${L} ladders for everyone${M.rules === "grow" ? ", growing and shrinking" : ""}. The lowest score wins: the time, a minute a step over par, half a minute a hint.`;
  };
  function drawLobby(body, M) {
    const r = runOf(cur, mySlot()), pres = present(), underway = !!cur.start;
    body.append(el("p", "duel-what", describe(M)));
    if (!underway) body.append(choice("This game", Object.entries(MODES), M.mode, v => switchMode(v)));
    const ul = el("ul", "duel-seats");
    for (const [uid, p] of seated(cur)) {
      const run = runOf(cur, p.slot), here = pres.includes(p.slot), li = el("li", uid === me() ? "me" : "");
      li.append(el("b", "", uid === me() ? `${first(p.name)} (you)` : first(p.name)),
        el("span", `duel-st${run?.ready ? " ok" : ""}`, run?.ready ? "ready" : here ? "not ready yet" : "not here"));
      ul.append(li);
    }
    body.append(ul);
    if (!r?.ready) body.append(button(underway ? "Play it" : "Ready", ready, "primary"));
    else {
      const waiting = seated(cur).filter(([, p]) => p.slot !== mySlot() && !runOf(cur, p.slot)?.ready).map(([, p]) => first(p.name));
      const wait = el("p", "duel-note");
      wait.append(sextant(), waiting.length ? `Waiting for ${list(waiting)}` : "Waiting for someone to join");
      body.append(wait);
      body.append(button("Start without waiting", startNow, ""));             // a team's absent players' letters are let go to the rest
    }
    body.append(button("Back to solo", () => together.leave(), "link"));
  }
  function drawCount(body, M) {
    const r = runOf(cur, mySlot()), big = el("p", "duel-count");
    const tick = () => { const left = Math.ceil((r.begun - now()) / 1000); big.textContent = left > 0 ? String(left) : "Go"; if (left <= 0) clearInterval(ticker); };
    tick();
    ticker = setInterval(tick, 100);
    body.append(big, el("p", "duel-what duel-mid", describe(M)));
  }
  function drawResult(head, body, M) {
    if (M.mode === "team") {
      const T = cur.team, P = M.ladders[0];
      if (!T?.done) { head.textContent = "The team's ladder"; body.append(el("p", "duel-note", "Still climbing.")); }
      else {
        const over = T.steps - P.par;
        head.textContent = over === 0 ? "Par, together" : `${T.steps} steps, together`;
        body.append(el("p", "duel-what", `${T.steps} steps for par ${P.par}, ${fmt((T.at - cur.start) / 1000)}${T.hints ? `, ${T.hints} hint${T.hints > 1 ? "s" : ""}` : ""}: score ${fmt(T.score)}.`));
        const by = {};
        for (const r of T.rungs.slice(1)) by[r.by] = (by[r.by] || 0) + 1;
        const who = Object.entries(by).map(([s, k]) => `${Number(s) < 0 ? "hints" : nameOf(Number(s))} ${k}`).join(", ");
        body.append(el("p", "duel-note", `Rungs made: ${who}.`));
      }
    } else {
      const pres = present(), done = raceOver(cur, pres), rows = standings(cur, raceOrder), mine = rows.find(x => x.slot === mySlot());
      const tops = rows.filter(x => x.rank === 1);
      head.textContent = !mine?.run.done ? "The race so far" : !done ? "Your race" : tops.length > 1 ? (tops.some(x => x.slot === mySlot()) ? "A draw" : `${list(tops.map(x => first(x.name)))} share it`) : tops[0]?.slot === mySlot() ? "You win" : `${first(tops[0]?.name)} wins`;
      const ol = el("ol", "duel-rank");
      for (const x of rows) {
        const li = el("li", `${x.slot === mySlot() ? "me" : ""}${done && x.rank === 1 ? " top" : ""}`);
        li.append(el("span", "duel-pos", x.run.done ? String(x.rank) : "·"), el("b", "", x.slot === mySlot() ? "You" : first(x.name)),
          el("span", "duel-score", `${x.run.text ?? ""}${x.run.done ? "" : pres.includes(x.slot) ? ", climbing" : ", away"}`));
        ol.append(li);
      }
      body.append(ol);
      if (mine?.run.done && !done) { const w = el("p", "duel-note"); w.append(sextant(), "The others are still climbing"); body.append(w); }
    }
    if (over()) body.append(button(M.mode === "team" ? "Another ladder" : "Rematch", again, "primary"));
    body.append(button("Back to solo", () => together.leave(), "link"));
  }
  function button(text, fn, kind) {
    const b = el("button", kind === "link" ? "link duel-link" : `btn wide${kind === "primary" ? " primary" : ""}`, text);
    b.type = "button";
    b.addEventListener("click", () => { if (kind === "link") closeSheet(); fn(); });
    return b;
  }

  // ---------- the table's buttons ----------
  function ready() {
    const pres = present(), n = cur?.n;
    return together.act(g => {
      if (g.n !== n) return false;
      const ok = sayReady(g, slotOf(g, me()), pres, now());
      if (ok && g.start) startTable(g, now());                 // everyone's ready (or it's under way): the team's ladder too
      return ok;
    });
  }
  function startNow() {
    const n = cur?.n;
    return together.act(g => (g.n === n && runOf(g, slotOf(g, me()))?.ready ? startTable(g, now()) : false));
  }
  /** Everyone here is ready but nobody started it (someone who wasn't ready left): this device starts it. */
  function maybeStart() {
    if (!cur || cur.start || !runOf(cur, mySlot())?.ready || !allReady(cur, present())) return;
    const pres = present(), n = cur.n;
    together.act(g => (g.n === n && !g.start && allReady(g, pres) ? startTable(g, now()) : false));
  }
  /** Another game at the table, dealt here: the others say Ready again. */
  function again() {
    closedFor = null;
    const match = dealMatch(people());
    return together.act(g => rematch(g, slotOf(g, me()), match));
  }
  /** The lobby's mode switch: this game dealt again the other way, before anyone has begun. */
  function switchMode(mode) {
    prefs.together = mode; keepPrefs();
    const match = dealMatch(people(), mode), n = cur.n;
    together.act(g => { if (g.n !== n || g.start) return false; g.match = match; for (const r of Object.values(g.runs || {})) if (r) r.ready = false; return true; });
  }
  function reset() {
    clearTimeout(countdown); clearInterval(ticker);
    stopOffset?.(); stopOffset = null;
    cur = null; race = null; shownFor = null; sent = ""; closedFor = null;
    closeSheet();
  }

  // ---------- the menu's together part ----------
  function menu(body) {
    const table = part(body, "together");
    if (!cur) { const wait = line(joiningWords()); wait.prepend(sextant()); table.append(wait, action("Back to solo", () => { location.replace(location.pathname); }, "link")); return; }
    const pres = present(), names = seated(cur).map(([uid, p]) => `${uid === me() ? "you" : first(p.name)}${pres.includes(p.slot) ? "" : " (away)"}`);
    table.append(line(`At the table: ${list(names)}. This game: ${MODES[cur.match.mode]}.`),
      choice("Next game", Object.entries(MODES), prefs.together || defaultMode(people()), v => { prefs.together = v; keepPrefs(); }),
      action(over() ? "Another game" : "A new game", () => { if (over() || confirm("Start a new game? This one isn't over.")) again(); }, over() ? "primary" : ""),
      action("The table", () => { closedFor = null; openSheet(runOf(cur, mySlot())?.begun ? "result" : "lobby"); }),
      action("Back to solo", () => together.leave(), "link"));
    const content = part(body, "content");
    content.append(choice("Level", Object.entries(LEVELS).map(([k, L]) => [k, L.label]), prefs.level, v => { prefs.level = v; keepPrefs(); }));
    if ((prefs.together || defaultMode(people())) === "race") content.append(choice("Rules", Object.entries(RULES), prefs.rules, v => { prefs.rules = v; keepPrefs(); }));
  }

  // ---------- the strip: the others, as they go ----------
  function drawLine(box, G) {
    if (!cur) { box.hidden = true; return; }
    box.hidden = false;
    const pres = present(), parts = [];
    for (const [uid, p] of seated(cur)) {
      if (uid === me()) continue;
      const run = runOf(cur, p.slot), here = pres.includes(p.slot);
      const say = G?.mode === "team" ? (here ? "" : " away") : run?.begun ? ` ${run.text || ""}${run.done ? " ✓" : ""}` : here ? " here" : " away";
      parts.push([p.slot, `${first(p.name)}${say}`]);
    }
    const sig = JSON.stringify(parts);
    if (box.dataset.t === sig) return;
    box.dataset.t = sig;
    box.replaceChildren();
    if (!parts.length) { box.append(sextant(), "Waiting for the others"); return; }
    parts.forEach(([slot, text], i) => {
      if (i) box.append(" · ");
      const s = el("span", "ld-who", text);
      s.style.setProperty("--who", `var(--p${slot % 6})`);
      box.append(s);
    });
  }
  /** The result panel under the ladder, at a table. */
  function drawResult_(verdict, nextBtn, G) {
    const P = G.P, n = steps(G.run), overBy = n - P.par;
    verdict.className = `ld-verdict${overBy === 0 ? " good" : ""}`;
    if (G.mode === "team") {
      verdict.replaceChildren(overBy === 0 ? `Par, together: ${n} steps.` : `${n} steps together, ${overBy} over par.`, el("small", "", `Score ${fmt(cur.team.score)}.`));
      nextBtn.textContent = "The table";
      return;
    }
    const left = cur.match.ladders.length - race.done.length;
    verdict.replaceChildren(overBy === 0 ? `Par: ${n} steps.` : `${n} steps, ${overBy} over par.`, el("small", "", left > 0 ? `Ladder ${G.raceI + 1} of ${cur.match.ladders.length}: the clock is running.` : "Your race is run."));
    nextBtn.textContent = left > 0 ? "Next ladder" : "The standings";
  }

  return {
    get on() { return !!together.room; },
    get joining() { return !!joining; },
    get inAddress() { return roomCode().length === 4; },
    /** Joins the table in the address; resolves true once its state is drawn, false (solo) otherwise. */
    async join() {
      joining = busy(joiningWords(), { delay: 0 });
      try {
        const drawn = new Promise(res => { firstDrawn = res; setTimeout(res, 8000); });
        if (!(await together.join(roomCode()))) return false;
        await drawn;
        return true;
      } finally { firstDrawn = null; joining?.(); joining = null; }
    },
    menu,
    elapsed: G => (!cur ? 0 : G?.mode === "team" ? (cur.team?.done ? cur.team.at - cur.start : Math.max(0, now() - (cur.start || now()))) : race ? race.finishedMs ?? Math.max(0, now() - race.begun) : 0),
    keep, report, finish,
    again: G => (G?.mode === "race" ? next(G) : openSheet("result")),
    setLevel: level => { prefs.level = level; keepPrefs(); },
    resync: () => together.resync(),
    mayPlay: G => !G || G.mode === "solo" || (!!cur && (G.mode === "team" ? teamOn(cur) && !cur.team.done && mySlot() != null : !!race && now() >= race.begun)),
    mayChange: (G, p) => !owner(G, p) || owner(G, p).cls === "mine",
    whyNot: (G, p) => `That letter is ${nameOf(G.team.owners[p])}'s to change.`,
    oneEnd: G => G?.mode === "team",
    label: G => (G.mode === "team" ? "Team" : `Race, ${G.raceI + 1} of ${cur?.match.ladders.length || RACE_LADDERS}`),
    waiting: G => (G?.mode === "team" && G.team && !G.team.owners.includes(mySlot()) ? "You hold no letters this game: help the others see the way." : ""),
    drawLine, drawResult: drawResult_,
    teamMove: move, teamUndo: undo, teamHint: hint,
    byOf: (G, r) => (G?.mode === "team" && r.side === "top" && G.team?.rungs[r.i] && G.team.rungs[r.i].by >= 0 ? G.team.rungs[r.i].by : null),
    sealed: G => (G?.mode === "team" && G.team && !G.team.done ? G.team.owners.map(o => o !== mySlot() && present().includes(o)) : null),
    owner,
    maybeStart,
    get table() { return cur; },
  };
}
