/**
 * Differential update utility for game state.
 * Computes and applies deltas to reduce bandwidth usage.
 */

export interface Delta {
  type: 'full' | 'partial';
  data?: any;
  changes?: Record<string, any>;
}

/**
 * Computes the delta between two objects.
 * Returns only the fields that have changed.
 */
export function computeDelta(oldState: any, newState: any): Record<string, any> {
  if (!oldState) {
    return newState; // No previous state, send full state
  }

  const changes: Record<string, any> = {};

  for (const key in newState) {
    if (!Object.prototype.hasOwnProperty.call(newState, key)) continue;

    const oldValue = oldState[key];
    const newValue = newState[key];

    if (oldValue === undefined && newValue !== undefined) {
      // New field added
      changes[key] = newValue;
    } else if (oldValue === newValue) {
      // Unchanged (primitive comparison)
      continue;
    } else if (typeof newValue === 'object' && newValue !== null && !Array.isArray(newValue)) {
      // Nested object - recursively compute delta
      const nestedDelta = computeDelta(oldValue, newValue);
      if (Object.keys(nestedDelta).length > 0) {
        changes[key] = nestedDelta;
      }
    } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      // Field changed (arrays or complex objects)
      changes[key] = newValue;
    }
  }

  return changes;
}

/**
 * Applies a delta to an existing state.
 */
export function applyDelta(state: any, delta: Record<string, any>): any {
  if (!state) {
    return delta;
  }

  const result = { ...state };

  for (const key in delta) {
    if (!Object.prototype.hasOwnProperty.call(delta, key)) continue;

    const value = delta[key];

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively apply delta to nested objects
      result[key] = applyDelta(state[key] || {}, value);
    } else {
      // Replace primitive values or arrays
      result[key] = value;
    }
  }

  return result;
}

/**
 * Estimates the size of a delta in bytes (rough approximation).
 */
export function estimateDeltaSize(delta: Record<string, any>): number {
  return JSON.stringify(delta).length;
}

/**
 * Determines whether to send a full state or delta based on delta size.
 */
export function shouldSendFullState(delta: Record<string, any>, threshold: number = 1000): boolean {
  return estimateDeltaSize(delta) > threshold;
}
