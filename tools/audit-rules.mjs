// The rules that fill kb/audit/marks.js the first time (node tools/audit-marks.mjs): which mark an entity gets, from what
// it is (its sets and kind), from lists of names judged against the curriculum map (kb/audit/curriculum.js), and from what
// its clues are about. A mark that is wrong is changed in kb/audit/marks.js, never here: the file is the truth, this is how
// it was first filled, and `audit-marks.mjs` only adds entities the file doesn't have yet.
// Marks: u universal, r regional, s specialist, p personal (Korbi's trade and market material), l living (not dealt).
export const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^the /, "").replace(/[^a-z0-9]+/g, " ").trim();
const L = s => new Set(s.split(";").map(x => norm(x)).filter(Boolean));

/** Taught in at least 8 of the fifteen systems (judged topic by topic: kb/audit/curriculum.js has the geography; the others are the
 *  standing parts of the same frameworks, recalled). People are the ones every system names. */
export const UNIVERSAL = L(`
Einstein; Marie Curie; Curie; Napoleon; Gandhi; Mandela; Shakespeare; William Shakespeare; Columbus; Magellan; Leonardo da Vinci; Leonardo; Michelangelo; Picasso; Pablo Picasso;
Van Gogh; Vincent van Gogh; Rembrandt; Mozart; Beethoven; Bach; Galileo; Galileo Galilei; Copernicus; Churchill; Hitler; Stalin; Lincoln; Washington; Abraham Lincoln; Alexander the Great; Genghis Khan;
Cleopatra; Confucius; Buddha; Mao Zedong; Sun Yat-sen; Socrates; Pythagoras; Euclid; Archimedes; Hippocrates; Martin Luther King; Mother Teresa; Tolstoy; Leo Tolstoy; Marco Polo; Vasco da Gama; Gutenberg;
Edison; Wright brothers; Tesla; Nikola Tesla; Freud; Karl Marx; Immanuel Kant; Aristotle; Plato; Julius Caesar; Charlemagne; Joan of Arc; Elizabeth I; Henry VIII; Queen Victoria; Louis XIV;
Peter the Great; Catherine the Great; Goethe; Johann Wolfgang von Goethe; Cervantes; Miguel de Cervantes; Dante Alighieri; Homer; Fibonacci; Turing; Darwin; Charles Darwin; Adam Smith;
Dostoevsky; Fyodor Dostoevsky; Charles Dickens; Jane Austen; Victor Hugo; Mark Twain; Hemingway; George Orwell; Rabindranath Tagore; Lu Xun; Laozi; Sun Tzu; Voltaire; Rousseau; Jean-Jacques Rousseau; Descartes; René Descartes; Nietzsche; Friedrich Nietzsche;
Dalí; Salvador Dalí; Frida Kahlo; Claude Monet; Raphael; Botticelli; Sandro Botticelli; Albrecht Dürer; Albrecht Durer; Velázquez; Diego Velázquez; Francisco Goya; Gustav Klimt; Edvard Munch; Katsushika Hokusai; Hokusai; Auguste Renoir; Pierre-Auguste Renoir; Paul Cézanne; Andy Warhol; Henri Matisse; Wassily Kandinsky; Piet Mondrian; Johannes Vermeer; Eugène Delacroix; Édouard Manet; Edgar Degas; Jackson Pollock; Caravaggio;
Moses; Jesus; Muhammad; Tutankhamun; Julius Caesar; Gaius Julius Caesar; Hannibal; Saladin; Zheng He; Livingstone; Nelson Mandela; Haile Selassie; Nkrumah; Atatürk; Ho Chi Minh; Bolívar; Simon Bolivar; Che Guevara; Fidel Castro; Deng Xiaoping; Gorbachev; Lenin; Peter the Great;
Gagarin; Yuri Gagarin; Neil Armstrong; Isaac Newton; Newton; Faraday; Pasteur; Louis Pasteur; Edmund Hillary; James Cook; Florence Nightingale; Ada Lovelace; Hawking; Stephen Hawking;
Pyramids; Sphinx; Colosseum; Eiffel Tower; Statue of Liberty; Great Wall; Forbidden City; Big Ben; Acropolis; The Parthenon; Hagia Sophia; Kremlin; White House; Berlin Wall; Cold War; Industrial Revolution;
Great Depression; 9/11; Moon landing; Pearl Harbor; Gulf War; Arab Spring; Waterloo; Big Bang; IMF; Red Cross; NASA; League of Nations; Himalayas; K2; Rockies; Black Sea; Caspian; Niagara; Serengeti; Rift Valley;
Monsoon; Typhoons; Hurricanes; Cyclones; Volcanoes; Steppe; Pampas; Mount Olympus; Congo River; Missile crisis; Manhattan Project; Cricket; Basketball; Baseball; Marathon; Elephants; Pandas; Camels; Kangaroo; Hurricane Katrina; The Pantheon; St Peter's Basilica; The Palace of Versailles; Notre-Dame Cathedral; The Empire State Building; The Sydney Opera House; The Taj Mahal; Taj Mahal; Machu Picchu; Terracotta Army; Angkor Wat; Petra; Abu Simbel; Chichen Itza; The Pyramids of Giza; Stonehenge; Sagrada Familia;
Everest; Kilimanjaro; Mont Blanc; Mount Fuji; Lake Baikal; Lake Victoria; Victoria Falls; The Mouth of the Nile; The Mouth of the Amazon; Great Barrier Reef; The Galapagos; Grand Canyon; Yellowstone; Krakatoa; Vesuvius; Etna; Dead Sea; The Aral Sea; Chernobyl; Greenwich; Uluru; The Mariana Trench; Denali; Aconcagua; Elbrus; Lake Titicaca; Fukushima; Timbuktu; Zanzibar;
Amazon; Nile; Yangtze; Mississippi; Ganges; Danube; Rhine; The Rhine; Volga; Congo; The Congo; Niger; The Niger; Murray-Darling; The Yellow River; Indus; Mekong; Thames; The Thames; Seine; The Seine; Tigris; Euphrates; The Euphrates; Missouri; Colorado; Brahmaputra; Zambezi;
The Alps; The Andes; The Himalaya; The Rocky Mountains; The Ural Mountains; The Atlas Mountains; The Caucasus; The Sahara; The Gobi; The Kalahari; The Namib; The Rub al Khali; Atacama; The Tibetan Plateau; The Deccan Plateau; The Amazon Basin; The Congo Basin;
Lake Superior; Lake Michigan; Lake Tanganyika; Lake Geneva; Lake Malawi; Lake Chad; Lake Huron; Lake Erie; Lake Ontario;
Mona Lisa; The Last Supper; The Starry Night; Sunflowers; Girl with a Pearl Earring; The Night Watch; Guernica; The Scream; The Persistence of Memory; The Birth of Venus; Las Meninas; The Kiss; The Great Wave off Kanagawa; Liberty Leading the People; Water Lilies; Impression; The School of Athens; The Creation of Adam; American Gothic; Whistler's Mother; Campbell's Soup Cans; Les Demoiselles d'Avignon; The Garden of Earthly Delights;
Renaissance; Baroque; Impressionism; Cubism; Surrealism; Romanticism; Pop Art; Gothic; Neoclassicism; Realism; Expressionism; Modernism;
Zeus; Hera; Poseidon; Athena; Apollo; Artemis; Ares; Aphrodite; Hades; Dionysus; Demeter; Hermes; Heracles; Hercules; Odysseus; Achilles; Perseus; Theseus; Jason; Oedipus; Prometheus; Medusa; The Minotaur; Ra; Osiris; Isis; Horus; Anubis; Jupiter; Mars; Venus; Odin; Thor;
Odyssey; Iliad; Hamlet; Macbeth; Romeo and Juliet; Don Quixote; Faust I; Divine Comedy; Inferno; Pride and Prejudice; Oliver Twist; A Christmas Carol; Frankenstein; Alice's Adventures in Wonderland; Moby-Dick; Anna Karenina; The Analects; Tao Te Ching; The Art of War; Dream of the Red Chamber; Bhagavad Gita; Gitanjali; The Bible; The Book of Genesis; On the Origin of Species; The Wealth of Nations; Les Misérables; Treasure Island; The Gettysburg Address; The Declaration of Independence; Manifest der Kommunistischen Partei; Kinder- und Hausmärchen; Brothers Grimm; Hans Christian Andersen; The Emperor's New Clothes;
Pizza; Sushi; Pasta; Curry; Rice; Bread; Tea; Coffee; Chocolate; Cheese; Beer; Wine;
US Dollar; Dollar; Euro; Yen; Pound; Yuan; Rupee; Rouble; Ruble
`);
/** Taught in three to seven systems, mostly the home system's neighbours and its history's. */
export const REGIONAL = L(`
Frederick the Great; Leibniz; Gauss; Euler; Bernoulli; Riemann; Kolmogorov; Fermat; Galois; Hergé; Magritte; Gaudí; Chopin; Liszt; Bartók; Tolstoy; Pushkin; Alexander Pushkin; Cicero; Virgil; Seneca; Ovid; Tacitus; Kafka; Franz Kafka; Thomas Mann;
Bismarck; Otto von Bismarck; Machiavelli; Niccolò Machiavelli; Molière; Montesquieu; Hobbes; Thomas Hobbes; Locke; Hume; David Hume; Keynes; John Maynard Keynes; Wellington; The Duke of Wellington; Nelson; Henry the Navigator; Franco; Salazar; Mussolini; Garibaldi;
Tamerlane; Kublai Khan; Qin Shi Huang; Puyi; Zhou Enlai; Xunzi; Mencius; Zhuangzi; Li Bai; Du Fu; Cao Xueqin; Matsuo Bashō; Murasaki Shikibu; Rumi; Omar Khayyam; Ibn Battuta; Al-Khwarizmi; Nehru; Jinnah; Tagore; Ramanujan; Tipu Sultan; Clive; Wilberforce; Walpole; Robert Walpole;
Thor; Loki; Freyja; Frigg; Balder; Baldr; Heimdall; Hel; Ptah; Thoth; Bastet; Sekhmet; Hathor; Amun; Sobek; Poseidon; Neptune; Minerva; Juno; Diana; Cupid; Saturn; Vulcan; Mercury; Bacchus; Pluto; Ceres; Vesta; Proserpina;
Pyrenees; Ardennes; The Apennines; The Carpathians; The Appalachians; The Great Dividing Range; The Hindu Kush; The Zagros; The Tian Shan; The Altai; The Drakensberg; The Dinaric Alps; The Balkan Mountains; The Cascades; The Sierra Nevada; The Kunlun;
Magritte; The Louvre; Louvre; British Museum; The British Museum; Prado; The Metropolitan Museum of Art; The Uffizi; The Hermitage; The Rijksmuseum, home of The Night Watch; The Vatican's Apostolic Palace; The Sistine Chapel; Tate Modern; The Musée d'Orsay; MoMA; The Smithsonian; The Egyptian Museum; The Palace Museum; The Acropolis Museum;
Apartheid; Hanseatic League; Silk Road; Thirty Years' War; Peace of Westphalia; Congress of Vienna; Opium Wars; Raj; Partition; Armada; Tulip mania; Anschluss; Watergate; Industrial; Bastille; Brexit; Euro; Crimean; Spanish Armada; Troubles; Great Famine; Kristallnacht; Prague Spring; Velvet Revolution; Holodomor; Armenian genocide; Chernobyl fallout; Apollo 11;
Bundesliga; Premier League; La Liga; Serie A; Wimbledon; Tour de France; Super Bowl; NBA; Tiki-taka; All Blacks; Sumo; Taekwondo; Badminton; Rugby sevens; Handball; Ice hockey; Water polo; Field hockey; Archery; Freestyle wrestling; Kabaddi; IPL
`);
/** Alive in November 2026 and not on the short list of the globally famous: not dealt. */
export const LIVING = L(`
Terence Tao; Kylie; Hugh Jackman; Nazarbayev; Drake; Hinton; Denis Villeneuve; MBS; Tamim; Marie Kondo; Tyla; Faker; Pacquiao; Lea Salonga; Dangote; Burna Boy; Mahathir; Stormzy; Charli XCX; Adele; Soros; Christopher Nolan; Lloyd Webber; Jacquemus;
Björk; Räikkönen; Kaurismäki; Arvo Pärt; Wong Kar-wai; Zhang Yimou; Shah Rukh Khan; Tendulkar; Ambani; Lanthimos; Giannis; Varoufakis; Felipe VI; Juan Carlos; Almodóvar; Mourinho; Paul Mescal; Saoirse Ronan; Conor McGregor; Zlatan; Björn Borg; Stromae; King Philippe; Kevin De Bruyne;
Dardenne brothers; Conchita Wurst; Orbán; Tusk; Lewandowski; Iga Świątek; Klitschko; Bubka; Porziņģis; Baryshnikov; Sabonis; Raúl; Jacinda Ardern; Peter Jackson; Lorde; Sultan Haitham; Imran Khan; Sheikh Hasina; Muhammad Yunus; Shakib Al Hasan; Kipchoge; Rudisha; Ouattara; Drogba; Yaya Touré;
Dua Lipa; Kagame; Queen Rania; Ons Jabeur; Youssou N'Dour; Sadio Mané; Luis Suárez; Peter Sagan; Luka Dončić; Melania Trump; Magnus Carlsen; Golovkin; Wayne Gretzky; Sharapova; Egan Bernal; Hassanal Bolkiah; Samuel Eto'o; Roger Milla; Rahmon; Assad; Bukele; Xanana Gusmão; Kiir; Tshisekedi; Maduro;
Lukashenko; Evo Morales; Edin Džeko; Maia Sandu; George Weah; Ellen Johnson Sirleaf; David Hockney; Banksy; Beeple; François Pinault; Patrick Drahi; Ronald Lauder; Mario Draghi; Pei-Shen Qian; Wolfgang Beltracchi; John Myatt; Mikaela Shiffrin; Marcel Hirscher; Lindsey Vonn; Marco Odermatt;
Mswati III; Obiang; Teodorín; Isaias Afwerki; Michael Schumacher; Valentino Rossi; Alan Greenspan; Rigoberta Menchú; Sassou Nguesso; Raúl; Mahamat; Hugh Jackman; Elon Musk; Musk; Trump; Obama; Modi; Zelensky; Messi; Roger Federer; Nadal; Ronaldo; Serena Williams; Greta Thunberg; Malala; Spielberg; Jackie Chan; Shakira; Warren Buffett; Buffett; Salah;
Haruki Murakami; Madonna; Beyoncé; Lady Gaga; Rihanna; Taylor Swift; Ed Sheeran; Justin Bieber; Billie Eilish; Jay Chou; Elton John; Mick Jagger; Paul McCartney; Bob Dylan; Meryl Streep; Morgan Freeman; Rowan Atkinson; Tom Hanks; Tom Cruise; Brad Pitt; Johnny Depp; Keanu Reeves; Will Smith; Dwayne Johnson; Leonardo DiCaprio;
Angelina Jolie; Oprah Winfrey; Gordon Ramsay; Chow Yun-fat; Andy Lau; Stephen Chow; Michelle Yeoh; Gong Li; David Beckham; LeBron James; Yao Ming; Tiger Woods; Lewis Hamilton; Usain Bolt; Michael Phelps; Charles III; Bill Gates; Jeff Bezos; Mark Zuckerberg; Jack Ma; JK Rowling; Stephen King; David Attenborough; Li Ka-shing; Angela Merkel; Michael Jordan
`);
/** The globally famous among the living: dealt (a short list: names known in most of the fifteen systems). */
export const LIVING_OK = L(`
Trump; Obama; Elon Musk; Musk; Modi; Zelensky; Messi; Ronaldo; Roger Federer; Nadal; Serena Williams; Greta Thunberg; Malala; Spielberg; Jackie Chan; Shakira; Warren Buffett; Buffett; Salah;
Taylor Swift; Beyoncé; Lady Gaga; Rihanna; Madonna; Elton John; Paul McCartney; Tom Cruise; Leonardo DiCaprio; Bill Gates; Jeff Bezos; Mark Zuckerberg; JK Rowling; Charles III; Angela Merkel; Michael Jordan; Usain Bolt; LeBron James; Michael Phelps; Tiger Woods; Lewis Hamilton; Jack Ma; Pope Francis
`);
/** Heroes of the personal build only: trade and market people and things whose names don't say so. */
export const PERSONAL = L(`Marc Rich; Calouste Gulbenkian; Marcus Samuel; William Jardine; Howqua; Hu Xueyan; Shen Wansan; Li Ka-shing; Hunt brothers; Rockefeller; John Law; Jakob Fugger; Mayer Amschel Rothschild; Warren Hastings`);

/** The aspects (kb/ clue topics) that are the trade and market side: a clue thing mostly about these is personal. */
export const TRADE_ASPECTS = new Set(["trade", "fin", "mkt", "mkts", "logi", "prod", "co", "firm", "nrg", "met"]);
/** Staple commodities every geography syllabus names among the world's resources (geo.energy, geo.agri). */
export const STAPLES = new Set(["coffee", "cocoa", "copper", "gold", "natural-gas", "wheat", "sugar", "coal", "crude-oil", "rice", "iron-ore", "silver", "aluminium", "corn", "rubber", "cotton", "soybeans", "tea", "cattle", "diamonds", "wool", "silk", "lumber", "steel", "uranium", "orange-juice", "barley", "palm-oil"]);
export const REGIONAL_COMMODITIES = new Set(["nickel", "zinc", "tin", "lithium", "cobalt", "platinum", "rare-earths", "hydrogen", "vanilla", "linen", "eggs", "potash", "phosphate", "graphite", "palladium", "sunflower-oil", "rapeseed", "soybean-oil", "tallow", "sulphur", "ammonia", "urea", "plastic-pyrolysis-oil"]);
/** Sets that are the trade and market material wholesale. */
export const PERSONAL_SETS = ["legal-maxim", "legal-concept", "trade-place", "trade-good", "futures-exchange", "kind:market", "kind:law", "art-market-person", "art-market-place", "art-market-thing", "auction-house", "art-dealer", "art-forger", "art-fair", "art-record", "group:bio", "group:cred", "group:circ"];
/** Set defaults, first match wins. [set, mark] */
export const SET_DEFAULT = [
  // a set (Census's: the planets, the Tudor monarchs) is known where its members are taught; the school-wide ones are in SET_UNIVERSAL
  ["set", "r"],
  ["greek-god", "u"], ["egyptian-god", "r"], ["roman-god", "r"], ["norse-god", "r"], ["myth-hero", "r"], ["myth-creature", "r"], ["myth-place", "s"],
  ["chinese-thinker", "r"], ["chinese-province", "r"], ["china-place", "r"], ["china-person", "r"], ["china-thing", "r"], ["chinese-dish", "s"], ["chinese-tea", "s"], ["chinese-festival", "r"], ["chengyu", "s"],
  ["merchant-power", "r"], ["merchant-person", "r"], ["trade-history", "r"], ["architecture-style", "r"], ["architecture-term", "s"], ["art-movement", "r"],
  ["feature", "r"], ["museum", "s"], ["painting", "r"], ["painter", "r"], ["author", "r"], ["work", "r"], ["building", "r"], ["architect", "r"], ["art-place", "r"],
  ["city", "r"], ["geo-place", "r"], ["people-place", "s"],
  ["saying", "s"], ["quotation", "s"], ["kind:currency", "r"], ["kind:sport", "s"], ["kind:animal", "s"], ["kind:plant", "s"], ["kind:natural", "s"], ["kind:person", "s"],
];
/** Sets taught in every school system (10 Nov 2026): the planets, continents, oceans, the colours of the rainbow, the Seven Wonders, the first 20 elements. */
export const SET_UNIVERSAL = new Set(["set-planets", "set-continents", "set-oceans", "set-rainbow", "set-wonders", "set-first-20"]);
/** Entities whose name collides with a universal one (the fashion house is not the god). */
export const OVERRIDE = { hermes: "s" };
/** Cities every geography syllabus names (megacities and the capitals of the world's major countries): a city or place entity of these names. */
export const CITIES = L(`Tokyo; Delhi; Shanghai; Beijing; Cairo; Istanbul; Mexico City; Buenos Aires; Lagos; Nairobi; Sydney; Singapore; Dubai; Jakarta; Mumbai; Sao Paulo; Moscow; Rome; London; Paris; Berlin; Madrid; New York; Chicago; Toronto; Seoul; Bangkok; Manila; Karachi; Dhaka; Kinshasa; Johannesburg; Cape Town; Athens; Vienna; Lima; Bogota; Tehran; Baghdad; Riyadh; Kyiv; Warsaw; Lisbon; Amsterdam; Brussels; Stockholm; Oslo; Helsinki; Dublin; Prague; Budapest; Havana; Hong Kong; Osaka; Jerusalem; Mecca; Kabul; Casablanca; Rio de Janeiro; Brasilia; Santiago de Chile; Caracas; Addis Ababa; Accra; Hanoi; Taipei; Kolkata; Chennai; Venice; Florence; Barcelona; Washington DC; Los Angeles; San Francisco; Canberra; Ottawa; Wellington; Auckland; Melbourne`);
