import * as fs from 'fs';
import * as path from 'path';
import { TraitType, CatastropheCard, BunkerRoom } from '../game/types';

/**
 * Data loader service for game data with caching support.
 * Loads game data from JSON files with language fallback to English.
 */
export class DataLoaderService {
  private catastrophesCache = new Map<string, CatastropheCard[]>();
  private bunkerRoomsCache = new Map<string, BunkerRoom[]>();
  private traitsCache = new Map<string, Record<TraitType, Array<{id: string; name: string; description: string}>>>();
  private messagesCache = new Map<string, Record<string, any>>();

  /**
   * Loads data from JSON file with caching and language fallback.
   * @param dataType - Type of data to load
   * @param language - Language code (defaults to 'en')
   * @returns Loaded data
   */
  private loadData<T>(dataType: 'catastrophes' | 'traits' | 'bunker' | 'messages', language: string = 'en'): T {
    const cacheKey = language;
    const cacheMap = dataType === 'bunker' ? this.bunkerRoomsCache : 
                     dataType === 'catastrophes' ? this.catastrophesCache :
                     dataType === 'traits' ? this.traitsCache :
                     this.messagesCache;
    
    // Return cached data if available
    if (cacheMap.has(cacheKey)) {
      return cacheMap.get(cacheKey) as T;
    }
    
    const filePath = path.join(__dirname, '../game/data', `${dataType}-${language}.json`);
    
    // Fallback to English if requested language file doesn't exist
    if (!fs.existsSync(filePath)) {
      const fallbackPath = path.join(__dirname, '../game/data', `${dataType}-en.json`);
      try {
        const data = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
        cacheMap.set(cacheKey, data);
        return data;
      } catch (error) {
        console.error(`Failed to parse fallback file ${fallbackPath}:`, error);
        throw new Error(`Failed to load ${dataType} data`);
      }
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      cacheMap.set(cacheKey, data);
      return data;
    } catch (error) {
      console.error(`Failed to parse file ${filePath}:`, error);
      throw new Error(`Failed to load ${dataType} data`);
    }
  }

  /**
   * Gets catastrophe cards for a language.
   */
  getCatastrophes(language: string = 'en'): CatastropheCard[] {
    return this.loadData<CatastropheCard[]>('catastrophes', language);
  }

  /**
   * Gets bunker rooms for a language.
   */
  getBunkerRooms(language: string = 'en'): BunkerRoom[] {
    return this.loadData<BunkerRoom[]>('bunker', language);
  }

  /**
   * Gets trait cards for a language.
   */
  getTraits(language: string = 'en'): Record<TraitType, Array<{id: string; name: string; description: string}>> {
    return this.loadData<Record<TraitType, Array<{id: string; name: string; description: string}>>>('traits', language);
  }

  /**
   * Gets localized messages for a language.
   */
  getMessages(language: string = 'en'): Record<string, any> {
    return this.loadData<Record<string, any>>('messages', language);
  }

  /**
   * Clears all caches (useful for testing or hot reload).
   */
  clearCache(): void {
    this.catastrophesCache.clear();
    this.bunkerRoomsCache.clear();
    this.traitsCache.clear();
    this.messagesCache.clear();
  }
}

// Export singleton instance
export const dataLoader = new DataLoaderService();
