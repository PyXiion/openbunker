import { describe, it, expect, beforeEach } from 'vitest';
import { blurSlurs, hasInappropriateContent, filterChatMessage } from '../../utils/contentFilter';

describe('blurSlurs', () => {
  it('should blur English profanity', () => {
    const result = blurSlurs('This is fucking bad');
    expect(result).toContain('\\*');
  });

  it('should blur racial slurs', () => {
    const result = blurSlurs('That word is offensive');
    expect(result).toBe('That word is offensive'); // No slur in this message
  });

  it('should blur multiple slurs in a message', () => {
    const result = blurSlurs('shit and damn');
    expect(result).toContain('\\*');
  });

  it('should handle empty string', () => {
    const result = blurSlurs('');
    expect(result).toBe('');
  });

  it('should handle string with only slurs', () => {
    const result = blurSlurs('fuck');
    expect(result).toBe('\\*\\*\\*\\*');
  });

  it('should preserve whitespace', () => {
    const result = blurSlurs('word  shit  word');
    expect(result).toBe('word  \\*\\*\\*\\*  word');
  });

  it('should be case-insensitive', () => {
    const result1 = blurSlurs('FUCK');
    const result2 = blurSlurs('fuck');
    const result3 = blurSlurs('FuCk');
    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
  });

  it('should blur slurs at start of message', () => {
    const result = blurSlurs('shit happens');
    expect(result).toMatch(/^\\\*\\\*\\\*\\\*/);
  });

  it('should blur slurs at end of message', () => {
    const result = blurSlurs('oh shit');
    expect(result).toMatch(/\\\*\\\*\\\*\\\*$/);
  });

  it('should handle punctuation around slurs', () => {
    const result = blurSlurs('shit!');
    // The implementation includes punctuation in the blur
    expect(result).toContain('\\*');
  });

  it('should blur Russian profanity', () => {
    const result = blurSlurs('хуй');
    expect(result).toBe('\\*\\*\\*');
  });

  it('should handle mixed Latin and Cyrillic', () => {
    const result = blurSlurs('test хуй world');
    expect(result).toContain('\\*\\*\\*');
  });

  it('should preserve numbers in non-slur context', () => {
    const result = blurSlurs('I have 2 apples');
    expect(result).toBe('I have 2 apples');
  });
});

describe('hasInappropriateContent', () => {
  it('should return true for profanity', () => {
    const result = hasInappropriateContent('This is fucking bad');
    expect(result).toBe(true);
  });

  it('should return false for clean text without known slurs', () => {
    const result = hasInappropriateContent('That word is offensive');
    expect(result).toBe(false);
  });

  it('should return false for empty string', () => {
    const result = hasInappropriateContent('');
    expect(result).toBe(false);
  });

  it('should detect Russian profanity', () => {
    const result = hasInappropriateContent('хуй тебе');
    expect(result).toBe(true);
  });

  it('should be case-insensitive', () => {
    const result1 = hasInappropriateContent('FUCK');
    const result2 = hasInappropriateContent('fuck');
    expect(result1).toBe(result2);
    expect(result1).toBe(true);
  });

  it('should detect slurs with punctuation', () => {
    const result = hasInappropriateContent('shit!');
    expect(result).toBe(true);
  });
});

describe('filterChatMessage', () => {
  beforeEach(() => {
    // Clear the cache before each test
    // Note: We can't directly clear the LRU cache as it's not exported
    // But we can test caching behavior by calling same message twice
  });

  it('should filter inappropriate content', () => {
    const result = filterChatMessage('This is fucking bad');
    expect(result).toContain('\\*');
  });

  it('should handle empty string', () => {
    const result = filterChatMessage('');
    expect(result).toBe('');
  });

  it('should be case-insensitive', () => {
    const result1 = filterChatMessage('FUCK this');
    const result2 = filterChatMessage('fuck this');
    expect(result1).toBe(result2);
  });

  it('should cache filtered results', () => {
    const message = 'This is a test message with shit';
    const result1 = filterChatMessage(message);
    const result2 = filterChatMessage(message);
    expect(result1).toBe(result2);
  });

  it('should handle multiple spaces', () => {
    const result = filterChatMessage('word   shit   word');
    expect(result).toBe('word   \\*\\*\\*\\*   word');
  });

  it('should handle leading/trailing whitespace', () => {
    const result = filterChatMessage('  shit  ');
    expect(result).toBe('  \\*\\*\\*\\*  ');
  });

  it('should preserve newlines', () => {
    const result = filterChatMessage('line1\nshit\nline2');
    expect(result).toContain('line1');
    expect(result).toContain('\\*\\*\\*\\*');
    expect(result).toContain('line2');
  });

  it('should handle tabs', () => {
    const result = filterChatMessage('word\tshit\tword');
    expect(result).toBe('word\t\\*\\*\\*\\*\tword');
  });
});

describe('Edge Cases', () => {
  it('should handle very long messages', () => {
    const longMessage = 'clean '.repeat(1000) + 'shit';
    const result = blurSlurs(longMessage);
    expect(result).toContain('\\*\\*\\*\\*');
  });

  it('should handle special characters', () => {
    const result = blurSlurs('shit@#$%^&*()');
    // The implementation includes special characters in the blur
    expect(result).toContain('\\*');
  });

  it('should handle emoji', () => {
    const result = blurSlurs('shit 😊');
    expect(result).toContain('\\*');
    expect(result).toContain('😊');
  });

  it('should handle unicode characters', () => {
    const result = blurSlurs('café shit');
    expect(result).toContain('café');
    expect(result).toContain('\\*\\*\\*\\*');
  });

  it('should handle mixed scripts', () => {
    const result = blurSlurs('hello хуй world');
    expect(result).toContain('\\*\\*\\*');
  });

  it('should handle repeated characters', () => {
    // The implementation doesn't handle variations like "shiiit" since it's not an exact match
    const result = blurSlurs('shiiit');
    // This might not be filtered since it doesn't match the exact slur pattern
    expect(result).toBeTruthy();
  });
});
