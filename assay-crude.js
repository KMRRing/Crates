// Crude words, as guesses only (README, Assay). Wordle accepts them, so a player who opens with one is not turned away; none can
// be the answer, since answers come from the commonest words (assay-words.js). The shared English list (wordlist.js) leaves
// them out, so they are kept here, for the lengths Assay plays (four to seven). Sexual, bodily and profane words and insults;
// no slur against a people, a faith or a sexuality (the original lets those in; this does not, so a team's screen never
// shows one a partner typed). Written by hand from the profanity lists of naughty-words (LDNOOBW) and profane-words and
// from Wordle's own list of words it accepts (five letters), keeping real words and leaving misspellings and brands out.
export const CRUDE = new Set(`
  anal anus boob clit cock cuck cunt dick fuck jism jizz milf mofo nads orgy poon porn pube quim rape sexy shat
  shit slut smut tits twat wang wank
  asses bitch boink boner boobs busty choad chode clits cocks cunny cunts dicks dildo fecal felch fucks fugly
  horny kinky minge nudie panty penis porno pubes pussy queef raped semen sexed shite shits skank sluts spunk
  titty tushy twats vulva wanky whore
  asshat bimbos bollok bollox boners damnit dildos doodoo dookie erotic fecker fucked fucker fuckin fuckup goddam
  hentai incest jizzed minger nipple nympho orgasm orgies peepee pornos raping rapist rimjob scrote shitty skanks
  skanky sodomy spooge stiffy titjob tittie tittis tosser vagina wanker weewee whored whores
  apeshit assface asshead asshole asswipe ballbag bastard bellend bitched bitches blowjob bollock bondage crapola
  cumming cumshot dickbag dickish dickwad dipshit dumbass erotism fellate fisting fuckass fuckbag fuckboy fuckers
  fucking fucknut fuckoff fuckwit handjob horndog humping jackoff jerkoff nipples nutsack orgasms panties penises
  pissing pissoff pussies schlong shagger shitbag shitcan shitter splooge titties topless upskirt wanking
`.trim().split(/\s+/));
