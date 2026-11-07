// Cartel's 3D table (Menu, View: 3D): Guandan's tipped mahogany cloth (table3d.js) with every opponent given a play zone of their
// own on it: a name and medallion, a cup with the number of dice still hidden under it, the dice they have shown laid on the felt,
// and their gold dice counted. Korbi, 8 Nov 2026: the left opponent halfway down the left side, the opposite one at the top, the
// right one mirroring the left, each with a region of their own, dice on the board and a cup that says how many are hidden.
// The page (cartel.js) is still the master: its seat elements, dice and middle are the same on the flat table, and this only
// stands them on the cloth, so every tap, label and the picked outline are the page's own. Your own dice and buttons stay under the table.
import { createCloth, slotOf } from "./table3d.js";

/** Where each opponent's zone is (centre x, centre y, width, height, in per cent of the mat), by how many opponents there are,
 *  in the order play goes round from you: the next seat on your left first. The middle of the cloth stays clear for the bid. */
export const ZONES = {
  1: [[50, 30, 66, 30]],
  2: [[21, 48, 36, 42], [79, 48, 36, 42]],
  3: [[17, 52, 30, 40], [50, 25, 34, 26], [83, 52, 30, 40]],
  4: [[17, 72, 32, 30], [34, 28, 31, 27], [66, 28, 31, 27], [83, 72, 32, 30]],
  5: [[17, 76, 32, 26], [17, 46, 32, 26], [50, 25, 36, 24], [83, 46, 32, 26], [83, 76, 32, 26]],
};

/** What a seat's dice come to, read from the page's dice (their labels say hidden or shown, and the kind): dice shown, the
 *  number still hidden, and the gold ones in all. */
export function tally(dice) {
  const shown = [];
  let hidden = 0, gold = 0;
  for (const d of dice) {
    const label = d.getAttribute?.("aria-label") || "", isGold = /gold/.test(label);
    if (isGold) gold++;
    if (label.startsWith("hidden")) hidden++; else shown.push(d);
  }
  return { shown, hidden, gold };
}

const tilt = k => ((k * 53 + 17) % 25) - 12;                      // each die lies at its own small angle, the same every draw

export function createCartel3d(host, { onLost = () => {} } = {}) {
  let cloth = null, seats = 0, home = null;
  const zones = new Map();
  void onLost;                                                    // the cloth is DOM: there is no graphics context to lose

  /**
   * model: { n (seats at the table), me (your seat, 0 when watching), seats: the page's seat elements (data-seat, with
   * .ct-dice inside and the classes turn, out, targetable, picked), centre: the page's middle element, die: the dice's size }.
   */
  function sync(model) {
    const { n, me, centre } = model;
    if (!cloth || seats !== n) {
      cloth = createCloth(host, { seats: n });
      seats = n;
      zones.clear();
      home ||= { parent: centre.parentNode, next: centre.nextSibling };
    }
    cloth.mat.style.setProperty("--seat-die", model.die || "1rem");
    if (centre.parentNode !== cloth.centre) cloth.centre.append(centre);
    const rooms = ZONES[Math.max(1, Math.min(5, n - 1))];
    for (const el of model.seats) {
      const i = Number(el.dataset.seat), slot = slotOf(i, me, n), [x, y, w, h] = rooms[Math.max(0, slot - 1)] || rooms[0];
      let z = zones.get(i);
      if (!z) { z = document.createElement("div"); cloth.mat.append(z); zones.set(i, z); }
      const has = c => el.classList.contains(c);
      z.className = `ct3-zone${has("turn") ? " on" : ""}${has("out") ? " out" : ""}${has("targetable") ? " tobeat" : ""}${has("picked") ? " picked" : ""}`;
      z.style.cssText = `left:${x}%;top:${y}%;width:${w}%;height:${h}%`;
      z.onclick = has("targetable") ? () => el.click() : null;
      const name = el.querySelector(".ct-plaque b")?.textContent || `Seat ${i + 1}`, who = name.replace(/ · out$/, "");
      const t = tally([...(el.querySelector(".ct-dice")?.children || [])]);
      const head = document.createElement("div"), cup = document.createElement("div"), board = document.createElement("div"), play = document.createElement("div");
      head.className = "ct3-head";
      head.innerHTML = `<span class="tk-s${((i % 6) + 6) % 6}"><span class="tk-med" aria-hidden="true"><b></b></span></span><b class="ct3-name"></b><span class="ct3-gold" title="Gold dice"><i aria-hidden="true"></i><span></span></span>`;
      head.querySelector(".tk-med b").textContent = [...who.trim()][0]?.toUpperCase() || "?";
      head.querySelector(".ct3-name").textContent = name;
      head.querySelector(".ct3-gold span").textContent = `×${t.gold}`;
      cup.className = "ct3-cup";
      cup.title = `${t.hidden} hidden ${t.hidden === 1 ? "die" : "dice"}`;
      cup.innerHTML = `<b></b>`;
      cup.firstChild.textContent = String(t.hidden);
      cup.hidden = !t.hidden;
      board.className = "ct3-board";
      t.shown.forEach((d, k) => { d.style.rotate = `${tilt(i * 7 + k)}deg`; board.append(d); });
      play.className = "ct3-play";
      play.append(cup, board);
      z.replaceChildren(head, play);
    }
  }
  return {
    sync,
    reset() {},
    dispose() {
      if (cloth && home && cloth.centre.firstElementChild) home.parent.insertBefore(cloth.centre.firstElementChild, home.next);   // the middle goes back to the page
      host.replaceChildren();
      cloth = null;
      zones.clear();
    },
  };
}
