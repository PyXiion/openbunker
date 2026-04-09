/**
 * Debug-only logger utility for frontend
 * Logs are only shown when DEBUG environment variable is set or in development
 */

const isDebug = 
  (typeof process !== 'undefined' && process.env?.DEBUG === 'true') ||
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
  (typeof window !== 'undefined' && (window as any).__NUXT__?.config?.dev);

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
