// Beacon's words (party-beacon.js): the 25 on a board come from here, and so do the clues the computer gives and the
// meaning it reads into yours. Each line is a word of Echo's or the drawing games' lists (party-echo-words.js,
// party-draw-words.js: tests/party-beacon.mjs checks it) and, after the colon, what it makes people think of, the
// likeliest first, one word each. Written for this game; the clue words are shared between lines on purpose (pet is
// on cat, dog and rabbit), because a clue that reaches two or three cards is what makes the game. British spelling.
const LINES = `
cat: pet kitten purr whisker mouse claw feline milk nine
dog: pet puppy bark bone lead wolf fetch loyal walk
panda: bamboo bear china black white zoo rare
tiger: stripes jungle cat fierce orange india roar
lion: mane king roar pride africa savannah brave jungle
elephant: trunk tusk africa ivory memory huge grey zoo circus
giraffe: neck tall spots africa savannah zoo
monkey: banana ape climb tree jungle tail zoo cheeky
rabbit: bunny carrot hop ears easter hare burrow fur pet
horse: ride gallop saddle stable race hoof mane farm cavalry
cow: milk farm beef moo cattle grass dairy field
pig: farm pork bacon oink mud sty swine
sheep: wool lamb flock farm baa shepherd mutton
chicken: egg hen farm cluck coop roast feathers nuggets
duck: quack pond waddle feathers bill swim egg bird
penguin: ice antarctica waddle cold tuxedo flightless bird
dolphin: sea porpoise flipper swim clever smile mammal
whale: sea blue ocean huge blubber mammal harpoon spout
shark: fin jaws teeth sea predator fish bite
octopus: tentacles eight ink sea arms
crab: claw pincers shell sideways beach seafood sea
snake: venom hiss slither fangs scales cobra python viper
frog: pond hop toad prince croak green tadpole amphibian
turtle: shell slow tortoise sea shell green
owl: night wise hoot feathers bird barn
eagle: bird talon soar america prey wings
parrot: bird talk colourful pirate feathers tropical
bat: cave night wings vampire cricket baseball fly
spider: web eight legs insect arachnid silk
bee: honey buzz sting hive wasp wings queen
butterfly: wings caterpillar insect colourful flutter moth
ant: colony insect tiny army queen march
mosquito: bite malaria buzz insect blood itch
kangaroo: australia pouch hop joey outback
camel: desert hump sahara caravan sand dromedary
zebra: stripes crossing africa horse savannah
wolf: pack howl wild moon fang dog sheep
fox: red cunning sly hunt fur tail
bear: honey grizzly polar cub hibernate fur panda
mouse: cheese cat computer squeak tiny rodent click
snail: shell slow slime garden escargot
crocodile: swamp teeth snout nile reptile alligator
squirrel: nut acorn tree tail bushy
koala: australia eucalyptus bear tree sleep
fish: swim sea fin scales chips gills bait net
bird: wings fly feathers nest beak song
jellyfish: sting sea tentacles blob ocean
hedgehog: spikes prickly garden hibernate sonic
deer: antlers stag forest fawn bambi venison
swan: lake white graceful ballet bird cygnet
hippo: river africa huge mud water
flamingo: pink bird leg lake tropical
rhinoceros: horn africa thick huge
sloth: slow lazy tree sin
lobster: claw red seafood sea pot
worm: earth soil garden bait wriggle
scorpion: sting tail desert venom
peacock: feathers tail proud blue
goldfish: bowl pet fish orange
apple: fruit red tree pie newton core cider
banana: fruit yellow peel monkey bunch split
orange: fruit juice citrus colour peel vitamin
watermelon: fruit summer seeds green slice
strawberry: fruit red cream jam summer
lemon: sour yellow citrus juice fruit tart
pineapple: tropical fruit spiky hawaii pizza
mango: tropical fruit india juicy
rice: asian grain paddy white wedding sushi
noodles: asian soup pasta chinese slurp
bread: loaf toast bake flour butter slice
cake: birthday sweet bake cream icing slice
chocolate: sweet cocoa bar brown candy
cheese: dairy mouse milk cheddar pizza mould
egg: shell yolk breakfast chicken easter boil
milk: dairy cow white drink calcium
coffee: caffeine bean espresso morning latte cup
tea: leaves cup britain green herbal kettle
beer: pub pint hops lager german barley bar
wine: grapes red vineyard glass cellar france
pizza: italy cheese slice delivery dough
hamburger: bun beef patty fast food chips
sushi: japan raw fish rice seaweed
soup: bowl spoon broth hot starter
salt: pepper sea seasoning mine shaker
sugar: sweet cane cube spoon candy
honey: bee sweet comb hive sticky
popcorn: cinema corn butter kernel snack
sandwich: bread lunch filling picnic ham
garlic: vampire bulb clove breath smelly
potato: chips mash spud crisps root
tomato: red ketchup sauce salad fruit
carrot: orange rabbit root vegetable crunchy
mushroom: fungus toadstool spore forest
corn: maize cob kernel yellow field
peanut: nut butter allergy shell snack
biscuit: cookie tea dunk crumb sweet
steak: beef rare grill meat medium
salad: lettuce green healthy dressing leaf
butter: dairy spread toast cream yellow
coconut: tropical palm milk shell island
cherry: red stone pie cocktail blossom
peach: fruit fuzzy stone juicy pink
pancake: flat batter syrup breakfast flip
sausage: pork grill sizzle hot dog link
vinegar: sour pickle chips acid
ketchup: tomato red sauce bottle chips
pear: fruit green shaped juicy
onion: tears layers cry bulb peel
chips: fries fish potato crisps casino
spaghetti: pasta italy sauce noodles twirl
avocado: green guacamole toast stone
broccoli: green vegetable tree healthy
croissant: french pastry crescent butter breakfast
cocktail: bar mixed drink party shaker
champagne: bubbles fizz france celebration cork
grapes: wine vine fruit raisin bunch
phone: call mobile ring screen text
computer: screen keyboard mouse laptop code
key: lock door piano unlock turn
umbrella: rain wet handle open cover
clock: time tick hands alarm tower
watch: wrist time strap look swiss
glasses: lenses eyes spectacles see frames
camera: photo lens flash picture film
mirror: reflection glass face look
chair: seat sit leg table
table: chair dinner leg wood desk
bed: sleep mattress pillow night
pillow: soft sleep bed fight feather
lamp: light bulb shade desk
candle: wax flame wick light birthday
book: read pages library novel cover
pen: ink write pencil paper
pencil: lead write sharpen draw eraser
scissors: cut snip paper blades
hammer: nail tool thor hit smash
ladder: climb rung steps rope
rope: tie knot pull climb string
bottle: glass cork drink neck
cup: tea mug handle drink trophy
knife: cut sharp blade stab kitchen
spoon: soup stir fork cutlery
plate: dish dinner flat china
fridge: cold kitchen food freezer cool
television: screen watch remote channel
guitar: strings strum rock music acoustic
piano: keys music grand notes
drum: beat band sticks kit
violin: strings bow orchestra fiddle
ball: round kick bounce sport dance
kite: wind string fly bird
balloon: air helium party float pop
wallet: money purse leather pocket
money: cash bank rich pay coin
coin: money penny metal toss flip
ticket: pass entry train cinema
map: atlas route treasure chart
flag: nation country pole banner
crown: king queen royal jewels gold
ring: wedding finger bell diamond circle
necklace: jewel chain neck pearls
hat: head cap brim wear
shoe: foot lace sole wear
sock: foot pair wool wear
glove: hand boxing winter leather
scarf: neck wool winter wrap
tie: knot necktie draw suit
dress: gown wear skirt wedding
suitcase: luggage travel holiday pack
backpack: school hiker straps bag
toothbrush: teeth brush paste bathroom
soap: wash bath bubbles clean opera
towel: dry bath beach wet
bell: ring church chime tower
fan: breeze cool wind supporter
sofa: couch lounge sit cushion
window: glass pane view house
door: handle knock open house
stairs: steps climb floor
battery: power charge flat cell
magnet: attract north iron metal
needle: thread sharp sew haystack
button: press shirt sew push
envelope: letter post stamp seal
newspaper: news print daily headline
calendar: date month year diary
dice: roll six casino game
puzzle: jigsaw piece riddle solve
fork: cutlery eat prongs road
bowl: cereal soup bowling dish
bath: tub soak water bubbles
toilet: loo bathroom flush seat
oven: bake hot kitchen cook
kettle: boil tea steam whistle
broom: sweep witch brush
comb: hair teeth brush
curtains: window drape theatre close
tap: water drip sink dance
shower: rain wash bath water
iron: press clothes metal steam
lock: key door secure bolt
torch: light flame battery beam
laptop: computer portable screen work
keyboard: keys type piano computer
doll: toy barbie girl puppet
hourglass: sand time sands minutes
anchor: ship chain sea heavy
bucket: pail water spade bin
telescope: stars space lens look
compass: north needle direction map
chain: link metal bike necklace
glue: stick paste sticky
ruler: measure king centimetre straight
stamp: post letter collector licker
saw: cut wood teeth blade
nail: hammer finger metal polish
present: gift wrapped birthday now
mask: face hide disguise carnival
barrel: oil wine beer keg
calculator: sums maths numbers digits
safe: vault lock secure box
briefcase: office business bag
belt: waist buckle trousers leather
boots: wellington walking leather kick
jacket: coat zip warm
helmet: head safety bike knight
wig: hair fake judge
trousers: legs pants wear
skirt: dress waist wear
shorts: legs summer short
gloves: hands boxing winter
bikini: beach swimsuit summer
handbag: purse lady bag
lipstick: red makeup lips
pyjamas: night bed sleep
slippers: feet bed indoor
hoodie: jumper hood warm
beach: sand sea sun holiday
mountain: peak climb snow high
island: sea desert palm isolated
desert: sand dry camel sahara
forest: trees woods wild green
river: water flow bank stream
lake: water still swim loch
ocean: sea deep waves atlantic
volcano: lava erupt ash mountain
cave: dark bats underground rock
city: urban town capital skyscraper
village: small rural church hamlet
school: pupils teacher class learn
hospital: doctor nurse ill ward
airport: planes flight terminal runway
station: train platform railway
library: books quiet borrow shelves
museum: exhibits history art gallery
zoo: animals cage keeper
park: bench swing trees
church: priest bell holy wedding
temple: holy shrine monk worship
castle: king moat tower knight
palace: king queen royal buckingham
prison: jail cell guard escape
bank: money vault loan river
restaurant: menu waiter dinner chef
hotel: room stay guest reception
kitchen: cook oven chef fridge
garden: flowers lawn plants grow
farm: cow tractor field barn
market: stalls buy trade stock
cinema: film popcorn screen movie
stadium: football crowd pitch arena
bridge: river span cards cross
tower: tall castle clock high
pyramid: egypt pharaoh tomb triangle
paris: france eiffel tower capital
antarctica: ice penguin pole cold
moon: night lunar crater space
casino: gamble cards chips dice
gym: weights muscles fitness
lift: elevator up floor
harbour: ship port boat sea
factory: plant production workers assembly
jungle: trees tiger wild tropical
circus: clown tent elephant acrobat
graveyard: grave ghost cemetery
lighthouse: beam coast ship rocks
skyscraper: tall city tower
tent: camp canvas pitch
igloo: ice eskimo snow
windmill: sails wind dutch grain
house: home roof door
sea: waves salt blue ocean
dam: water river wall reservoir
mine: coal gold dig shaft
office: desk work boss computer
warehouse: store goods stock shelves
refinery: oil crude petrol plant
silo: grain farm storage missile
sun: hot day sunshine star
star: sky night celebrity twinkle
cloud: rain sky grey fluffy
rain: wet storm umbrella drops
snow: white winter cold flakes
wind: breeze gale blow air
storm: thunder rain lightning
rainbow: colours rain arch
lightning: thunder storm bolt flash
fire: flame burn hot smoke
ice: cold frozen cube rink
tree: leaves wood branch trunk
flower: petals bloom garden rose
rose: red thorn flower love
grass: lawn green field blade
leaf: tree green autumn page
stone: rock pebble heavy
sand: beach desert dune grains
gold: yellow rich medal bar
diamond: ring gem jewel hard
sky: blue clouds heaven
planet: earth mars orbit space
comet: tail halley space
earth: planet soil world ground
spring: season coil bounce water
winter: cold snow season christmas
bamboo: panda china stick
waterfall: cliff water falls
fog: mist mist cloud grey
wave: sea surf hello ocean
cactus: desert prickly spikes
tornado: twister storm wind
rock: stone music boulder
shell: sea beach snail egg
sunset: evening dusk sun red
feather: bird light tickle quill
nest: bird egg home
iceberg: titanic ice sea
eclipse: sun moon shadow
coral: reef sea pink
lotus: flower pond buddha
sunflower: yellow seeds tall
coal: black mine fuel
acorn: oak nut squirrel
doctor: medicine hospital ill nurse
nurse: hospital ward care
teacher: school class pupils
chef: cook kitchen restaurant
pilot: plane fly cockpit
farmer: field crops tractor
soldier: army war uniform
king: crown royal throne
queen: crown royal bee
prince: royal charming frog
princess: royal castle tiara
pirate: ship treasure parrot
ninja: japan stealth black
wizard: magic spell wand
witch: broom spell cauldron
ghost: haunt spirit boo
vampire: blood fangs bat
robot: machine metal android
alien: space ufo martian
clown: circus nose funny
astronaut: space moon rocket
detective: crime clue sherlock
thief: steal robber burglar
judge: court law jury
lawyer: court law legal
singer: song voice band
dancer: ballet stage move
painter: art brush canvas
baby: infant cry nappy
bride: wedding groom white
twins: pair double identical
monk: temple robe prayer
emperor: ruler empire rome
mermaid: sea tail siren
spy: secret agent bond
dentist: teeth drill
waiter: restaurant serve tip
postman: letters mail post
boss: manager chief work
cowboy: horse west lasso
magician: magic trick wand
diver: sea dive scuba
builder: house construct brick
lifeguard: beach swim rescue
troll: bridge goblin internet
elf: santa christmas pointy
genie: lamp wish bottle
angel: wings halo heaven
devil: hell horns evil
giant: huge tall beanstalk
dragon: fire wings knight
dinosaur: extinct fossil reptile
unicorn: horn horse myth
monster: scary beast loch
zombie: undead brains walking
mummy: egypt wrapped tomb
fairy: wings wand tale
phoenix: fire bird ashes
centaur: horse half myth
car: drive road engine
bus: passengers stop public
train: rail station track
aeroplane: fly jet airport
ship: boat sea sail
bicycle: pedal wheel ride
taxi: cab fare driver
helicopter: blades fly rotor
rocket: space launch fuel
submarine: underwater periscope navy
tractor: farm field wheels
lorry: truck freight road
ambulance: emergency hospital siren
tram: rail street cable
parachute: jump skydive silk
boat: sail water row
ferry: crossing boat passengers
canoe: paddle river
gondola: venice canal
scooter: vespa moped ride
tank: army war water
tanker: oil ship fuel
eye: see iris look
ear: hear listen lobe
nose: smell sniff nostril
mouth: lips teeth talk
tooth: dentist bite molar
hair: comb brush scalp
hand: finger palm wave
foot: toes shoe heel
heart: love beat organ
brain: mind think smart
bone: skeleton skull dog
blood: red vein vampire
finger: hand thumb nail
knee: leg joint
beard: chin hair face
skeleton: bones skull dead
tongue: mouth taste language
shoulder: arm neck
neck: head throat giraffe
skull: head bone pirate
stomach: belly food hungry
arm: hand elbow limb
leg: knee foot limb
thumb: finger hitchhiker
elbow: arm joint
football: soccer goal pitch
basketball: hoop dunk court
tennis: racket court serve
golf: club hole green
boxing: ring gloves punch
skiing: snow slopes alps
chess: king queen board
yoga: stretch calm mat
marathon: run race long
goal: score net football
referee: whistle match rules
medal: gold winner olympics
trophy: cup winner prize
cards: deck poker shuffle
baseball: bat pitch america
bowling: pins alley strike
darts: board bullseye pub
archery: bow arrow target
cricket: bat wicket england
volleyball: net beach spike
snooker: cue table pot
swing: playground sway park
slide: playground park
seesaw: playground balance
trumpet: brass jazz band
microphone: sing speak stage
headphones: music listen ears
harp: strings angel
radio: music broadcast waves
whistle: referee blow
saxophone: jazz brass
flute: music wind
accordion: squeeze music
cello: strings orchestra
gong: bang china
conductor: orchestra baton
choir: sing church
concert: music live stage
band: music rock group
birthday: cake candles party
wedding: bride groom marry
party: fun dance celebrate
holiday: vacation beach break
film: movie cinema
photo: picture camera
letter: post alphabet
secret: hidden spy
love: heart romance
war: army battle
peace: calm dove
time: clock hour
magic: wand spell trick
luck: fortune lucky
fear: scared afraid
kiss: lips love
race: speed run
exam: test school
news: paper headline
internet: web online
password: secret login
email: inbox send
fireworks: bang night rockets
christmas: santa tree december
lantern: light lamp chinese
pumpkin: halloween orange
confetti: party wedding
wreath: christmas door
reindeer: santa sleigh
bonfire: night fire
graduation: gown degree
halloween: october pumpkin
oil: crude petrol barrel
container: box ship
diesel: fuel engine
salary: pay wages
tax: duty revenue
contract: deal agreement
bitcoin: crypto digital
dollar: money america
pipeline: oil gas
forklift: warehouse pallet
scales: weight balance
sword: blade knight
shield: defend knight
bow: arrow archer
cannon: ball ship
bomb: explode blast
treasure: pirate gold
heaven: angel clouds
spaceship: alien space
ufo: alien saucer
passport: travel visa border abroad stamp
`;

// The other way round: a clue word and the words on the board it reaches, for the clues that cover many (animal,
// kitchen, royal). Each member is a word of the lines above.
const GROUP_LINES = `
animal: cat dog panda tiger lion elephant giraffe monkey rabbit horse cow pig sheep chicken duck penguin dolphin whale shark octopus crab snake frog turtle owl eagle parrot bat spider bee butterfly ant mosquito kangaroo camel zebra wolf fox bear mouse snail crocodile squirrel koala fish bird jellyfish hedgehog deer swan hippo flamingo rhinoceros sloth lobster worm scorpion peacock goldfish
wild: tiger lion elephant giraffe monkey wolf fox bear zebra crocodile jungle forest eagle
pet: cat dog rabbit goldfish mouse parrot fish snake
farm: cow pig sheep chicken horse duck farmer tractor corn barrel
sea: whale shark dolphin octopus crab turtle jellyfish lobster fish ship anchor beach harbour wave coral submarine lighthouse pirate mermaid island ocean
swim: fish shark dolphin whale duck swan frog turtle bath lake river diver lifeguard
bird: eagle owl parrot duck swan flamingo peacock chicken penguin feather nest egg
insect: bee ant butterfly mosquito spider worm
reptile: snake crocodile turtle dinosaur
mammal: cat dog tiger lion elephant giraffe monkey rabbit horse cow pig sheep dolphin whale bear wolf fox bat mouse squirrel deer hippo
fruit: apple banana orange watermelon strawberry lemon pineapple mango cherry peach pear grapes coconut tomato avocado
vegetable: potato tomato carrot mushroom corn garlic onion broccoli salad
sweet: sugar honey chocolate cake cherry strawberry biscuit pancake mango
food: pizza hamburger sushi soup bread cake cheese egg rice noodles sandwich steak salad sausage spaghetti chips
drink: beer wine tea coffee milk cocktail champagne bottle cup
dairy: milk cheese butter cow
meat: steak sausage chicken pig hamburger
breakfast: egg bread coffee tea pancake croissant butter honey
bake: bread cake oven biscuit pancake croissant
kitchen: oven fridge kettle knife spoon plate fork bowl chef
cutlery: knife spoon fork plate bowl
furniture: chair table bed sofa lamp
bedroom: bed pillow lamp mirror
bathroom: bath toilet soap towel shower toothbrush tap mirror comb
tool: hammer saw nail ladder rope glue ruler needle
sharp: knife scissors needle sword saw nail
metal: iron coin chain key nail tank anchor
sound: bell drum whistle radio microphone gong
write: pen pencil book letter ruler
paper: book newspaper envelope letter map ticket calendar
office: computer laptop keyboard phone pen boss briefcase calculator
tech: phone computer laptop keyboard battery camera television
time: clock watch hourglass calendar
light: lamp candle torch sun lighthouse lantern
cold: ice snow fridge penguin winter igloo iceberg antarctica
hot: sun fire oven desert volcano kettle
water: sea river lake ocean rain waterfall bath shower tap bucket dam
weather: rain snow wind storm cloud lightning rainbow fog tornado
sky: sun moon star cloud rainbow comet planet kite bird
space: moon star planet comet rocket astronaut alien ufo spaceship telescope earth sun
night: moon star owl bat ghost vampire candle lamp bed
tree: leaf nest acorn squirrel owl forest
flower: rose sunflower lotus garden bee butterfly
garden: flower grass rose bucket worm snail hedgehog
building: house castle palace church temple tower skyscraper hospital school hotel factory
place: beach mountain island desert forest river lake ocean volcano cave city village park
shop: market bank restaurant cinema hotel
travel: suitcase backpack aeroplane airport taxi train ship compass map passport ticket
vehicle: car bus train aeroplane ship bicycle taxi helicopter rocket submarine tractor lorry ambulance tram boat ferry canoe gondola scooter tank
fly: aeroplane helicopter rocket parachute kite balloon bird bat bee butterfly eagle owl
road: car bus taxi lorry bicycle scooter tractor ambulance
wheel: car bus bicycle scooter tractor lorry tram
royal: king queen prince princess crown palace castle emperor
magic: wizard witch fairy genie magician unicorn dragon
spooky: ghost vampire zombie mummy skeleton graveyard devil monster witch bat spider halloween pumpkin
myth: dragon unicorn phoenix centaur troll elf fairy genie giant mermaid angel devil
crime: thief detective judge prison lawyer spy
law: judge lawyer prison contract tax
medical: doctor nurse hospital ambulance dentist tooth
school: teacher exam book pencil ruler library
job: doctor nurse teacher chef pilot farmer soldier builder boss waiter postman lifeguard dentist
army: soldier tank cannon bomb sword shield bow war
weapon: sword shield bow cannon bomb knife
sport: football basketball tennis golf boxing skiing chess yoga marathon baseball bowling darts archery cricket volleyball snooker
ball: football basketball tennis golf baseball bowling volleyball cricket snooker ball
team: football basketball baseball cricket volleyball referee goal
win: medal trophy race goal
game: chess cards dice puzzle darts snooker casino
gamble: casino dice cards chips luck
music: guitar piano drum violin trumpet harp saxophone flute accordion cello band choir concert conductor radio
string: guitar violin harp cello rope
brass: trumpet saxophone gong bell
party: balloon cake birthday champagne present confetti fireworks cocktail
wedding: ring bride dress cake champagne confetti
christmas: reindeer wreath present tree elf candle bell
body: eye ear nose mouth tooth hair hand foot heart brain bone blood finger knee beard skeleton tongue shoulder neck skull stomach arm leg thumb elbow
face: eye ear nose mouth tooth hair beard tongue mask glasses
head: hat helmet wig brain hair skull crown eye ear nose
clothes: hat shoe sock glove scarf tie dress trousers skirt shorts jacket boots belt pyjamas hoodie bikini gloves
jewellery: ring necklace crown diamond gold
money: bank coin wallet dollar bitcoin salary tax safe gold casino
rich: gold diamond bank safe crown treasure
fuel: oil diesel tanker refinery barrel pipeline coal
energy: oil diesel battery coal sun wind fire
industry: factory mine warehouse container forklift refinery silo
cargo: ship container tanker harbour warehouse lorry forklift
pirate: ship treasure parrot anchor sword map skull compass
`;

/** Every word's associates, likeliest first: word → [clue word…]. */
export const ASSOC = new Map(LINES.trim().split("\n").map(l => { const [w, rest] = l.split(": "); return [w, [...new Set(rest.split(" "))]]; }));
/** The words a board is dealt from. */
export const POOL = [...ASSOC.keys()];
/** Clue word → the words on the board it reaches. */
export const GROUPS = new Map(GROUP_LINES.trim().split("\n").map(l => { const [hub, rest] = l.split(": "); return [hub, [...new Set(rest.split(" "))]]; }));
