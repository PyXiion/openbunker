import { v4 as uuidv4 } from 'uuid';
import { GameRoom, Player } from './types';
import { GameSettings } from '../types';
import { GAME_CONSTANTS } from './constants';
import { logger } from '../utils/logger';
import { ChatManager } from './chatManager';
import { RoomMutex } from '../utils/roomMutex';

/**
 * Manages room lifecycle and player management.
 * Handles room creation, joining, leaving, and player operations.
 */
export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();
  private roomParticipants: Map<string, Set<string>> = new Map(); // Track userIds that were ever in each room
  private chatManager: ChatManager;
  private onRoomDeleted?: (roomId: string) => void;
  private roomMutex: RoomMutex = new RoomMutex();

  constructor(chatManager: ChatManager, onRoomDeleted?: (roomId: string) => void) {
    this.chatManager = chatManager;
    this.onRoomDeleted = onRoomDeleted;
  }

  /**
   * Sets the callback to be called when a room is deleted.
   * Used to clean up pending removal timeouts in SocketHandlers.
   */
  setOnRoomDeleted(callback: (roomId: string) => void): void {
    this.onRoomDeleted = callback;
  }


  /**
   * Gets all rooms.
   */
  getRooms(): Map<string, GameRoom> {
    return this.rooms;
  }

  /**
   * Gets a room by ID.
   */
  getRoom(roomId: string): GameRoom | null {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Generates a UUID for internal room identification.
   * Stable and permanent, used for all internal operations.
   */
  generateRoomId(): string {
    return uuidv4();
  }

  /**
   * Generates a random 6-character uppercase room code.
   * Uses base36 encoding of a random number for readability.
   * Checks for collisions with existing room codes.
   * User-facing shareable code that can be regenerated.
   */
  generateRoomCode(): string {
    let roomCode: string;
    let attempts = 0;
    const maxAttempts = 100;
    
    do {
      roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      attempts++;
      
      if (attempts >= maxAttempts) {
        // Fallback to UUID if we can't find a unique code
        logger.warn('Could not generate unique 6-char room code, falling back to UUID');
        return uuidv4().substring(0, 8).toUpperCase();
      }
    } while (Array.from(this.rooms.values()).some(room => room.roomCode === roomCode));
    
    return roomCode;
  }


  /**
   * Creates a new game room with the specified host.
   * Initializes room in LOBBY state with default settings.
   * Uses mutex to prevent race condition in room ID generation.
   */
  async createRoom(
    hostUserId: string,
    hostName: string,
    language: string = 'en',
    settings?: GameSettings,
    avatarUrl?: string,
    isGuest: boolean = false
  ): Promise<GameRoom> {
    return this.roomMutex.withLock('global', () => {
      const roomId = this.generateRoomId();
      const roomCode = this.generateRoomCode();
      console.log(`Creating room ${roomId} with code ${roomCode} for host ${hostName} with language ${language}`);

      const room: GameRoom = {
        roomId,
        roomCode,
        status: 'LOBBY',
        round: 0,
        catastrophe: null,
        bunker: null,
        players: {},
        turnOrder: [],
        currentTurnIndex: 0,
        cardsToRevealPerTurn: 1,
        cardsRevealedThisTurn: 0,
        language,
        settings,
        chatHistory: []
      };

      const host = this.createPlayer('', hostUserId, hostName, true, avatarUrl, isGuest);
      room.players[host.id] = host;
      room.turnOrder.push(host.id);

      // Track userId as a participant of this room
      if (!this.roomParticipants.has(roomId)) {
        this.roomParticipants.set(roomId, new Set());
      }
      this.roomParticipants.get(roomId)!.add(hostUserId);

      this.rooms.set(roomId, room);
      console.log(`Room ${roomId} created and stored. Total rooms: ${this.rooms.size}`);
      return room;
    });
  }

  createPlayer(
    socketId: string,
    userId: string,
    playerName: string,
    isHost: boolean = false,
    avatarUrl?: string,
    isGuest: boolean = false
  ): Player {
    const id = userId;
    return {
      id,
      socketId,
      name: playerName,
      isHost,
      isExiled: false,
      isReady: false,
      isGuest,
      avatarUrl,
      traits: {
        profession: { id: '', name: '', description: '', isRevealed: false },
        biology: { id: '', name: '', description: '', isRevealed: false },
        hobby: { id: '', name: '', description: '', isRevealed: false },
        phobia: { id: '', name: '', description: '', isRevealed: false },
        baggage: { id: '', name: '', description: '', isRevealed: false },
        fact: { id: '', name: '', description: '', isRevealed: false },
      },
      votesReceived: 0,
      hasVoted: false,
    };
  }

  /**
   * Allows a player to join an existing room.
   * Only allows new players to join during LOBBY phase.
   * Uses mutex to prevent race conditions.
   */
  async joinRoom(
    roomId: string,
    userId: string,
    playerName: string,
    avatarUrl?: string,
    isGuest: boolean = false
  ): Promise<GameRoom | null> {
    return this.roomMutex.withLock(roomId, () => {
      const id = userId;
      console.log(`RoomManager.joinRoom called with roomId: ${roomId}, userId: ${userId}, playerName: ${playerName}`);

      const room = this.rooms.get(roomId);
      console.log(`Room found: ${!!room}, status: ${room?.status}`);

      if (!room) {
        console.log(`Room ${roomId} not found`);
        return null;
      }

      // Check if player with this userId already exists (reconnection)
      const existingPlayer = Object.values(room.players).find(p => p.id === userId);
      if (existingPlayer) {
        console.log(`Player ${userId} already in room ${roomId}, will update socket ID on WebSocket connect`);
        existingPlayer.isGuest = isGuest;
        return room;
      }

      // Check if player was previously in the room (allow reconnection even after removal)
      const previousParticipants = this.roomParticipants.get(roomId);
      if (previousParticipants && previousParticipants.has(userId)) {
        console.log(`Player ${userId} was previously in room ${roomId}, allowing reconnection`);
        // Re-add player to room
        const player = this.createPlayer('', userId, playerName, false, avatarUrl, isGuest);
        room.players[id] = player;
        // Don't add to turnOrder again if game already started
        if (room.status === 'LOBBY') {
          room.turnOrder.push(id);
        }
        return room;
      }

      // New players can only join during LOBBY phase
      if (room.status !== 'LOBBY') {
        console.log(`Room ${roomId} is not in LOBBY status, cannot join`);
        return null;
      }

      if (Object.keys(room.players).length >= GAME_CONSTANTS.MAX_PLAYERS) {
        return null;
      }

      const player = this.createPlayer('', userId, playerName, false, avatarUrl, isGuest);
      room.players[id] = player;
      room.turnOrder.push(id);

      // Track userId as a participant of this room
      if (!this.roomParticipants.has(roomId)) {
        this.roomParticipants.set(roomId, new Set());
      }
      this.roomParticipants.get(roomId)!.add(userId);

      console.log(`New player ${playerName} joined room ${roomId}. Room now has ${Object.keys(room.players).length} players`);

      this.chatManager.addSystemEvent(room, 'PLAYER_JOIN', `${playerName} joined the room`, { playerId: id, playerName });
      return room;
    });
  }

  /**
   * Removes a player from a room.
   * Handles host transfer: immediate transfer for all cases (voluntary leave or timeout).
   * Deletes room if it becomes empty.
   */
  removePlayer(roomId: string, playerId: string, immediateHostTransfer: boolean = false): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    const player = room.players[playerId];
    if (!player) {
      console.log(`Player ${playerId} not found in room ${roomId}, may have been already removed`);
      return false;
    }

    console.log(`Removing player ${player.name} (${playerId}) from room ${roomId}`);
    
    // Find the player's index in turn order before removing them
    const playerTurnIndex = room.turnOrder.indexOf(playerId);
    
    delete room.players[playerId];
    room.turnOrder = room.turnOrder.filter(id => id !== playerId);

    // Adjust currentTurnIndex if necessary
    if (playerTurnIndex === room.currentTurnIndex && room.turnOrder.length > 0) {
      // The removed player was the current player, find next non-exiled player
      let nextIndex = room.currentTurnIndex;
      if (nextIndex >= room.turnOrder.length) {
        nextIndex = 0; // Wrap around if we were at the end
      }
      
      // Find next non-exiled player with safety check
      let checkedCount = 0;
      const maxChecks = room.turnOrder.length;
      do {
        nextIndex = (nextIndex + 1) % room.turnOrder.length;
        checkedCount++;
        // Safety: if we've checked all players and all are exiled, break
        if (checkedCount >= maxChecks) {
          nextIndex = 0;
          break;
        }
      } while (room.players[room.turnOrder[nextIndex]].isExiled && nextIndex !== room.currentTurnIndex);
      
      room.currentTurnIndex = nextIndex;
    } else if (playerTurnIndex !== -1 && playerTurnIndex < room.currentTurnIndex) {
      // The removed player was before the current player, so shift the index back
      room.currentTurnIndex--;
    } else if (playerTurnIndex === room.currentTurnIndex && room.currentTurnIndex >= room.turnOrder.length) {
      // The removed player was the current player and was at the end of the list
      room.currentTurnIndex = 0;
    }

    // If host leaves, transfer host ownership immediately to next player
    if (player.isHost && room.turnOrder.length > 0) {
      console.log(`Host ${player.name} left room ${roomId}, transferring host to next player`);
      const newHostId = room.turnOrder[0];
      room.players[newHostId].isHost = true;
      room.hostDisconnectedAt = undefined; // Clear host disconnect timestamp
      console.log(`New host assigned: ${room.players[newHostId].name}`);
    }

    // Delete room if empty
    if (room.turnOrder.length === 0) {
      console.log(`Room ${roomId} is now empty, deleting room`);
      this.rooms.delete(roomId);
      this.roomParticipants.delete(roomId);
      if (this.onRoomDeleted) {
        this.onRoomDeleted(roomId);
      }
    }

    return true;
  }

  /**
   * Regenerates a room code to a new unique value.
   * The internal roomId remains unchanged.
   */
  regenerateRoomCode(roomId: string): string | null {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    const newRoomCode = this.generateUniqueRoomCode();
    if (!newRoomCode) {
      return null;
    }

    const oldRoomCode = room.roomCode;
    room.roomCode = newRoomCode;

    console.log(`Room code regenerated from ${oldRoomCode} to ${newRoomCode} for room ${roomId}`);
    return newRoomCode;
  }

  private generateUniqueRoomCode(): string | null {
    let attempts = 0;
    while (attempts < 10) {
      const newRoomCode = this.generateRoomCode();
      if (!Array.from(this.rooms.values()).some(room => room.roomCode === newRoomCode)) {
        return newRoomCode;
      }
      attempts++;
    }
    return null;
  }


  /**
   * Updates room state in the map.
   */
  updateRoom(roomId: string, room: GameRoom): void {
    this.rooms.set(roomId, room);
  }
}
