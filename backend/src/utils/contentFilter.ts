/**
 * Content filtering utilities for chat messages
 * Provides slur detection and blurring functionality
 */

import { LRUCache } from 'lru-cache';
import { getConfig } from '../config';
import { 
  ENGLISH_SLURS, 
  RUSSIAN_SLURS, 
  RUSSIAN_REGEX_SLURS, 
  LEET_VARIATIONS, 
  CYRILLIC_LOOKALIKES, 
  SLURS 
} from '../data/slurs';

const config = getConfig();

// LRU cache for filtered messages to reduce CPU overhead
const filterCache = new LRUCache<string, string>({
  max: config.content_filter.cache_max,
  ttl: config.content_filter.cache_ttl_ms,
});

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