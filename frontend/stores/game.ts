import { defineStore } from 'pinia';
import { GAME_CONSTANTS } from '~/constants/game';
import type { GameSettings } from '~/types/settings';
import { applyDelta } from '~/utils/delta';

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

// Debounced localStorage write with 1 second delay
const debouncedSetItem = debounce((key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error('Failed to write to localStorage:', error);
  }
}, 1000);

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
  type: 'CHAT' | 'SYSTEM' | 'EVENT';
  eventType?: string;
  eventData?: Record<string, any>;
}

export interface Player {
  id: string;
  persistentId: string;
  name: string;
  isHost: boolean;
  isExiled: boolean;
  avatarUrl?: string;
  traits: {
    profession: any;
    biology: any;
    hobby: any;
    phobia: any;
    baggage: any;
    fact: any;
  };
  votesReceived: number;
  hasVoted: boolean;
}

interface GameRoom {
  roomId: string;
  status: 'LOBBY' | 'PLAYING' | 'VOTING' | 'FINISHED';
  round: number;
  catastrophe: any;
  bunker: any;
  players: Record<string, Player>;
  turnOrder: string[];
  currentTurnIndex: number;
  cardsToRevealPerTurn: number;
  cardsRevealedThisTurn: number;
  hostOwnershipExpiry?: number;
  settings?: GameSettings;
  chatHistory: ChatMessage[];
}

export const useGameStore = defineStore('game', {
  state: () => ({
    room: null as GameRoom | null,
    playerId: null as string | null,
    playerName: null as string | null,
    persistentId: null as string | null,
    isGuest: null as boolean | null,
    connected: false,
    error: null as string | null,
    kickedMessage: null as string | null,
    chatHistory: [] as ChatMessage[]
  }),

  getters: {
    currentPlayer: (state) => {
      if (!state.room || !state.playerId) return null;
      return state.room.players[state.playerId];
    },

    isMyTurn: (state) => {
      if (!state.room || !state.playerId) return false;
      return state.room.turnOrder[state.room.currentTurnIndex] === state.playerId;
    },

    activePlayers: (state) => {
      if (!state.room) return [];
      return Object.values(state.room.players).filter(p => !p.isExiled);
    },

    /**
     * Checks if current player can end their turn.
     * Validates that first trait was revealed and minimum required cards were shown.
     * Accounts for cardsToRevealPerTurn setting (first trait counts as first reveal).
     */
    canEndTurn: (state) => {
      if (!state.room || !state.playerId) return false;
      const currentPlayer = state.room.players[state.playerId];
      if (!currentPlayer) return false;
      
      // Get the first trait to reveal (null = any trait allowed)
      const firstTrait = state.room.settings?.firstTraitToReveal;
      
      // If a specific first trait is configured, it must be revealed first
      if (firstTrait && !currentPlayer.traits[firstTrait].isRevealed) {
        return false;
      }
      
      // Count unrevealed cards
      const allTraitTypes = ['profession', 'biology', 'hobby', 'phobia', 'baggage', 'fact'] as const;
      const unrevealedCards = allTraitTypes.filter(type => !currentPlayer.traits[type].isRevealed).length;
      
      // If no specific first trait is configured, player must reveal N cards total
      // If a specific first trait is configured, it counts as the first reveal, so (N-1) more needed
      const firstTraitRevealed = firstTrait ? 1 : 0;
      const additionalRevealsRequired = Math.max(0, state.room.cardsToRevealPerTurn - firstTraitRevealed);
      const additionalRevealsMade = state.room.cardsRevealedThisTurn - firstTraitRevealed;
      const remainingCards = Math.min(additionalRevealsRequired, unrevealedCards);
      
      return additionalRevealsMade >= remainingCards;
    },

    canStartGame: (state) => {
      if (!state.room) return false;
      const playerCount = Object.keys(state.room.players).length;
      return state.room.status === 'LOBBY' && 
             state.room.players[state.playerId!]?.isHost && 
             playerCount >= GAME_CONSTANTS.MIN_PLAYERS_TO_START;
    },

    /**
     * Calculates how many more cards the player must reveal before ending turn.
     * Returns 1 if first trait not revealed yet.
     * Otherwise calculates based on cardsToRevealPerTurn minus first trait.
     */
    cardsRemainingToReveal: (state) => {
      if (!state.room || !state.playerId) return 0;
      const currentPlayer = state.room.players[state.playerId];
      if (!currentPlayer) return 0;
      
      // Get the first trait to reveal (null = any trait allowed)
      const firstTrait = state.room.settings?.firstTraitToReveal;
      
      // If a specific first trait is configured and not revealed, must reveal it first
      if (firstTrait && !currentPlayer.traits[firstTrait].isRevealed) {
        return 1; // Just need to reveal first trait
      }
      
      // Count unrevealed cards
      const allTraitTypes = ['profession', 'biology', 'hobby', 'phobia', 'baggage', 'fact'] as const;
      const unrevealedCards = allTraitTypes.filter(type => !currentPlayer.traits[type].isRevealed).length;
      
      // If no specific first trait is configured, need to reveal N cards total
      // If a specific first trait is configured, it counts as the first reveal, so (N-1) more needed
      const firstTraitRevealed = firstTrait ? 1 : 0;
      const additionalRevealsRequired = Math.max(0, state.room.cardsToRevealPerTurn - firstTraitRevealed);
      const additionalRevealsMade = Math.max(0, state.room.cardsRevealedThisTurn - firstTraitRevealed);
      const remainingCards = Math.min(additionalRevealsRequired, unrevealedCards);
      
      return Math.max(0, remainingCards - additionalRevealsMade);
    },

    canRevealCard: (state) => {
      if (!state.room || !state.playerId) return false;
      return state.room.cardsRevealedThisTurn < state.room.cardsToRevealPerTurn;
    },

    mustRevealFirstTrait: (state) => {
      if (!state.room || !state.playerId) return false;
      const currentPlayer = state.room.players[state.playerId];
      if (!currentPlayer) return false;
      const firstTrait = state.room.settings?.firstTraitToReveal;
      return firstTrait ? !currentPlayer.traits[firstTrait].isRevealed : false;
    },
  },

  actions: {
    setRoom(room: GameRoom) {
      this.room = room;
      if (room) {
        debouncedSetItem('gameRoom', JSON.stringify(room));
        // Sync chat history from room
        if (room.chatHistory) {
          this.chatHistory = room.chatHistory;
        }
      } else {
        localStorage.removeItem('gameRoom');
      }
    },

    setPlayerId(id: string) {
      this.playerId = id;
      localStorage.setItem('playerId', id);
    },

    setPlayerName(name: string) {
      this.playerName = name;
      localStorage.setItem('playerName', name);
    },

    setPersistentId(id: string) {
      this.persistentId = id;
      localStorage.setItem('persistentId', id);
    },

    setConnected(connected: boolean) {
      this.connected = connected;
    },

    setError(error: string | null) {
      this.error = error;
    },

    setKickedMessage(message: string | null) {
      this.kickedMessage = message;
    },

    setIsGuest(isGuest: boolean) {
      this.isGuest = isGuest;
    },

    reset() {
      this.room = null;
      this.playerId = null;
      this.chatHistory = [];
      // Keep playerName for reuse on next game
      this.persistentId = null;
      this.isGuest = null;
      this.connected = false;
      this.error = null;
      localStorage.removeItem('gameRoom');
      localStorage.removeItem('playerId');
      // Keep playerName in localStorage
      localStorage.removeItem('persistentId');
    },

    // Clear room state only (for leaving room without disconnecting socket)
    clearRoomState() {
      this.room = null;
      this.playerId = null;
      this.error = null;
      this.chatHistory = [];
      this.isGuest = null;
      localStorage.removeItem('gameRoom');
      localStorage.removeItem('playerId');
      // Keep playerName, persistentId, and connected status
    },

    // Load persisted state from localStorage
    loadPersistedState() {
      try {
        const savedRoom = localStorage.getItem('gameRoom');
        const savedPlayerName = localStorage.getItem('playerName');
        const savedPersistentId = localStorage.getItem('persistentId');
        const savedPlayerId = localStorage.getItem('playerId');

        if (savedRoom) this.room = JSON.parse(savedRoom);
        if (savedPlayerName) this.playerName = savedPlayerName;
        if (savedPersistentId) this.persistentId = savedPersistentId;
        if (savedPlayerId) this.playerId = savedPlayerId;
      } catch (error) {
        console.error('Failed to load persisted state:', error);
        this.reset();
      }
    },

    // Add a chat message to history
    addChatMessage(message: ChatMessage) {
      this.chatHistory.push(message);
      // Keep only last 100 messages
      if (this.chatHistory.length > 100) {
        this.chatHistory = this.chatHistory.slice(-100);
      }
    },

    // Get persistent ID (must be set by server via ROOM_CREATED or ROOM_STATE_UPDATE)
    getOrCreatePersistentId(): string | null {
      return this.persistentId;
    },

    // Apply a differential update to the room state
    applyRoomDelta(delta: Record<string, any>) {
      if (!this.room) {
        // If no room exists, we can't apply delta - this shouldn't happen in normal flow
        console.error('Cannot apply delta: no room state exists');
        return;
      }
      
      // Apply delta to existing room state
      this.room = applyDelta(this.room, delta);
      
      // Persist the updated room state
      if (this.room) {
        debouncedSetItem('gameRoom', JSON.stringify(this.room));
        // Sync chat history from room
        if (this.room.chatHistory) {
          this.chatHistory = this.room.chatHistory;
        }
      }
    },
  }
});
