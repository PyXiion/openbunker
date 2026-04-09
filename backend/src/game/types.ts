import { GameSettings } from '../types/settings';

export type GameStatus = 'LOBBY' | 'PLAYING' | 'VOTING' | 'FINISHED';

export type TraitType = 'profession' | 'biology' | 'hobby' | 'phobia' | 'baggage' | 'fact';

export type ChatEventType = 
  | 'PLAYER_JOIN' 
  | 'PLAYER_LEFT' 
  | 'PLAYER_KICKED'
  | 'GAME_STARTED'
  | 'CARD_REVEALED'
  | 'VOTE_SUBMITTED'
  | 'PLAYER_EXILED'
  | 'ROUND_STARTED'
  | 'BUNKER_ROOM_REVEALED'
  | 'GAME_FINISHED'
  | 'HOST_CHANGED'
  | 'CHAT_MESSAGE';

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
  type: 'CHAT' | 'SYSTEM' | 'EVENT';
  eventType?: ChatEventType;
  eventData?: Record<string, any>;
}

export interface Trait {
  id: string;
  name: string;
  description: string;
  isRevealed: boolean;
}

/**
 * Represents a player in the game.
 * @property id - Persistent UUID (constant across reconnects)
 * @property socketId - Current Socket.io connection ID (changes on reconnect)
 * @property traits - All 6 hidden trait cards
 */
export interface Player {
  id: string; // persistentId (constant)
  socketId: string; // changes on reconnect
  name: string;
  isHost: boolean;
  isExiled: boolean;
  isReady: boolean;
  isGuest: boolean;
  avatarUrl?: string;
  traits: {
    profession: Trait;
    biology: Trait;
    hobby: Trait;
    phobia: Trait;
    baggage: Trait;
    fact: Trait;
  };
  votesReceived: number;
  hasVoted: boolean;
}

/**
 * Represents a room/section within the bunker.
 * Revealed progressively each round.
 */
export interface BunkerRoom {
  id: string;
  name: string;
  description: string;
  isRevealed: boolean;
}

export interface BunkerStats {
  capacity: number;
  food: number;
  water: number;
  medicine: number;
  power: number;
  rooms: BunkerRoom[];
}

/**
 * Describes the catastrophe scenario for the game.
 * Determines bunker requirements and survival conditions.
 */
export interface CatastropheCard {
  id: string;
  title: string;
  description: string;
  duration: string;
}

/**
 * Master game state stored on the server.
 * Contains all player data unmasked.
 * @property hostOwnershipExpiry - Timestamp when host transfer TTL expires (undefined if not pending)
 * @property turnOrder - Array of player IDs in turn sequence
 */
export interface GameRoom {
  roomId: string;
  status: GameStatus;
  round: number;
  catastrophe: CatastropheCard | null;
  bunker: BunkerStats | null;
  players: Record<string, Player>;
  turnOrder: string[];
  currentTurnIndex: number;
  hostOwnershipExpiry?: number;
  cardsToRevealPerTurn: number;
  cardsRevealedThisTurn: number;
  language: string;
  settings?: GameSettings;
  chatHistory: ChatMessage[];
  gameStartedAt?: number;
}

/**
 * Player data as sent to clients - unrevealed traits may be masked.
 * @property traits - Hidden traits show only name/description as '???' if not revealed
 */
export interface ClientPlayer {
  id: string; // persistentId (constant)
  socketId: string; // changes on reconnect
  name: string;
  isHost: boolean;
  isExiled: boolean;
  isReady: boolean;
  isGuest: boolean;
  avatarUrl?: string;
  traits: {
    profession: Trait;
    biology: Trait | { name: string; description: string; isRevealed: false };
    hobby: Trait | { name: string; description: string; isRevealed: false };
    phobia: Trait | { name: string; description: string; isRevealed: false };
    baggage: Trait | { name: string; description: string; isRevealed: false };
    fact: Trait | { name: string; description: string; isRevealed: false };
  };
  votesReceived: number;
  hasVoted: boolean;
}

/**
 * Room state as sent to clients - sensitive data masked per player.
 * Each player receives a personalized version via getMaskedRoom().
 */
export interface ClientGameRoom {
  roomId: string;
  status: GameStatus;
  round: number;
  catastrophe: CatastropheCard | null;
  bunker: BunkerStats | null;
  players: Record<string, ClientPlayer>;
  turnOrder: string[];
  currentTurnIndex: number;
  cardsToRevealPerTurn: number;
  cardsRevealedThisTurn: number;
  settings?: GameSettings;
}
