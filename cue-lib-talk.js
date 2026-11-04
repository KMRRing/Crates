// Cue's library, the talking cards: Who is most likely to, Would you rather, Never have I ever, Hot takes, Finish the
// sentence, Confessions, Icebreakers, Two truths and a lie. Data only (cue-library.js reads it, tests/cue-library.mjs
// checks it). Every card is PG: nothing sexual, nothing hateful, nothing about drinking, nothing that picks on someone.
//
// A category: { id, name, one, lead, tail, ask, x, guess?, kids, work, friends }.
//   lead and tail go round each card's text (the card says "Who is most likely to" + text + "?"), so a list holds only
//   what differs. kids is for any age, work for a team (nothing cheeky), friends for people who know each other well.
//   A card is "text", or "text|other": the other is what a player who is dealt "a different cue" sees instead (a twin
//   that sounds alike); a card without one gets another card of its category.
//   ask: what the table does with the card. x: what the player whose turn it is does. guess: what the others do when
//   that player sees nothing and has to work the card out (only for cards that can be guessed).
export const TALK = [
  {
    id: "likely", name: "Who is most likely to…", one: "Most likely", lead: "Who is most likely to ", tail: "?",
    ask: "On three, everyone points at one person. Most fingers wins, and says whether they agree.",
    x: "Read it out, count to three, and take the pointing.",
    kids: [
      "build a sandcastle bigger than a house", "fall asleep in the car", "eat the last biscuit", "laugh at their own joke",
      "make friends with a dog on the street", "forget where they put their shoes", "sing in the shower", "stay up all night reading",
      "get lost in a supermarket", "wear their pyjamas all day", "talk to a cat as if it can answer", "climb the tallest tree",
      "win a staring contest", "hide the remote control", "invent a new sandwich", "have a pet snail",
      "cry at a cartoon", "turn up in fancy dress by mistake", "dance when nobody is watching", "name their toys after famous people",
      "ask for a second helping of pudding", "keep a jar of buttons for no reason",
    ],
    work: [
      "answer an email at midnight", "bring cake to a meeting", "be early for everything", "lose their keys on the way out",
      "reply all by mistake", "know every shortcut on the keyboard", "start a lunchtime running club", "have fourteen tabs open at once",
      "make a spreadsheet for a holiday", "be on mute when they start talking", "arrive in the wrong building", "turn up with the wrong charger",
      "microwave fish in the office kitchen", "become the boss one day", "run out of battery in the middle of a call", "decorate their desk for every season",
      "suggest a team song", "get the whole office to play a game", "fall for a fake website", "write the longest email ever sent",
      "never use the printer correctly", "know everyone's coffee order", "forget which day it is", "bring their dog to work if allowed",
      "wear odd socks to an important meeting", "end up leading a project they didn't want", "tell the best story at the Christmas party", "keep the plants alive",
    ],
    friends: [
      "forget their own birthday", "get lost with a map in their hand", "cry at an advert", "text the wrong person",
      "eat dessert before dinner", "start a band and never practise", "win a hot-dog eating contest", "adopt six cats",
      "get a tattoo of a cartoon character", "become famous for something silly", "take a selfie in the background of a wedding photo", "laugh at the wrong moment",
      "buy something online at 3 a.m.", "talk their way out of a parking ticket", "go viral for a dance", "fall asleep at the cinema",
      "move abroad on a whim", "take a wrong turn and call it an adventure", "give a very long speech at a wedding", "become a millionaire by accident",
      "run a marathon in fancy dress", "forget a friend's name straight after meeting them", "write a novel and never finish it", "know every word of a song they dislike",
      "arrive at the airport the day before", "get stuck in a lift and make friends", "turn a quiet dinner into a party", "have the most unread messages",
      "burn toast three times in a row", "wave at a stranger thinking it's a friend", "keep a secret for twenty years", "talk to themselves in the car",
      "plan a trip and not go", "have a favourite spoon", "stand up for a stranger", "end up on the local news",
      "take a day off to do nothing", "be the last to leave the party", "start a new hobby every month", "survive a week with no phone",
      "dress up for a party that isn't fancy dress", "tell the same story twice in one evening", "become best friends with the neighbour", "get the giggles in a quiet room",
      "have a secret talent", "overpack for a weekend away", "lose a bet over something tiny", "know a fact about everything",
    ],
  },
  {
    id: "rather", name: "Would you rather…", one: "Would you rather", lead: "Would you rather ", tail: "?",
    ask: "Everyone picks a side and says why, all at once on three. Then count the sides.",
    x: "Read both sides, then pick last and defend it.",
    kids: [
      "be able to fly or be invisible", "have a pet dragon or a pet unicorn", "live in a treehouse or a castle", "eat pizza every day or pasta every day",
      "be a giant or the size of a mouse", "have a slide instead of stairs or a lift made of jelly", "never have homework or never have to tidy your room", "meet a talking dog or a talking cat",
      "swim like a dolphin or run like a cheetah", "ride a rocket or sail a pirate ship", "have a robot friend or a magic wand", "have ice cream for breakfast or pancakes for dinner",
      "be a superhero or a wizard", "live on the moon or under the sea", "have wings or have a tail", "always hop or always skip",
      "sleep in a hammock or in a tent", "be the best at football or the best at drawing", "have a rainbow bedroom or a bedroom full of balloons", "explore a jungle or explore a cave",
    ],
    work: [
      "work four long days or five short ones", "have a huge office or a tiny one with a view", "never have a meeting again or never answer an email again", "work from a beach or from a mountain cabin",
      "be paid more and travel more or be paid less and be home", "have a pet at your desk or free lunch every day", "present to a thousand people or write a ten-page report", "always be ten minutes early or always be ten minutes late",
      "have a silent keyboard or a very comfortable chair", "lose your charger or lose your headphones", "be the funniest person on the team or the most organised", "learn a new language or learn an instrument",
      "have a one-hour commute or a three-hour lunch", "swap jobs with a colleague for a week or swap with a stranger", "know every answer in a quiz or never lose a game of cards", "have a magic spell-checker or a magic calculator",
      "take a long holiday once a year or a long weekend every month", "be famous at work or famous at home", "start a company or join a very big one", "give a speech with no notes or sing with no music",
    ],
    friends: [
      "be able to talk to animals or speak every language", "have a time machine to the past or to the future", "never use social media again or never watch a film again", "live without music or live without books",
      "win a lot of money now or a little every week for life", "have a free flight every month or a free meal every day", "be the best-looking in the room or the funniest", "know the future or change the past",
      "live a hundred years ago or a hundred years ahead", "eat only sweet food for a year or only salty", "have a pause button for life or a rewind button", "be stuck in a lift with a celebrity or with your boss",
      "swap lives with a friend for a week or with a famous person for a day", "always say what you think or never say what you think", "have a house by the sea or a flat in the middle of a big city", "cook every meal or eat out every meal",
      "have no phone for a year or no friends nearby for a year", "give up chocolate or give up cheese", "be able to teleport or read minds", "go on a road trip or on a train trip",
      "find a hundred pounds or find a lost kitten", "be an amazing singer or an amazing dancer", "lose all your photos or lose all your messages", "see the northern lights or a huge volcano erupt",
      "have a pet elephant or a pet penguin", "write a bestselling book or star in a hit film", "never be cold again or never be hot again", "know all the gossip or none of it",
      "get a surprise party or a surprise trip", "live where it is always summer or always autumn", "be the first person on Mars or the first at the bottom of the sea", "sleep only four hours a night or nap three times a day",
      "have to sing everything you say or dance everywhere you go", "be able to freeze time or fast-forward it", "have a personal chef or a personal driver", "own a lighthouse or own a small island",
      "have super hearing or super sight", "fight one horse-sized duck or a hundred duck-sized horses", "have a loud laugh or a very quiet sneeze", "live in a world with no clocks or no maps",
    ],
  },
  {
    id: "never", name: "Never have I ever…", one: "Never have I ever", lead: "Never have I ever ", tail: "",
    ask: "If you have, put a finger up, or stand. Everyone with a finger up tells the story if asked.",
    x: "Read it out, and tell yours first if you have.",
    kids: [
      "eaten a worm", "climbed a tree", "slept in a tent", "fallen off a bike", "built a den", "got lost in a shop",
      "ridden on a horse", "stayed up past midnight", "found a ladybird and named it", "baked a cake", "lost a tooth", "worn my shoes on the wrong feet",
      "swum in the sea", "had a pet fish", "told a joke that made nobody laugh", "made a snowman", "been on a train all day", "danced in the rain",
    ],
    work: [
      "been late to a meeting", "sent an email to the wrong person", "pretended to be on mute", "forgotten a colleague's name", "worked in my pyjamas", "laughed during a serious call",
      "spilled coffee on my keyboard", "lost a presentation I'd not saved", "got stuck in a lift", "taken a nap at my desk", "walked into a glass door", "said hello to the wrong person",
      "booked the wrong room for a meeting", "clapped at the wrong moment", "had an idea in the shower that fixed everything", "used the wrong word and kept going", "eaten someone else's lunch from the fridge by mistake", "forgotten my own phone number",
    ],
    friends: [
      "been on TV", "missed a flight", "sung in public", "fallen asleep at the cinema", "forgotten someone's birthday", "got lost abroad",
      "eaten a whole pizza alone", "cried at a film", "pretended to like a gift", "been locked out of my home", "waved back at someone who wasn't waving at me", "worn my clothes inside out all day",
      "laughed so much I cried", "texted the wrong person something about them", "walked out of a film", "tried to speak a language I couldn't", "got a nickname I didn't like", "stayed up all night talking",
      "joined a gym and never gone", "bought something I never used", "kept a pet that wasn't mine", "been in a school play", "forgotten where I parked", "sent a message and wished I could take it back",
      "lost a bet and had to do something silly", "climbed something I shouldn't have", "worn fancy dress to the wrong party", "danced on a table", "stayed in a hotel I couldn't pronounce", "slept through an alarm that mattered",
      "got a sunburn in a funny shape", "tried a food I couldn't name", "told a lie about my age", "missed my stop on the train", "burned something I was cooking", "given a speech I hadn't prepared",
    ],
  },
  {
    id: "hottake", name: "Hot takes", one: "Hot take", lead: "", tail: "",
    ask: "Everyone says agree or disagree on three. The one in the minority defends their side.",
    x: "Read it out and give your own take last.",
    kids: [
      "Pizza is the best food in the world.", "Rainy days are better than sunny days.", "Dogs are better than cats.", "Summer is better than winter.",
      "Breakfast is the best meal of the day.", "It is more fun to give a present than to get one.", "Homework should be banned at weekends.", "Pancakes are better than waffles.",
      "A bike is better than a scooter.", "The beach is better than the mountains.", "Chips are better with ketchup than with anything else.", "Sleepovers are better than parties.",
      "Cartoons are better than films.", "Every house should have a slide.",
    ],
    work: [
      "Meetings should never be longer than twenty minutes.", "Open-plan offices are a mistake.", "Working from home is better than the office.", "Everyone should take a proper lunch break away from their desk.",
      "Reply-all should not exist.", "A four-day week is better for everybody.", "Emails are better than calls.", "Calls are better than emails.",
      "Standing desks are overrated.", "The best ideas come from walking, not sitting.", "A tidy desk means a tidy mind.", "Dress codes are old-fashioned.",
      "Every team needs a snack drawer.", "Background music helps people work.", "Morning people get more done.", "Spreadsheets are more fun than people admit.",
    ],
    friends: [
      "A hot dog is a sandwich.", "Pineapple belongs on pizza.", "Cereal is a soup.", "The sequel is rarely better than the first film.",
      "Chocolate is better than vanilla.", "Winter is the best season.", "Socks with sandals are fine.", "Brunch is just a late breakfast with a fancier name.",
      "It is rude to read over someone's shoulder, even on a train.", "Group chats are the worst thing to happen to friendship.", "Phone calls are better than texts.", "A film is better at home than at the cinema.",
      "Books are always better than the film.", "Nobody needs more than three pairs of shoes.", "Mornings are the best part of the day.", "Reading the last page first is fine.",
      "Cold pizza is better than hot pizza.", "Holidays are better when nothing is planned.", "Lists are better than memory.", "Fancy restaurants are overrated.",
      "A good nap beats a good night out.", "Tomato ketchup belongs in the fridge.", "Board games bring out the worst in people.", "Everybody should learn to cook one great dish.",
      "Going on holiday with friends is harder than going with family.", "Spoilers don't ruin anything.", "Cats secretly run the world.", "You should always say yes to an invitation.",
      "Tea is better than coffee.", "The best days have no plans at all.",
    ],
  },
  {
    id: "finish", name: "Finish the sentence", one: "Finish it", lead: "", tail: "",
    ask: "Everyone finishes the sentence, one after another. The funniest or the truest gets a cheer.",
    x: "Start the sentence off, and finish it first.",
    kids: [
      "The best thing about my birthday is…", "If I could have any pet, it would be…", "My favourite thing to do on a rainy day is…", "When I grow up, I want to…",
      "If I were invisible for a day, I would…", "My superhero name would be…", "The silliest thing I ever did was…", "The best present I ever got was…",
      "The funniest word I know is…", "If I ran a school, the first rule would be…", "My favourite sound in the world is…", "If I could visit any planet, I'd go to…",
      "The food I could eat every day is…", "My secret hiding place is…", "The best game in the world is…", "I'm brave when…",
    ],
    work: [
      "The best part of my week is…", "If I could change one thing about meetings, it would be…", "The best advice I ever got was…", "On a perfect Monday morning, I would…",
      "My favourite thing about this team is…", "If I wasn't doing this job, I'd be…", "The skill I wish I had is…", "The most useful thing I own is…",
      "Something that always makes me smile at work is…", "If I had a free afternoon, I would…", "I am at my best when…", "The first thing I do when I get to my desk is…",
      "The last thing I learned was…", "A small thing that makes a big difference is…", "My ideal lunch break is…", "The thing I'd like to be remembered for is…",
    ],
    friends: [
      "The strangest thing in my bag right now is…", "If I won the lottery tomorrow, the first thing I'd buy is…", "The best meal I ever had was…", "I knew it was going to be a bad day when…",
      "The worst advice I ever took was…", "The one thing I can never say no to is…", "If I could swap lives with someone for a day, it would be…", "My most useless talent is…",
      "I laugh the most when…", "If I could live anywhere, I'd live…", "Something I pretend to know about is…", "If my life had a theme tune, it would be…",
      "The best compliment I ever got was…", "I secretly love…", "If I wrote a book, it would be called…", "My best holiday ever was…",
      "The thing that always makes me late is…", "If I could have dinner with anyone, it would be…", "The oddest job I ever had was…", "I never leave the house without…",
      "A smell that takes me back to childhood is…", "The most surprising thing about me is…", "My idea of a perfect Sunday is…", "If I had to eat one thing for a year, it'd be…",
      "My guilty pleasure is…", "The best present I ever gave was…", "I'll never forget the day…", "A talent I would love to have is…",
    ],
  },
  {
    id: "confess", name: "Confessions", one: "Confession", lead: "", tail: "",
    ask: "Everyone owns up, one after another, with the story if they have one. Nobody laughs until it's over.",
    x: "Confess first.",
    kids: [
      "Confess something silly you believed when you were small.", "Confess the funniest thing you ever got told off for.", "Confess a food you secretly don't like.", "Confess a game where you always bend the rules, only a little.",
      "Confess the name of a toy you still miss.", "Confess something you've hidden under your bed.", "Confess the longest you've ever stayed in the bath.", "Confess an imaginary friend you once had.",
      "Confess a song you know every word of.", "Confess something you pretended to be good at.",
    ],
    work: [
      "Confess a small mistake at work you never told anyone about.", "Confess your most-used excuse for being late.", "Confess how many tabs you have open right now.", "Confess a task you have been putting off for weeks.",
      "Confess the strangest thing you've eaten at your desk.", "Confess a word you still can't spell without checking.", "Confess a meeting you pretended to understand.", "Confess a time you were very bad at something you were supposed to be good at.",
      "Confess your favourite way to procrastinate.", "Confess the oldest thing in your bag.",
    ],
    friends: [
      "Confess the most embarrassing song on your phone.", "Confess a lie you told as a kid that still makes you smile.", "Confess the worst haircut you ever had.", "Confess something you bought and never used.",
      "Confess a film that makes you cry every time.", "Confess your worst habit when you cook.", "Confess something you've borrowed and never given back.", "Confess a trend you followed and now regret.",
      "Confess the silliest thing you've ever googled.", "Confess the last thing you did that you hoped nobody saw.", "Confess a secret talent that no one here knows about.", "Confess the worst present you've ever given.",
      "Confess a moment you laughed when you shouldn't have.", "Confess a TV show you pretend not to watch.", "Confess the most childish thing you still do.", "Confess a rule you break all the time.",
      "Confess the longest you've gone without washing a mug.", "Confess something you said you'd do, and never did.", "Confess a time you got totally lost.", "Confess a small thing you are weirdly proud of.",
      "Confess an app you open too many times a day.", "Confess your most embarrassing nickname.", "Confess the worst thing you've ever cooked.", "Confess your most useless purchase this year.",
      "Confess a time you didn't read the instructions and regretted it.", "Confess the weirdest thing you do when you're alone.",
    ],
  },
  {
    id: "ice", name: "Icebreakers", one: "Icebreaker", lead: "", tail: "",
    ask: "Everyone answers in turn. Keep it short, and ask one follow-up question each.",
    x: "Answer first, then pick who goes next.",
    kids: [
      "What is your favourite animal, and why?", "What is the best thing you ate this week?", "If you could have any superpower, what would it be?", "What is the funniest thing that happened to you at school?",
      "What is your favourite game to play with friends?", "What would you name a pet dragon?", "Which colour makes you happiest?", "What would you build if you had all the bricks in the world?",
      "What is your favourite place to be?", "What song do you sing most?", "If you had a day off, what would you do first?", "Which cartoon character would you like to meet?",
    ],
    work: [
      "What was your first job, and what did you learn?", "What is the best thing you've learned this year?", "What is one thing you do that helps you focus?", "What is your go-to lunch?",
      "What is a tool or app you couldn't work without?", "What was the best team you were ever on, and why?", "What would you do if you had one extra hour every day?", "What is something at work that always makes you smile?",
      "What is the best piece of advice you've been given?", "What did you want to be when you were ten?", "What do you do to switch off after work?", "What is something small that you're proud of lately?",
      "Which city would you most like to work in for a month?", "What is your favourite way to get to work?", "What is the best book or podcast you've found lately?", "What is a skill you'd like to learn this year?",
    ],
    friends: [
      "What is the best trip you ever took?", "What is the last thing that made you laugh out loud?", "If you could live in any decade, which would it be?", "What is the best meal you've ever cooked?",
      "What is a small thing that makes your day better?", "What was your favourite toy as a kid?", "What was the last film you loved?", "What was your first car, or first bike?",
      "What is the most useful thing you've learned from a friend?", "Which place would you love to go back to?", "What is your favourite smell?", "What is the best compliment you've received?",
      "If you could master any skill overnight, which one?", "What was your dream job as a child?", "What is the best present you've ever been given?", "What is your favourite thing about the place you live?",
      "What is the most interesting thing in your home?", "What would you do with a free weekend and no plans?", "What was the first concert or show you went to?", "What is your favourite word, and why?",
      "What is the strangest food you've enjoyed?", "Which book would you make everyone read?", "What was the best day of your last year?", "What did you collect when you were small?",
      "Which animal do you think is most like you?", "What is the best thing about your hometown?", "If your life were a film, who'd play you?", "What are you looking forward to the most?",
    ],
  },
  {
    id: "truths", name: "Two truths and a lie", one: "Two truths and a lie", lead: "Two truths and a lie about ", tail: ".",
    ask: "Say three things on the topic, two true and one false. The table votes on which is the lie.",
    x: "Go first: say your three.",
    kids: [
      "your favourite food", "animals", "your family and pets", "holidays", "your birthday", "what you can do", "school", "your favourite games",
    ],
    work: [
      "your first job", "your commute", "your lunch", "your desk", "something you've learned this year", "a project you've done", "your hobbies", "the places you've worked",
      "your best colleague", "a skill you have", "your morning routine", "your studies",
    ],
    friends: [
      "your childhood", "a trip you took", "your family history", "the strangest food you've eaten", "your talents", "your first day at a job", "something you've won", "a famous person you've met",
      "the places you've lived", "your worst haircut", "an accident you had", "your pets", "your odd habits", "your phone", "your school days", "something you can't do",
      "something you lost", "a time you were really scared", "sports you have tried", "music you love", "what you were like at twelve", "the oddest job you've had", "where you've been lost", "what you've cooked",
    ],
  },
];
