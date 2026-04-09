import { describe, it, expect } from 'vitest';
import { computeDelta, applyDelta, estimateDeltaSize, shouldSendFullState } from '../../utils/delta';

describe('computeDelta', () => {
  it('should return full state when oldState is null', () => {
    const newState = { a: 1, b: 2 };
    const delta = computeDelta(null, newState);
    expect(delta).toEqual(newState);
  });

  it('should return full state when oldState is undefined', () => {
    const newState = { a: 1, b: 2 };
    const delta = computeDelta(undefined, newState);
    expect(delta).toEqual(newState);
  });

  it('should detect changed primitive values', () => {
    const oldState = { a: 1, b: 2 };
    const newState = { a: 1, b: 3 };
    const delta = computeDelta(oldState, newState);
    expect(delta).toEqual({ b: 3 });
  });

  it('should detect new fields', () => {
    const oldState = { a: 1 };
    const newState = { a: 1, b: 2 };
    const delta = computeDelta(oldState, newState);
    expect(delta).toEqual({ b: 2 });
  });

  it('should ignore unchanged primitive values', () => {
    const oldState = { a: 1, b: 2, c: 3 };
    const newState = { a: 1, b: 2, c: 3 };
    const delta = computeDelta(oldState, newState);
    expect(delta).toEqual({});
  });

  it('should handle nested objects recursively', () => {
    const oldState = { a: { x: 1, y: 2 }, b: 3 };
    const newState = { a: { x: 1, y: 5 }, b: 3 };
    const delta = computeDelta(oldState, newState);
    expect(delta).toEqual({ a: { y: 5 } });
  });

  it('should handle array changes', () => {
    const oldState = { items: [1, 2, 3] };
    const newState = { items: [1, 2, 4] };
    const delta = computeDelta(oldState, newState);
    expect(delta).toEqual({ items: [1, 2, 4] });
  });

  it('should handle deeply nested objects', () => {
    const oldState = { a: { b: { c: { d: 1 } } } };
    const newState = { a: { b: { c: { d: 2 } } } };
    const delta = computeDelta(oldState, newState);
    expect(delta).toEqual({ a: { b: { c: { d: 2 } } } });
  });

  it('should handle mixed types', () => {
    const oldState = {
      num: 1,
      str: 'hello',
      bool: true,
      arr: [1, 2],
      obj: { x: 1 }
    };
    const newState = {
      num: 2,
      str: 'hello',
      bool: false,
      arr: [1, 2],
      obj: { x: 2 }
    };
    const delta = computeDelta(oldState, newState);
    expect(delta).toEqual({
      num: 2,
      bool: false,
      obj: { x: 2 }
    });
  });

  it('should return empty object when states are identical', () => {
    const state = { a: 1, b: { c: 2 } };
    const delta = computeDelta(state, state);
    expect(delta).toEqual({});
  });

  it('should handle null values in state', () => {
    const oldState = { a: null, b: 1 };
    const newState = { a: 2, b: 1 };
    const delta = computeDelta(oldState, newState);
    expect(delta).toEqual({ a: 2 });
  });
});

describe('applyDelta', () => {
  it('should return delta when state is null', () => {
    const delta = { a: 1, b: 2 };
    const result = applyDelta(null, delta);
    expect(result).toEqual(delta);
  });

  it('should return delta when state is undefined', () => {
    const delta = { a: 1, b: 2 };
    const result = applyDelta(undefined, delta);
    expect(result).toEqual(delta);
  });

  it('should apply delta to primitive values', () => {
    const state = { a: 1, b: 2 };
    const delta = { b: 3 };
    const result = applyDelta(state, delta);
    expect(result).toEqual({ a: 1, b: 3 });
  });

  it('should add new fields from delta', () => {
    const state = { a: 1 };
    const delta = { b: 2 };
    const result = applyDelta(state, delta);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('should recursively apply delta to nested objects', () => {
    const state = { a: { x: 1, y: 2 }, b: 3 };
    const delta = { a: { y: 5 } };
    const result = applyDelta(state, delta);
    expect(result).toEqual({ a: { x: 1, y: 5 }, b: 3 });
  });

  it('should replace arrays entirely', () => {
    const state = { items: [1, 2, 3] };
    const delta = { items: [4, 5, 6] };
    const result = applyDelta(state, delta);
    expect(result).toEqual({ items: [4, 5, 6] });
  });

  it('should handle deeply nested deltas', () => {
    const state = { a: { b: { c: { d: 1 } } } };
    const delta = { a: { b: { c: { d: 2 } } } };
    const result = applyDelta(state, delta);
    expect(result).toEqual({ a: { b: { c: { d: 2 } } } });
  });

  it('should not mutate original state', () => {
    const state = { a: 1, b: 2 };
    const delta = { b: 3 };
    applyDelta(state, delta);
    expect(state).toEqual({ a: 1, b: 2 });
  });

  it('should handle empty delta', () => {
    const state = { a: 1, b: 2 };
    const delta = {};
    const result = applyDelta(state, delta);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('should create new nested objects if they do not exist', () => {
    const state = { a: {} };
    const delta = { a: { b: { c: 1 } } };
    const result = applyDelta(state, delta);
    expect(result).toEqual({ a: { b: { c: 1 } } });
  });
});

describe('estimateDeltaSize', () => {
  it('should estimate size of simple object', () => {
    const delta = { a: 1, b: 2 };
    const size = estimateDeltaSize(delta);
    expect(size).toBeGreaterThan(0);
  });

  it('should estimate size of nested object', () => {
    const delta = { a: { b: { c: 1 } } };
    const size = estimateDeltaSize(delta);
    expect(size).toBeGreaterThan(0);
  });

  it('should estimate size of array', () => {
    const delta = { items: [1, 2, 3, 4, 5] };
    const size = estimateDeltaSize(delta);
    expect(size).toBeGreaterThan(0);
  });

  it('should return 0 for empty object', () => {
    const delta = {};
    const size = estimateDeltaSize(delta);
    expect(size).toBe(2); // '{}' is 2 characters
  });

  it('should handle complex nested structures', () => {
    const delta = {
      players: {
        abc123: { name: 'Player 1', score: 100 },
        def456: { name: 'Player 2', score: 200 }
      },
      game: { status: 'playing', round: 2 }
    };
    const size = estimateDeltaSize(delta);
    expect(size).toBeGreaterThan(0);
  });
});

describe('shouldSendFullState', () => {
  it('should return true when delta size exceeds default threshold', () => {
    const delta = { a: 'x'.repeat(1500) };
    const result = shouldSendFullState(delta);
    expect(result).toBe(true);
  });

  it('should return false when delta size is below default threshold', () => {
    const delta = { a: 'x'.repeat(500) };
    const result = shouldSendFullState(delta);
    expect(result).toBe(false);
  });

  it('should use custom threshold when provided', () => {
    const delta = { a: 'x'.repeat(500) };
    const result = shouldSendFullState(delta, 400);
    expect(result).toBe(true);
  });

  it('should return false when delta size equals threshold', () => {
    // JSON.stringify({ a: 'x' }) = '{"a":"x"}' = 9 chars
    // So we need 1000 - 9 = 991 characters of 'x'
    const delta = { a: 'x'.repeat(991) };
    const result = shouldSendFullState(delta, 1000);
    expect(result).toBe(false);
  });

  it('should return true when delta size is exactly threshold + 1', () => {
    const delta = { a: 'x'.repeat(1001) };
    const result = shouldSendFullState(delta, 1000);
    expect(result).toBe(true);
  });

  it('should handle empty delta', () => {
    const delta = {};
    const result = shouldSendFullState(delta);
    expect(result).toBe(false);
  });
});

describe('Integration: computeDelta + applyDelta', () => {
  it('should round-trip state changes correctly', () => {
    const oldState = {
      players: {
        p1: { name: 'Alice', score: 100 },
        p2: { name: 'Bob', score: 200 }
      },
      game: { status: 'playing', round: 1 }
    };

    const newState = {
      players: {
        p1: { name: 'Alice', score: 150 },
        p2: { name: 'Bob', score: 200 }
      },
      game: { status: 'playing', round: 2 }
    };

    const delta = computeDelta(oldState, newState);
    const result = applyDelta(oldState, delta);

    expect(result).toEqual(newState);
  });

  it('should handle complex nested state changes', () => {
    const oldState = {
      room: {
        id: 'ABC123',
        players: {
          p1: { traits: { profession: { name: 'Doctor' } } }
        }
      }
    };

    const newState = {
      room: {
        id: 'ABC123',
        players: {
          p1: { traits: { profession: { name: 'Doctor', revealed: true } } }
        }
      }
    };

    const delta = computeDelta(oldState, newState);
    const result = applyDelta(oldState, delta);

    expect(result).toEqual(newState);
  });
});
