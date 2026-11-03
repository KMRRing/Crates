// Settle's levels, found by a search (the best plan found for each, replayed by tests/settle.mjs): a tank farm
// dealt from a seed, some parts of the game switched on (rules), a goal of parcels to ship and the pumps to do it in.
// par is the fewest pumps a search found; the plan is its pumps, [slot, tank] (-1: the draw-off, on that tank). Three stars
// for par, two for par and a third more, one for any win within the limit. Each level adds one idea to the ones before.
export const LEVELS = [
{"id":1,"name":"Sink","note":"Ship 3 parcels. A parcel sinks below the lighter ones; three of a grade side by side, at one level, ship out.","seed":100,"parcels":6,"rules":{"deliver":false,"sour":false,"tanker":false,"draw":false},"goal":3,"limit":6,"par":2,"plan":[[0,0],[0,1]]},
{"id":2,"name":"Lift","note":"A parcel lifts the lighter ones above it a level. Use that to line three up.","seed":1100,"parcels":10,"rules":{"deliver":false,"sour":false,"tanker":false,"draw":false},"goal":6,"limit":7,"par":3,"plan":[[0,3],[0,0],[0,2]]},
{"id":3,"name":"Neighbours","note":"A line runs across tanks at one level: put the same grade next to each other.","seed":2101,"parcels":12,"rules":{"deliver":false,"sour":false,"tanker":false,"draw":false},"goal":9,"limit":9,"par":4,"plan":[[0,0],[0,4],[0,0],[0,2]]},
{"id":4,"name":"Second wave","note":"What floated above a shipped line drops, and can line up again: a second wave.","seed":3101,"parcels":14,"rules":{"deliver":false,"sour":false,"tanker":false,"draw":false},"goal":12,"limit":10,"par":5,"plan":[[0,1],[1,2],[1,3],[1,5],[1,4]]},
{"id":5,"name":"Deliveries","note":"A delivery comes in every three pumps. It never makes a line, but it fills a tank.","seed":4104,"parcels":10,"rules":{"deliver":true,"sour":false,"tanker":false,"draw":false},"goal":9,"limit":9,"par":4,"plan":[[0,1],[0,2],[1,2],[1,3]]},
{"id":6,"name":"Full tanks","note":"A ninth parcel spills over the top and costs a life: ship out of a tall tank first.","seed":5102,"parcels":28,"rules":{"deliver":true,"sour":false,"tanker":false,"draw":false},"goal":12,"limit":9,"par":4,"plan":[[0,0],[0,0],[0,0],[0,4]]},
{"id":7,"name":"The tanker","note":"The tanker takes its grade by threes, any other by fours. The water barge takes water.","seed":6100,"parcels":12,"rules":{"deliver":false,"sour":false,"tanker":true,"draw":false},"goal":9,"limit":9,"par":4,"plan":[[0,3],[0,3],[0,1],[0,4]]},
{"id":8,"name":"Next in","note":"The next tanker's grade is shown beside the jetty: build its lines before it berths.","seed":7102,"parcels":12,"rules":{"deliver":true,"sour":false,"tanker":true,"draw":false},"goal":9,"limit":9,"par":4,"plan":[[0,3],[0,0],[0,1],[0,3]]},
{"id":9,"name":"Wet bottoms","note":"FAME standing on water sours into slops, which never ship. Ship it before the count runs out.","seed":8200,"parcels":12,"rules":{"deliver":false,"sour":true,"tanker":false,"draw":false},"goal":9,"limit":10,"par":5,"sour":3,"plan":[[0,1],[0,1],[0,3],[1,2],[1,2]]},
{"id":10,"name":"Souring","note":"Deliveries keep landing FAME on water. Watch the counts on the tanks.","seed":9128,"parcels":12,"rules":{"deliver":true,"sour":true,"tanker":false,"draw":false},"goal":9,"limit":9,"par":4,"sour":3,"plan":[[0,1],[0,1],[1,1],[0,0]]},
{"id":11,"name":"Draw-off","note":"The draw-off drains the water and slops from a tank's foot; what stood on them drops.","seed":10100,"parcels":14,"rules":{"deliver":false,"sour":false,"tanker":false,"draw":true},"goal":9,"limit":10,"par":5,"drawn":true,"plan":[[0,1],[0,1],[0,2],[0,2],[-1,0]]},
{"id":12,"name":"Drain and ship","note":"Drain the water and slops from under FAME before it sours.","seed":11110,"parcels":12,"rules":{"deliver":false,"sour":true,"tanker":false,"draw":true},"goal":9,"limit":9,"par":4,"drawn":true,"sour":3,"plan":[[1,3],[-1,4],[0,3],[0,3]]},
{"id":13,"name":"Tanker and draw-off","note":"Drain a foot so a tanker's grade drops into line.","seed":12112,"parcels":12,"rules":{"deliver":false,"sour":false,"tanker":true,"draw":true},"goal":9,"limit":10,"par":5,"drawn":true,"plan":[[1,1],[1,3],[1,2],[1,2],[-1,4]]},
{"id":14,"name":"The full farm","note":"Everything at once: deliveries, souring, tankers and the draw-off. Ship 14.","seed":50002,"parcels":18,"rules":{"deliver":true,"sour":true,"tanker":true,"draw":true},"goal":14,"limit":25,"par":14,"plan":[[0,0],[0,0],[0,1],[0,0],[0,0],[0,2],[0,0],[0,2],[0,2],[0,1],[-1,0],[0,0],[0,2],[0,1]]},
{"id":15,"name":"Busy jetty","note":"Ship 20. The lines for the next tanker are worth waiting for.","seed":50106,"parcels":20,"rules":{"deliver":true,"sour":true,"tanker":true,"draw":true},"goal":20,"limit":20,"par":11,"plan":[[0,0],[0,3],[0,3],[0,4],[0,1],[0,2],[1,2],[0,0],[1,3],[0,4],[0,0]]},
{"id":16,"name":"Peak season","note":"Ship 28 before the pumps run out.","seed":50200,"parcels":22,"rules":{"deliver":true,"sour":true,"tanker":true,"draw":true},"goal":28,"limit":33,"par":19,"plan":[[0,4],[1,2],[0,1],[0,3],[0,0],[0,3],[0,1],[0,3],[0,0],[0,2],[-1,5],[0,1],[0,1],[1,3],[1,3],[1,2],[1,5],[0,2],[0,3]]},
];
/** A level by its number. */
export const levelOf = id => LEVELS.find(l => l.id === id);
/** Stars for a win in pumps: three at par, two within a third more (two pumps at least), else one. */
export const starsFor = (level, pumps) => (pumps <= level.par ? 3 : pumps <= level.par + Math.max(2, Math.ceil(level.par / 3)) ? 2 : 1);
/** A level is open once the one before has a star; the first always. */
export const isOpen = (id, done) => id === 1 || (done[id - 1]?.stars || 0) > 0 || (done[id]?.stars || 0) > 0;
