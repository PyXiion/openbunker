import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameLogic } from '../../game/gameLogic';
import { GameRoom, TraitType } from '../../game/types';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
vi.mock('fs');
vi.mock('path', () => ({
  join: (...args: string[]) => args.join('/'),
}));

describe('GameLogic', () => {
  let gameLogic: GameLogic;

  beforeEach(() => {
    gameLogic = new GameLogic();
    vi.clearAllMocks();
    
    // Mock file system reads for game data
    vi.mocked(fs.existsSync).mockReturnValue(true);
    
    // Mock different return values based on file path
    vi.mocked(fs.readFileSync).mockImplementation((filePath: any) => {
      const pathStr = String(filePath);
      if (pathStr.includes('data/catastrophes')) {
        return JSON.stringify([{ id: 'c1', title: 'Nuclear War', description: 'Test', duration: 'Permanent' }]);
      } else if (pathStr.includes('data/bunker')) {
        return JSON.stringify([{ id: 'r1', name: 'Medical Bay', description: 'Test' }]);
      } else if (pathStr.includes('data/traits')) {
        return JSON.stringify({
          profession: [{ id: 'p1', name: 'Doctor', description: 'Heals' }],
          biology: [{ id: 'b1', name: 'Young', description: 'Age 25' }],
          hobby: [{ id: 'h1', name: 'Gaming', description: 'Plays games' }],
          phobia: [{ id: 'ph1', name: 'Spiders', description: 'Scary' }],
          baggage: [{ id: 'bg1', name: 'Laptop', description: 'Tech' }],
          fact: [{ id: 'f1', name: 'Left-handed', description: 'Fact' }],
        });
      } else if (pathStr.includes('data/messages')) {
        return JSON.stringify({ test: 'message' });
      }
      return '{}';
    });
  });

  describe('generateRoomId', () => {
    it('should generate a 6-character room ID', () => {
      const roomId = gameLogic.generateRoomId();
      expect(roomId).toHaveLength(6);
      expect(roomId).toMatch(/^[A-Z0-9]+$/);
    });

    it('should generate unique room IDs', () => {
      const id1 = gameLogic.generateRoomId();
      const id2 = gameLogic.generateRoomId();
      expect(id1).not.toBe(id2);
    });

    it('should avoid collisions with existing rooms', () => {
      const roomId1 = gameLogic.generateRoomId();
      gameLogic.createRoom('socket1', 'Player1', undefined, 'en');
      const roomId2 = gameLogic.generateRoomId();
      expect(roomId2).not.toBe(roomId1);
    });
  });

  describe('generatePersistentId', () => {
    it('should generate a UUID-like ID', () => {
      const id = gameLogic.generatePersistentId();
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(20);
    });

    it('should generate unique IDs', () => {
      const id1 = gameLogic.generatePersistentId();
      const id2 = gameLogic.generatePersistentId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('createRoom', () => {
    it('should create a room with host', () => {
      const room = gameLogic.createRoom('socket1', 'HostPlayer');
      
      expect(room).toBeTruthy();
      expect(room.status).toBe('LOBBY');
      expect(room.players).toBeDefined();
      expect(Object.keys(room.players)).toHaveLength(1);
      expect(room.turnOrder).toHaveLength(1);
    });

    it('should set host as first player', () => {
      const room = gameLogic.createRoom('socket1', 'HostPlayer');
      const hostId = room.turnOrder[0];
      const host = room.players[hostId];
      
      expect(host.isHost).toBe(true);
      expect(host.name).toBe('HostPlayer');
      expect(host.socketId).toBe('socket1');
    });

    it('should accept custom persistent ID', () => {
      const customId = 'custom-persistent-id';
      const room = gameLogic.createRoom('socket1', 'HostPlayer', customId);
      
      const hostId = room.turnOrder[0];
      expect(hostId).toBe(customId);
    });

    it('should accept custom settings', () => {
      const settings = { bunkerCapacity: 5 };
      const room = gameLogic.createRoom('socket1', 'HostPlayer', undefined, 'en', settings);
      
      expect(room.settings).toEqual(settings);
    });

    it('should store room in rooms map', () => {
      const room = gameLogic.createRoom('socket1', 'HostPlayer');
      const retrieved = gameLogic.getRoom(room.roomId);
      
      expect(retrieved).toBeTruthy();
      expect(retrieved?.roomId).toBe(room.roomId);
    });

    it('should accept avatar URL', () => {
      const avatarUrl = 'https://example.com/avatar.png';
      const room = gameLogic.createRoom('socket1', 'HostPlayer', undefined, 'en', undefined, avatarUrl);
      
      const hostId = room.turnOrder[0];
      expect(room.players[hostId].avatarUrl).toBe(avatarUrl);
    });
  });

  describe('joinRoom', () => {
    let roomId: string;

    beforeEach(() => {
      const room = gameLogic.createRoom('socket1', 'HostPlayer');
      roomId = room.roomId;
    });

    it('should allow player to join existing room in LOBBY', () => {
      const result = gameLogic.joinRoom(roomId, 'socket2', 'Player2');
      
      expect(result).toBeTruthy();
      expect(Object.keys(result!.players)).toHaveLength(2);
    });

    it('should return null for non-existent room', () => {
      const result = gameLogic.joinRoom('INVALID', 'socket2', 'Player2');
      expect(result).toBeNull();
    });

    it('should return null if room is not in LOBBY', () => {
      gameLogic.joinRoom(roomId, 'socket2', 'Player2', 'player2');
      gameLogic.startGame(roomId);
      const result = gameLogic.joinRoom(roomId, 'socket3', 'Player3');
      expect(result).toBeNull();
    });

    it('should update socket ID for rejoining player', () => {
      const room = gameLogic.createRoom('socket1', 'Player1', 'persistent1');
      const roomId2 = room.roomId;
      
      const result = gameLogic.joinRoom(roomId2, 'socket2', 'Player1', 'persistent1');
      expect(result).toBeTruthy();
      expect(result!.players['persistent1'].socketId).toBe('socket2');
    });

    it('should accept avatar URL for joining player', () => {
      const avatarUrl = 'https://example.com/avatar2.png';
      const result = gameLogic.joinRoom(roomId, 'socket2', 'Player2', undefined, avatarUrl);
      
      expect(result).toBeTruthy();
      const newPlayerId = Object.keys(result!.players).find(id => result!.players[id].name === 'Player2');
      expect(result!.players[newPlayerId!].avatarUrl).toBe(avatarUrl);
    });
  });

  describe('startGame', () => {
    let roomId: string;

    beforeEach(() => {
      const room = gameLogic.createRoom('socket1', 'HostPlayer');
      roomId = room.roomId;
    });

    it('should start game with minimum players', () => {
      gameLogic.joinRoom(roomId, 'socket2', 'Player2');
      const result = gameLogic.startGame(roomId);
      
      expect(result).toBe(true);
      const room = gameLogic.getRoom(roomId);
      expect(room?.status).toBe('PLAYING');
    });

    it('should return false for non-existent room', () => {
      const result = gameLogic.startGame('INVALID');
      expect(result).toBe(false);
    });

    it('should return false if room not in LOBBY', () => {
      gameLogic.joinRoom(roomId, 'socket2', 'Player2');
      gameLogic.startGame(roomId);
      const result = gameLogic.startGame(roomId);
      expect(result).toBe(false);
    });

    it('should return false with insufficient players', () => {
      const result = gameLogic.startGame(roomId);
      expect(result).toBe(false);
    });

    it('should initialize catastrophe and bunker', () => {
      gameLogic.joinRoom(roomId, 'socket2', 'Player2');
      gameLogic.startGame(roomId);
      
      const room = gameLogic.getRoom(roomId);
      expect(room?.catastrophe).toBeTruthy();
      expect(room?.bunker).toBeTruthy();
    });

    it('should deal traits to all players', () => {
      gameLogic.joinRoom(roomId, 'socket2', 'Player2');
      gameLogic.startGame(roomId);
      
      const room = gameLogic.getRoom(roomId);
      for (const player of Object.values(room!.players)) {
        expect(player.traits.profession.id).toBeTruthy();
        expect(player.traits.biology.id).toBeTruthy();
        expect(player.traits.hobby.id).toBeTruthy();
      }
    });
  });

  describe('revealCard', () => {
    let roomId: string;
    let playerId: string;

    beforeEach(() => {
      const room = gameLogic.createRoom('socket1', 'Player1', 'p1');
      roomId = room.roomId;
      playerId = 'p1';
      gameLogic.joinRoom(roomId, 'socket2', 'Player2', 'p2');
      gameLogic.startGame(roomId);
    });

    it('should reveal card for current player', () => {
      const result = gameLogic.revealCard(roomId, playerId, 'profession');
      expect(result).toBe(true);
      
      const room = gameLogic.getRoom(roomId);
      expect(room?.players[playerId].traits.profession.isRevealed).toBe(true);
    });

    it('should return false for non-existent room', () => {
      const result = gameLogic.revealCard('INVALID', playerId, 'profession');
      expect(result).toBe(false);
    });

    it('should return false if room not in PLAYING', () => {
      const room = gameLogic.createRoom('socket3', 'Player3', 'p3');
      const roomId2 = room.roomId;
      const result = gameLogic.revealCard(roomId2, 'p3', 'profession');
      expect(result).toBe(false);
    });

    it('should return false if not current player turn', () => {
      const result = gameLogic.revealCard(roomId, 'p2', 'profession');
      expect(result).toBe(false);
    });

    it('should return false if card already revealed', () => {
      gameLogic.revealCard(roomId, playerId, 'profession');
      const result = gameLogic.revealCard(roomId, playerId, 'profession');
      expect(result).toBe(false);
    });

    it('should enforce first trait rule when configured', () => {
      const room = gameLogic.createRoom('socket3', 'Player3', 'p3', 'en', { firstTraitToReveal: 'profession' as TraitType });
      const roomId2 = room.roomId;
      gameLogic.joinRoom(roomId2, 'socket4', 'Player4', 'p4');
      gameLogic.startGame(roomId2);
      
      // Try to reveal biology before profession
      const result = gameLogic.revealCard(roomId2, 'p3', 'biology');
      expect(result).toBe(false);
    });
  });

  describe('endTurn', () => {
    let roomId: string;
    let playerId: string;

    beforeEach(() => {
      const room = gameLogic.createRoom('socket1', 'Player1', 'p1');
      roomId = room.roomId;
      playerId = 'p1';
      gameLogic.joinRoom(roomId, 'socket2', 'Player2', 'p2');
      gameLogic.startGame(roomId);
    });

    it('should end turn for current player', () => {
      gameLogic.revealCard(roomId, playerId, 'profession');
      const result = gameLogic.endTurn(roomId, playerId);
      expect(result).toBe(true);
      
      const room = gameLogic.getRoom(roomId);
      expect(room?.currentTurnIndex).toBe(1);
    });

    it('should return false for non-existent room', () => {
      const result = gameLogic.endTurn('INVALID', playerId);
      expect(result).toBe(false);
    });

    it('should return false if not current player turn', () => {
      const result = gameLogic.endTurn(roomId, 'p2');
      expect(result).toBe(false);
    });

    it('should return false if first trait not revealed when required', () => {
      const room = gameLogic.createRoom('socket3', 'Player3', 'p3', 'en', { firstTraitToReveal: 'profession' as TraitType });
      const roomId2 = room.roomId;
      gameLogic.joinRoom(roomId2, 'socket4', 'Player4', 'p4');
      gameLogic.startGame(roomId2);
      
      const result = gameLogic.endTurn(roomId2, 'p3');
      expect(result).toBe(false);
    });

    it('should return false if not enough cards revealed', () => {
      const result = gameLogic.endTurn(roomId, playerId);
      expect(result).toBe(false);
    });

    it('should start voting phase when all players have taken turn', () => {
      gameLogic.revealCard(roomId, playerId, 'profession');
      gameLogic.endTurn(roomId, playerId);
      
      gameLogic.revealCard(roomId, 'p2', 'profession');
      gameLogic.endTurn(roomId, 'p2');
      
      const room = gameLogic.getRoom(roomId);
      expect(room?.status).toBe('VOTING');
    });
  });

  describe('submitVote', () => {
    let roomId: string;

    beforeEach(() => {
      const room = gameLogic.createRoom('socket1', 'Player1', 'p1');
      roomId = room.roomId;
      gameLogic.joinRoom(roomId, 'socket2', 'Player2', 'p2');
      gameLogic.joinRoom(roomId, 'socket3', 'Player3', 'p3');
      gameLogic.startGame(roomId);
      
      // Advance to voting phase
      gameLogic.revealCard(roomId, 'p1', 'profession');
      gameLogic.endTurn(roomId, 'p1');
      gameLogic.revealCard(roomId, 'p2', 'profession');
      gameLogic.endTurn(roomId, 'p2');
      gameLogic.revealCard(roomId, 'p3', 'profession');
      gameLogic.endTurn(roomId, 'p3');
    });

    it('should accept vote from active player', () => {
      const result = gameLogic.submitVote(roomId, 'p1', 'p2');
      expect(result.success).toBe(true);
    });

    it('should return false for non-existent room', () => {
      const result = gameLogic.submitVote('INVALID', 'p1', 'p2');
      expect(result.success).toBe(false);
    });

    it('should return false if room not in VOTING', () => {
      const room = gameLogic.createRoom('socket4', 'Player4', 'p4');
      const roomId2 = room.roomId;
      const result = gameLogic.submitVote(roomId2, 'p4', 'p4');
      expect(result.success).toBe(false);
    });

    it('should return false if player already voted', () => {
      gameLogic.submitVote(roomId, 'p1', 'p2');
      const result = gameLogic.submitVote(roomId, 'p1', 'p3');
      expect(result.success).toBe(false);
    });

    it('should return false if voter is exiled', () => {
      const room = gameLogic.getRoom(roomId);
      if (room) room.players['p1'].isExiled = true;
      
      const result = gameLogic.submitVote(roomId, 'p1', 'p2');
      expect(result.success).toBe(false);
    });

    it('should return false if target is exiled', () => {
      const room = gameLogic.getRoom(roomId);
      if (room) room.players['p2'].isExiled = true;
      
      const result = gameLogic.submitVote(roomId, 'p1', 'p2');
      expect(result.success).toBe(false);
    });

    it('should process voting when all players have voted', () => {
      gameLogic.submitVote(roomId, 'p1', 'p2');
      gameLogic.submitVote(roomId, 'p2', 'p1');
      const result = gameLogic.submitVote(roomId, 'p3', 'p1');
      
      expect(result.success).toBe(true);
      expect(result.events.length).toBeGreaterThan(0);
    });
  });

  describe('removePlayer', () => {
    let roomId: string;

    beforeEach(() => {
      const room = gameLogic.createRoom('socket1', 'HostPlayer', 'host1');
      roomId = room.roomId;
      gameLogic.joinRoom(roomId, 'socket2', 'Player2', 'player2');
    });

    it('should remove player from room', () => {
      const result = gameLogic.removePlayer(roomId, 'player2');
      expect(result).toBe(true);
      
      const room = gameLogic.getRoom(roomId);
      expect(room?.players['player2']).toBeUndefined();
    });

    it('should return false for non-existent room', () => {
      const result = gameLogic.removePlayer('INVALID', 'player2');
      expect(result).toBe(false);
    });

    it('should transfer host immediately on voluntary leave', () => {
      const result = gameLogic.removePlayer(roomId, 'host1', true);
      expect(result).toBe(true);
      
      const room = gameLogic.getRoom(roomId);
      expect(room?.players['player2'].isHost).toBe(true);
    });

    it('should set TTL for host on disconnect', () => {
      const result = gameLogic.removePlayer(roomId, 'host1', false);
      expect(result).toBe(true);
      
      const room = gameLogic.getRoom(roomId);
      expect(room?.hostOwnershipExpiry).toBeDefined();
    });

    it('should delete room when empty', () => {
      gameLogic.removePlayer(roomId, 'player2');
      gameLogic.removePlayer(roomId, 'host1');
      
      const room = gameLogic.getRoom(roomId);
      expect(room).toBeNull();
    });

    it('should adjust turn order when removing current player', () => {
      gameLogic.startGame(roomId);
      const room = gameLogic.getRoom(roomId);
      const originalTurnIndex = room?.currentTurnIndex;
      
      gameLogic.removePlayer(roomId, 'host1');
      const updatedRoom = gameLogic.getRoom(roomId);
      expect(updatedRoom?.currentTurnIndex).toBe(0);
    });
  });

  describe('checkHostOwnershipTTL', () => {
    let roomId: string;

    beforeEach(() => {
      const room = gameLogic.createRoom('socket1', 'HostPlayer', 'host1');
      roomId = room.roomId;
      gameLogic.joinRoom(roomId, 'socket2', 'Player2', 'player2');
    });

    it('should return false if no TTL set', () => {
      const result = gameLogic.checkHostOwnershipTTL(roomId);
      expect(result).toBe(false);
    });

    it('should return false if TTL not expired', () => {
      gameLogic.removePlayer(roomId, 'host1', false);
      const result = gameLogic.checkHostOwnershipTTL(roomId);
      expect(result).toBe(false);
    });

    it('should transfer host when TTL expired', () => {
      gameLogic.removePlayer(roomId, 'host1', false);
      
      // Manually set expiry to past
      const room = gameLogic.getRoom(roomId);
      if (room) room.hostOwnershipExpiry = Date.now() - 1000;
      
      const result = gameLogic.checkHostOwnershipTTL(roomId);
      expect(result).toBe(true);
      
      const updatedRoom = gameLogic.getRoom(roomId);
      expect(updatedRoom?.players['player2'].isHost).toBe(true);
      expect(updatedRoom?.hostOwnershipExpiry).toBeUndefined();
    });
  });

  describe('getMaskedRoom', () => {
    let roomId: string;
    let playerId: string;

    beforeEach(() => {
      const room = gameLogic.createRoom('socket1', 'Player1', 'p1');
      roomId = room.roomId;
      playerId = 'p1';
      gameLogic.joinRoom(roomId, 'socket2', 'Player2', 'p2');
      gameLogic.startGame(roomId);
    });

    it('should return masked room for player', () => {
      const masked = gameLogic.getMaskedRoom(roomId, playerId);
      expect(masked).toBeTruthy();
      expect(masked?.roomId).toBe(roomId);
    });

    it('should return null for non-existent room', () => {
      const masked = gameLogic.getMaskedRoom('INVALID', playerId);
      expect(masked).toBeNull();
    });

    it('should hide other players unrevealed traits', () => {
      const masked = gameLogic.getMaskedRoom(roomId, 'p2');
      const p1Traits = masked?.players['p1'].traits;
      
      expect(p1Traits?.profession.name).toBe('???');
      expect(p1Traits?.profession.description).toBe('This card has not been revealed yet.');
    });

    it('should show own unrevealed traits', () => {
      const masked = gameLogic.getMaskedRoom(roomId, 'p1');
      const p1Traits = masked?.players['p1'].traits;
      
      expect(p1Traits?.profession.name).not.toBe('???');
    });

    it('should reveal all cards when game finished', () => {
      const room = gameLogic.getRoom(roomId);
      if (room) {
        room.status = 'FINISHED';
        room.bunker!.capacity = 10;
      }
      
      const masked = gameLogic.getMaskedRoom(roomId, 'p2');
      const p1Traits = masked?.players['p1'].traits;
      
      expect(p1Traits?.profession.name).not.toBe('???');
    });
  });

  describe('getRoom', () => {
    it('should return room by ID', () => {
      const room = gameLogic.createRoom('socket1', 'Player1');
      const retrieved = gameLogic.getRoom(room.roomId);
      
      expect(retrieved).toBeTruthy();
      expect(retrieved?.roomId).toBe(room.roomId);
    });

    it('should return null for non-existent room', () => {
      const retrieved = gameLogic.getRoom('INVALID');
      expect(retrieved).toBeNull();
    });
  });

  describe('regenerateRoomId', () => {
    it('should regenerate room ID', () => {
      const room = gameLogic.createRoom('socket1', 'Player1');
      const oldId = room.roomId;
      const newId = gameLogic.regenerateRoomId(oldId);
      
      expect(newId).toBeTruthy();
      expect(newId).not.toBe(oldId);
    });

    it('should return null for non-existent room', () => {
      const newId = gameLogic.regenerateRoomId('INVALID');
      expect(newId).toBeNull();
    });

    it('should update room in map with new ID', () => {
      const room = gameLogic.createRoom('socket1', 'Player1');
      const oldId = room.roomId;
      const newId = gameLogic.regenerateRoomId(oldId);
      
      expect(gameLogic.getRoom(oldId)).toBeNull();
      expect(gameLogic.getRoom(newId!)).toBeTruthy();
    });
  });

  describe('Chat functionality', () => {
    let roomId: string;

    beforeEach(() => {
      const room = gameLogic.createRoom('socket1', 'Player1', 'p1');
      roomId = room.roomId;
    });

    it('should add chat message', () => {
      const message = gameLogic.addChatMessage(roomId, 'p1', 'Player1', 'Hello');
      expect(message).toBeTruthy();
      expect(message?.message).toBe('Hello');
    });

    it('should return null for non-existent room', () => {
      const message = gameLogic.addChatMessage('INVALID', 'p1', 'Player1', 'Hello');
      expect(message).toBeNull();
    });

    it('should limit chat history to 100 messages', () => {
      for (let i = 0; i < 150; i++) {
        gameLogic.addChatMessage(roomId, 'p1', 'Player1', `Message ${i}`);
      }
      
      const history = gameLogic.getChatHistory(roomId);
      expect(history.length).toBe(100);
    });

    it('should add system event', () => {
      const event = gameLogic.addSystemEvent(roomId, 'PLAYER_JOIN', 'Test message');
      expect(event).toBeTruthy();
      expect(event?.type).toBe('EVENT');
      expect(event?.eventType).toBe('PLAYER_JOIN');
    });

    it('should get chat history', () => {
      gameLogic.addChatMessage(roomId, 'p1', 'Player1', 'Message 1');
      gameLogic.addChatMessage(roomId, 'p1', 'Player1', 'Message 2');
      
      const history = gameLogic.getChatHistory(roomId);
      expect(history.length).toBe(2);
    });

    it('should return empty array for non-existent room', () => {
      const history = gameLogic.getChatHistory('INVALID');
      expect(history).toEqual([]);
    });
  });
});
