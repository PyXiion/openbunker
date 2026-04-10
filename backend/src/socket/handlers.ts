import { Server, Socket } from 'socket.io';
import { GameLogic } from '../game/gameLogic';
import { ChatMessage } from '../game/types';
import { UpdateRoomSettings } from '../types';
import { AuthenticatedSocket, isGuest } from '../auth/middleware';
import { computeDelta, shouldSendFullState } from '../utils/delta';
import { GameHandlers } from './handlers/gameHandlers';
import { RoomHandlers } from './handlers/roomHandlers';
import { ChatHandlers } from './handlers/chatHandlers';

export class SocketHandlers {
  private io: Server;
  private gameLogic: GameLogic;
  private lastSentState: Map<string, any> = new Map();
  private pendingRemovals: Map<string, Map<string, { timer: NodeJS.Timeout, disconnectedAt: Date }>> = new Map();
  
  private gameHandlers: GameHandlers;
  private roomHandlers: RoomHandlers;
  private chatHandlers: ChatHandlers;

  constructor(io: Server, gameLogic: GameLogic) {
    this.io = io;
    this.gameLogic = gameLogic;

    // Register callback to clean up pending removals when a room is deleted
    const onRoomDeleted = (roomId: string) => {
      const roomPendingRemovals = this.pendingRemovals.get(roomId);
      if (roomPendingRemovals) {
        console.log(`Cleaning up ${roomPendingRemovals.size} pending removal timeouts for deleted room ${roomId}`);
        for (const [playerId, pendingRemoval] of roomPendingRemovals) {
          clearTimeout(pendingRemoval.timer);
        }
        this.pendingRemovals.delete(roomId);
      }
    };

    // Set the callbacks on GameLogic
    this.gameLogic.setOnRoomDeleted(onRoomDeleted);
    
    this.gameHandlers = new GameHandlers(
      io,
      gameLogic,
      (roomId) => this.broadcastRoomState(roomId),
      (roomId, message) => this.broadcastChatMessage(roomId, message)
    );
    
    this.roomHandlers = new RoomHandlers(
      io,
      gameLogic,
      (roomId) => this.broadcastRoomState(roomId),
      (roomId, message) => this.broadcastChatMessage(roomId, message),
      (playerId) => this.lastSentState.delete(playerId),
      this.pendingRemovals
    );
    
    this.chatHandlers = new ChatHandlers(io, gameLogic);
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

    const roomId = socket.handshake.auth.roomId as string;

    if (!roomId) {
      console.error(`Connection rejected: No roomId in auth payload for socket ${socket.id}`);
      socket.emit('ERROR', { message: 'Room ID required', code: 'ROOM_ID_REQUIRED' });
      socket.disconnect();
      return;
    }

    const room = this.gameLogic.getRoom(roomId);
    if (!room) {
      console.error(`Connection rejected: Room ${roomId} not found for socket ${socket.id}`);
      socket.emit('ERROR', { message: 'Room not found', code: 'ROOM_NOT_FOUND' });
      socket.disconnect();
      return;
    }

    const player = Object.values(room.players).find(p => p.id === authSocket.userId);
    if (!player) {
      console.error(`Connection rejected: User ${authSocket.userId} not in room ${roomId} for socket ${socket.id}`);
      socket.emit('ERROR', { message: 'Not in room. Please join via REST API first.', code: 'NOT_IN_ROOM' });
      socket.disconnect();
      return;
    }

    player.socketId = socket.id;
    player.isReady = true; // Set ready back to true on reconnection

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerId = player.id;

    // If reconnected player is host, clear hostDisconnectedAt and force full update
    if (player.isHost) {
      room.hostDisconnectedAt = undefined;
      console.log(`Host ${player.name} reconnected, cleared hostDisconnectedAt`);
      // Force full state update to ensure reactivity
      const maskedRoom = this.gameLogic.getMaskedRoom(roomId, player.id);
      this.gameNamespace.to(roomId).emit('ROOM_STATE_UPDATE', maskedRoom);
    }

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

    const maskedRoom = this.gameLogic.getMaskedRoom(roomId, player.id);
    socket.emit('INITIAL_STATE', maskedRoom);

    this.lastSentState.delete(player.id);

    socket.on('START_GAME', (data: { roomId: string }) => {
      this.gameHandlers.handleStartGame(socket, data.roomId);
    });

    socket.on('REVEAL_CARD', (data: { roomId: string; traitType: string }) => {
      this.gameHandlers.handleRevealCard(socket, data.roomId, data.traitType);
    });

    socket.on('END_TURN', (data: { roomId: string }) => {
      this.gameHandlers.handleEndTurn(socket, data.roomId);
    });

    socket.on('SUBMIT_VOTE', (data: { roomId: string; targetId: string }) => {
      this.gameHandlers.handleSubmitVote(socket, data.roomId, data.targetId);
    });

    socket.on('LEAVE_ROOM', (data: { roomId: string }) => {
      this.roomHandlers.handleLeaveRoom(socket, data.roomId);
    });

    socket.on('KICK_PLAYER', (data: { roomId: string; targetId: string }) => {
      this.roomHandlers.handleKickPlayer(socket, data.roomId, data.targetId);
    });

    socket.on('REGENERATE_ROOM_CODE', (data: { roomId: string }) => {
      this.roomHandlers.handleRegenerateRoomCode(socket, data.roomId);
    });

    socket.on('UPDATE_SETTINGS', (data: { roomId: string; settings: UpdateRoomSettings }) => {
      this.roomHandlers.handleUpdateSettings(socket, data.roomId, data.settings);
    });

    socket.on('SEND_CHAT_MESSAGE', (data: { roomId: string; message: string }) => {
      this.chatHandlers.handleSendChatMessage(socket, data.roomId, data.message);
    });

    socket.on('TOGGLE_READY', (data: { roomId: string }) => {
      this.gameHandlers.handleToggleReady(socket, data.roomId);
    });

    socket.on('disconnect', () => {
      this.handleDisconnect(socket);
    });
  }

  /**
   * Handles involuntary disconnect (browser close, network loss, etc).
   * Implements 30 second grace period allowing player to reconnect without losing their seat.
   * Uses pendingRemovals map to track and cancel timeouts if reconnection occurs.
   * Re-emits full current state on reconnection within grace period.
   */
  private handleDisconnect(socket: Socket): void {
    console.log(`Player disconnected: ${socket.id}`);

    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;

    if (roomId && playerId) {
      const room = this.gameLogic.getRoom(roomId);
      if (!room) {
        console.log(`Room ${roomId} no longer exists, skipping disconnect handling`);
        return;
      }

      const player = room.players[playerId];
      if (!player) {
        console.log(`Player ${playerId} no longer in room ${roomId}, skipping disconnect handling`);
        return;
      }

      // Set player to not ready while offline
      player.isReady = false;
      
      // If host disconnects, set hostDisconnectedAt for countdown
      if (player.isHost) {
        room.hostDisconnectedAt = Date.now();
        console.log(`Host ${player.name} disconnected, set hostDisconnectedAt`);
      }
      
      this.broadcastRoomState(roomId);

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
      }, 30000); // 30 second delay for reconnection

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
