// Who am I? (Party): the decks a table plays with. Each is a list of the entities it deals, picked as known well enough
// to be guessed by yes-or-no questions, or a set of kb/'s (every country, every city…). An entry that is a list names
// the entity and its doubles in kb/ ([main, double…]: "Shakespeare" beside "William Shakespeare"), whose facts and names
// the crib and the guess take too. The build (tools/build-kb.mjs) writes each identity's crib, the lines the others
// read to answer: what kb/ says of it, its own facts first, then its links. `a` is what a deck's identity is, as the
// table says it ("You are a famous person").
export const DECKS = [
  {
    id: "people", name: "Famous people", a: "a famous person",
    ids: ["napoleon", "einstein", "confucius", "bruce-lee", ["william-shakespeare", "shakespeare"], "picasso", "van-gogh", ["leonardo-da-vinci", "leonardo"],
      "beethoven", "mozart", "bach", "chopin", "gandhi", "marco-polo", "columbus", "magellan", "mother-teresa", "abraham-lincoln", "karl-marx", "mark-twain",
      "hemingway", "jane-austen", ["leo-tolstoy", "tolstoy"], "dante-alighieri", "plato", "aristotle", "sun-tzu", "obama", "edison", "houdini", "che-guevara",
      "john-f-kennedy", "thomas-jefferson", "washington", "adam-smith", "gutenberg", "turing", "archimedes", "niccolo-machiavelli", "miguel-de-cervantes",
      "rene-descartes", "voltaire", "friedrich-nietzsche", "franz-kafka", "victor-hugo", "li-bai", "laozi", "lee-kuan-yew", "zheng-he", "musk",
      ["marie-curie", "curie"], "charles-dickens", "oscar-wilde", "homer", "gaudi", "johann-wolfgang-von-goethe", "elvis", "rockefeller", "bolivar",
      "vasco-da-gama", "mary-queen-of-scots", "william-wallace", "robert-burns", "richard-wagner", "otto-von-bismarck", "empress-sisi", "ludwig-ii",
      "hans-christian-andersen", "brothers-grimm", "arthur-conan-doyle", "edgar-allan-poe", "charles-darwin", ["galileo-galilei", "galileo"], "michelangelo",
      "rembrandt", "claude-monet", "salvador-dali", "frida-kahlo", "andy-warhol", "steve-jobs", "messi", "pele", "michael-jordan", "muhammad-ali",
      "cleopatra", "alexander-the-great", "genghis-khan", "qin-shi-huang", "sun-yat-sen", "jackie-chan", "freddie-mercury", "martin-luther-king",
      "neil-armstrong", "copernicus", "nikola-tesla", "alexander-pushkin", "fyodor-dostoevsky", "rumi", ["rabindranath-tagore", "tagore"], "amundsen",
      "dua-lipa", "kylie", "hugh-jackman", "drake"],
  },
  {
    id: "myth", name: "Gods and monsters", a: "a god, a hero or a monster of myth",
    ids: ["zeus", "hera", "poseidon", "demeter", "athena", "apollo", "artemis", "ares", "aphrodite", "hephaestus", "hermes-god", "dionysus", "hades", "hestia",
      "persephone", "cronus", "eros", "odin", "thor", "loki", "frigg", "freyja", "freyr", "baldr", "tyr", "heimdall", "hel", "ra", "osiris", "isis", "horus",
      "set", "anubis", "thoth", "bastet", "sekhmet", "hathor", "amun", "sobek", ["heracles", "hercules"], "perseus", "theseus", "jason", "medea", "odysseus",
      "achilles", "hector", "paris-of-troy", "helen-of-troy", "agamemnon", "aeneas", "orpheus", "oedipus", "prometheus", "daedalus", "icarus", "midas-myth",
      "romulus-and-remus", "sigurd", "beowulf", "nemean-lion", "hydra", "cerberus", "medusa", "pegasus", "minotaur", "polyphemus", "scylla", "charybdis",
      "sphinx-of-thebes", "fenrir", "jormungandr", "sleipnir", "fafnir", "grendel"],
  },
  { id: "countries", name: "Countries", a: "a country", sets: ["country"] },
  { id: "cities", name: "Cities", a: "a city", sets: ["city"] },
  {
    id: "food", name: "Food and drink", a: "something to eat or drink",
    ids: ["sushi", "pizza", "kimchi", "croissant", "paella", "curry", "chocolate", "hamburger", "fries", "baguette", "pho", "banh-mi", "egg-tarts", "mooncake",
      "hotpot", "jiaozi", "mapo-tofu", "congee", "laksa", "nasi-goreng", "tacos", "churros", "pretzel", "fish-and-chips", "fondue", "baklava", "kebab", "borscht",
      "caviar", "bagels", "biryani", "tempura", "tofu", "soy-sauce", "ice-cream", "maple-syrup", "pavlova", "poutine", "tagine", "ceviche", "bibimbap",
      "chilli-crab", "tom-yum", "peking-duck", "dim-sum", "stroopwafel", "marmite", "foie-gras", "olive-oil", "parmesan", "durian", "honey", "salmon",
      "champagne", "tequila", "sake", "guinness", "espresso", "cola", "scotch-whisky", "vodka", "rum", "beer", "earl-grey", "sangria", "mojito", "bubble-tea",
      "matcha", "caipirinha", "negroni", "port", "latte", "chai", "ouzo", "soju", "baileys"],
  },
  {
    id: "brands", name: "Brands", a: "a company or a brand",
    ids: ["tesla", "coca-cola", "rolex", "toyota", "samsung", "starbucks", "nestle", "lindt", "adidas", "puma", "heineken", "red-bull", "hsbc", "shell", "maersk",
      "uniqlo", "tiktok", "hermes", "lvmh", "cartier", "omega", "patek-philippe", "michelin", "volkswagen", "nutella", "lego", "ikea", "apple", "google", "nike",
      "mcdonald-s", "disney", "ferrari", "bmw", "nintendo", "huawei", "tencent", "airbus", "boeing", "gucci", "lavazza", "carlsberg", "ferrero", "cadbury",
      "harrods", "burberry", "havaianas", "nando-s", "seiko", "hyundai", "spotify", "microsoft", "nokia", "porsche", "ryanair", "zara", "h-and-m", "levi-s",
      "byd", "aramco", "walmart", "lidl", "swarovski"],
  },
  { id: "commodities", name: "Commodities", a: "a commodity", sets: ["commodity"] },
  { id: "paintings", name: "Paintings", a: "a painting", sets: ["painting"] },
];
