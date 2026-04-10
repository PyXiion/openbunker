import { Server, Socket } from 'socket.io';
import { GameLogic } from '../../game/gameLogic';
import { filterChatMessage } from '../../utils/contentFilter';

/**
 * Chat handler for Socket.IO events.
 * Handles sending and filtering chat messages.
 */
export class ChatHandlers {
  constructor(
    private io: Server,
    private gameLogic: GameLogic
  ) {}

  private get gameNamespace() {
    return this.io.of('/ws/game');
  }

  handleSendChatMessage(socket: Socket, roomId: string, message: string): void {
    console.log(`[CHAT] Received message from ${socket.id} in room ${roomId}: "${message.substring(0, 50)}..."`);
    
    const room = this.gameLogic.getRoom(roomId);
    const player = Object.values(room?.players || {}).find(p => p.socketId === socket.id);

    if (!room) {
      console.log(`[CHAT] Error: Room ${roomId} not found`);
      socket.emit('ERROR', { message: 'Room not found' });
      return;
    }
    
    if (!player) {
      console.log(`[CHAT] Error: Player with socket ${socket.id} not found in room`);
      socket.emit('ERROR', { message: 'Player not found' });
      return;
    }

    if (!message || message.trim().length === 0) {
      socket.emit('ERROR', { message: 'Message cannot be empty' });
      return;
    }

    if (message.length > 500) {
      socket.emit('ERROR', { message: 'Message too long (max 500 characters)' });
      return;
    }

    console.log(`[CHAT] Adding message from ${player.name} to history`);
    
    const isContentFilterEnabled = room.settings?.enableContentFilter !== false;
    const filteredMessage = isContentFilterEnabled ? filterChatMessage(message.trim()) : message.trim();
    
    const chatMessage = this.gameLogic.addChatMessage(
      roomId,
      player.id,
      player.name,
      filteredMessage,
      'CHAT',
      'CHAT_MESSAGE'
    );

    if (chatMessage) {
      console.log(`[CHAT] Broadcasting message to room ${roomId}, players: ${Object.keys(room.players).length}`);
      const gameNamespace = this.io.of('/ws/game');
      gameNamespace.to(roomId).emit('CHAT_MESSAGE', chatMessage);
      console.log(`[CHAT] Message broadcast complete: ${chatMessage.id}`);
    }
  }
}
