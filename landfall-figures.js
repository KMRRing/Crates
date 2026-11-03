// The line figures of Landfall's constellations: our own, drawn here by star (its designation in the catalogue,
// landfall-stars.js), not copied from any other project's figure file (Stellarium's are GPL). A line is a run of stars
// joined in order; `key` are the stars a player is asked to find first. M1 has the three of Section 1; the rest
// of the 25 or so (docs/landfall.md has the plan) are added here, and the catalogue builder picks up their stars.
export const FIGURES = {
  UMa: {
    name: "Ursa Major", english: "the Great Bear", asterism: "the Plough", german: "Großer Wagen",
    lines: [["α UMa", "β UMa", "γ UMa", "δ UMa", "α UMa"], ["δ UMa", "ε UMa", "ζ UMa", "η UMa"]],
    key: ["α UMa", "β UMa", "γ UMa", "δ UMa", "ε UMa", "ζ UMa", "η UMa"],
  },
  UMi: {
    name: "Ursa Minor", english: "the Little Bear", asterism: "the Little Dipper", german: "Kleiner Wagen",
    lines: [["α UMi", "δ UMi", "ε UMi", "ζ UMi", "β UMi", "γ UMi", "η UMi", "ζ UMi"]],
    key: ["α UMi", "β UMi", "γ UMi"],
  },
  Cas: {
    name: "Cassiopeia", english: "the Queen", asterism: "the W", german: "Kassiopeia",
    lines: [["β Cas", "α Cas", "γ Cas", "δ Cas", "ε Cas"]],
    key: ["β Cas", "α Cas", "γ Cas", "δ Cas", "ε Cas"],
  },
};

/** Star-hopping rules that are a line on the sky: from a star through another to the goal, `times` the first span. */
export const HOPS = {
  pointers: { from: "β UMa", through: "α UMa", to: "α UMi", times: 5, rule: "The two pointer stars of the Plough lead to Polaris." },
};

/** Which constellation a designation belongs to ("α UMa" -> "UMa"). */
export const constellationOf = des => (/ ([A-Za-z]{3})$/.exec(des) || [])[1] || "";
