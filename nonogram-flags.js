// Nonogram's flags, drawn: the knowledge base has each country's flag only as an emoji, which every phone draws its
// own way, so a flag's picture is described here as shapes (stripes, a cross, a disc, a star, a triangle at the hoist)
// and rasterised the same way on every phone. Keyed by the knowledge base's country ids (the flags bank's), so a
// flag missed carries its country to the pile. Emblems and coats of arms are drawn as the blot of colour they make
// at this size; Afghanistan's and Syria's are left out, as their flags changed lately and phones still disagree.
//
// A flag is { r: width over height, d: [shape…] }, the shapes painted in order, each over the last. Positions are
// fractions of the width (x) and height (y), from the top of the hoist; radii and thicknesses are fractions of the
// height, so a disc is round whatever the flag's shape. Colours are letters (COLOURS); "_" is no flag at all (Nepal's
// pennants stand on nothing).

export const COLOURS = {
  R: "#CE2029", W: "#FFFFFF", B: "#1F4FA3", N: "#0B2A5B", L: "#6CACE4", C: "#00A3BF", G: "#13893F", D: "#0B5D38",
  Y: "#F9C81F", O: "#F28A1E", K: "#111111", M: "#8D1B3D", T: "#8B5A2B", S: "#9AA0A6", P: "#6B3FA0",
};
export const COLOUR_NAMES = { R: "red", W: "white", B: "blue", N: "navy", L: "sky blue", C: "teal", G: "green", D: "dark green", Y: "yellow",
  O: "orange", K: "black", M: "maroon", T: "brown", S: "grey", P: "purple", _: "" };

// the Union Jack in a box (the UK's flag, and the canton of Australia's, New Zealand's, Fiji's and Tuvalu's)
const UJ = (x1 = 1, y1 = 1) => [["uj", "N", 0, 0, x1, y1]];
const quarters = (a, b, c, d, cx = 0.5, cy = 0.5) => [["box", a, 0, 0, cx, cy], ["box", b, cx, 0, 1, cy], ["box", c, 0, cy, cx, 1], ["box", d, cx, cy, 1, 1]];
const maple = [[0.5, 0], [0.58, 0.15], [0.68, 0.1], [0.65, 0.35], [0.85, 0.2], [0.82, 0.32], [0.98, 0.35], [0.85, 0.5], [0.9, 0.58], [0.6, 0.6], [0.62, 0.75],
  [0.52, 0.72], [0.52, 0.95], [0.48, 0.95], [0.48, 0.72], [0.38, 0.75], [0.4, 0.6], [0.1, 0.58], [0.15, 0.5], [0.02, 0.35], [0.18, 0.32], [0.15, 0.2],
  [0.35, 0.35], [0.32, 0.1], [0.42, 0.15]].flatMap(([x, y]) => [0.3 + 0.4 * x, 0.08 + 0.84 * y]);

export const FLAGS = {
  // Europe
  france: { r: 1.5, d: [["v", "BWR"]] },
  germany: { r: 5 / 3, d: [["h", "KRY"]] },
  italy: { r: 1.5, d: [["v", "GWR"]] },
  spain: { r: 1.5, d: [["h", "RYR", [1, 2, 1]], ["box", "R", 0.23, 0.33, 0.36, 0.68], ["box", "Y", 0.26, 0.38, 0.33, 0.47]] },
  portugal: { r: 1.5, d: [["v", "GR", [2, 3]], ["disc", "Y", 0.4, 0.5, 0.25], ["box", "R", 0.35, 0.36, 0.45, 0.64], ["box", "W", 0.375, 0.42, 0.425, 0.58]] },
  netherlands: { r: 1.5, d: [["h", "RWB"]] },
  belgium: { r: 15 / 13, d: [["v", "KYR"]] },
  switzerland: { r: 1, d: [["box", "R", 0, 0, 1, 1], ["box", "W", 13 / 32, 6 / 32, 19 / 32, 26 / 32], ["box", "W", 6 / 32, 13 / 32, 26 / 32, 19 / 32]] },
  austria: { r: 1.5, d: [["h", "RWR"]] },
  denmark: { r: 37 / 28, d: [["box", "R", 0, 0, 1, 1], ["cross", "W", 14 / 37, 0.5, 4 / 28]] },
  sweden: { r: 1.6, d: [["box", "B", 0, 0, 1, 1], ["cross", "Y", 0.375, 0.5, 0.2]] },
  norway: { r: 22 / 16, d: [["box", "R", 0, 0, 1, 1], ["cross", "W", 8 / 22, 0.5, 4 / 16], ["cross", "N", 8 / 22, 0.5, 2 / 16]] },
  finland: { r: 18 / 11, d: [["box", "W", 0, 0, 1, 1], ["cross", "B", 6.5 / 18, 0.5, 3 / 11]] },
  iceland: { r: 25 / 18, d: [["box", "B", 0, 0, 1, 1], ["cross", "W", 9 / 25, 0.5, 4 / 18], ["cross", "R", 9 / 25, 0.5, 2 / 18]] },
  ireland: { r: 2, d: [["v", "GWO"]] },
  uk: { r: 2, d: UJ() },
  poland: { r: 1.6, d: [["h", "WR"]] },
  "czech-republic": { r: 1.5, d: [["h", "WR"], ["tri", "B", 0.5]] },
  slovakia: { r: 1.5, d: [["h", "WBR"], ["box", "W", 0.17, 0.24, 0.41, 0.76], ["box", "R", 0.19, 0.27, 0.39, 0.72], ["box", "B", 0.19, 0.6, 0.39, 0.72], ["box", "W", 0.27, 0.32, 0.31, 0.6]] },
  hungary: { r: 2, d: [["h", "RWG"]] },
  romania: { r: 1.5, d: [["v", "BYR"]] },
  bulgaria: { r: 5 / 3, d: [["h", "WGR"]] },
  greece: { r: 1.5, d: [["h", "BWBWBWBWB"], ["box", "B", 0, 0, 0.37, 5 / 9], ["box", "W", 0.148, 0, 0.222, 5 / 9], ["box", "W", 0, 2 / 9, 0.37, 3 / 9]] },
  croatia: { r: 2, d: [["h", "RWB"], ["checks", "R", "W", 0.42, 0.28, 0.58, 0.7, 5, 5]] },
  slovenia: { r: 2, d: [["h", "WBR"], ["box", "R", 0.17, 0.16, 0.33, 0.52], ["box", "B", 0.18, 0.18, 0.32, 0.5], ["poly", "W", [0.19, 0.46, 0.25, 0.26, 0.31, 0.46]]] },
  serbia: { r: 1.5, d: [["h", "RBW"], ["box", "R", 0.24, 0.24, 0.4, 0.76], ["box", "W", 0.28, 0.34, 0.36, 0.64]] },
  "bosnia-and-herzegovina": { r: 2, d: [["box", "B", 0, 0, 1, 1], ["poly", "Y", [0.27, 0, 0.73, 0, 0.73, 1]], ["dots", "W", 0.2, 0.05, 0.62, 0.95, 9, 0.045]] },
  montenegro: { r: 2, d: [["box", "Y", 0, 0, 1, 1], ["box", "R", 0.025, 0.05, 0.975, 0.95], ["disc", "Y", 0.5, 0.5, 0.27]] },
  "north-macedonia": { r: 2, d: [["box", "R", 0, 0, 1, 1], ["rays", "Y", 0.5, 0.5, [0, 0, 1, 0, 1, 1, 0, 1, 0.5, 0, 1, 0.5, 0.5, 1, 0, 0.5], 0.08], ["disc", "R", 0.5, 0.5, 0.21], ["disc", "Y", 0.5, 0.5, 0.17]] },
  albania: { r: 1.4, d: [["box", "R", 0, 0, 1, 1], ["poly", "K", [0.5, 0.18, 0.62, 0.3, 0.72, 0.25, 0.66, 0.5, 0.56, 0.62, 0.56, 0.82, 0.44, 0.82, 0.44, 0.62, 0.34, 0.5, 0.28, 0.25, 0.38, 0.3]]] },
  kosovo: { r: 1.4, d: [["box", "B", 0, 0, 1, 1], ["poly", "Y", [0.36, 0.5, 0.48, 0.38, 0.62, 0.42, 0.66, 0.58, 0.56, 0.74, 0.44, 0.76, 0.38, 0.64]], ["arc", "W", 0.5, 0.62, 0.36, -60, 60, 6, 0.045]] },
  estonia: { r: 11 / 7, d: [["h", "BKW"]] },
  latvia: { r: 2, d: [["h", "MWM", [2, 1, 2]]] },
  lithuania: { r: 5 / 3, d: [["h", "YGR"]] },
  belarus: { r: 2, d: [["h", "RG", [2, 1]], ["box", "W", 0, 0, 0.11, 1], ["checks", "R", "W", 0.025, 0, 0.085, 1, 1, 7]] },
  ukraine: { r: 1.5, d: [["h", "BY"]] },
  moldova: { r: 2, d: [["v", "BYR"], ["box", "T", 0.44, 0.3, 0.56, 0.72], ["box", "R", 0.47, 0.45, 0.53, 0.62]] },
  russia: { r: 1.5, d: [["h", "WBR"]] },
  luxembourg: { r: 5 / 3, d: [["h", "RWL"]] },
  malta: { r: 1.5, d: [["v", "WR"], ["box", "S", 0.06, 0.07, 0.18, 0.27]] },
  cyprus: { r: 1.5, d: [["box", "W", 0, 0, 1, 1], ["poly", "O", [0.24, 0.48, 0.34, 0.36, 0.52, 0.3, 0.78, 0.22, 0.7, 0.34, 0.62, 0.5, 0.46, 0.56, 0.3, 0.56]], ["poly", "G", [0.3, 0.66, 0.5, 0.8, 0.7, 0.66, 0.5, 0.72]]] },
  andorra: { r: 10 / 7, d: [["v", "BYR", [8, 9, 8]], ["box", "O", 0.43, 0.32, 0.57, 0.68], ["box", "R", 0.5, 0.38, 0.55, 0.62]] },
  monaco: { r: 1.25, d: [["h", "RW"]] },
  liechtenstein: { r: 5 / 3, d: [["h", "BR"], ["poly", "Y", [0.16, 0.36, 0.17, 0.2, 0.21, 0.27, 0.25, 0.14, 0.29, 0.27, 0.33, 0.2, 0.34, 0.36]]] },
  "san-marino": { r: 4 / 3, d: [["h", "WL"], ["box", "Y", 0.42, 0.3, 0.58, 0.72], ["box", "L", 0.45, 0.42, 0.55, 0.62]] },
  "vatican-city": { r: 1, d: [["v", "YW"], ["poly", "Y", [0.62, 0.72, 0.75, 0.28, 0.88, 0.72]], ["poly", "S", [0.64, 0.42, 0.86, 0.42, 0.75, 0.75]]] },
  // Asia and the Middle East
  turkey: { r: 1.5, d: [["box", "R", 0, 0, 1, 1], ["crescent", "W", 0.333, 0.5, 0.25, 0.375, 0.5, 0.2], ["star", "W", 0.49, 0.5, 0.125, 5, 180]] },
  georgia: { r: 1.5, d: [["box", "W", 0, 0, 1, 1], ["cross", "R", 0.5, 0.5, 0.2], ["plus", "R", 0.2, 0.22, 0.14, 0.05], ["plus", "R", 0.8, 0.22, 0.14, 0.05], ["plus", "R", 0.2, 0.78, 0.14, 0.05], ["plus", "R", 0.8, 0.78, 0.14, 0.05]] },
  armenia: { r: 2, d: [["h", "RBO"]] },
  azerbaijan: { r: 2, d: [["h", "LRG"], ["crescent", "W", 0.47, 0.5, 0.15, 0.495, 0.5, 0.125], ["star", "W", 0.56, 0.5, 0.075, 8]] },
  kazakhstan: { r: 2, d: [["box", "C", 0, 0, 1, 1], ["disc", "Y", 0.5, 0.42, 0.18], ["poly", "Y", [0.36, 0.6, 0.5, 0.72, 0.64, 0.6, 0.5, 0.66]], ["box", "Y", 0.04, 0.04, 0.1, 0.96]] },
  uzbekistan: { r: 2, d: [["h", "LWG"], ["crescent", "W", 0.12, 0.17, 0.12, 0.155, 0.17, 0.105], ["dots", "W", 0.2, 0.08, 0.36, 0.08, 3, 0.03]] },
  turkmenistan: { r: 1.5, d: [["box", "G", 0, 0, 1, 1], ["box", "M", 0.12, 0, 0.3, 1], ["crescent", "W", 0.4, 0.2, 0.12, 0.43, 0.18, 0.1], ["dots", "W", 0.46, 0.08, 0.5, 0.32, 3, 0.03]] },
  kyrgyzstan: { r: 5 / 3, d: [["box", "R", 0, 0, 1, 1], ["disc", "Y", 0.5, 0.5, 0.32], ["disc", "R", 0.5, 0.5, 0.17], ["disc", "Y", 0.5, 0.5, 0.12]] },
  tajikistan: { r: 2, d: [["h", "RWG", [2, 3, 2]], ["poly", "Y", [0.45, 0.56, 0.46, 0.44, 0.5, 0.39, 0.54, 0.44, 0.55, 0.56]], ["arc", "Y", 0.5, 0.56, 0.2, -70, 70, 7, 0.025]] },
  pakistan: { r: 1.5, d: [["box", "D", 0, 0, 1, 1], ["box", "W", 0, 0, 0.25, 1], ["crescent", "W", 0.625, 0.5, 0.3, 0.66, 0.43, 0.27], ["star", "W", 0.73, 0.36, 0.1, 5, 300]] },
  india: { r: 1.5, d: [["h", "OWG"], ["disc", "N", 0.5, 0.5, 0.125], ["disc", "W", 0.5, 0.5, 0.06]] },
  nepal: { r: 0.82, d: [["poly", "N", [0, 0, 1, 0.47, 0.36, 0.47, 1, 1, 0, 1]], ["poly", "R", [0.04, 0.05, 0.86, 0.43, 0.27, 0.43, 0.86, 0.96, 0.04, 0.96]],
    ["crescent", "W", 0.27, 0.27, 0.11, 0.27, 0.22, 0.1], ["disc", "W", 0.27, 0.31, 0.06], ["star", "W", 0.27, 0.73, 0.1, 12]] },
  bhutan: { r: 1.5, d: [["poly", "Y", [0, 0, 1, 0, 0, 1]], ["poly", "O", [1, 0, 1, 1, 0, 1]], ["band", "W", 0.2, 0.76, 0.8, 0.26, 0.26]] },
  bangladesh: { r: 5 / 3, d: [["box", "D", 0, 0, 1, 1], ["disc", "R", 0.45, 0.5, 0.3]] },
  "sri-lanka": { r: 2, d: [["box", "Y", 0, 0, 1, 1], ["box", "G", 0.04, 0.08, 0.17, 0.92], ["box", "O", 0.17, 0.08, 0.3, 0.92], ["box", "M", 0.34, 0.08, 0.96, 0.92], ["disc", "Y", 0.65, 0.5, 0.24]] },
  maldives: { r: 1.5, d: [["box", "R", 0, 0, 1, 1], ["box", "G", 0.25, 0.25, 0.75, 0.75], ["crescent", "W", 0.52, 0.5, 0.17, 0.57, 0.5, 0.15]] },
  china: { r: 1.5, d: [["box", "R", 0, 0, 1, 1], ["star", "Y", 0.167, 0.25, 0.15], ["star", "Y", 0.333, 0.1, 0.05], ["star", "Y", 0.4, 0.2, 0.05], ["star", "Y", 0.4, 0.35, 0.05], ["star", "Y", 0.333, 0.45, 0.05]] },
  mongolia: { r: 2, d: [["v", "RBR"], ["box", "Y", 0.12, 0.18, 0.21, 0.82], ["box", "R", 0.15, 0.36, 0.18, 0.62]] },
  "north-korea": { r: 2, d: [["h", "BWRWB", [6, 1, 15, 1, 6]], ["disc", "W", 0.36, 0.5, 0.22], ["star", "R", 0.36, 0.5, 0.21]] },
  "south-korea": { r: 1.5, d: [["box", "W", 0, 0, 1, 1], ["disc", "B", 0.5, 0.5, 0.25], ["half", "R", 0.5, 0.5, 0.25, 34], ["box", "K", 0.14, 0.14, 0.26, 0.34], ["box", "K", 0.74, 0.14, 0.86, 0.34], ["box", "K", 0.14, 0.66, 0.26, 0.86], ["box", "K", 0.74, 0.66, 0.86, 0.86]] },
  japan: { r: 1.5, d: [["box", "W", 0, 0, 1, 1], ["disc", "R", 0.5, 0.5, 0.3]] },
  taiwan: { r: 1.5, d: [["box", "R", 0, 0, 1, 1], ["box", "B", 0, 0, 0.5, 0.5], ["star", "W", 0.25, 0.25, 0.19, 12, 0, 0.7], ["disc", "B", 0.25, 0.25, 0.085], ["disc", "W", 0.25, 0.25, 0.07]] },
  vietnam: { r: 1.5, d: [["box", "R", 0, 0, 1, 1], ["star", "Y", 0.5, 0.5, 0.3]] },
  laos: { r: 1.5, d: [["h", "RBR", [1, 2, 1]], ["disc", "W", 0.5, 0.5, 0.2]] },
  cambodia: { r: 25 / 16, d: [["h", "BRB", [1, 2, 1]], ["poly", "W", [0.32, 0.68, 0.36, 0.46, 0.41, 0.52, 0.45, 0.38, 0.5, 0.3, 0.55, 0.38, 0.59, 0.52, 0.64, 0.46, 0.68, 0.68]]] },
  thailand: { r: 1.5, d: [["h", "RWBWR", [1, 1, 2, 1, 1]]] },
  myanmar: { r: 1.5, d: [["h", "YGR"], ["star", "W", 0.5, 0.53, 0.42]] },
  malaysia: { r: 2, d: [["h", "RWRWRWRWRWRWRW"], ["box", "N", 0, 0, 0.5, 8 / 14], ["crescent", "Y", 0.2, 0.29, 0.2, 0.245, 0.29, 0.165], ["star", "Y", 0.33, 0.29, 0.14, 14]] },
  singapore: { r: 1.5, d: [["h", "RW"], ["crescent", "W", 0.2, 0.25, 0.17, 0.25, 0.25, 0.15], ["dots", "W", 0.27, 0.15, 0.27, 0.35, 2, 0.03]] },
  indonesia: { r: 1.5, d: [["h", "RW"]] },
  brunei: { r: 2, d: [["box", "Y", 0, 0, 1, 1], ["band", "W", 0, 0.1, 1, 0.66, 0.2], ["band", "K", 0, 0.3, 1, 0.86, 0.2], ["disc", "R", 0.5, 0.5, 0.26]] },
  philippines: { r: 2, d: [["h", "BR"], ["tri", "W", 0.433], ["disc", "Y", 0.15, 0.5, 0.1], ["dots", "Y", 0.05, 0.12, 0.05, 0.88, 2, 0.04], ["dots", "Y", 0.37, 0.5, 0.37, 0.5, 1, 0.04]] },
  "east-timor": { r: 2, d: [["box", "R", 0, 0, 1, 1], ["tri", "Y", 0.5], ["tri", "K", 0.333], ["star", "W", 0.11, 0.5, 0.11]] },
  iran: { r: 7 / 4, d: [["h", "GWR"], ["disc", "R", 0.5, 0.5, 0.12], ["disc", "W", 0.5, 0.5, 0.05]] },
  iraq: { r: 1.5, d: [["h", "RWK"], ["box", "G", 0.3, 0.42, 0.7, 0.58], ["box", "W", 0.38, 0.42, 0.42, 0.5], ["box", "W", 0.58, 0.42, 0.62, 0.5]] },
  lebanon: { r: 1.5, d: [["h", "RWR", [1, 2, 1]], ["poly", "G", [0.5, 0.29, 0.6, 0.62, 0.53, 0.62, 0.53, 0.71, 0.47, 0.71, 0.47, 0.62, 0.4, 0.62]]] },
  israel: { r: 11 / 8, d: [["box", "W", 0, 0, 1, 1], ["box", "B", 0, 0.1, 1, 0.25], ["box", "B", 0, 0.75, 1, 0.9], ["hexagram", "B", 0.5, 0.5, 0.2, 0.045]] },
  jordan: { r: 2, d: [["h", "KWG"], ["tri", "R", 0.5], ["star", "W", 0.17, 0.5, 0.07, 7]] },
  "saudi-arabia": { r: 1.5, d: [["box", "G", 0, 0, 1, 1], ["box", "W", 0.25, 0.27, 0.75, 0.47], ["box", "G", 0.33, 0.32, 0.36, 0.42], ["box", "G", 0.5, 0.32, 0.53, 0.42], ["box", "W", 0.25, 0.6, 0.72, 0.66], ["box", "W", 0.72, 0.56, 0.75, 0.7]] },
  yemen: { r: 1.5, d: [["h", "RWK"]] },
  oman: { r: 2, d: [["h", "WRG"], ["box", "R", 0, 0, 0.27, 1], ["box", "W", 0.06, 0.06, 0.2, 0.28]] },
  uae: { r: 2, d: [["h", "GWK"], ["box", "R", 0, 0, 0.25, 1]] },
  qatar: { r: 28 / 11, d: [["box", "M", 0, 0, 1, 1], ["serrate", "W", 0.3, 0.08, 9]] },
  bahrain: { r: 5 / 3, d: [["box", "R", 0, 0, 1, 1], ["serrate", "W", 0.22, 0.12, 5]] },
  kuwait: { r: 2, d: [["h", "GWR"], ["poly", "K", [0, 0, 0.25, 0.333, 0.25, 0.667, 0, 1]]] },
  palestine: { r: 2, d: [["h", "KWG"], ["tri", "R", 0.333]] },
  // Africa
  egypt: { r: 1.5, d: [["h", "RWK"], ["poly", "Y", [0.44, 0.38, 0.5, 0.36, 0.56, 0.38, 0.55, 0.62, 0.45, 0.62]]] },
  libya: { r: 2, d: [["h", "RKG", [1, 2, 1]], ["crescent", "W", 0.48, 0.5, 0.15, 0.51, 0.5, 0.12], ["star", "W", 0.56, 0.5, 0.065, 5, 180]] },
  tunisia: { r: 1.5, d: [["box", "R", 0, 0, 1, 1], ["disc", "W", 0.5, 0.5, 0.25], ["crescent", "R", 0.5, 0.5, 0.19, 0.53, 0.5, 0.15], ["star", "R", 0.55, 0.5, 0.1, 5, 180]] },
  algeria: { r: 1.5, d: [["v", "GW"], ["crescent", "R", 0.5, 0.5, 0.25, 0.56, 0.5, 0.2], ["star", "R", 0.57, 0.5, 0.12, 5, 180]] },
  morocco: { r: 1.5, d: [["box", "R", 0, 0, 1, 1], ["pentagram", "G", 0.5, 0.5, 0.28, 0.04]] },
  mauritania: { r: 1.5, d: [["box", "G", 0, 0, 1, 1], ["box", "R", 0, 0, 1, 0.2], ["box", "R", 0, 0.8, 1, 1], ["crescent", "Y", 0.5, 0.45, 0.25, 0.5, 0.34, 0.24], ["star", "Y", 0.5, 0.36, 0.08]] },
  mali: { r: 1.5, d: [["v", "GYR"]] },
  niger: { r: 7 / 6, d: [["h", "OWG"], ["disc", "O", 0.5, 0.5, 0.13]] },
  chad: { r: 1.5, d: [["v", "NYR"]] },
  sudan: { r: 2, d: [["h", "RWK"], ["tri", "G", 0.33]] },
  "south-sudan": { r: 2, d: [["h", "KWRWG", [6, 1, 6, 1, 6]], ["tri", "B", 0.42], ["star", "Y", 0.12, 0.5, 0.11]] },
  eritrea: { r: 2, d: [["poly", "G", [0, 0, 1, 0, 1, 0.5]], ["poly", "B", [0, 1, 1, 1, 1, 0.5]], ["poly", "R", [0, 0, 1, 0.5, 0, 1]], ["ring", "Y", 0.25, 0.5, 0.15, 0.2], ["box", "Y", 0.24, 0.5, 0.26, 0.68]] },
  ethiopia: { r: 2, d: [["h", "GYR"], ["disc", "B", 0.5, 0.5, 0.25], ["star", "Y", 0.5, 0.5, 0.19]] },
  djibouti: { r: 1.5, d: [["h", "LG"], ["tri", "W", 0.43], ["star", "R", 0.16, 0.5, 0.1]] },
  somalia: { r: 1.5, d: [["box", "L", 0, 0, 1, 1], ["star", "W", 0.5, 0.5, 0.28]] },
  kenya: { r: 1.5, d: [["h", "KWRWG", [6, 1, 6, 1, 6]], ["poly", "R", [0.5, 0.14, 0.58, 0.5, 0.5, 0.86, 0.42, 0.5]], ["poly", "K", [0.5, 0.3, 0.545, 0.5, 0.5, 0.7, 0.455, 0.5]]] },
  uganda: { r: 1.5, d: [["h", "KYRKYR"], ["disc", "W", 0.5, 0.5, 0.2]] },
  rwanda: { r: 1.5, d: [["h", "LYG", [2, 1, 1]], ["disc", "Y", 0.84, 0.25, 0.13]] },
  burundi: { r: 5 / 3, d: [["box", "G", 0, 0, 1, 1], ["poly", "R", [0, 0, 1, 0, 0.5, 0.5]], ["poly", "R", [0, 1, 1, 1, 0.5, 0.5]], ["saltire", "W", 0.14], ["disc", "W", 0.5, 0.5, 0.28], ["dots", "R", 0.43, 0.42, 0.57, 0.42, 2, 0.05], ["dots", "R", 0.5, 0.6, 0.5, 0.6, 1, 0.05]] },
  tanzania: { r: 1.5, d: [["poly", "G", [0, 0, 1, 0, 0, 1]], ["poly", "C", [1, 0, 1, 1, 0, 1]], ["band", "Y", 0, 1, 1, 0, 0.34], ["band", "K", 0, 1, 1, 0, 0.24]] },
  senegal: { r: 1.5, d: [["v", "GYR"], ["star", "G", 0.5, 0.5, 0.16]] },
  gambia: { r: 1.5, d: [["h", "RWBWG", [6, 1, 4, 1, 6]]] },
  guinea: { r: 1.5, d: [["v", "RYG"]] },
  "guinea-bissau": { r: 2, d: [["box", "R", 0, 0, 0.333, 1], ["box", "Y", 0.333, 0, 1, 0.5], ["box", "G", 0.333, 0.5, 1, 1], ["star", "K", 0.167, 0.5, 0.15]] },
  "sierra-leone": { r: 1.5, d: [["h", "GWB"]] },
  liberia: { r: 19 / 10, d: [["h", "RWRWRWRWRWR"], ["box", "N", 0, 0, 0.239, 5 / 11], ["star", "W", 0.12, 0.227, 0.16]] },
  "ivory-coast": { r: 1.5, d: [["v", "OWG"]] },
  ghana: { r: 1.5, d: [["h", "RYG"], ["star", "K", 0.5, 0.5, 0.17]] },
  togo: { r: 1.618, d: [["h", "GYGYG"], ["box", "R", 0, 0, 0.37, 0.6], ["star", "W", 0.185, 0.3, 0.2]] },
  benin: { r: 1.5, d: [["box", "G", 0, 0, 0.4, 1], ["box", "Y", 0.4, 0, 1, 0.5], ["box", "R", 0.4, 0.5, 1, 1]] },
  "burkina-faso": { r: 1.5, d: [["h", "RG"], ["star", "Y", 0.5, 0.5, 0.17]] },
  nigeria: { r: 2, d: [["v", "GWG"]] },
  cameroon: { r: 1.5, d: [["v", "GRY"], ["star", "Y", 0.5, 0.5, 0.16]] },
  "central-african-republic": { r: 5 / 3, d: [["h", "BWGY"], ["box", "R", 0.43, 0, 0.57, 1], ["star", "Y", 0.12, 0.125, 0.1]] },
  gabon: { r: 4 / 3, d: [["h", "GYB"]] },
  "equatorial-guinea": { r: 1.5, d: [["h", "GWR"], ["tri", "B", 0.2], ["box", "S", 0.45, 0.39, 0.55, 0.61]] },
  "republic-of-the-congo": { r: 1.5, d: [["box", "R", 0, 0, 1, 1], ["poly", "G", [0, 0, 1, 0, 0, 1]], ["band", "Y", 0, 1, 1, 0, 0.36]] },
  "dr-congo": { r: 4 / 3, d: [["box", "L", 0, 0, 1, 1], ["band", "Y", 0, 1, 1, 0, 0.36], ["band", "R", 0, 1, 1, 0, 0.26], ["star", "Y", 0.15, 0.2, 0.14]] },
  angola: { r: 1.5, d: [["h", "RK"], ["ring", "Y", 0.5, 0.5, 0.15, 0.21], ["band", "Y", 0.4, 0.66, 0.62, 0.34, 0.06], ["star", "Y", 0.45, 0.42, 0.06]] },
  zambia: { r: 1.5, d: [["box", "G", 0, 0, 1, 1], ["box", "R", 0.7, 0.4, 0.8, 1], ["box", "K", 0.8, 0.4, 0.9, 1], ["box", "O", 0.9, 0.4, 1, 1], ["poly", "O", [0.76, 0.2, 0.85, 0.12, 0.94, 0.2, 0.85, 0.3]]] },
  zimbabwe: { r: 2, d: [["h", "GYRKRYG"], ["tri", "K", 0.31], ["tri", "W", 0.28], ["star", "R", 0.1, 0.5, 0.11]] },
  mozambique: { r: 1.5, d: [["h", "GWKWY", [5, 1, 5, 1, 5]], ["tri", "R", 0.43], ["star", "Y", 0.13, 0.5, 0.13]] },
  malawi: { r: 1.5, d: [["h", "KRG"], ["disc", "R", 0.5, 0.333, 0.16]] },
  madagascar: { r: 1.5, d: [["box", "W", 0, 0, 0.333, 1], ["box", "R", 0.333, 0, 1, 0.5], ["box", "G", 0.333, 0.5, 1, 1]] },
  namibia: { r: 1.5, d: [["poly", "B", [0, 0, 1, 0, 0, 1]], ["poly", "G", [1, 0, 1, 1, 0, 1]], ["band", "W", 0, 1, 1, 0, 0.34], ["band", "R", 0, 1, 1, 0, 0.25], ["star", "Y", 0.17, 0.25, 0.14, 12, 0, 0.6]] },
  botswana: { r: 1.5, d: [["box", "L", 0, 0, 1, 1], ["box", "W", 0, 0.375, 1, 0.625], ["box", "K", 0, 0.42, 1, 0.58]] },
  "south-africa": { r: 1.5, d: [["h", "RB"], ["band", "W", 0, 0, 0.42, 0.5, 0.34], ["band", "W", 0, 1, 0.42, 0.5, 0.34], ["box", "W", 0.4, 0.33, 1, 0.67],
    ["band", "G", 0, 0, 0.42, 0.5, 0.2], ["band", "G", 0, 1, 0.42, 0.5, 0.2], ["box", "G", 0.4, 0.4, 1, 0.6], ["tri", "Y", 0.3], ["tri", "K", 0.25]] },
  lesotho: { r: 1.5, d: [["h", "BWG", [3, 4, 3]], ["poly", "K", [0.5, 0.32, 0.585, 0.63, 0.415, 0.63]]] },
  eswatini: { r: 1.5, d: [["h", "BYRYB", [3, 1, 6, 1, 3]], ["poly", "W", [0.27, 0.5, 0.5, 0.31, 0.73, 0.5, 0.5, 0.69]], ["poly", "K", [0.5, 0.31, 0.73, 0.5, 0.5, 0.69]]] },
  mauritius: { r: 1.5, d: [["h", "RBYG"]] },
  seychelles: { r: 2, d: [["poly", "B", [0, 1, 0, 0, 0.333, 0]], ["poly", "Y", [0, 1, 0.333, 0, 0.667, 0]], ["poly", "R", [0, 1, 0.667, 0, 1, 0, 1, 0.333]], ["poly", "W", [0, 1, 1, 0.333, 1, 0.667]], ["poly", "G", [0, 1, 1, 0.667, 1, 1]]] },
  "cape-verde": { r: 5 / 3, d: [["box", "B", 0, 0, 1, 1], ["box", "W", 0, 0.5, 1, 0.75], ["box", "R", 0, 0.583, 1, 0.667], ["arc", "Y", 0.375, 0.625, 0.27, 0, 360, 10, 0.045]] },
  comoros: { r: 5 / 3, d: [["h", "YWRB"], ["tri", "G", 0.4], ["crescent", "W", 0.13, 0.5, 0.17, 0.18, 0.5, 0.15]] },
  "sao-tome-and-principe": { r: 2, d: [["h", "GYG", [2, 3, 2]], ["tri", "R", 0.25], ["star", "K", 0.46, 0.5, 0.11], ["star", "K", 0.7, 0.5, 0.11]] },
  // the Americas
  "united-states": { r: 1.9, d: [["h", "RWRWRWRWRWRWR"], ["box", "N", 0, 0, 0.4, 7 / 13], ["dotgrid", "W", 0.035, 0.055, 0.365, 0.485, 6, 5, 0.022]] },
  canada: { r: 2, d: [["v", "RWR", [1, 2, 1]], ["poly", "R", maple]] },
  mexico: { r: 1.75, d: [["v", "GWR"], ["disc", "T", 0.5, 0.48, 0.14], ["band", "G", 0.42, 0.62, 0.58, 0.62, 0.05]] },
  guatemala: { r: 1.6, d: [["v", "LWL"], ["ring", "G", 0.5, 0.52, 0.12, 0.17], ["disc", "T", 0.5, 0.48, 0.07]] },
  belize: { r: 5 / 3, d: [["box", "B", 0, 0, 1, 1], ["box", "R", 0, 0, 1, 0.1], ["box", "R", 0, 0.9, 1, 1], ["disc", "W", 0.5, 0.5, 0.31], ["ring", "G", 0.5, 0.5, 0.24, 0.3], ["disc", "T", 0.5, 0.5, 0.1]] },
  honduras: { r: 2, d: [["h", "CWC"], ["dots", "C", 0.42, 0.44, 0.58, 0.44, 2, 0.035], ["dots", "C", 0.5, 0.5, 0.5, 0.5, 1, 0.035], ["dots", "C", 0.42, 0.56, 0.58, 0.56, 2, 0.035]] },
  "el-salvador": { r: 1.77, d: [["h", "BWB"], ["poly", "Y", [0.5, 0.38, 0.56, 0.6, 0.44, 0.6]], ["ring", "G", 0.5, 0.5, 0.12, 0.15]] },
  nicaragua: { r: 5 / 3, d: [["h", "BWB"], ["poly", "C", [0.5, 0.38, 0.57, 0.6, 0.43, 0.6]]] },
  "costa-rica": { r: 5 / 3, d: [["h", "NWRWN", [1, 1, 2, 1, 1]]] },
  panama: { r: 1.5, d: [...quarters("W", "R", "B", "W"), ["star", "B", 0.25, 0.25, 0.15], ["star", "R", 0.75, 0.75, 0.15]] },
  cuba: { r: 2, d: [["h", "BWBWB"], ["tri", "R", 0.433], ["star", "W", 0.15, 0.5, 0.13]] },
  jamaica: { r: 2, d: [["poly", "G", [0, 0, 1, 0, 0.5, 0.5]], ["poly", "G", [0, 1, 1, 1, 0.5, 0.5]], ["poly", "K", [0, 0, 0.5, 0.5, 0, 1]], ["poly", "K", [1, 0, 0.5, 0.5, 1, 1]], ["saltire", "Y", 0.17]] },
  haiti: { r: 5 / 3, d: [["h", "BR"], ["box", "W", 0.38, 0.35, 0.62, 0.65], ["poly", "G", [0.5, 0.38, 0.54, 0.6, 0.46, 0.6]]] },
  "dominican-republic": { r: 1.6, d: [["box", "W", 0, 0, 1, 1], ["box", "B", 0, 0, 0.45, 0.42], ["box", "R", 0.55, 0, 1, 0.42], ["box", "R", 0, 0.58, 0.45, 1], ["box", "B", 0.55, 0.58, 1, 1], ["disc", "G", 0.5, 0.5, 0.07]] },
  bahamas: { r: 2, d: [["h", "CYC"], ["tri", "K", 0.433]] },
  "trinidad-and-tobago": { r: 5 / 3, d: [["box", "R", 0, 0, 1, 1], ["band", "W", 0, 0, 1, 1, 0.42], ["band", "K", 0, 0, 1, 1, 0.3]] },
  barbados: { r: 1.5, d: [["v", "NYN"], ["poly", "K", [0.46, 0.75, 0.46, 0.5, 0.4, 0.48, 0.39, 0.25, 0.43, 0.38, 0.48, 0.38, 0.5, 0.22, 0.52, 0.38, 0.57, 0.38, 0.61, 0.25, 0.6, 0.48, 0.54, 0.5, 0.54, 0.75]]] },
  colombia: { r: 1.5, d: [["h", "YBR", [2, 1, 1]]] },
  venezuela: { r: 1.5, d: [["h", "YBR"], ["arc", "W", 0.5, 0.68, 0.24, -70, 70, 8, 0.03]] },
  guyana: { r: 5 / 3, d: [["box", "G", 0, 0, 1, 1], ["poly", "W", [0, 0, 1, 0.5, 0, 1]], ["poly", "Y", [0, 0.04, 0.95, 0.5, 0, 0.96]], ["poly", "K", [0, 0, 0.5, 0.5, 0, 1]], ["poly", "R", [0, 0.05, 0.45, 0.5, 0, 0.95]]] },
  suriname: { r: 1.5, d: [["h", "GWRWG", [2, 1, 4, 1, 2]], ["star", "Y", 0.5, 0.5, 0.2]] },
  ecuador: { r: 2, d: [["h", "YBR", [2, 1, 1]], ["disc", "T", 0.5, 0.48, 0.12], ["disc", "L", 0.5, 0.52, 0.06]] },
  peru: { r: 1.5, d: [["v", "RWR"]] },
  bolivia: { r: 22 / 15, d: [["h", "RYG"]] },
  brazil: { r: 10 / 7, d: [["box", "G", 0, 0, 1, 1], ["poly", "Y", [0.085, 0.5, 0.5, 0.12, 0.915, 0.5, 0.5, 0.88]], ["disc", "N", 0.5, 0.5, 0.25], ["band", "W", 0.33, 0.45, 0.67, 0.56, 0.04]] },
  paraguay: { r: 5 / 3, d: [["h", "RWB"], ["ring", "G", 0.5, 0.5, 0.09, 0.12], ["disc", "Y", 0.5, 0.5, 0.05]] },
  uruguay: { r: 1.5, d: [["h", "WBWBWBWBW"], ["box", "W", 0, 0, 0.37, 5 / 9], ["star", "Y", 0.185, 0.278, 0.2, 16, 0, 0.6]] },
  chile: { r: 1.5, d: [["h", "WR"], ["box", "B", 0, 0, 0.333, 0.5], ["star", "W", 0.167, 0.25, 0.15]] },
  argentina: { r: 1.6, d: [["h", "LWL"], ["disc", "Y", 0.5, 0.5, 0.12]] },
  "antigua-and-barbuda": { r: 1.5, d: [["box", "R", 0, 0, 1, 1], ["poly", "K", [0, 0, 1, 0, 0.5, 1]], ["star", "Y", 0.5, 0.38, 0.2, 16, 0, 0.6], ["poly", "B", [0.19, 0.38, 0.81, 0.38, 0.7, 0.6, 0.3, 0.6]], ["poly", "W", [0.3, 0.6, 0.7, 0.6, 0.5, 1]]] },
  dominica: { r: 2, d: [["box", "G", 0, 0, 1, 1], ["cross", "Y", 0.5, 0.5, 0.24], ["cross", "K", 0.5, 0.5, 0.16], ["cross", "W", 0.5, 0.5, 0.08], ["disc", "R", 0.5, 0.5, 0.25], ["disc", "P", 0.5, 0.5, 0.11]] },
  grenada: { r: 5 / 3, d: [["box", "R", 0, 0, 1, 1], ["poly", "Y", [0.08, 0.14, 0.92, 0.14, 0.5, 0.5]], ["poly", "Y", [0.08, 0.86, 0.92, 0.86, 0.5, 0.5]], ["poly", "G", [0.08, 0.14, 0.5, 0.5, 0.08, 0.86]], ["poly", "G", [0.92, 0.14, 0.5, 0.5, 0.92, 0.86]], ["disc", "R", 0.5, 0.5, 0.14], ["star", "Y", 0.5, 0.5, 0.11], ["disc", "O", 0.2, 0.5, 0.06]] },
  "saint-lucia": { r: 2, d: [["box", "L", 0, 0, 1, 1], ["poly", "W", [0.5, 0.08, 0.7, 0.9, 0.3, 0.9]], ["poly", "K", [0.5, 0.17, 0.66, 0.9, 0.34, 0.9]], ["poly", "Y", [0.5, 0.5, 0.7, 0.9, 0.3, 0.9]]] },
  "saint-kitts-and-nevis": { r: 1.5, d: [["poly", "G", [0, 0, 1, 0, 0, 1]], ["poly", "R", [1, 0, 1, 1, 0, 1]], ["band", "Y", 0, 1, 1, 0, 0.42], ["band", "K", 0, 1, 1, 0, 0.3], ["star", "W", 0.38, 0.62, 0.1], ["star", "W", 0.62, 0.38, 0.1]] },
  "saint-vincent-and-the-grenadines": { r: 1.5, d: [["v", "BYG", [1, 2, 1]], ["poly", "G", [0.42, 0.24, 0.47, 0.38, 0.42, 0.52, 0.37, 0.38]], ["poly", "G", [0.58, 0.24, 0.63, 0.38, 0.58, 0.52, 0.53, 0.38]], ["poly", "G", [0.5, 0.48, 0.55, 0.62, 0.5, 0.76, 0.45, 0.62]]] },
  // Oceania
  australia: { r: 2, d: [["box", "N", 0, 0, 1, 1], ...UJ(0.5, 0.5), ["star", "W", 0.25, 0.75, 0.15, 7], ["star", "W", 0.75, 0.17, 0.07, 7], ["star", "W", 0.62, 0.42, 0.07, 7], ["star", "W", 0.87, 0.38, 0.07, 7], ["star", "W", 0.75, 0.83, 0.07, 7]] },
  "new-zealand": { r: 2, d: [["box", "N", 0, 0, 1, 1], ...UJ(0.5, 0.5), ...[[0.75, 0.2], [0.66, 0.45], [0.85, 0.4], [0.75, 0.8]].flatMap(([x, y]) => [["star", "W", x, y, 0.09], ["star", "R", x, y, 0.065]])] },
  "papua-new-guinea": { r: 4 / 3, d: [["poly", "R", [0, 0, 1, 0, 1, 1]], ["poly", "K", [0, 0, 1, 1, 0, 1]], ["poly", "Y", [0.58, 0.32, 0.72, 0.18, 0.86, 0.12, 0.8, 0.28, 0.9, 0.42, 0.74, 0.36]], ["dots", "W", 0.22, 0.55, 0.22, 0.88, 2, 0.04], ["dots", "W", 0.12, 0.7, 0.32, 0.7, 2, 0.04]] },
  fiji: { r: 2, d: [["box", "L", 0, 0, 1, 1], ...UJ(0.5, 0.5), ["box", "W", 0.66, 0.26, 0.84, 0.74], ["box", "R", 0.66, 0.26, 0.84, 0.38], ["box", "R", 0.735, 0.38, 0.765, 0.74]] },
  samoa: { r: 2, d: [["box", "R", 0, 0, 1, 1], ["box", "N", 0, 0, 0.5, 0.5], ["dots", "W", 0.25, 0.1, 0.25, 0.4, 2, 0.04], ["dots", "W", 0.15, 0.24, 0.35, 0.2, 2, 0.04]] },
  tonga: { r: 2, d: [["box", "R", 0, 0, 1, 1], ["box", "W", 0, 0, 0.4, 0.5], ["plus", "R", 0.2, 0.25, 0.3, 0.1]] },
  vanuatu: { r: 5 / 3, d: [["h", "RG"], ["poly", "Y", [0, 0, 0.5, 0.44, 1, 0.44, 1, 0.56, 0.5, 0.56, 0, 1]], ["box", "K", 0.5, 0.47, 1, 0.53], ["poly", "K", [0, 0.07, 0.42, 0.5, 0, 0.93]], ["disc", "Y", 0.14, 0.5, 0.08]] },
  "solomon-islands": { r: 2, d: [["poly", "B", [0, 0, 1, 0, 0, 1]], ["poly", "G", [1, 0, 1, 1, 0, 1]], ["band", "Y", 0, 1, 1, 0, 0.12], ["dots", "W", 0.1, 0.12, 0.3, 0.12, 2, 0.04], ["dots", "W", 0.2, 0.25, 0.2, 0.25, 1, 0.04], ["dots", "W", 0.1, 0.38, 0.3, 0.38, 2, 0.04]] },
  micronesia: { r: 1.9, d: [["box", "L", 0, 0, 1, 1], ["star", "W", 0.5, 0.2, 0.12], ["star", "W", 0.5, 0.8, 0.12], ["star", "W", 0.34, 0.5, 0.12], ["star", "W", 0.66, 0.5, 0.12]] },
  palau: { r: 1.6, d: [["box", "L", 0, 0, 1, 1], ["disc", "Y", 0.45, 0.5, 0.3]] },
  kiribati: { r: 2, d: [["box", "R", 0, 0, 1, 0.55], ["h", "BWBWBW", null, 0.55, 1], ["disc", "Y", 0.5, 0.55, 0.2], ["box", "R", 0, 0.55, 1, 0.56], ["poly", "Y", [0.35, 0.22, 0.5, 0.12, 0.65, 0.22, 0.5, 0.18]]] },
  "marshall-islands": { r: 1.9, d: [["box", "N", 0, 0, 1, 1], ["poly", "O", [0, 1, 1, 0.08, 1, 0.3]], ["poly", "W", [0, 1, 1, 0, 1, 0.08]], ["star", "W", 0.22, 0.28, 0.16, 12, 0, 0.5]] },
  nauru: { r: 2, d: [["box", "N", 0, 0, 1, 1], ["box", "Y", 0, 0.46, 1, 0.54], ["star", "W", 0.25, 0.73, 0.13, 12, 0, 0.55]] },
  tuvalu: { r: 2, d: [["box", "L", 0, 0, 1, 1], ...UJ(0.5, 0.5), ["dots", "Y", 0.6, 0.65, 0.9, 0.25, 4, 0.045], ["dots", "Y", 0.65, 0.85, 0.95, 0.5, 4, 0.045]] },
};

// ---------- painting a flag ----------
const RAD = Math.PI / 180;
/** Whether (x, y) is inside a polygon of points [x, y, x, y, …] (even–odd), all in the same units. */
function inPoly(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** How far (x, y) is from the segment a–b. */
function toSegment(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}
/** A star's outline: n points on radius r (inner radius r·inner), the first at `rot` degrees (0: up), centred on cx, cy. */
function starPts(cx, cy, r, n = 5, rot = 0, inner = 0.382) {
  const pts = [];
  for (let k = 0; k < 2 * n; k++) {
    const a = (rot + (k * 180) / n) * RAD, q = k % 2 ? r * inner : r;
    pts.push(cx + q * Math.sin(a), cy - q * Math.cos(a));
  }
  return pts;
}

/**
 * The shapes of a flag as tests in one frame: x across in units of the flag's height (0 … r), y down (0 … 1). Each
 * is [colour, test(x, y)], painted in order; the last that holds at a point is its colour.
 */
function painted(flag) {
  const r = flag.r, out = [];
  const X = x => x * r;                                            // a width fraction into height units
  const P = pts => pts.map((v, i) => (i % 2 ? v : X(v)));
  for (const s of flag.d) {
    const [kind, c] = s;
    if (kind === "h" || kind === "v") {
      const cols = [...s[1]], w = s[2] || cols.map(() => 1), y0 = s[3] ?? 0, y1 = s[4] ?? 1, sum = w.reduce((a, b) => a + b, 0);
      let at = 0;
      cols.forEach((col, i) => {
        const a = at / sum, b = (at += w[i]) / sum;
        if (kind === "h") { const top = y0 + a * (y1 - y0), bot = y0 + b * (y1 - y0); out.push([col, (x, y) => y >= top && y < bot]); }
        else out.push([col, (x, y) => x >= X(a) && x < X(b)]);
      });
    } else if (kind === "box") {
      const [, , x0, y0, x1, y1] = s;
      out.push([c, (x, y) => x >= X(x0) && x < X(x1) && y >= y0 && y < y1]);
    } else if (kind === "poly") {
      const pts = P(s[2]);
      out.push([c, (x, y) => inPoly(pts, x, y)]);
    } else if (kind === "disc") {
      const cx = X(s[2]), cy = s[3], rr = s[4];
      out.push([c, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= rr * rr]);
    } else if (kind === "ring") {
      const cx = X(s[2]), cy = s[3], a = s[4], b = s[5];
      out.push([c, (x, y) => { const d = Math.hypot(x - cx, y - cy); return d >= a && d <= b; }]);
    } else if (kind === "half") {                                  // the half of a disc above a line through its centre, tilted
      const cx = X(s[2]), cy = s[3], rr = s[4], t = s[5] * RAD;
      out.push([c, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= rr * rr && (y - cy) * Math.cos(t) - (x - cx) * Math.sin(t) < 0]);
    } else if (kind === "crescent") {                              // a disc with another taken out of it
      const [, , ax, ay, ar, bx, by, br] = s, cx = X(ax), dx = X(bx);
      out.push([c, (x, y) => (x - cx) ** 2 + (y - ay) ** 2 <= ar * ar && (x - dx) ** 2 + (y - by) ** 2 > br * br]);
    } else if (kind === "star") {
      const pts = starPts(X(s[2]), s[3], s[4], s[5] || 5, s[6] || 0, s[7] || 0.382);
      out.push([c, (x, y) => inPoly(pts, x, y)]);
    } else if (kind === "cross") {                                 // a bar down and a bar across, the whole flag long
      const cx = X(s[2]), cy = s[3], t = s[4] / 2;
      out.push([c, (x, y) => Math.abs(x - cx) <= t || Math.abs(y - cy) <= t]);
    } else if (kind === "plus") {                                  // a small cross: arms `size` long, `t` thick
      const cx = X(s[2]), cy = s[3], h = s[4] / 2, t = s[5] / 2;
      out.push([c, (x, y) => (Math.abs(x - cx) <= t && Math.abs(y - cy) <= h) || (Math.abs(y - cy) <= t && Math.abs(x - cx) <= h)]);
    } else if (kind === "saltire") {
      const t = s[2] / 2;
      out.push([c, (x, y) => toSegment(x, y, 0, 0, r, 1) <= t || toSegment(x, y, 0, 1, r, 0) <= t]);
    } else if (kind === "band") {                                  // a band from one point to another, t thick
      const ax = X(s[2]), ay = s[3], bx = X(s[4]), by = s[5], t = s[6] / 2;
      out.push([c, (x, y) => toSegment(x, y, ax, ay, bx, by) <= t]);
    } else if (kind === "tri") {                                   // a triangle on the hoist, its point `depth` of the width in
      const d = X(s[2]);
      out.push([c, (x, y) => x <= d * (1 - Math.abs(2 * y - 1))]);
    } else if (kind === "rays") {                                  // rays from a centre out to points, each widening to w
      const cx = X(s[2]), cy = s[3], ends = s[4], w = s[5];
      const tris = [];
      for (let i = 0; i < ends.length; i += 2) {
        const ex = X(ends[i]), ey = ends[i + 1], dx = ex - cx, dy = ey - cy, n = Math.hypot(dx, dy), px = (-dy / n) * w, py = (dx / n) * w;
        tris.push([cx, cy, ex + px, ey + py, ex - px, ey - py]);
      }
      out.push([c, (x, y) => tris.some(t => inPoly(t, x, y))]);
    } else if (kind === "dots" || kind === "arc" || kind === "dotgrid") {
      const centres = [];
      if (kind === "dots") {                                       // n dots evenly along a line
        const [, , x0, y0, x1, y1, n] = s;
        for (let k = 0; k < n; k++) { const t = n > 1 ? k / (n - 1) : 0; centres.push([X(x0 + t * (x1 - x0)), y0 + t * (y1 - y0)]); }
      } else if (kind === "arc") {                                 // n dots round an arc from one angle to another (0: up)
        const [, , cx, cy, rr, a0, a1, n] = s, full = a1 - a0 >= 360;
        for (let k = 0; k < n; k++) { const a = (a0 + ((a1 - a0) * k) / (full ? n : Math.max(1, n - 1))) * RAD; centres.push([X(cx) + rr * Math.sin(a), cy - rr * Math.cos(a)]); }
      } else {                                                     // a grid of dots over a box
        const [, , x0, y0, x1, y1, nx, ny] = s;
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) centres.push([X(x0 + ((x1 - x0) * i) / (nx - 1)), y0 + ((y1 - y0) * j) / (ny - 1)]);
      }
      const rr = s[kind === "dotgrid" ? 8 : kind === "arc" ? 8 : 7];
      out.push([c, (x, y) => centres.some(([a, b]) => (x - a) ** 2 + (y - b) ** 2 <= rr * rr)]);
    } else if (kind === "checks") {                                // a chequer of two colours over a box
      const [, a, b, x0, y0, x1, y1, nx, ny] = s;
      out.push([a, (x, y) => x >= X(x0) && x < X(x1) && y >= y0 && y < y1 && (Math.floor(((x / r - x0) / (x1 - x0)) * nx) + Math.floor(((y - y0) / (y1 - y0)) * ny)) % 2 === 0]);
      out.push([b, (x, y) => x >= X(x0) && x < X(x1) && y >= y0 && y < y1 && (Math.floor(((x / r - x0) / (x1 - x0)) * nx) + Math.floor(((y - y0) / (y1 - y0)) * ny)) % 2 === 1]);
    } else if (kind === "serrate") {                               // a band at the hoist with n teeth into the field
      const base = X(s[2]), depth = X(s[3]), n = s[4];
      out.push([c, (x, y) => { const f = (y * n) % 1, tooth = depth * (1 - Math.abs(2 * f - 1)); return x <= base + tooth; }]);
    } else if (kind === "pentagram") {                             // a star's outline: its five strokes
      const pts = starPts(X(s[2]), s[3], s[4], 5, 0, 1).filter((_, i) => i % 4 < 2), t = s[5] / 2;
      const P2 = [];
      for (let k = 0; k < 5; k++) P2.push([pts[2 * k], pts[2 * k + 1]]);
      out.push([c, (x, y) => [0, 1, 2, 3, 4].some(k => { const a = P2[k], b = P2[(k + 2) % 5]; return toSegment(x, y, a[0], a[1], b[0], b[1]) <= t; })]);
    } else if (kind === "hexagram") {                              // the Star of David: two triangles' outlines
      const cx = X(s[2]), cy = s[3], rr = s[4], t = s[5] / 2, P3 = [];
      for (let k = 0; k < 6; k++) { const a = (k * 60) * RAD; P3.push([cx + rr * Math.sin(a), cy - rr * Math.cos(a)]); }
      out.push([c, (x, y) => [0, 1, 2, 3, 4, 5].some(k => { const a = P3[k], b = P3[(k + 2) % 6]; return toSegment(x, y, a[0], a[1], b[0], b[1]) <= t; })]);
    } else if (kind === "uj") {                                    // the Union Jack in a box
      const [, , x0, y0, x1, y1] = s, bx0 = X(x0), bx1 = X(x1), bw = bx1 - bx0, bh = y1 - y0, inside = (x, y) => x >= bx0 && x < bx1 && y >= y0 && y < y1;
      const sal = t => (x, y) => inside(x, y) && (toSegment(x, y, bx0, y0, bx1, y1) <= t * bh || toSegment(x, y, bx0, y1, bx1, y0) <= t * bh);
      const crs = t => (x, y) => inside(x, y) && (Math.abs(x - (bx0 + bw / 2)) <= t * bh || Math.abs(y - (y0 + bh / 2)) <= t * bh);
      out.push(["N", inside], ["W", sal(3 / 30)], ["R", sal(1 / 30)], ["W", crs(5 / 30)], ["R", crs(3 / 30)]);
    } else throw new Error(`a flag shape I don't know: ${kind}`);
  }
  return out;
}

/** A flag's colour at (u, v), fractions of its width and height: a COLOURS letter, or "_" off the flag. */
export function colourAt(shapes, r, u, v) {
  let c = "_";
  for (const [col, test] of shapes) if (test(u * r, v)) c = col;
  return c;
}

/**
 * A flag as a w×h grid of colour letters: each cell the colour most of its ss×ss samples have (the centre's, when two
 * tie). Returns { letters, crisp } (crisp: how much of each cell, on average, its colour holds: 1 when every edge
 * falls between cells).
 */
export function rasterFlag(flag, w, h, ss = 5) {
  const shapes = painted(flag), letters = [], tally = new Map();
  let held = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    tally.clear();
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) {
      const c = colourAt(shapes, flag.r, (x + (i + 0.5) / ss) / w, (y + (j + 0.5) / ss) / h);
      tally.set(c, (tally.get(c) || 0) + 1);
    }
    const mid = colourAt(shapes, flag.r, (x + 0.5) / w, (y + 0.5) / h);
    let best = mid, n = tally.get(mid) || 0;
    for (const [c, k] of tally) if (k > n) { best = c; n = k; }
    letters.push(best);
    held += n / (ss * ss);
  }
  return { letters, crisp: held / (w * h) };
}
