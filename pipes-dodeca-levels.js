// Pipes on the dodecahedron: the levels (November 2026). A level is where the wellhead (src) and the terminal (term) are, as [tile, side], its rock, its old pipe
// (tile: piece), its stakes (tiles, in order), the hand of pieces to lay (a b x, a count each) and the routes that solve it: the side
// the oil leaves each tile by, as digits, from the wellhead's outlet on. Made by pipes-solid-pick.mjs from pipes-solid-make.js, which keeps rock
// only where the level needs it to have one answer (and old pipe and stakes only where they are needed too), and checked
// by tests/pipes-solid.mjs, which solves every level again and wants those routes and no others.
// A level's id is its identity (stars are kept by it): new levels go at the end of a chapter with a new id.

export const CHAPTERS = [
  { key: "a", name: "Pentagons", rule: "Five sides to every tile: a tight bend joins neighbours, an easy bend skips one." },
  { key: "b", name: "Old pipe", rule: "Old pipe is already in the ground. The oil must run through it." },
  { key: "c", name: "Stakes", rule: "The oil passes the numbered stakes in order." },
];

export const LEVELS = [
  // Pentagons
  { id: "dodeca-a1", name: "Apex", chapter: "a", solid: "dodeca", m: 1, src: [6,2], term: [8,3], rocks: [10,1,0], olds: {}, stakes: [], hand: "a1 b4", sols: ["20140"] },
  { id: "dodeca-a2", name: "Facet", chapter: "a", solid: "dodeca", m: 1, src: [0,4], term: [9,1], rocks: [3,8,6], olds: {}, stakes: [], hand: "a2 b3", sols: ["23200"] },
  { id: "dodeca-a3", name: "Ridge", chapter: "a", solid: "dodeca", m: 1, src: [8,0], term: [11,1], rocks: [5,2], olds: {}, stakes: [], hand: "a3 b3", sols: ["134000"] },
  { id: "dodeca-a4", name: "Crest", chapter: "a", solid: "dodeca", m: 1, src: [9,0], term: [7,3], rocks: [2,1], olds: {}, stakes: [], hand: "a3 b5", sols: ["24313300"] },
  // Old pipe
  { id: "dodeca-b1", name: "Spool", chapter: "b", solid: "dodeca", m: 1, src: [3,0], term: [0,1], rocks: [6], olds: {"1":"b0","10":"b3"}, stakes: [], hand: "a4 b1", sols: ["2332032"] },
  { id: "dodeca-b2", name: "Flange", chapter: "b", solid: "dodeca", m: 1, src: [7,1], term: [2,0], rocks: [], olds: {"10":"b2","11":"a3"}, stakes: [], hand: "a4 b2", sols: ["01433203"] },
  { id: "dodeca-b3", name: "Gasket", chapter: "b", solid: "dodeca", m: 1, src: [7,2], term: [3,3], rocks: [], olds: {"2":"a2","9":"b3"}, stakes: [], hand: "a3 b4", sols: ["433002220"] },
  { id: "dodeca-b4", name: "Coupling", chapter: "b", solid: "dodeca", m: 1, src: [9,2], term: [6,1], rocks: [], olds: {"3":"b2","10":"a4"}, stakes: [], hand: "a4 b3", sols: ["330022334"] },
  // Stakes
  { id: "dodeca-c1", name: "Peg", chapter: "c", solid: "dodeca", m: 1, src: [5,1], term: [3,1], rocks: [0,11], olds: {}, stakes: [6,9], hand: "a3 b4", sols: ["3213022"] },
  { id: "dodeca-c2", name: "Marker", chapter: "c", solid: "dodeca", m: 1, src: [6,3], term: [3,0], rocks: [5], olds: {"4":"b2"}, stakes: [10,2], hand: "a4 b4", sols: ["401113431"] },
  { id: "dodeca-c3", name: "Cairn", chapter: "c", solid: "dodeca", m: 1, src: [8,1], term: [6,1], rocks: [9], olds: {}, stakes: [0,5], hand: "a3 b5", sols: ["24003134"] },
  { id: "dodeca-c4", name: "Bearing", chapter: "c", solid: "dodeca", m: 1, src: [3,2], term: [0,4], rocks: [], olds: {"10":"a2"}, stakes: [8,11], hand: "a4 b4", sols: ["402443321"] },
];
