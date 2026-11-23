// The quays Drift is played on: a mask on a grid. "#" is quay a crate can lie on, "." is water, which no crate can
// enter and a slide stops at. Rows run from the north; the page draws a margin of water round each.
const quays = {
  quay: ["Open quay", ["#######", "#######", "#######", "#######", "#######", "#######", "#######"]],
  hull: ["Ship's hull", ["...#...", "..###..", ".#####.", ".#####.", "#######", "#######", "#######", ".#####.", "..###.."]],
  pier: ["Pier", ["#######", "#######", "..###..", "..###..", "..###..", "..###..", "..###.."]],
  basin: ["Harbour basin", ["###.###", "###.###", "#######", "#######", "#######", ".#####.", "..###.."]],
  eight: ["Figure of eight", ["..###..", ".#####.", ".##.##.", ".#####.", "..###..", ".#####.", ".##.##.", ".#####.", "..###.."]],
  lagoon: ["Lagoon", [".#####.", "#######", "##...##", "##...##", "##...##", "#######", ".#####."]],
  // the campaign's (23 Nov 2026): a small dock to learn a twist on, a cog's round deck, a jetty's T and a Kontor's stepped quayside
  dock: ["Small dock", ["#####", "#####", "#####", "#####", "#####"]],
  cog: ["Cog's deck", ["..###..", ".#####.", "#######", "#######", "#######", ".#####.", "..###.."]],
  jetty: ["Jetty", ["#########", "#########", "...###...", "...###...", "...###..."]],
  kontor: ["Kontor quay", ["###....", "#####..", "#######", "#######", "#######", "..#####", "....###"]],
};
export const SHAPES = Object.fromEntries(Object.entries(quays).map(([id, [name, rows]]) => [id, {
  id, name, rows, w: rows[0].length, h: rows.length,
  open: rows.flatMap(r => [...r].map(ch => ch === "#")),
}]));
export const SHAPE_IDS = Object.keys(SHAPES);
