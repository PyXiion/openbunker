import { Mutex } from 'async-mutex';

/**
 * Manages per-room mutexes to prevent race conditions.
 * Each room gets its own mutex to ensure atomic operations on room state.
 */
export class RoomMutex {
  private mutexes: Map<string, Mutex> = new Map();

  /**
   * Acquires a mutex for a specific room and runs the callback.
   * Creates a new mutex if one doesn't exist for the room.
   * Cleans up mutexes for deleted rooms to prevent memory leaks.
   */
  async withLock<T>(roomId: string, callback: () => Promise<T> | T): Promise<T> {
    let mutex = this.mutexes.get(roomId);
    
    if (!mutex) {
      mutex = new Mutex();
      this.mutexes.set(roomId, mutex);
    }

    const release = await mutex.acquire();
    try {
      return await callback();
    } finally {
      release();
    }
  }

  /**
   * Removes the mutex for a room when the room is deleted.
   */
  deleteRoom(roomId: string): void {
    const mutex = this.mutexes.get(roomId);
    if (mutex) {
      this.mutexes.delete(roomId);
    }
  }

  /**
   * Gets the number of active mutexes (for debugging).
   */
  getActiveMutexCount(): number {
    return this.mutexes.size;
  }
}
