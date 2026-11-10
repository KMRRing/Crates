// The Campaign in a game's menu (campaign.js holds the rules): the chapters with their one-line rule and their levels, each with
// its number, name, a word of what it asks and the stars won; and Endless, the next level or what it waits for. The look is
// campaign.css (a page that uses this links it).
//   content.append(levelGrid(camp, { onPick: i => …, about: i => "Score 42" }));
//   content.append(endlessLine(camp, { onPlay: () => … }));
const STAR = "★", HOLLOW = "☆";
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Every chapter and its levels. A chapter not reached yet shows its name and how many levels it holds, no more: what comes is a
 *  surprise until the one before is beaten. `about(i)`: a few words a level asks (its goal, its size); `current`: the level in play. */
export function levelGrid(camp, { onPick, about = () => "", current = camp.at } = {}) {
  const all = el("div", "cp-levels");
  camp.chapters.forEach((ch, c) => {
    const [from, to] = camp.ranges[c], reached = camp.isOpen(from), won = camp.levels.slice(from, to).reduce((a, _, k) => a + camp.stars(from + k), 0);
    const head = el("div", "cp-chap");
    head.append(el("b", "", `${c + 1}  ${ch.name}`), el("span", "", reached ? `${won} of ${(to - from) * 3} ${STAR}` : plural(to - from, "level")));
    all.append(head);
    if (!reached) return;
    all.append(el("p", "cp-rule", ch.rule));
    const grid = el("div", "cp-grid");
    for (let i = from; i < to; i++) {
      const L = camp.levels[i], open = camp.isOpen(i), s = camp.stars(i), b = el("button");
      b.type = "button";
      b.disabled = !open;
      b.className = `${s ? "done" : ""}${camp.isCapstone(i) ? " cap" : ""}`;
      if (i === current) b.setAttribute("aria-current", "true");
      b.setAttribute("aria-label", `Level ${i + 1}, ${L.name}${camp.isCapstone(i) ? ", the chapter's last" : ""}${open ? "" : ", locked: beat the one before it"}${s ? `, ${plural(s, "star")}` : ""}`);
      const top = el("span", "cp-top");
      top.append(el("b", "", String(i + 1)), el("span", "cp-st", open ? STAR.repeat(s) + HOLLOW.repeat(3 - s) : ""));
      b.append(top, el("span", "cp-name", L.name), el("span", "cp-about", open ? about(i) : ""));
      if (onPick) b.addEventListener("click", () => onPick(i));
      grid.append(b);
    }
    all.append(grid);
  });
  return all;
}

/** Endless: where you are in it and the button to go on, or what it waits for. */
export function endlessLine(camp, { onPlay, playing = false } = {}) {
  const box = el("div", "cp-endless"), E = camp.endless, n = E.at;
  if (!E.list.length) return box;
  if (!E.begun) {
    box.append(el("p", "cp-wait", `Endless opens when chapter 1, ${camp.chapters[E.list[0].needs].name}, is beaten.`));
    return box;
  }
  if (n >= E.list.length) {
    box.append(el("p", "cp-wait", `Every Endless level so far is beaten: ${E.list.length}. More are added from time to time.`));
    return box;
  }
  const gate = E.gate(n);
  if (gate >= 0) {
    box.append(el("p", "cp-wait", `Endless ${n + 1} needs chapter ${gate + 1}, ${camp.chapters[gate].name}: beat its last level to go on.`));
    return box;
  }
  const b = el("button", "btn primary cp-go", playing ? `Endless ${n + 1}` : `Play Endless ${n + 1}`);
  b.type = "button";
  b.disabled = playing;
  if (onPlay) b.addEventListener("click", onPlay);
  box.append(b, el("p", "cp-wait", `${plural(n, "level")} beaten of ${E.list.length} so far, the same for everyone.`));
  return box;
}
