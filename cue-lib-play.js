// Cue's library, the playing cards: Describe it, Name three, Act it out. Data only, like cue-lib-talk.js (same shape,
// same rules). Here every card has a twin ("text|twin"), a thing that sounds close to it, so the player dealt "a
// different cue" has something to bluff with, and every one can be guessed, so the player dealt no cue can work it out
// from what the others say and do.
export const PLAY = [
  {
    id: "describe", name: "Describe it", one: "Describe it", lead: "", tail: "",
    ask: "Describe it in your own words without saying it, or any word in it. The others say what it is.",
    x: "Describe it first, then listen to the others.",
    guess: "Describe it to them without saying it, one after another, until they get it.",
    kids: [
      "a rainbow|a firework", "a birthday party|a picnic", "a snowman|an igloo", "a pirate ship|a space rocket", "a haunted house|a castle", "a teddy bear|a toy robot",
      "a zoo|a farm", "a swimming pool|a bath", "a school bus|a fire engine", "a library|a toy shop", "a bedtime story|a lullaby", "a roller coaster|a swing",
      "a thunderstorm|a rainstorm", "an ice-cream van|a bakery", "a magic trick|a puzzle", "a trampoline|a see-saw",
    ],
    work: [
      "a team meeting|a one-to-one chat", "a deadline|a to-do list", "a pay rise|a bonus", "a coffee break|a lunch break", "a long email|a long call", "a job interview|a first day",
      "a spreadsheet|a slide deck", "the office printer|the office kettle", "a conference|a workshop", "a quiet day|a busy day", "a brainstorm|a presentation", "a standing desk|a swivel chair",
      "a video call|a phone call", "a lost password|a lost badge", "a train delay|a traffic jam", "a Monday morning|a Friday afternoon",
    ],
    friends: [
      "a surprise party|a wedding", "a camping trip|a road trip", "a long queue|a crowded lift", "a bad haircut|a good hairdo", "a first date|a job interview", "a sunburn|a blister",
      "a lost suitcase|a missed flight", "a power cut|a flat battery", "a karaoke night|a quiz night", "a house move|a spring clean", "a rainy holiday|a snowed-in weekend", "a power nap|a lie-in",
      "a lucky escape|a close call", "a flash mob|a street parade", "a school reunion|a family reunion", "a box of old photos|a shoebox of letters",
      "a farmers' market|a flea market", "a lighthouse|a windmill", "a hot-air balloon|a zip wire", "a guided tour|a treasure hunt",
      "an awkward silence|a polite cough", "a cold shower|a hot bath", "a street musician|a circus clown", "a sleepy village|a busy port",
    ],
  },
  {
    id: "three", name: "Name three…", one: "Name three", lead: "Name three ", tail: ".",
    ask: "Everyone names three, one after another, with no repeats. Run out and you're out of the round.",
    x: "Name three first, fast, then the next player goes.",
    guess: "Each names three examples without saying the topic. The player with no cue works out what it is.",
    kids: [
      "animals that live in the sea|animals that live in a forest", "things that are red|things that are yellow", "foods you eat for breakfast|foods you eat at a party", "things in a classroom|things in a bedroom",
      "things with wheels|things with wings", "ways to travel|ways to keep warm", "farm animals|zoo animals", "fruits that are round|fruits that are long",
      "things that make a noise|things that are very quiet", "things in a toy box|things in a school bag", "games you play outside|games you play inside", "things you find at the beach|things you find in a park",
      "things that are cold|things that are hot", "things that are sticky|things that are soft", "kinds of weather|kinds of clothes", "things you can build|things you can draw",
    ],
    work: [
      "things on a desk|things in a cupboard", "jobs you've never done|jobs you'd like to try", "apps you use every day|apps you've deleted", "things you can do in a lift|things you can do on a train",
      "things you'd bring to a meeting|things you'd bring to a picnic", "ways to say hello|ways to say thank you", "words people overuse at work|words people overuse online", "things you do in the first hour|things you do in the last hour",
      "places to go for lunch|places to go for a walk", "tools you can't work without|tools you've never used", "skills every team needs|skills every leader needs", "things that run out in an office|things that break in an office",
      "ways to start an email|ways to end an email", "cities you'd like to visit|cities you've already seen", "things that are on time|things that are always late", "ways to say no politely|ways to say yes happily",
    ],
    friends: [
      "things in a fridge|things in a freezer", "things you'd take on a desert island|things you'd take to space", "famous people called John|famous people called Mary", "things that fit in a pocket|things that fit in a suitcase",
      "songs with a colour in the title|songs with a place in the title", "countries that start with a vowel|countries that start with S", "things you can do in ten seconds|things you can do in ten minutes", "films with a number in the title|films with an animal in the title",
      "things that are round|things that are square", "things you'd find in a garden|things you'd find in a garage", "types of bread|types of cheese", "words that rhyme with cat|words that rhyme with dog",
      "things people queue for|things people argue about", "famous bridges|famous towers", "dances you know|sports you know", "things that smell good|things that smell bad",
      "board games|card games", "things on a pizza|things on a sandwich", "capital cities|large rivers", "things that are yellow|things that are blue",
      "things you can wear on your head|things you can wear on your feet", "things in a handbag|things in a toolbox", "kinds of tree|kinds of flower", "TV detectives|TV doctors",
    ],
  },
  {
    id: "act", name: "Act it out", one: "Act it out", lead: "Act out ", tail: ".",
    ask: "Act it out with no words or sounds. The others guess; whoever gets it acts the next one.",
    x: "You act it out. No words.",
    guess: "Act it out for them with no words, until they say the right thing.",
    kids: [
      "a cat stuck in a box|a dog stuck in a cat flap", "a penguin on ice|a polar bear on ice", "a monkey eating a banana|a squirrel eating a nut", "a robot dancing|a robot cooking",
      "a baby learning to walk|a baby learning to crawl", "a dinosaur sneezing|a dinosaur sleeping", "a pirate finding treasure|a pirate losing his hat", "a snail in a race|a tortoise in a race",
      "a bird building a nest|a bee making honey", "a clown on a unicycle|a clown blowing up balloons", "a kangaroo in a boxing ring|a kangaroo on a trampoline", "a ghost trying not to be seen|a ghost eating a sandwich",
      "a fish out of water|a frog on a lily pad", "a chef dropping a pancake|a chef juggling plates", "an astronaut walking on the moon|an astronaut floating in space", "a superhero stuck in traffic|a superhero stuck in a lift",
    ],
    work: [
      "a printer jamming|a printer running out of ink", "someone on mute|someone with a frozen screen", "a waiter dropping a tray|a waiter with a long order", "a boss giving a speech|a boss finding the wrong file",
      "a long queue for coffee|a long queue for the lift", "a tired person at a desk|a very busy person at a desk", "a team lifting a heavy box|a team solving a puzzle", "a person looking for their keys|a person looking for their phone",
      "someone late for a train|someone late for a bus", "a tour guide on a bad day|a tour guide on a good day", "a person on a very bad video call|a person on a very good video call", "an umbrella in a gale|a hat in a gale",
      "a carpenter hammering a nail|a builder laying bricks", "a gardener planting seeds|a gardener pulling weeds", "someone carrying too many coffees|someone carrying too many files", "a lost tourist with a map|a lost driver with a sat nav",
    ],
    friends: [
      "a cat watching a bird|a dog watching a squirrel", "a nervous first-time skier|a nervous first-time swimmer", "a person trying to stay awake in a film|a person trying to stay awake in a lecture", "a mime stuck in a box|a mime pulling a rope",
      "a chef who's burned the dinner|a chef who's lost the recipe", "a pop star's big finish|a rock star's guitar solo", "a person finding money in an old coat|a person finding a key in an old coat", "a wedding guest who forgot the present|a wedding guest who lost the ring",
      "a very slow waiter|a very fast waiter", "a runner crossing the finish line|a swimmer at the finish", "a sleepwalker in a kitchen|a sleepwalker in a garden", "someone who's sat on a wet bench|someone who's sat on a cold step",
      "someone trying to open a stuck jar|someone trying to open a stuck door", "a tourist taking a photo of a statue|a tourist taking a photo of a view", "a parent pushing a pram uphill|a parent chasing a toddler", "a magician whose trick has gone wrong|a magician whose rabbit has escaped",
      "a bear woken from hibernation|a bear who found honey", "a person walking on a tightrope|a person walking on a frozen pond", "a dog being given a bath|a cat being given a bath", "a judge on a talent show|a judge at a dog show",
      "a driver stuck behind a tractor|a driver stuck behind a cyclist", "a tennis player who just missed|a golfer who just missed", "a knight who can't get off his horse|a knight who can't get his helmet off", "a mountaineer reaching the top|a mountaineer slipping on ice",
    ],
  },
];
