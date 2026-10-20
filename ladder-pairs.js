// Ladders with a link between their two words (README, Ladder): Carroll's own doublets, Kinbote's word golf, and pairs
// chosen for what joins them, each with its line in Carroll's manner. tests/ladder.mjs plays every one: each has a
// ladder by its rules, at par in words a person knows (Carroll's in words of his day, SCOWL 50).

// Lewis Carroll's Doublets (Macmillan, 1879), in the book's order and his words, the ladder running from the word
// the line starts from. Seven of his thirty-eight are left out: ROGUE to BEAST, ELM to OAK, HARE to SOUP, PITCH to
// TENTS, PITY to GOOD and EEL to PIE need words nobody uses now (BEAUT, OIK, SOUK, TENCH, POOS, PEE), and BUY an ASS
// a word the word list leaves out. HEAD to TAIL, the example his rules were written round, comes first.
export const CARROLL = [
  ["head", "tail", "Turn HEAD into TAIL"],
  ["pig", "sty", "Drive PIG into STY"],
  ["flour", "bread", "Make FLOUR into BREAD"],
  ["four", "five", "Raise FOUR to FIVE"],
  ["tea", "hot", "Make TEA HOT"],
  ["wheat", "bread", "Make WHEAT into BREAD"],
  ["comb", "hair", "Run COMB into HAIR"],
  ["pen", "ink", "Dip PEN into INK"],
  ["chin", "nose", "Touch CHIN with NOSE"],
  ["wet", "dry", "Change WET to DRY"],
  ["army", "navy", "Combine ARMY and NAVY"],
  ["beans", "shelf", "Place BEANS on SHELF"],
  ["hook", "fish", "HOOK FISH"],
  ["eye", "lid", "Cover EYE with LID"],
  ["quell", "bravo", "QUELL a BRAVO"],
  ["furies", "barrel", "Stow FURIES in a BARREL"],
  ["steal", "coins", "STEAL COINS"],
  ["mine", "coal", "Get COAL from MINE"],
  ["poor", "rich", "Turn POOR into RICH"],
  ["costs", "pence", "Pay COSTS in PENCE"],
  ["raven", "miser", "Prove RAVEN to be a MISER"],
  ["one", "two", "Raise ONE to TWO"],
  ["oat", "rye", "Change OAT to RYE"],
  ["blue", "pink", "Change BLUE to PINK"],
  ["tree", "wood", "Get WOOD from TREE"],
  ["black", "white", "Change BLACK to WHITE"],
  ["grass", "green", "Prove GRASS to be GREEN"],
  ["fish", "bird", "Change FISH to BIRD"],
  ["ape", "man", "Evolve MAN from APE"],
  ["shoes", "crust", "Sell SHOES for CRUST"],
  ["cain", "abel", "Change CAIN into ABEL"],
  ["kettle", "holder", "Make KETTLE HOLDER"],
].map(([a, b, say]) => ({ a, b, say, by: "Carroll, 1879" }));

// Word golf, as Nabokov named it in Pale Fire (1962), where Kinbote gives his records: hate to love in three, lass to
// male in four, and live to dead in five, with lend in the middle. The first two are par; the third can't be done in
// five through any word of the widest list (it takes six, through LEND as he says), which is either a slip or Kinbote.
export const KINBOTE = [
  ["hate", "love", "Hate to love, in three"],
  ["lass", "male", "Lass to male, in four"],
  ["live", "dead", "Live to dead, in five, lend in the middle"],
].map(([a, b, say]) => ({ a, b, say, by: "Kinbote, Pale Fire" }));

// The book: Carroll's, then Kinbote's, played in order (a chapter each).
export const BOOK = [...CARROLL, ...KINBOTE];

export const THEMES = { opposites: "Opposites", trade: "Trade", farm: "Food & farm", nature: "Nature", creatures: "Creatures", play: "Life & play" };

// Pairs of one length, for Classic (and Grow and shrink, where par may be shorter).
const SAME = {
  opposites: [
    ["cold", "warm", "Turn COLD to WARM"], ["rise", "fall", "Bring RISE to FALL"], ["give", "take", "Turn GIVE into TAKE"],
    ["push", "pull", "Change PUSH to PULL"], ["hard", "soft", "Make HARD SOFT"], ["fast", "slow", "Turn FAST to SLOW"],
    ["wild", "tame", "Make WILD TAME"], ["pass", "fail", "Turn PASS into FAIL"], ["sink", "swim", "SINK or SWIM"],
    ["loss", "gain", "Turn LOSS into GAIN"], ["dawn", "dusk", "Take DAWN to DUSK"], ["east", "west", "Go from EAST to WEST"],
    ["wise", "fool", "Make the WISE a FOOL"], ["fool", "sage", "Make a FOOL a SAGE"], ["sick", "well", "Make SICK WELL"],
    ["ill", "fit", "Get from ILL to FIT"], ["weak", "firm", "Make WEAK FIRM"], ["nice", "rude", "Turn NICE to RUDE"],
    ["fact", "myth", "Turn FACT into MYTH"], ["true", "lies", "Turn TRUE into LIES"], ["heat", "cool", "Let HEAT COOL"],
    ["born", "dead", "From BORN to DEAD"], ["hate", "like", "Turn HATE to LIKE"], ["home", "away", "From HOME to AWAY"],
    ["tied", "lost", "From TIED to LOST"], ["sword", "peace", "Beat a SWORD into PEACE"],
  ],
  trade: [
    ["bull", "bear", "Turn a BULL into a BEAR"], ["bid", "ask", "Close the BID to the ASK"], ["boom", "bust", "Ride BOOM to BUST"],
    ["loan", "debt", "Turn a LOAN into DEBT"], ["cash", "debt", "Trade CASH for DEBT"], ["bond", "loan", "Swap a BOND for a LOAN"],
    ["coin", "bank", "Put a COIN in the BANK"], ["cash", "bank", "Take CASH to the BANK"], ["gold", "coin", "Strike GOLD into a COIN"],
    ["spot", "term", "Roll SPOT into TERM"], ["spot", "swap", "Turn SPOT into a SWAP"], ["long", "flat", "Take a LONG to FLAT"],
    ["stock", "share", "Split STOCK into a SHARE"], ["share", "price", "Put a SHARE to its PRICE"], ["risk", "safe", "Take RISK to SAFE"],
    ["ship", "port", "Bring SHIP into PORT"], ["dock", "ship", "Load the SHIP at the DOCK"], ["tide", "port", "Ride the TIDE into PORT"],
    ["tank", "fuel", "Fill a TANK with FUEL"], ["corn", "fuel", "Turn CORN into FUEL"], ["cane", "fuel", "Turn CANE into FUEL"],
    ["fat", "oil", "Render FAT into OIL"], ["oil", "gas", "Crack OIL into GAS"], ["coal", "coke", "Bake COAL into COKE"],
    ["lead", "gold", "Turn LEAD into GOLD"], ["mine", "gold", "Sink a MINE for GOLD"], ["nut", "oil", "Press a NUT for OIL"],
  ],
  farm: [
    ["corn", "meal", "Grind CORN into MEAL"], ["milk", "curd", "Turn MILK to CURD"], ["malt", "beer", "Brew MALT into BEER"],
    ["wool", "yarn", "Spin WOOL into YARN"], ["wheat", "flour", "Mill WHEAT into FLOUR"], ["grain", "bread", "Bake GRAIN into BREAD"],
    ["seed", "tree", "Grow a SEED into a TREE"], ["seed", "corn", "Grow SEED into CORN"], ["seed", "soil", "Sow SEED in SOIL"],
    ["soil", "crop", "Raise a CROP from SOIL"], ["farm", "food", "From FARM to FOOD"], ["bake", "cook", "BAKE or COOK"],
    ["meat", "stew", "Make MEAT into STEW"], ["fish", "chip", "Serve a FISH with a CHIP"], ["rice", "cake", "Make RICE into CAKE"],
    ["bean", "soup", "Make a BEAN into SOUP"], ["tea", "cup", "Pour TEA into a CUP"], ["rum", "gin", "Swap RUM for GIN"],
    ["cork", "wine", "Draw a CORK from the WINE"], ["palm", "date", "Pick a DATE from a PALM"], ["oats", "meal", "Grind OATS into MEAL"],
    ["mud", "pie", "Make MUD into PIE"],
  ],
  nature: [
    ["rain", "snow", "Turn RAIN to SNOW"], ["mist", "rain", "Thicken MIST to RAIN"], ["snow", "melt", "Let the SNOW MELT"],
    ["tide", "moon", "Tie the TIDE to the MOON"], ["moon", "star", "From MOON to STAR"], ["sea", "bay", "From SEA to BAY"],
    ["wave", "sand", "Break a WAVE on SAND"], ["sand", "dune", "Heap SAND into a DUNE"], ["rock", "sand", "Grind ROCK into SAND"],
    ["hill", "dale", "Over HILL and DALE"], ["leaf", "tree", "Hang a LEAF on a TREE"], ["root", "tree", "From ROOT to TREE"],
    ["sun", "day", "Let the SUN make DAY"], ["day", "eve", "Turn DAY into EVE"], ["year", "week", "Make a YEAR a WEEK"],
    ["hour", "time", "Pass an HOUR of TIME"], ["calm", "wind", "Stir CALM into WIND"], ["coal", "fire", "Set COAL on FIRE"],
    ["fuel", "fire", "Feed FUEL to the FIRE"],
  ],
  creatures: [
    ["cat", "dog", "Chase a CAT with a DOG"], ["fox", "hen", "Set the FOX on the HEN"], ["colt", "mare", "Grow a COLT into a MARE"],
    ["duck", "swan", "Turn a DUCK into a SWAN"], ["worm", "bird", "Feed a WORM to a BIRD"], ["bird", "nest", "Bring a BIRD to its NEST"],
    ["moth", "lamp", "Draw a MOTH to a LAMP"], ["crow", "dove", "Make a CROW a DOVE"], ["hawk", "dove", "Turn HAWK to DOVE"],
  ],
  play: [
    ["word", "game", "Play a WORD GAME"], ["bell", "ring", "Make a BELL RING"], ["head", "foot", "From HEAD to FOOT"],
    ["hand", "foot", "Wait HAND and FOOT"], ["face", "mask", "Hide a FACE with a MASK"], ["pawn", "king", "Take a PAWN to a KING"],
    ["tune", "song", "Make a TUNE a SONG"], ["note", "song", "Make a NOTE a SONG"], ["harp", "lyre", "Swap a HARP for a LYRE"],
    ["card", "deck", "Put a CARD in the DECK"], ["dice", "roll", "Let the DICE ROLL"], ["game", "over", "Call GAME OVER"],
    ["spy", "lie", "Make a SPY LIE"], ["wash", "dirt", "WASH off the DIRT"], ["boat", "dock", "Bring a BOAT to DOCK"],
    ["hut", "inn", "From HUT to INN"], ["swim", "dive", "From SWIM to DIVE"], ["soap", "suds", "Work SOAP into SUDS"],
    ["boy", "man", "Make a BOY a MAN"], ["mum", "dad", "From MUM to DAD"], ["kiss", "love", "Turn a KISS to LOVE"],
    ["bride", "groom", "Wed BRIDE to GROOM"],
  ],
};
// Pairs of different lengths, or that Grow and shrink plays better: a step may also add or take away a letter.
const GROWN = {
  opposites: [
    ["hot", "cold", "Turn HOT to COLD"], ["day", "night", "Turn DAY into NIGHT"], ["war", "peace", "Make WAR into PEACE"],
    ["work", "rest", "From WORK to REST"], ["win", "lose", "WIN or LOSE"], ["old", "new", "Make OLD NEW"],
    ["big", "small", "Make BIG SMALL"], ["tall", "short", "Make TALL SHORT"], ["dark", "light", "Bring DARK to LIGHT"],
    ["man", "woman", "From MAN to WOMAN"], ["love", "hate", "Turn LOVE to HATE"],
  ],
  trade: [
    ["buy", "sell", "Turn BUY into SELL"], ["oil", "fuel", "Refine OIL into FUEL"], ["long", "short", "Go LONG, then SHORT"],
    ["cash", "card", "Pay by CASH or CARD"], ["coin", "note", "Change a COIN for a NOTE"], ["ore", "metal", "Smelt ORE into METAL"],
    ["iron", "steel", "Forge IRON into STEEL"], ["crude", "fuel", "Refine CRUDE into FUEL"],
  ],
  farm: [
    ["bread", "butter", "Spread BREAD with BUTTER"], ["corn", "bread", "Bake CORN into BREAD"], ["grape", "wine", "Press a GRAPE into WINE"],
    ["cow", "milk", "Get MILK from a COW"], ["sheep", "wool", "Shear WOOL from a SHEEP"], ["bee", "honey", "Get HONEY from a BEE"],
    ["salt", "pepper", "Pass the SALT and PEPPER"], ["ice", "water", "Melt ICE into WATER"],
  ],
  nature: [
    ["sun", "moon", "From SUN to MOON"], ["acorn", "oak", "Grow an ACORN into an OAK"], ["rain", "storm", "Build RAIN into a STORM"],
    ["wind", "storm", "Whip WIND into a STORM"], ["river", "sea", "Run a RIVER to the SEA"],
  ],
  creatures: [["cat", "mouse", "Set a CAT on a MOUSE"], ["hen", "chick", "From HEN to CHICK"]],
  play: [["ink", "quill", "From INK to QUILL"]],
};
const flat = (by, rules) => Object.entries(by).flatMap(([theme, xs]) => xs.map(([a, b, say]) => ({ a, b, say, theme, rules })));
/** Every linked pair: the same-length ones play by either rules, the others only growing. */
export const LINKED = [...flat(SAME, "classic"), ...flat(GROWN, "grow")];
/** The linked pairs a ladder by these rules may deal, from these themes. */
export const linkedFor = (rules, themes = Object.keys(THEMES)) => LINKED.filter(p => themes.includes(p.theme) && (rules === "grow" || p.rules === "classic"));
