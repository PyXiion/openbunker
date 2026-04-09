/**
 * Debug-only logger utility
 * Logs are only shown when DEBUG environment variable is set
 */

const isDebug = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args: any[]) => {
    if (isDebug) {
      console.log('[DEBUG]', ...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isDebug) {
      console.info('[DEBUG]', ...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (isDebug) {
      console.warn('[DEBUG]', ...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (isDebug) {
      console.debug('[DEBUG]', ...args);
    }
  },
  
  // Keep error logging always visible
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  }
};
