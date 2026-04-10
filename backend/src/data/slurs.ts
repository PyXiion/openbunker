/**
 * Slur and profanity data for content filtering.
 * Contains slur lists in multiple languages and normalization mappings.
 */

// Comprehensive profanity filter - English
export const ENGLISH_SLURS = [
  // Strong profanity
  'fuck', 'fucking', 'fucker', 'fucked', 'fuckup', 'fuckwit', 'fuckface',
  'shit', 'shitty', 'shitting', 'shithead', 'shitface', 'bullshit',
  'cunt', 'cunting', 'cunts',
  'ass', 'asshole', 'asshat', 'asswipe', 'dumbass', 'badass',
  'bitch', 'bitching', 'bitched', 'sonofabitch', 'sonofabitches',
  'bastard', 'bastards', 'l bastard',
  
  // Sexual content
  'pussy', 'pussies', 'dick', 'dicks', 'dickhead', 'dickwad', 'cock', 'cocks', 'cock sucker',
  'whore', 'whores', 'slut', 'sluts', 'slutty', 'hooker', 'hookers', 'prostitute',
  'rape', 'raping', 'rapist', 'molest', 'molestation', 'pedophile', 'pedophilia',
  'nude', 'naked', 'nudity', 'porn', 'pornography', 'porno', 'erotic',
  'sex', 'sexual', 'intercourse', 'orgasm', 'orgasms', 'masturbate', 'masturbation',
  'penis', 'vagina', 'clitoris', 'testicles', 'breasts', 'boobs', 'tits', 'nipples',
  
  // Racial and ethnic slurs
  'nigger', 'nigga', 'niggers', 'niggas', 'niglet',
  'chink', 'chinks', 'gook', 'gooks', 'spic', 'spics', 'wetback', 'wetbacks',
  'kike', 'kikes', 'heeb', 'hebes', 'kyke', 'kykes',
  'wop', 'wops', 'dego', 'dego', 'guinea', 'guineas',
  'paki', 'pakis', 'raghead', 'ragheads', 'sandnigger', 'sandniggers',
  'cracker', 'crackers', 'honkey', 'honkeys', 'honky', 'honkies',
  'redskin', 'redskins', 'injun', 'injuns', 'savage', 'savages',
  
  // LGBTQ+ slurs
  'fag', 'faggot', 'faggots', 'faggy', 'fagging',
  'dyke', 'dykes', 'lesbo', 'lesbos', 'queer', 'queers',
  'tranny', 'trannies', 'shemale', 'shemales', 'ladyboy', 'ladyboys',
  
  // Disability and mental health slurs
  'retard', 'retarded', 'retards', 'retardation',
  'spastic', 'spastics', 'cripple', 'cripples', 'gimp', 'gimps',
  'lunatic', 'lunatics', 'insane', 'madman', 'madmen',
  
  // General insults
  'idiot', 'idiots', 'stupid', 'stupidity', 'moron', 'morons', 'imbecile', 'imbeciles',
  'loser', 'losers', 'jerk', 'jerks', 'jerkoff', 'jerkoffs',
  'douche', 'douchebag', 'douchebags', 'douche nozzle',
  'sucker', 'suckers', 'suck', 'sucking', 'sucks',
  'twat', 'twats', 'wanker', 'wankers', 'tosser', 'tossers',
  
  // Violence and threats
  'kill', 'killing', 'kills', 'murder', 'murdering', 'murders', 'murderer',
  'death', 'dead', 'die', 'dying', 'suicide', 'suicidal',
  'terrorist', 'terrorism', 'bomb', 'bombing', 'bombs', 'explode', 'explosion',
  'shoot', 'shooting', 'shoots', 'shot', 'gun', 'guns', 'weapon', 'weapons',
  'stab', 'stabbing', 'stabs', 'knife', 'knives', 'cut', 'cutting', 'cuts',
  
  // Drug references
  'drug', 'drugs', 'cocaine', 'heroin', 'meth', 'methamphetamine', 'crack', 'weed',
  'marijuana', 'pot', 'lsd', 'ecstasy', 'addict', 'addicts', 'addiction',
  
  // Body fluids and functions
  'piss', 'pissing', 'pissed', 'pissed off', 'urine', 'urinating',
  'cum', 'cumming', 'semen', 'ejaculate', 'ejaculation',
  'feces', 'fecal', 'defecate', 'defecation', 'poop', 'pooping',
  
  // Religious slurs and blasphemy
  'goddamn', 'goddammit', 'jesus christ', 'jesus fucking christ',
  'allah', 'muslim', 'muslims', 'jew', 'jews', 'christian', 'christians',
  
  // Gender-based slurs
  'bimbo', 'bimbos', 'gold digger', 'gold diggers', 'slutty', 'tramp', 'tramps',
  'manwhore', 'manwhores', 'player', 'players', 'womanizer', 'womanizers',
  
  // Age-related slurs
  'old fart', 'old farts', 'geezer', 'geezers', 'coot', 'coots',
  
  // Other offensive terms
  'hate', 'hating', 'racist', 'racism', 'sexist', 'sexism',
  'nazi', 'nazis', 'hitler', 'fascist', 'fascism', 'kkk', 'klan',
  'satan', 'satanic', 'devil', 'demonic', 'hell', 'damn', 'damned',
];

export const RUSSIAN_SLURS = [
  // === СИЛЬНЫЙ МАТ (Core Profanity) ===
  'хуй', 'пизда', 'ебать', 'блядь', 'бля', 'мудак', 'хуесос', 'гандон', 'гондон', 'залупа', 'манда',
  'охуеть', 'пиздец', 'ебанат', 'уебок', 'ебало', 'пиздюк', 'хуила', 'пидор', 'пидорас', 'сука',

  // === ОСКОРБЛЕНИЯ (Degrading Slurs) ===
  'шлюха', 'курва', 'давалка', 'потаскуха', 'мразь', 'тварь', 'падла', 'ублюдок', 'выродок', 'чмо',
  'гнида', 'стерва', 'шалава', 'проститутка', 'хуеплет', 'дрищ', 'лошара', 'лохозавр',

  // === ЭТНИЧЕСКИЕ И РАСОВЫЕ (Hate Speech) ===
  'хач', 'чурка', 'черножопый', 'жид', 'хохол', 'кацап', 'москаль', 'пиндос', 'ниггер', 'нигер', 'негр',
  'узкоглазый', 'чурбан', 'черномазый', 'укроп', 'ватник', 'рашист',

  // === ЛГБТ-ОСКОРБЛЕНИЯ (Hateful/Slurs only) ===
  'педик', 'гомик', 'лесбуха', 'педераст', 'гомосек', 'петушара', 'гей', 'лесбиянка', 'лесби',
  'гомогей', 'нетрадиционный',

  // === ЖЕСТОКОСТЬ И УГРОЗЫ (Violence/Threats) ===
  'сдохни', 'убью', 'расчлененка', 'изнасилую', 'живодер', 'террорист', 'шахид', 'арабы'
];

export const RUSSIAN_REGEX_SLURS = [
  /^(?:на|по|за|от|вы|при|под|пере|не|до|о|об|обо|рас|с)?ху[йеёяию][а-яё]*/i,
  /^(?:на|по|за|от|вы|при|под|пере|не|до|о|об|обо|рас|с)?пизд[а-яё]*/i,
  /^(?:уеб|заеб|доеб|выеб|отъеб|въеб|объеб|разъеб|съеб)[а-яё]*/i,
  /^(?:еба|ебу|ебл|ебн|ёбн)[а-яё]*/i,
  /^(?:бля|бляд|ублюд)[а-яё]*/i,
  /^(?:муда|мудо)[а-яё]*/i,
  /^г[ао]ндон[а-яё]*/i,
  /^чмо(?:ш|шн)?[а-яё]*/i,

  /^(?:на|по|за|от|вы|при|под|пере|раз|с)?(?:манда|залуп|письк|писюн|пиписк|сиськ|титьк|жоп|очк|срак|перд|бзд|сц|ср)[а-яё]*/i,
  /^(?:не)?(?:петух|петуш)[а-яё]*(?:арь|иный|оватый)?/i,
  /^(?:пед(?:ерик|ераст)|гомос[а-яё]*|лесб[а-яё]*)/i,
  /^(?:наци(?:ст|к)|фаши(?:ст|к)|скинхед|коловрат|свастик)/i,
  /^(?:уби|смерт|самоуби|суицид|террор|взрыв|бомб|стрел|расстрел)/i,
  /^(?:нарк(?:отик|оман|ота)|амфет|метадон|героин|кокаин|спайс|мефедрон)/i,
  /^(?:путин(?:оид|ский|щина|изм)|путлер|рашист|кремлебот|ватник|укроп|бандеровец|хохол|кацап|москаль|чурка|жид)/i
];

// Leet speak variations (Latin)
export const LEET_VARIATIONS = {
  '4': 'a', '@': 'a',
  '3': 'e', '£': 'e',
  '1': 'i', '!': 'i', '|': 'i',
  '0': 'o', '()': 'o',
  '$': 's', '5': 's',
  '7': 't', '+': 't',
  '8': 'b', '6': 'b',
  '9': 'g', 'q': 'g',
  '2': 'z', 'z': 'z',
  'ck': 'c', 'kk': 'c',
  'ph': 'f', 'ff': 'f',
  'gh': 'g',
  'x': 'ks', 'cs': 'x',
};

// Cyrillic lookalikes to prevent bypasses like "xуй" (Latin x)
export const CYRILLIC_LOOKALIKES = {
  'a': 'а', 'p': 'р', 'o': 'о', 'x': 'х', 'y': 'у', 
  'e': 'е', 'c': 'с', 'k': 'к', '3': 'з', '0': 'о',
};

// Combined slur list for static matching
export const SLURS = [...ENGLISH_SLURS, ...RUSSIAN_SLURS];
