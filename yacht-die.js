// One drawn die of Yacht (the table's flat dice in yacht.js and the lessons' in yacht-course-stage.js); 0 is a die not rolled yet.
const PIPS = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] };

export function die(face) {
  const pips = (PIPS[face] || []).map(([c, r]) => `<circle${face === 1 ? ' class="red"' : ""} cx="${6 + 6 * c}" cy="${6 + 6 * r}" r="${face === 1 ? 3.2 : 2.3}"/>`).join("");
  return `<svg class="ya-die" viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="4.6"/>${pips}</svg>`;
}
