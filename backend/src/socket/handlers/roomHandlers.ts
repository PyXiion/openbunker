import { Server, Socket } from 'socket.io';
import { GameLogic } from '../../game/gameLogic';
import { UpdateRoomSettings, SettingsValidator } from '../../types';

/**
 * Room management handlers for Socket.IO events.
 * Handles room operations: leave, kick, regenerate code, update settings.
 */
export class RoomHandlers {
  constructor(
    private io: Server,
    private gameLogic: GameLogic,
    private broadcastRoomState: (roomId: string) => void,
    private broadcastChatMessage: (roomId: string, message: any) => void,
    private clearLastSentState: (playerId: string) => void,
    private pendingRemovals: Map<string, Map<string, { timer: NodeJS.Timeout, disconnectedAt: Date }>>
  ) {}

  private get gameNamespace() {
    return this.io.of('/ws/game');
  }

  handleLeaveRoom(socket: Socket, roomId: string): void {
    console.log(`Player ${socket.id} voluntarily leaving room ${roomId}`);
    
    const room = this.gameLogic.getRoom(roomId);
    const player = Object.values(room?.players || {}).find(p => p.socketId === socket.id);
    
    if (!room || !player) {
      socket.emit('ERROR', { message: 'Room not found or not in room' });
      return;
    }

    const playerName = player.name;
    
    const success = this.gameLogic.removePlayer(roomId, player.id, true);
    
    if (!success) {
      socket.emit('ERROR', { message: 'Failed to leave room' });
      return;
    }

    console.log(`Player ${playerName} successfully left room ${roomId}`);
    
    const eventMessage = this.gameLogic.addSystemEvent(
      roomId,
      'PLAYER_LEFT',
      `${playerName} left the room`,
      { playerId: player.id, playerName }
    );
    if (eventMessage) {
      this.broadcastChatMessage(roomId, eventMessage);
    }
    
    socket.leave(roomId);
    socket.data.roomId = null;
    socket.data.playerId = null;
    
    this.clearLastSentState(player.id);
    
    this.gameNamespace.to(roomId).emit('PLAYER_LEFT', { playerId: player.id, playerName });
    this.broadcastRoomState(roomId);
  }

  handleKickPlayer(socket: Socket, roomId: string, targetId: string): void {
    console.log(`Host ${socket.id} attempting to kick player ${targetId} from room ${roomId}`);

    const room = this.gameLogic.getRoom(roomId);
    const host = Object.values(room?.players || {}).find(p => p.socketId === socket.id);
    const targetPlayer = room?.players[targetId];

    if (!room || !host || !targetPlayer) {
      socket.emit('ERROR', { message: 'Room or player not found' });
      return;
    }

    if (!host.isHost) {
      socket.emit('ERROR', { message: 'Only host can kick players' });
      return;
    }

    if (targetPlayer.isHost) {
      socket.emit('ERROR', { message: 'Cannot kick the host' });
      return;
    }

    const playerName = targetPlayer.name;

    const success = this.gameLogic.removePlayer(roomId, targetId);

    if (!success) {
      socket.emit('ERROR', { message: 'Failed to kick player' });
      return;
    }

    console.log(`Player ${playerName} (${targetId}) was kicked from room ${roomId}`);

    const eventMessage = this.gameLogic.addSystemEvent(
      roomId,
      'PLAYER_KICKED',
      `${playerName} was kicked by the host`,
      { playerId: targetId, playerName, kickedBy: host.name }
    );
    if (eventMessage) {
      this.broadcastChatMessage(roomId, eventMessage);
    }

    this.gameNamespace.to(targetPlayer.socketId).emit('KICKED', { roomId, reason: 'Kicked by host' });

    this.clearLastSentState(targetId);

    const roomPendingRemovals = this.pendingRemovals.get(roomId);
    if (roomPendingRemovals) {
      roomPendingRemovals.delete(targetId);
      if (roomPendingRemovals.size === 0) {
        this.pendingRemovals.delete(roomId);
      }
    }

    this.gameNamespace.to(roomId).emit('PLAYER_KICKED', { playerId: targetId, playerName });
    this.broadcastRoomState(roomId);
  }

  handleRegenerateRoomCode(socket: Socket, roomId: string): void {
    console.log(`Host ${socket.id} attempting to regenerate room code for ${roomId}`);

    const room = this.gameLogic.getRoom(roomId);
    const host = Object.values(room?.players || {}).find(p => p.socketId === socket.id);

    if (!room || !host) {
      socket.emit('ERROR', { message: 'Room not found' });
      return;
    }

    if (!host.isHost) {
      socket.emit('ERROR', { message: 'Only host can regenerate room code' });
      return;
    }

    if (room.status !== 'LOBBY') {
      socket.emit('ERROR', { message: 'Can only regenerate room code in lobby' });
      return;
    }

    const oldRoomCode = room.roomCode;
    const newRoomCode = this.gameLogic.regenerateRoomCode(roomId);

    if (!newRoomCode) {
      socket.emit('ERROR', { message: 'Failed to regenerate room code' });
      return;
    }

    console.log(`Room code regenerated: ${oldRoomCode} -> ${newRoomCode} for room ${roomId}`);

    this.gameNamespace.to(roomId).emit('ROOM_CODE_REGENERATED', { oldRoomCode, newRoomCode });
    this.broadcastRoomState(roomId);
  }

  handleUpdateSettings(socket: Socket, roomId: string, settings: UpdateRoomSettings): void {
    const room = this.gameLogic.getRoom(roomId);
    const host = Object.values(room?.players || {}).find(p => p.socketId === socket.id);

    if (!room || !host) {
      socket.emit('ERROR', { message: 'Room not found' });
      return;
    }

    if (!host.isHost) {
      socket.emit('ERROR', { message: 'Only host can update settings' });
      return;
    }

    if (room.status !== 'LOBBY') {
      socket.emit('ERROR', { message: 'Can only update settings in lobby' });
      return;
    }

    const playerCount = Object.keys(room.players).length;
    const validatedSettings = SettingsValidator.validateSettings(settings, playerCount);
    room.settings = { ...room.settings, ...validatedSettings };
    console.log(`Settings updated for room ${roomId}:`, settings);

    this.broadcastRoomState(roomId);
  }
}
