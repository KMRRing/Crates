// What a reading plate says, for the 3D block and the flat view alike (the plate is a small box of the page; survey.css draws it).

/** The numbers of a plate that reads several channels: silver then gold where there are two ores (the two colours), a bar between the sides of a fault. Only numbers go in. */
export function plateOf(P, t, axis) {
  const cut = P.cut && P.cut.axis === axis, per = P.ores === 2 ? 2 : 1, out = [];
  for (let side = 0; side < (cut ? 2 : 1); side++) {
    const one = t.slice(side * per, side * per + per).map((v, k) => `<i class="${per === 2 ? (k ? "g" : "s") : "o"}">${v | 0}</i>`).join("");
    out.push(`<span>${one}</span>`);
  }
  return out.join('<u></u>');
}
/** The class a reading's plate takes beyond `sv-lab`: fog, several numbers (two ores or a fault), runs, or by seams a plain plate (one seam or none), a ring (two) or a box (three or more). */
export function plateShape(P, cl) {
  const two = !!cl && !!cl.t && (P.ores === 2 || P.cut);
  return !cl ? " fog" : two ? " two" : P.kind === "runs" ? " runs" : P.kind === "counts" ? "" : ["", "", " ring", " box"][cl.g];
}
/** The words of a plate that has one number or runs. */
export const plateText = (P, cl) => (!cl ? "?" : P.kind === "runs" ? (cl.r.length ? cl.r.join(" ") : "0") : String(cl.c));
