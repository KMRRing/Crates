// Ingot's Foundry: its levels, each proved by the search on its seed. Written by ingot-plan.mjs, never by hand.
export const CHAPTERS = [
 {
  "id": "apprentice",
  "name": "Apprentice",
  "idea": "Commissions: cast a bar in so many swipes."
 },
 {
  "id": "anvils",
  "name": "Anvils",
  "idea": "Anvils are part of the mould: bars slide up against them, and nothing moves them."
 },
 {
  "id": "hallmarks",
  "name": "Hallmarks",
  "idea": "The bar must be cast on the hallmarked square."
 },
 {
  "id": "slag",
  "name": "Slag",
  "idea": "Lumps of slag are poured now and then: they block a pocket until two bars merged beside them knock them loose."
 },
 {
  "id": "quench",
  "name": "Quench",
  "idea": "Cold squares: a bar standing on one when you swipe is quenched hard, and merges with nothing on that swipe."
 },
 {
  "id": "foundry",
  "name": "The foundry",
  "idea": "Everything at once, on the big mould."
 }
];
export const LEVELS = [
  {"n":1,"id":"first-pour","chapter":"apprentice","name":"First pour","side":4,"goal":{"e":6,"par":37,"swipes":50},"note":"Cast a 64.","seed":2369875378},
  {"n":2,"id":"one-twenty-eight","chapter":"apprentice","name":"A hundred and twenty-eight","side":4,"goal":{"e":7,"par":67,"swipes":85},"note":"Cast a 128.","seed":1716675333},
  {"n":3,"id":"set-bars","chapter":"apprentice","name":"Bars already set","side":4,"start":{"0":5,"1":4,"4":3},"goal":{"e":8,"par":103,"swipes":130},"note":"A 32, a 16 and an 8 are already in the mould: build on them to a 256.","seed":1780074760},
  {"n":4,"id":"two-five-six","chapter":"apprentice","name":"Two hundred and fifty-six","side":4,"goal":{"e":8,"par":133,"swipes":170},"note":"Cast a 256.","seed":752186081},
  {"n":5,"id":"one-anvil","chapter":"anvils","name":"One anvil","side":4,"anvils":[5],"goal":{"e":7,"par":67,"swipes":85},"note":"An anvil in the mould: bars stop against it.","seed":2891144120},
  {"n":6,"id":"two-anvils","chapter":"anvils","name":"Two anvils","side":4,"anvils":[5,10],"goal":{"e":7,"par":102,"swipes":130},"note":"Two anvils across the middle.","seed":1078841953},
  {"n":7,"id":"forge-floor","chapter":"anvils","name":"The forge floor","side":5,"anvils":[0,4,20,24],"goal":{"e":8,"par":134,"swipes":170},"note":"The big mould with its corners filled: no corner to build in.","seed":3497409275},
  {"n":8,"id":"split-mould","chapter":"anvils","name":"A split mould","side":5,"anvils":[2,7,17,22],"goal":{"e":8,"par":172,"swipes":215},"note":"A wall of anvils down the middle, with one gap.","seed":2716179225},
  {"n":9,"id":"corner-mark","chapter":"hallmarks","name":"The corner mark","side":4,"goal":{"e":7,"at":0,"par":70,"swipes":90},"note":"Cast the 128 on the hallmark.","seed":1056009810},
  {"n":10,"id":"edge-mark","chapter":"hallmarks","name":"The edge mark","side":4,"goal":{"e":7,"at":1,"par":75,"swipes":95},"note":"The hallmark is on the edge, beside the corner.","seed":3864732662},
  {"n":11,"id":"mark-anvil","chapter":"hallmarks","name":"Mark by the anvil","side":4,"anvils":[0],"goal":{"e":7,"at":1,"par":66,"swipes":85},"note":"An anvil holds the corner: the hallmark leans on it.","seed":573915795},
  {"n":12,"id":"centre-mark","chapter":"hallmarks","name":"The centre mark","side":5,"anvils":[0,4,20,24],"goal":{"e":7,"at":12,"par":89,"swipes":115},"note":"The hallmark is in the middle of the big mould.","seed":2214598756},
  {"n":13,"id":"every-seventh","chapter":"slag","name":"Every seventh pour","side":4,"slag":7,"goal":{"e":7,"par":78,"swipes":100},"note":"Every seventh pour is a lump of slag.","seed":439713640},
  {"n":14,"id":"every-fifth","chapter":"slag","name":"Every fifth pour","side":4,"slag":5,"goal":{"e":7,"par":87,"swipes":110},"note":"Slag every fifth pour.","seed":3365074872},
  {"n":15,"id":"slag-anvils","chapter":"slag","name":"Slag among anvils","side":5,"anvils":[0,4,20,24],"slag":6,"goal":{"e":8,"par":157,"swipes":200},"note":"Anvils in the corners, slag every sixth pour.","seed":2830852346},
  {"n":16,"id":"slag-mark","chapter":"slag","name":"Slag on the mark","side":4,"slag":7,"goal":{"e":7,"at":15,"par":116,"swipes":145},"note":"Keep the hallmark clear of slag.","seed":126453976},
  {"n":17,"id":"cold-corner","chapter":"quench","name":"A cold corner","side":4,"cold":[0],"goal":{"e":7,"par":72,"swipes":90},"note":"The corner is cold: a bar on it merges with nothing on the swipe that starts there.","seed":1040627951},
  {"n":18,"id":"cold-row","chapter":"quench","name":"A cold row","side":4,"cold":[4,5,6,7],"goal":{"e":7,"par":78,"swipes":100},"note":"A whole row is cold.","seed":2312071514},
  {"n":19,"id":"quench-mark","chapter":"quench","name":"Quench and mark","side":4,"cold":[5,6,9,10],"goal":{"e":7,"at":3,"par":147,"swipes":185},"note":"A cold middle, and the hallmark in a corner.","seed":687912324},
  {"n":20,"id":"cold-edges","chapter":"quench","name":"Cold edges","side":5,"cold":[2,10,14,22],"goal":{"e":8,"par":154,"swipes":195},"note":"The middle of every edge is cold.","seed":3256848260},
  {"n":21,"id":"anvils-frost","chapter":"foundry","name":"Anvils and frost","side":5,"anvils":[6,18],"cold":[12],"goal":{"e":8,"par":153,"swipes":195},"note":"Two anvils and a cold heart.","seed":1769656309},
  {"n":22,"id":"all-at-once","chapter":"foundry","name":"All at once","side":5,"anvils":[0,4,20,24],"slag":7,"cold":[7,17],"goal":{"e":8,"at":12,"par":224,"swipes":280},"note":"Anvils, slag, cold squares and a hallmark in the middle.","seed":2792359984},
  {"n":23,"id":"the-bell","chapter":"foundry","name":"The bell","side":5,"anvils":[0,4],"slag":8,"goal":{"e":9,"par":298,"swipes":375},"note":"A 512, the bell metal.","seed":1219311410},
  {"n":24,"id":"masterwork","chapter":"foundry","name":"Masterwork","side":5,"anvils":[0,4,20,24],"cold":[12],"goal":{"e":9,"at":2,"par":314,"swipes":395},"note":"A 512 on the hallmark, the heart of the mould cold.","seed":706781102}
];
