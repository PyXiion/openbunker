/**
 * Content filtering utilities for chat messages
 * Provides slur detection and blurring functionality
 */

import { LRUCache } from 'lru-cache';
import { getConfig } from '../config';

const config = getConfig();

// LRU cache for filtered messages to reduce CPU overhead
const filterCache = new LRUCache<string, string>({
  max: config.content_filter.cache_max,
  ttl: config.content_filter.cache_ttl_ms,
});

// Comprehensive profanity filter - English
const ENGLISH_SLURS = [
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


const RUSSIAN_SLURS = [
  // === СИЛЬНЫЙ МАТ (Core Profanity) ===
  'хуй', 'пизда', 'ебать', 'блядь', 'бля', 'мудак', 'хуесос', 'гандон', 'гондон', 'залупа', 'манда',
  'охуеть', 'пиздец', 'ебанат', 'уебок', 'ебало', 'пиздюк', 'хуила', 'пидор', 'пидорас', 'сука',

  // === ОСКОРБЛЕНИЯ (Degrading Slurs) ===
  'шлюха', 'курва', 'давалка', 'потаскуха', 'мразь', 'тварь', 'падла', 'ублюдок', 'выродок', 'чмо',
  'гнида', 'стерва', 'шалава', 'проститутка', 'хуеплет', 'дрищ', 'лошара', 'лохозавр',

  // === ЭТНИЧЕСКИЕ И РАСОВЫЕ (Hate Speech) ===
  'хач', 'чурка', 'черножопый', 'жид', 'хохол', 'кацап', 'москаль', 'пиндос', 'ниггер', 'нигер',
  'узкоглазый', 'чурбан', 'черномазый', 'укроп', 'ватник', 'рашист',

  // === ЛГБТ-ОСКОРБЛЕНИЯ (Hateful/Slurs only) ===
  'педик', 'гомик', 'лесбуха', 'педераст', 'гомосек', 'петушара',

  // === ЖЕСТОКОСТЬ И УГРОЗЫ (Violence/Threats) ===
  'сдохни', 'убью', 'расчлененка', 'изнасилую', 'живодер', 'террорист', 'шахид'
];

const RUSSIAN_REGEX_SLURS = [
  /^(?:на|по|за|от|вы|при|под|пере|не|до|о|об|обо|рас|с)?ху[йеёяию][а-яё]*/i,
  /^(?:на|по|за|от|вы|при|под|пере|не|до|о|об|обо|рас|с)?пизд[а-яё]*/i,
  /^(?:уеб|заеб|доеб|выеб|отъеб|въеб|объеб|разъеб|съеб)[а-яё]*/i,
  /^(?:еба|ебу|ебл|ебн|ёбн)[а-яё]*/i,
  /^(?:бля|бляд|ублюд)[а-яё]*/i,
  /^(?:муда|мудо)[а-яё]*/i,
  /^г[ао]ндон[а-яё]*/i,
  /^чмо(?:ш|шн)?[а-яё]*/i,

  /^(?:на|по|за|от|вы|при|под|пере|раз|с)?(?:манда|залуп|письк|писюн|пиписк|сиськ|титьк|жоп|очк|срак|перд|бзд|сц|ср)[а-яё]*/i,
  /^(?:не)?(?:петух|петуш)[а-яё]*(?:арь|иный|оватый)?/i,   // осторожно – может ловить домашнюю птицу
  /^(?:пед(?:ерик|ераст)|гомос[а-яё]*|лесб[а-яё]*)/i,
  /^(?:наци(?:ст|к)|фаши(?:ст|к)|скинхед|коловрат|свастик)/i,
  /^(?:уби|смерт|самоуби|суицид|террор|взрыв|бомб|стрел|расстрел)/i,
  /^(?:нарк(?:отик|оман|ота)|амфет|метадон|героин|кокаин|спайс|мефедрон)/i,
  /^(?:путин(?:оид|ский|щина)|путлер|рашист|кремлебот|ватник|укроп|бандеровец|хохол|кацап|москаль|чурка|жид)/i
];

// Combined slur list for static matching
const SLURS = [...ENGLISH_SLURS, ...RUSSIAN_SLURS];

// Leet speak variations (Latin)
const LEET_VARIATIONS = {
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
const CYRILLIC_LOOKALIKES = {
  'a': 'а', 'p': 'р', 'o': 'о', 'x': 'х', 'y': 'у', 
  'e': 'е', 'c': 'с', 'k': 'к', '3': 'з', '0': 'о',
};

/**
 * Detects if text contains Cyrillic characters
 */
function containsCyrillic(text: string): boolean {
  return /[\u0400-\u04FF]/.test(text);
}

/**
 * Converts leet speak to normal characters for detection (Latin)
 */
function normalizeLatinText(text: string): string {
  let normalized = text.toLowerCase();
  normalized = normalized.replace(/[^a-z0-9]/g, '');
  
  for (const [leet, normal] of Object.entries(LEET_VARIATIONS)) {
    const escapedLeet = leet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    normalized = normalized.replace(new RegExp(escapedLeet, 'g'), normal);
  }
  return normalized;
}

/**
 * Converts leet speak to normal characters for detection (Cyrillic)
 */
function normalizeCyrillicText(text: string): string {
  let normalized = text.toLowerCase();
  normalized = normalized.replace(/[^a-z0-9\u0400-\u04FFё]/g, ''); // Added 'ё' explicitly
  
  // 1. Replace leet speak numbers/symbols to Latin letters
  for (const [leet, normal] of Object.entries(LEET_VARIATIONS)) {
    const escapedLeet = leet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    normalized = normalized.replace(new RegExp(escapedLeet, 'g'), normal);
  }

  // 2. Convert Latin lookalikes back to Cyrillic
  for (const [latin, cyrillic] of Object.entries(CYRILLIC_LOOKALIKES)) {
    const escapedLatin = latin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    normalized = normalized.replace(new RegExp(escapedLatin, 'g'), cyrillic);
  }
  return normalized;
}

/**
 * Converts leet speak to normal characters for detection (multilingual)
 */
function normalizeText(text: string): string {
  if (containsCyrillic(text)) {
    return normalizeCyrillicText(text);
  }
  return normalizeLatinText(text);
}

/**
 * Checks if a message contains slurs (using arrays and regex)
 */
function containsSlur(text: string): boolean {
  const words = text.split(/(\s+)/).filter(w => w.trim());
  
  for (const word of words) {
    const normalized = normalizeText(word);
    const originalLower = word.toLowerCase();
    
    // Check static arrays
    for (const slur of SLURS) {
      const slurLower = slur.toLowerCase();
      const slurNormalized = normalizeText(slur);
      
      if (originalLower.includes(slurLower) || normalized.includes(slurNormalized)) {
        return true;
      }
    }
    
    // Check Regex roots
    for (const regex of RUSSIAN_REGEX_SLURS) {
      if (regex.test(originalLower) || regex.test(normalized)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Blurs/detects slurs in text by replacing them with asterisks
 */
export function blurSlurs(text: string): string {
  const words = text.split(/(\s+)/); 
  const blurredWords = words.map(word => {
    if (!word.trim()) return word;
    
    const normalizedWord = normalizeText(word);
    const originalLower = word.toLowerCase();
    let isSlur = false;

    // 1. Check Russian Regex Patterns First
    for (const regex of RUSSIAN_REGEX_SLURS) {
      if (regex.test(originalLower) || regex.test(normalizedWord)) {
        isSlur = true;
        break;
      }
    }

    // 2. Check Static Slurs Array if Regex didn't catch it
    if (!isSlur) {
      for (const slur of SLURS) {
        const slurLower = slur.toLowerCase();
        const slurNormalized = normalizeText(slur);
        
        if (originalLower.includes(slurLower) || 
            normalizedWord.includes(slurNormalized) ||
            slurNormalized === normalizedWord) {
          isSlur = true;
          break;
        }
      }
    }
    
    if (isSlur) {
      // we use markdown
      return '\\*'.repeat(word.length);
    }
    
    return word;
  });
  
  return blurredWords.join('');
}

/**
 * Checks if a message contains inappropriate content
 */
export function hasInappropriateContent(text: string): boolean {
  return containsSlur(text);
}

/**
 * Filters a chat message by blurring any inappropriate content
 * Uses LRU cache to avoid re-filtering identical messages
 */
export function filterChatMessage(message: string): string {
  const cacheKey = message.toLowerCase().trim();
  
  // Check cache first
  if (filterCache.has(cacheKey)) {
    return filterCache.get(cacheKey)!;
  }
  
  // Filter the message
  const filtered = blurSlurs(message);
  
  // Cache the result
  filterCache.set(cacheKey, filtered);
  
  return filtered;
}