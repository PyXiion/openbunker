import { Server, Socket } from 'socket.io';
import { GameLogic } from '../game/gameLogic';
import { TraitType, ChatMessage } from '../game/types';
import { CreateRoomSettings, UpdateRoomSettings, SettingsValidator } from '../types';
import { filterChatMessage } from '../utils/contentFilter';

export class SocketHandlers {
  /**
   * Tracks pending player removals for reconnection grace period.
   * Key: persistentId, Value: timeout ID for delayed removal.
   */
  private pendingRemovals: Map<string, NodeJS.Timeout> = new Map();

  constructor(private io: Server, private gameLogic: GameLogic) {
  }

  /**
   * Sets up all Socket.io event handlers for a new connection.
   * Called once per client connection.
   */
  handleConnection(socket: Socket): void {
    console.log(`Player connected: ${socket.id}`);

    socket.on('JOIN_ROOM', (data: { roomId: string; playerName: string; persistentId?: string }) => {
      this.handleJoinRoom(socket, data.roomId, data.playerName, data.persistentId);
    });

    socket.on('CREATE_ROOM', (data: { playerName: string; persistentId?: string; language?: string; settings?: CreateRoomSettings }) => {
      this.handleCreateRoom(socket, data.playerName, data.persistentId, data.language, data.settings);
    });

    socket.on('START_GAME', (data: { roomId: string }) => {
      this.handleStartGame(socket, data.roomId);
    });

    socket.on('REVEAL_CARD', (data: { roomId: string; traitType: string }) => {
      this.handleRevealCard(socket, data.roomId, data.traitType);
    });

    socket.on('END_TURN', (data: { roomId: string }) => {
      this.handleEndTurn(socket, data.roomId);
    });

    socket.on('SUBMIT_VOTE', (data: { roomId: string; targetId: string }) => {
      this.handleSubmitVote(socket, data.roomId, data.targetId);
    });

    socket.on('LEAVE_ROOM', (data: { roomId: string }) => {
      this.handleLeaveRoom(socket, data.roomId);
    });

    socket.on('KICK_PLAYER', (data: { roomId: string; targetId: string }) => {
      this.handleKickPlayer(socket, data.roomId, data.targetId);
    });

    socket.on('REGENERATE_ROOM_CODE', (data: { roomId: string }) => {
      this.handleRegenerateRoomCode(socket, data.roomId);
    });

    socket.on('UPDATE_SETTINGS', (data: { roomId: string; settings: UpdateRoomSettings }) => {
      this.handleUpdateSettings(socket, data.roomId, data.settings);
    });

    socket.on('SEND_CHAT_MESSAGE', (data: { roomId: string; message: string }) => {
      this.handleSendChatMessage(socket, data.roomId, data.message);
    });

    socket.on('disconnect', () => {
      this.handleDisconnect(socket);
    });
  }

  /**
   * Handles player joining an existing room.
   * Supports reconnection: cancels pending removal if player reconnects within grace period.
   * Stores player data in socket.data for later reference.
   */
  private handleJoinRoom(socket: Socket, roomId: string, playerName: string, persistentId?: string): void {
    const room = this.gameLogic.joinRoom(roomId, socket.id, playerName, persistentId);
    
    if (!room) {
      socket.emit('JOIN_ERROR', { message: 'Failed to join room' });
      return;
    }

    socket.join(roomId);
    socket.data.roomId = roomId;

    // FIX: Find the player by the socketId we just assigned them in gameLogic
    const player = Object.values(room.players).find(p => p.socketId === socket.id);
    if (player) {
      socket.data.playerId = player.id; 
      socket.data.playerName = player.name;
      
      // Cancel any pending removal timeout for this player
      const existingTimeout = this.pendingRemovals.get(player.id);
      if (existingTimeout) {
        console.log(`Cancelling pending removal timeout for reconnected player ${player.id}`);
        clearTimeout(existingTimeout);
        this.pendingRemovals.delete(player.id);
      }
    }

    if (!player) {
      // Log player join event
      if (player) {
        const eventMessage = this.gameLogic.addSystemEvent(
          roomId,
          'PLAYER_JOIN',
          `${playerName} joined the room`,
          { playerId: persistentId, playerName }
        );
        this.broadcastChatMessage(roomId, eventMessage);
      }
    }

    this.gameLogic.checkHostOwnershipTTL(roomId);    
    this.broadcastRoomState(roomId);
  }

  private handleCreateRoom(socket: Socket, playerName: string, persistentId?: string, language?: string, settings?: CreateRoomSettings): void {
    // Validate and convert settings using the validator
    const validatedSettings = settings ? SettingsValidator.validateSettings(settings) : undefined;
    
    const room = this.gameLogic.createRoom(socket.id, playerName, persistentId, language || 'en', validatedSettings);
    
    socket.join(room.roomId);
    socket.data.roomId = room.roomId;
    socket.data.playerName = playerName;

    const host = Object.values(room.players).find(p => p.isHost);
    if (host) {
      socket.data.playerId = host.id; // Store the UUID
    }

    // Return the host's persistentId to the client
    socket.emit('ROOM_CREATED', { roomId: room.roomId, persistentId: host?.id });
    this.broadcastRoomState(room.roomId);
  }

  private handleStartGame(socket: Socket, roomId: string): void {
    console.log('handleStartGame called with roomId:', roomId);
    console.log('socket.id:', socket.id);
    
    const room = this.gameLogic.getRoom(roomId);
    console.log('room exists:', !!room);
    console.log('room status:', room?.status);
    
    // Find player by socketId to check if they're host
    const player = Object.values(room?.players || {}).find(p => p.socketId === socket.id);
    if (!room || !player?.isHost) {
      console.log('Failed: Room not found or player not host');
      socket.emit('ERROR', { message: 'Only host can start the game' });
      return;
    }

    const success = this.gameLogic.startGame(roomId);
    console.log('startGame success:', success);
    
    if (!success) {
      console.log('GameLogic.startGame failed');
      socket.emit('ERROR', { message: 'Failed to start game' });
      return;
    }

    console.log('Game started successfully, broadcasting room state');
    
    // Log game start event
    const eventMessage = this.gameLogic.addSystemEvent(
      roomId,
      'GAME_STARTED',
      'The game has started!',
      { round: 1 }
    );
    this.broadcastChatMessage(roomId, eventMessage);

    this.broadcastRoomState(roomId);
  }

  private handleRevealCard(socket: Socket, roomId: string, traitType: string): void {
    console.log(`handleRevealCard called with roomId: ${roomId}, traitType: ${traitType}`);
    
    const room = this.gameLogic.getRoom(roomId);
    
    const player = Object.values(room?.players || {}).find(p => p.id === socket.data.playerId);
    
    if (!room || !player) {
      console.log('Failed: Room not found or player not found');
      socket.emit('ERROR', { message: 'Failed to reveal card' });
      return;
    }
    
    const success = this.gameLogic.revealCard(roomId, player.id, traitType as any);
    
    if (!success) {
      console.log('GameLogic.revealCard failed');
      socket.emit('ERROR', { message: 'Failed to reveal card' });
      return;
    }

    console.log('Card revealed successfully, broadcasting room state');
    
    // Log card reveal event
    if (player) {
      const eventMessage = this.gameLogic.addSystemEvent(
        roomId,
        'CARD_REVEALED',
        `${player.name} revealed their ${traitType}`,
        { playerId: player.id, playerName: player.name, traitType }
      );
      this.broadcastChatMessage(roomId, eventMessage);
    }

    this.broadcastRoomState(roomId);
  }

  private handleEndTurn(socket: Socket, roomId: string): void {
    const room = this.gameLogic.getRoom(roomId);
    const player = Object.values(room?.players || {}).find(p => p.socketId === socket.id);
    if (!player) {
      socket.emit('ERROR', { message: 'Player not found' });
      return;
    }
    
    const success = this.gameLogic.endTurn(roomId, player.id);
    
    if (!success) {
      socket.emit('ERROR', { message: 'Failed to end turn' });
      return;
    }

    this.broadcastRoomState(roomId);
  }

  private handleSubmitVote(socket: Socket, roomId: string, targetId: string): void {
    const room = this.gameLogic.getRoom(roomId);
    const player = Object.values(room?.players || {}).find(p => p.socketId === socket.id);
    if (!player) {
      socket.emit('ERROR', { message: 'Player not found' });
      return;
    }
    
    const result = this.gameLogic.submitVote(roomId, player.id, targetId);
    
    if (!result.success) {
      socket.emit('ERROR', { message: 'Failed to submit vote' });
      return;
    }

    // Broadcast any events that were created (ROUND_STARTED, BUNKER_ROOM_REVEALED, GAME_FINISHED)
    for (const event of result.events) {
      this.broadcastChatMessage(roomId, event);
    }

    this.broadcastRoomState(roomId);

    // Check if player was exiled
    if (room && room.status === 'PLAYING') {
      const exiledPlayer = Object.values(room.players).find(p => p.isExiled && p.votesReceived > 0);
      if (exiledPlayer) {
        this.io.to(roomId).emit('PLAYER_EXILED', { playerId: exiledPlayer.id });
        
        // Log player exile event
        const eventMessage = this.gameLogic.addSystemEvent(
          roomId,
          'PLAYER_EXILED',
          `${exiledPlayer.name} has been exiled from the bunker`,
          { playerId: exiledPlayer.id, playerName: exiledPlayer.name, round: room.round }
        );
        this.broadcastChatMessage(roomId, eventMessage);
      }
    }
  }

  /**
   * Handles voluntary room leave (player clicks "Leave Room").
   * Immediately transfers host (not 30s TTL) since this is intentional.
   * Keeps socket connection alive for potential rejoin.
   */
  private handleLeaveRoom(socket: Socket, roomId: string): void {
    console.log(`Player ${socket.id} voluntarily leaving room ${roomId}`);
    
    const room = this.gameLogic.getRoom(roomId);
    const player = Object.values(room?.players || {}).find(p => p.socketId === socket.id);
    
    if (!room || !player) {
      socket.emit('ERROR', { message: 'Room not found or not in room' });
      return;
    }

    const playerName = player.name;
    
    // Remove player from room immediately with immediate host transfer for voluntary leave
    const success = this.gameLogic.removePlayer(roomId, player.id, true);
    
    if (!success) {
      socket.emit('ERROR', { message: 'Failed to leave room' });
      return;
    }

    console.log(`Player ${playerName} successfully left room ${roomId}`);
    
    // Log player left event
    const eventMessage = this.gameLogic.addSystemEvent(
      roomId,
      'PLAYER_LEFT',
      `${playerName} left the room`,
      { playerId: player.id, playerName }
    );
    this.broadcastChatMessage(roomId, eventMessage);
    
    // Leave socket room but keep connection alive
    socket.leave(roomId);
    socket.data.roomId = null;
    socket.data.playerId = null;
    
    // Notify remaining players
    this.io.to(roomId).emit('PLAYER_LEFT', { playerId: player.id, playerName });
    this.broadcastRoomState(roomId);
  }

  private handleKickPlayer(socket: Socket, roomId: string, targetId: string): void {
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

    // Remove player from room
    const success = this.gameLogic.removePlayer(roomId, targetId);

    if (!success) {
      socket.emit('ERROR', { message: 'Failed to kick player' });
      return;
    }

    console.log(`Player ${playerName} (${targetId}) was kicked from room ${roomId}`);

    // Log player kicked event
    const eventMessage = this.gameLogic.addSystemEvent(
      roomId,
      'PLAYER_KICKED',
      `${playerName} was kicked by the host`,
      { playerId: targetId, playerName, kickedBy: host.name }
    );
    this.broadcastChatMessage(roomId, eventMessage);

    // Notify the kicked player
    this.io.to(targetPlayer.socketId).emit('KICKED', { roomId, reason: 'Kicked by host' });

    // Notify remaining players
    this.io.to(roomId).emit('PLAYER_KICKED', { playerId: targetId, playerName });
    this.broadcastRoomState(roomId);
  }

  private handleRegenerateRoomCode(socket: Socket, roomId: string): void {
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

    // Generate new room ID
    const newRoomId = this.gameLogic.regenerateRoomId(roomId);

    if (!newRoomId) {
      socket.emit('ERROR', { message: 'Failed to regenerate room code' });
      return;
    }

    console.log(`Room code regenerated: ${roomId} -> ${newRoomId}`);

    // Move all players to the new room
    for (const player of Object.values(room.players)) {
      this.io.sockets.sockets.get(player.socketId)?.leave(roomId);
      this.io.sockets.sockets.get(player.socketId)?.join(newRoomId);
    }

    // Notify all players about the new room code
    this.io.to(newRoomId).emit('ROOM_CODE_REGENERATED', { oldRoomId: roomId, newRoomId });
    this.broadcastRoomState(newRoomId);
  }

  /**
   * Handles room settings updates (bunker capacity, first trait, etc).
   * Only host can update settings, and only in lobby phase.
   */
  private handleUpdateSettings(socket: Socket, roomId: string, settings: UpdateRoomSettings): void {
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

    // Validate and update settings
    const validatedSettings = SettingsValidator.validateSettings(settings);
    room.settings = { ...room.settings, ...validatedSettings };
    console.log(`Settings updated for room ${roomId}:`, settings);

    this.broadcastRoomState(roomId);
  }

  private handleSendChatMessage(socket: Socket, roomId: string, message: string): void {
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

    // Validate message
    if (!message || message.trim().length === 0) {
      socket.emit('ERROR', { message: 'Message cannot be empty' });
      return;
    }

    if (message.length > 500) {
      socket.emit('ERROR', { message: 'Message too long (max 500 characters)' });
      return;
    }

    console.log(`[CHAT] Adding message from ${player.name} to history`);
    
    // Check if content filtering is enabled for this room
    const isContentFilterEnabled = room.settings?.enableContentFilter !== false; // Default to true
    
    // Filter message content if filtering is enabled
    const filteredMessage = isContentFilterEnabled ? filterChatMessage(message.trim()) : message.trim();
    
    // Add message to chat history
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
      // Broadcast the new message to all players
      this.io.to(roomId).emit('CHAT_MESSAGE', chatMessage);
      console.log(`[CHAT] Message broadcast complete: ${chatMessage.id}`);
    }
  }

  /**
   * Handles involuntary disconnect (browser close, network loss, etc).
   * Implements 5-second grace period allowing player to reconnect without losing their seat.
   * Uses pendingRemovals map to track and cancel timeouts if reconnection occurs.
   * Host ownership is preserved with 30-second TTL (handled in GameLogic.removePlayer).
   */
  private handleDisconnect(socket: Socket): void {
    console.log(`Player disconnected: ${socket.id}`);
    
    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;
    
    if (roomId && playerId) {
      // Cancel any existing timeout for this player (prevents duplicate timeouts)
      const existingTimeout = this.pendingRemovals.get(playerId);
      if (existingTimeout) {
        console.log(`Cancelling existing removal timeout for player ${playerId}`);
        clearTimeout(existingTimeout);
        this.pendingRemovals.delete(playerId);
      }
      
      // Store the socket ID for comparison in delayed removal
      const disconnectedSocketId = socket.id;
      
      // Schedule player removal with a delay to allow for reconnection
      const timeout = setTimeout(() => {
        this.pendingRemovals.delete(playerId);
        
        const room = this.gameLogic.getRoom(roomId);
        if (!room) {
          console.log(`Room ${roomId} no longer exists, skipping removal`);
          return;
        }
        
        // Check if player still exists in room (might have been removed by another timeout or admin action)
        const player = room.players[playerId];
        if (!player) {
          console.log(`Player ${playerId} no longer in room ${roomId}, skipping removal`);
          return;
        }
        
        // Check if player with same ID has reconnected with different socket
        const reconnectedPlayer = Object.values(room.players).find(
          p => p.id === playerId && p.socketId !== disconnectedSocketId
        );
        
        if (reconnectedPlayer) {
          console.log(`Player ${playerId} reconnected with new socket ${reconnectedPlayer.socketId}, not removing`);
          return;
        }
        
        console.log(`Player ${disconnectedSocketId} did not reconnect, removing from room ${roomId}`);
        this.gameLogic.removePlayer(roomId, playerId);
        this.broadcastRoomState(roomId);
      }, 5000); // 5 second delay for reconnection
      
      // Track this timeout so we can cancel it if player reconnects
      this.pendingRemovals.set(playerId, timeout);
    }
  }

  /**
   * Sends personalized masked room state to each connected player.
   * Each player receives a version where unrevealed cards are hidden.
   * Called after any state-changing operation.
   */
  private broadcastRoomState(roomId: string): void {
    const room = this.gameLogic.getRoom(roomId);
    if (!room) return;

    // Send masked room state to each player (emit to their socketId)
    for (const player of Object.values(room.players)) {
      const maskedRoom = this.gameLogic.getMaskedRoom(roomId, player.id);
      this.io.to(player.socketId).emit('ROOM_STATE_UPDATE', maskedRoom);
    }
  }

  /**
   * Broadcasts a chat message to all players in a room.
   * Used for both player messages and system events.
   */
  private broadcastChatMessage(roomId: string, message: ChatMessage | null): void {
    if (!message) return;
    this.io.to(roomId).emit('CHAT_MESSAGE', message);
  }
}
