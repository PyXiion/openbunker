import { GameRoom, TraitType, ChatMessage } from './types';
import { GameSettings } from '../types';
import { RoomManager } from './roomManager';
import { GameEngine } from './gameEngine';
import { ChatManager } from './chatManager';

/**
 * GameLogic coordinator class that composes room, game, and chat managers.
 * Maintains backward compatibility with existing API.
 */
export class GameLogic {
  private roomManager: RoomManager;
  private gameEngine: GameEngine;
  private chatManager: ChatManager;

  constructor(onRoomDeleted?: (roomId: string) => void) {
    this.chatManager = new ChatManager();
    this.roomManager = new RoomManager(this.chatManager, onRoomDeleted);
    this.gameEngine = new GameEngine(this.chatManager);
  }

  /**
   * Sets the callback to be called when a room is deleted.
   * Used to clean up pending removal timeouts in SocketHandlers.
   */
  setOnRoomDeleted(callback: (roomId: string) => void): void {
    this.roomManager.setOnRoomDeleted(callback);
  }


  /**
   * Generates a random 6-character uppercase room code.
   */
  generateRoomCode(): string {
    return this.roomManager.generateRoomCode();
  }

  /**
   * Generates a UUID for internal room identification.
   */
  generateRoomId(): string {
    return this.roomManager.generateRoomId();
  }


  /**
   * Creates a new game room with the specified host.
   */
  async createRoom(
    hostUserId: string,
    hostName: string,
    language: string = 'en',
    settings?: GameSettings,
    avatarUrl?: string,
    isGuest: boolean = false
  ): Promise<GameRoom> {
    const room = await this.roomManager.createRoom(
      hostUserId,
      hostName,
      language,
      settings,
      avatarUrl,
      isGuest
    );
    this.roomManager.updateRoom(room.roomId, room);
    return room;
  }

  /**
   * Allows a player to join an existing room.
   */
  async joinRoom(
    roomId: string,
    userId: string,
    playerName: string,
    avatarUrl?: string,
    isGuest: boolean = false
  ): Promise<GameRoom | null> {
    const room = await this.roomManager.joinRoom(roomId, userId, playerName, avatarUrl, isGuest);
    if (room) {
      this.roomManager.updateRoom(roomId, room);
    }
    return room;
  }

  /**
   * Starts the game from LOBBY phase.
   */
  startGame(roomId: string): boolean {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return false;

    const success = this.gameEngine.startGame(room);
    if (success) {
      this.roomManager.updateRoom(roomId, room);
    }
    return success;
  }

  /**
   * Reveals a trait card for the current player during their turn.
   */
  revealCard(roomId: string, playerId: string, traitType: TraitType): boolean {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return false;

    const success = this.gameEngine.revealCard(room, playerId, traitType);
    if (success) {
      this.roomManager.updateRoom(roomId, room);
    }
    return success;
  }

  /**
   * Ends the current player's turn and advances to next non-exiled player.
   */
  endTurn(roomId: string, playerId: string): boolean {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return false;

    const success = this.gameEngine.endTurn(room, playerId);
    if (success) {
      this.roomManager.updateRoom(roomId, room);
    }
    return success;
  }

  /**
   * Processes a vote submission during VOTING phase.
   */
  submitVote(roomId: string, voterId: string, targetId: string): { success: boolean; events: ChatMessage[] } {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return { success: false, events: [] };

    const result = this.gameEngine.submitVote(room, voterId, targetId);
    this.roomManager.updateRoom(roomId, room);
    return result;
  }

  /**
   * Gets all rooms.
   */
  getRooms(): Map<string, GameRoom> {
    return this.roomManager.getRooms();
  }

  /**
   * Gets a room by ID.
   */
  getRoom(roomId: string): GameRoom | null {
    return this.roomManager.getRoom(roomId);
  }

  /**
   * Regenerates room code for a room.
   */
  regenerateRoomCode(roomId: string): string | null {
    return this.roomManager.regenerateRoomCode(roomId);
  }

  /**
   * Removes a player from a room.
   */
  removePlayer(roomId: string, playerId: string, immediateHostTransfer: boolean = false): boolean {
    const success = this.roomManager.removePlayer(roomId, playerId, immediateHostTransfer);
    if (success) {
      const room = this.roomManager.getRoom(roomId);
      if (room) {
        this.roomManager.updateRoom(roomId, room);
      }
    }
    return success;
  }

  /**
   * Returns a masked view of the room for a specific player.
   */
  getMaskedRoom(roomId: string, playerId: string): any {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return null;
    return this.gameEngine.getMaskedRoom(room, playerId);
  }

  /**
   * Adds a chat message to the room's chat history.
   */
  addChatMessage(
    roomId: string,
    playerId: string,
    playerName: string,
    message: string,
    type: 'CHAT' | 'SYSTEM' | 'EVENT' = 'CHAT',
    eventType?: any,
    eventData?: Record<string, any>
  ): ChatMessage | null {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return null;
    return this.chatManager.addChatMessage(room, playerId, playerName, message, type, eventType, eventData);
  }

  /**
   * Adds a system event message to the chat history.
   */
  addSystemEvent(
    roomId: string,
    eventType: any,
    message: string,
    eventData?: Record<string, any>
  ): ChatMessage | null {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return null;
    return this.chatManager.addSystemEvent(room, eventType, message, eventData);
  }

  /**
   * Adds a localized system event message to the chat history.
   */
  addLocalizedSystemEvent(
    roomId: string,
    eventType: any,
    messageKey: string,
    params?: Record<string, any>,
    eventData?: Record<string, any>
  ): ChatMessage | null {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return null;
    return this.chatManager.addLocalizedSystemEvent(room, eventType, messageKey, params, eventData);
  }

  /**
   * Gets the chat history for a room.
   */
  getChatHistory(roomId: string): ChatMessage[] {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return [];
    return this.chatManager.getChatHistory(room);
  }

  /**
   * Gets a localized message with parameter interpolation.
   */
  getLocalizedMessage(roomId: string, key: string, params?: Record<string, any>): string {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return key;
    return this.chatManager.getLocalizedMessage(room, key, params);
  }
}
