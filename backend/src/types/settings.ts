/**
 * Game settings types and interfaces
 * Used for both backend and frontend to ensure type consistency
 */

// Available trait types for first trait to reveal setting
export type FirstTraitToReveal = 'profession' | 'biology' | 'hobby' | 'phobia' | 'baggage' | 'fact' | null;

/**
 * Complete game settings interface
 * Used for room creation and updates
 */
export interface GameSettings {
  bunkerCapacity?: number | null; // null = auto (based on player count)
  firstTraitToReveal?: FirstTraitToReveal; // null = any trait can be revealed first
  enableContentFilter?: boolean; // Enable/disable slur filtering (default: true)
}

/**
 * Settings for creating a new room
 * Used in CREATE_ROOM socket event
 */
export interface CreateRoomSettings extends GameSettings {
  // Inherits all GameSettings properties
}

/**
 * Settings for updating an existing room
 * Used in UPDATE_SETTINGS socket event
 */
export interface UpdateRoomSettings extends GameSettings {
  // Inherits all GameSettings properties
}

/**
 * Default settings values
 */
export const DEFAULT_SETTINGS: Required<Omit<GameSettings, 'bunkerCapacity'>> = {
  firstTraitToReveal: null, // null = any trait can be revealed first
  enableContentFilter: true,
};

/**
 * Settings validation utilities
 */
export class SettingsValidator {
  /**
   * Validates bunker capacity setting
   */
  static validateBunkerCapacity(value?: number | null): number | null {
    if (value === undefined || value === null) {
      return null; // auto capacity
    }
    
    // Ensure it's within valid range (1-10)
    const capacity = Math.max(1, Math.min(10, Math.floor(value)));
    return capacity;
  }

  /**
   * Validates first trait to reveal setting
   */
  static validateFirstTraitToReveal(value?: FirstTraitToReveal): FirstTraitToReveal {
    if (value === undefined || value === null) {
      return null; // null = any trait can be revealed first
    }
    
    const validTraits: FirstTraitToReveal[] = ['profession', 'biology', 'hobby', 'phobia', 'baggage', 'fact'];
    return validTraits.includes(value) ? value : null;
  }

  /**
   * Validates content filter setting
   */
  static validateContentFilter(value?: boolean): boolean {
    return value !== false; // defaults to true if not explicitly false
  }

  /**
   * Validates complete settings object
   */
  static validateSettings(settings?: Partial<GameSettings>): GameSettings {
    return {
      bunkerCapacity: this.validateBunkerCapacity(settings?.bunkerCapacity),
      firstTraitToReveal: this.validateFirstTraitToReveal(settings?.firstTraitToReveal),
      enableContentFilter: this.validateContentFilter(settings?.enableContentFilter),
    };
  }
}
