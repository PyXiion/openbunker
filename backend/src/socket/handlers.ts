import { Server, Socket } from 'socket.io';
import { GameLogic } from '../game/gameLogic';
import { TraitType, ChatMessage } from '../game/types';
import { CreateRoomSettings, UpdateRoomSettings, SettingsValidator } from '../types';
import { filterChatMessage } from '../utils/contentFilter';
import { AuthenticatedSocket, requireAuthentication, requireRoomAccess, isGuest } from '../auth/middleware';
import { recordGameHistory, getProfile } from '../auth/database';
import { computeDelta, shouldSendFullState } from '../utils/delta';
import { logger } from '../utils/logger';

export class SocketHandlers {
  private io: Server;
  private gameLogic: GameLogic;
  private lastSentState: Map<string, any> = new Map();
  private pendingRemovals: Map<string, Map<string, { timer: NodeJS.Timeout, disconnectedAt: Date }>> = new Map();

  constructor(io: Server, gameLogic: GameLogic) {
    this.io = io;
    this.gameLogic = gameLogic;
  }

  private get gameNamespace() {
    return this.io.of('/ws/game');
  }

  /**
   * Sets up all Socket.io event handlers for a new connection.
   * Called once per client connection to /ws/game namespace.
   */
  handleConnection(socket: Socket): void {
    const authSocket = socket as AuthenticatedSocket;
    console.log(`Player connected: ${socket.id} (User: ${authSocket.userId}, Guest: ${isGuest(socket)})`);

    // Extract roomId from auth payload
    const roomId = socket.handshake.auth.roomId as string;

    if (!roomId) {
      console.error(`Connection rejected: No roomId in auth payload for socket ${socket.id}`);
      socket.emit('ERROR', { message: 'Room ID required', code: 'ROOM_ID_REQUIRED' });
      socket.disconnect();
      return;
    }

    // Verify user has joined via REST API (check GameLogic for player in room)
    const room = this.gameLogic.getRoom(roomId);
    if (!room) {
      console.error(`Connection rejected: Room ${roomId} not found for socket ${socket.id}`);
      socket.emit('ERROR', { message: 'Room not found', code: 'ROOM_NOT_FOUND' });
      socket.disconnect();
      return;
    }

    // Check if player is in the room (via userId from REST join)
    const player = Object.values(room.players).find(p => p.id === authSocket.userId);
    if (!player) {
      console.error(`Connection rejected: User ${authSocket.userId} not in room ${roomId} for socket ${socket.id}`);
      socket.emit('ERROR', { message: 'Not in room. Please join via REST API first.', code: 'NOT_IN_ROOM' });
      socket.disconnect();
      return;
    }

    // Update player's socketId to the current connection
    player.socketId = socket.id;

    // Join Socket.IO room
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerId = player.id;

    // Cancel any pending removal timeout for this player (reconnection)
    const roomPendingRemovals = this.pendingRemovals.get(roomId);
    if (roomPendingRemovals) {
      const pendingRemoval = roomPendingRemovals.get(player.id);
      if (pendingRemoval) {
        console.log(`Cancelling pending removal timeout for reconnected player ${player.id}`);
        clearTimeout(pendingRemoval.timer);
        roomPendingRemovals.delete(player.id);
        if (roomPendingRemovals.size === 0) {
          this.pendingRemovals.delete(roomId);
        }
      }
    }

    // Emit INITIAL_STATE immediately with current room state
    const maskedRoom = this.gameLogic.getMaskedRoom(roomId, player.id);
    socket.emit('INITIAL_STATE', maskedRoom);

    // Clear last sent state to ensure player gets full state on reconnection
    this.lastSentState.delete(player.id);

    // Attach game event listeners
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

    socket.on('TOGGLE_READY', (data: { roomId: string }) => {
      this.handleToggleReady(socket, data.roomId);
    });

    socket.on('disconnect', () => {
      this.handleDisconnect(socket);
    });
  }


  private handleStartGame(socket: Socket, roomId: string): void {
    try {
      const authSocket = requireRoomAccess(socket, roomId);
      
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
      const eventMessage = this.gameLogic.addLocalizedSystemEvent(
        roomId,
        'GAME_STARTED',
        'events.game_started',
        { round: 1 },
        { round: 1 }
      );
      if (eventMessage) {
        this.broadcastChatMessage(roomId, eventMessage);
      }

      // Add welcome message
      const welcomeTitle = this.gameLogic.getLocalizedMessage(roomId, 'welcome.title');
      const welcomeMessage = this.gameLogic.getLocalizedMessage(roomId, 'welcome.message');
      const fullWelcomeMessage = `${welcomeTitle} ${welcomeMessage}`;
      
      const welcomeChatMessage = this.gameLogic.addSystemEvent(
        roomId,
        'GAME_STARTED',
        fullWelcomeMessage,
        { type: 'welcome' }
      );
      if (welcomeChatMessage) {
        this.broadcastChatMessage(roomId, welcomeChatMessage);
      }

      this.broadcastRoomState(roomId);
    } catch (error) {
      console.error('Start game error:', error);
      socket.emit('ERROR', { message: 'Authentication failed' });
    }
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
      if (eventMessage) {
        this.broadcastChatMessage(roomId, eventMessage);
      }
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
      if (event) {
        this.broadcastChatMessage(roomId, event);
      }
    }

    this.broadcastRoomState(roomId);

    // Check if player was exiled
    if (room && room.status === 'PLAYING') {
      const exiledPlayer = Object.values(room.players).find(p => p.isExiled && p.votesReceived > 0);
      if (exiledPlayer) {
        this.gameNamespace.to(roomId).emit('PLAYER_EXILED', { playerId: exiledPlayer.id });

        // Log player exile event
        const eventMessage = this.gameLogic.addSystemEvent(
          roomId,
          'PLAYER_EXILED',
          `${exiledPlayer.name} has been exiled from the bunker`,
          { playerId: exiledPlayer.id, playerName: exiledPlayer.name, round: room.round }
        );
        if (eventMessage) {
          this.broadcastChatMessage(roomId, eventMessage);
        }
      }
    }

    // Record game history if game finished
    if (room && room.status === 'FINISHED' && room.gameStartedAt) {
      logger.debug('[GAME_HISTORY] Game finished, recording history for all players');
      const durationMinutes = Math.round((Date.now() - room.gameStartedAt) / 60000);

      // Record history for each authenticated player
      for (const player of Object.values(room.players)) {
        logger.debug(`[GAME_HISTORY] Player: ${player.name}, isGuest: ${player.isGuest}, id: ${player.id}`);
        if (!player.isGuest) {
          logger.debug(`[GAME_HISTORY] Recording history for player ${player.id}`);
          recordGameHistory({
            roomId: room.roomId,
            profileId: player.id,
            playerName: player.name,
            gameStatus: 'FINISHED',
            wasExiled: player.isExiled,
            survived: !player.isExiled,
            finalRound: room.round,
            playersCount: Object.keys(room.players).length,
            bunkerCapacity: room.bunker?.capacity || 0,
            catastropheId: room.catastrophe?.id,
            durationMinutes,
          }).catch((error) => {
            console.error(`Failed to record game history for player ${player.id}:`, error);
          });
        } else {
          logger.debug(`[GAME_HISTORY] Skipping guest player ${player.id}`);
        }
      }
    } else {
      logger.debug(`[GAME_HISTORY] Not recording - room: ${!!room}, status: ${room?.status}, gameStartedAt: ${!!room?.gameStartedAt}`);
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
    if (eventMessage) {
      this.broadcastChatMessage(roomId, eventMessage);
    }
    
    // Leave socket room but keep connection alive
    socket.leave(roomId);
    socket.data.roomId = null;
    socket.data.playerId = null;
    
    // Clear last sent state for the leaving player
    this.lastSentState.delete(player.id);
    
    // Notify remaining players
    this.gameNamespace.to(roomId).emit('PLAYER_LEFT', { playerId: player.id, playerName });
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
    if (eventMessage) {
      this.broadcastChatMessage(roomId, eventMessage);
    }

    // Notify the kicked player
    this.gameNamespace.to(targetPlayer.socketId).emit('KICKED', { roomId, reason: 'Kicked by host' });

    // Clear last sent state for the kicked player
    this.lastSentState.delete(targetId);

    // Clear pending removal for the kicked player
    const roomPendingRemovals = this.pendingRemovals.get(roomId);
    if (roomPendingRemovals) {
      roomPendingRemovals.delete(targetId);
      if (roomPendingRemovals.size === 0) {
        this.pendingRemovals.delete(roomId);
      }
    }

    // Notify remaining players
    this.gameNamespace.to(roomId).emit('PLAYER_KICKED', { playerId: targetId, playerName });
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
    this.gameNamespace.to(newRoomId).emit('ROOM_CODE_REGENERATED', { oldRoomId: roomId, newRoomId });
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

    // Validate and update settings with player count
    const playerCount = Object.keys(room.players).length;
    const validatedSettings = SettingsValidator.validateSettings(settings, playerCount);
    room.settings = { ...room.settings, ...validatedSettings };
    console.log(`Settings updated for room ${roomId}:`, settings);

    this.broadcastRoomState(roomId);
  }

  private handleSendChatMessage(socket: Socket, roomId: string, message: string): void {
    console.log(`[CHAT] Received message from ${socket.id} in room ${roomId}: "${message.substring(0, 50)}..."}`);
    
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
      // Broadcast the new message to all players in the /ws/game namespace
      const gameNamespace = this.io.of('/ws/game');
      gameNamespace.to(roomId).emit('CHAT_MESSAGE', chatMessage);
      console.log(`[CHAT] Message broadcast complete: ${chatMessage.id}`);
    }
  }

  private handleToggleReady(socket: Socket, roomId: string): void {
    const room = this.gameLogic.getRoom(roomId);
    const player = Object.values(room?.players || {}).find(p => p.socketId === socket.id);

    if (!room) {
      socket.emit('ERROR', { message: 'Room not found' });
      return;
    }

    if (!player) {
      socket.emit('ERROR', { message: 'Player not found' });
      return;
    }

    // Toggle ready status
    player.isReady = !player.isReady;
    console.log(`Player ${player.name} toggled ready status to ${player.isReady}`);

    this.broadcastRoomState(roomId);
  }

  /**
   * Handles involuntary disconnect (browser close, network loss, etc).
   * Implements 10-15 second grace period allowing player to reconnect without losing their seat.
   * Uses pendingRemovals map to track and cancel timeouts if reconnection occurs.
   * Re-emits full current state on reconnection within grace period.
   */
  private handleDisconnect(socket: Socket): void {
    console.log(`Player disconnected: ${socket.id}`);

    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;

    if (roomId && playerId) {
      // Cancel any existing timeout for this player (prevents duplicate timeouts)
      let roomPendingRemovals = this.pendingRemovals.get(roomId);
      if (roomPendingRemovals) {
        const existingPendingRemoval = roomPendingRemovals.get(playerId);
        if (existingPendingRemoval) {
          console.log(`Cancelling existing removal timeout for player ${playerId}`);
          clearTimeout(existingPendingRemoval.timer);
          roomPendingRemovals.delete(playerId);
          if (roomPendingRemovals.size === 0) {
            this.pendingRemovals.delete(roomId);
          }
        }
      }

      // Store the socket ID for comparison in delayed removal
      const disconnectedSocketId = socket.id;

      // Schedule player removal with a delay to allow for reconnection
      const timeout = setTimeout(() => {
        // Remove from tracking map
        roomPendingRemovals = this.pendingRemovals.get(roomId);
        if (roomPendingRemovals) {
          roomPendingRemovals.delete(playerId);
          if (roomPendingRemovals.size === 0) {
            this.pendingRemovals.delete(roomId);
          }
        }

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

        // Clear last sent state for the disconnecting player
        this.lastSentState.delete(playerId);

        this.gameLogic.removePlayer(roomId, playerId);
        this.broadcastRoomState(roomId);
      }, 15000); // 15 second delay for reconnection (increased from 5s)

      // Track this timeout so we can cancel it if player reconnects
      if (!roomPendingRemovals) {
        roomPendingRemovals = new Map();
        this.pendingRemovals.set(roomId, roomPendingRemovals);
      }
      roomPendingRemovals.set(playerId, { timer: timeout, disconnectedAt: new Date() });
    }
  }

  /**
   * Sends personalized masked room state to each connected player.
   * Each player receives a version where unrevealed cards are hidden.
   * Uses differential updates to send only changed fields.
   * Called after any state-changing operation.
   */
  private broadcastRoomState(roomId: string): void {
    const room = this.gameLogic.getRoom(roomId);
    if (!room) return;

    // Send masked room state to each player (emit to their socketId)
    for (const player of Object.values(room.players)) {
      const maskedRoom = this.gameLogic.getMaskedRoom(roomId, player.id);
      const lastState = this.lastSentState.get(player.id);

      // Compute delta between last sent state and current state
      const delta = computeDelta(lastState, maskedRoom);

      // Determine whether to send full state or delta
      const shouldSendFull = !lastState || shouldSendFullState(delta);

      if (shouldSendFull) {
        // Send full state for new connections or large changes
        this.gameNamespace.to(player.socketId).emit('ROOM_STATE_UPDATE', maskedRoom);
        this.lastSentState.set(player.id, maskedRoom);
      } else {
        // Send differential update
        this.gameNamespace.to(player.socketId).emit('ROOM_STATE_DELTA', delta);
        // Update last sent state by applying the delta
        this.lastSentState.set(player.id, maskedRoom);
      }
    }
  }

  /**
   * Broadcasts a chat message to all players in a room.
   * Used for both player messages and system events.
   */
  private broadcastChatMessage(roomId: string, message: ChatMessage): void {
    console.log(`[CHAT] Broadcasting message to room ${roomId}: ${message.type}`);
    this.gameNamespace.to(roomId).emit('CHAT_MESSAGE', message);
  }
}
