import { v4 as uuidv4 } from 'uuid';
import { GameRoom, ChatMessage, ChatEventType } from './types';
import { dataLoader } from '../services/dataLoader';

/**
 * Manages chat functionality for game rooms.
 * Handles adding messages, system events, and localized messages.
 */
export class ChatManager {
  /**
   * Adds a chat message to the room's chat history.
   * Limits chat history to the most recent 100 messages.
   */
  addChatMessage(
    room: GameRoom,
    playerId: string,
    playerName: string,
    message: string,
    type: 'CHAT' | 'SYSTEM' | 'EVENT' = 'CHAT',
    eventType?: ChatEventType,
    eventData?: Record<string, any>
  ): ChatMessage | null {
    const chatMessage: ChatMessage = {
      id: uuidv4(),
      playerId,
      playerName,
      message,
      timestamp: Date.now(),
      type,
      eventType,
      eventData
    };

    room.chatHistory.push(chatMessage);

    // Keep only the last 100 messages
    if (room.chatHistory.length > 100) {
      room.chatHistory = room.chatHistory.slice(-100);
    }

    return chatMessage;
  }

  /**
   * Adds a system event message to the chat history.
   */
  addSystemEvent(
    room: GameRoom,
    eventType: ChatEventType,
    message: string,
    eventData?: Record<string, any>
  ): ChatMessage | null {
    return this.addChatMessage(
      room,
      'system',
      'System',
      message,
      'EVENT',
      eventType,
      eventData
    );
  }

  /**
   * Adds a localized system event message to the chat history.
   */
  addLocalizedSystemEvent(
    room: GameRoom,
    eventType: ChatEventType,
    messageKey: string,
    params?: Record<string, any>,
    eventData?: Record<string, any>
  ): ChatMessage | null {
    const message = this.getLocalizedMessage(room, messageKey, params);
    return this.addSystemEvent(room, eventType, message, eventData);
  }

  /**
   * Gets the chat history for a room.
   */
  getChatHistory(room: GameRoom): ChatMessage[] {
    return room.chatHistory;
  }

  /**
   * Gets a localized message with parameter interpolation.
   */
  getLocalizedMessage(room: GameRoom, key: string, params?: Record<string, any>): string {
    const messages = dataLoader.getMessages(room.language || 'en');
    const messageTemplate = this.getNestedValue(messages, key) || key;
    
    if (!params) return messageTemplate;
    
    // Replace parameters in the template (e.g., {playerName} -> actual name)
    return messageTemplate.replace(/\{(\w+)\}/g, (match, paramKey) => {
      return params[paramKey] !== undefined ? String(params[paramKey]) : match;
    });
  }

  /**
   * Helper to get nested object values by dot notation.
   */
  private getNestedValue(obj: any, key: string): string {
    return key.split('.').reduce((current, prop) => current?.[prop], obj) || '';
  }
}
