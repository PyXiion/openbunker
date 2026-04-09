/**
 * Frontend game settings types
 * Matches backend settings types for consistency
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
 * Used in createRoom socket event
 */
export interface CreateRoomSettings extends GameSettings {
  // Inherits all GameSettings properties
}

/**
 * Settings for updating an existing room
 * Used in updateSettings socket event
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
