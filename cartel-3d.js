// Cartel's 3D table (Menu, View: 3D): Guandan's table, the card games' shared tipped mahogany cloth (table3d.js), with each
// opponent standing round it as a brass plate (avatar, name, their dice) and the bid in the middle. Korbi, 7 Nov 2026: "for the 3D
// mode, it should be the guandan table, completely reimagined" (the three.js counting-house scene is gone). The page (cartel.js) is
// still the master: its seat boxes, dice and middle are the same elements as on the flat table, and this only stands them on the
// cloth, so every tap, label and the picked outline are the page's own. Your own dice and buttons stay under the table.
import { createCloth, plateHtml, slotOf } from "./table3d.js";

export function createCartel3d(host, { onLost = () => {} } = {}) {
  let cloth = null, seats = 0, home = null;
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
      home ||= { parent: centre.parentNode, next: centre.nextSibling };
    }
    cloth.mat.style.setProperty("--seat-die", model.die || "1rem");
    if (centre.parentNode !== cloth.centre) cloth.centre.append(centre);
    for (const el of model.seats) {
      const i = Number(el.dataset.seat), slot = slotOf(i, me, n);
      const has = c => el.classList.contains(c);
      const state = [has("turn") ? "on" : "", has("out") ? "out" : "", has("targetable") ? "tobeat" : "", has("picked") ? "on" : ""].filter(Boolean).join(" ");
      cloth.set(slot, {
        seat: i, name: el.querySelector(".ct-plaque b")?.textContent || `Seat ${i + 1}`, meta: "", tally: `<span class="ct3-dice" data-slot="${slot}"></span>`,
        fan: 0, crown: false, mark: "", act: "", pass: false, state, label: el.querySelector(".ct-plaque b")?.textContent || "",
      });
      cloth.plates[slot].querySelector(".ct3-dice")?.replaceChildren(...(el.querySelector(".ct-dice")?.children || []));
      cloth.plates[slot].onclick = has("targetable") ? () => el.click() : null;
    }
  }
  return {
    sync,
    reset() {},
    dispose() {
      if (cloth && home && cloth.centre.firstElementChild) home.parent.insertBefore(cloth.centre.firstElementChild, home.next);   // the middle goes back to the page
      host.replaceChildren();
      cloth = null;
    },
  };
}
