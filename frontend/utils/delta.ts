/**
 * Differential update utility for game state.
 * Computes and applies deltas to reduce bandwidth usage.
 */

/**
 * Applies a delta to an existing state.
 * Recursively merges the delta into the state.
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
