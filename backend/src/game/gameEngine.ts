import { GameRoom, Trait, TraitType, BunkerStats, CatastropheCard, ChatMessage } from './types';
import { GAME_CONSTANTS, BUNKER_RESOURCES } from './constants';
import { dataLoader } from '../services/dataLoader';
import { ChatManager } from './chatManager';

/**
 * Manages game flow and logic.
 * Handles game start, turns, voting, card reveals, and win conditions.
 */
export class GameEngine {
  private chatManager: ChatManager;

  constructor(chatManager: ChatManager) {
    this.chatManager = chatManager;
  }

  /**
   * Starts the game from LOBBY phase.
   * Initializes catastrophe, bunker stats, and deals trait cards.
   * Requires minimum 2 players.
   */
  startGame(room: GameRoom): boolean {
    if (room.status !== 'LOBBY') {
      return false;
    }

    const playerCount = Object.keys(room.players).length;
    if (playerCount < GAME_CONSTANTS.MIN_PLAYERS_TO_START) {
      return false;
    }

    // Initialize game
    room.status = 'PLAYING';
    room.gameStartedAt = Date.now();
    room.catastrophe = this.getRandomCatastrophe(room.language || 'en');
    room.bunker = this.generateBunkerStats(playerCount, room.language || 'en', room.settings?.bunkerCapacity);
    room.currentTurnIndex = 0;

    // Deal traits to players
    this.dealTraits(room);

    return true;
  }

  private getRandomCatastrophe(language: string = 'en'): CatastropheCard {
    const catastrophes = dataLoader.getCatastrophes(language);
    return catastrophes[Math.floor(Math.random() * catastrophes.length)];
  }

  /**
   * Generates bunker capacity based on player count (60% of players, min 2).
   * Calculates resources needed and selects random rooms for each round.
   * First room is immediately revealed, others hidden until their round.
   */
  private generateBunkerStats(playerCount: number, language: string = 'en', customCapacity?: number | null): BunkerStats {
    const capacity = customCapacity !== undefined && customCapacity !== null 
      ? customCapacity 
      : Math.max(2, Math.floor(playerCount * GAME_CONSTANTS.DEFAULT_BUNKER_CAPACITY_RATIO));
    const rounds = Math.max(1, playerCount - capacity);
    const allRooms = dataLoader.getBunkerRooms(language);
    
    // Randomly select rooms equal to number of rounds
    const shuffled = [...allRooms].sort(() => Math.random() - 0.5);
    const selectedRooms = shuffled.slice(0, Math.min(rounds, allRooms.length));
    
    // Initialize all rooms as hidden, first one will be revealed on round 1
    const roomsWithRevealState = selectedRooms.map((room, index) => ({
      ...room,
      isRevealed: index === 0 // First room revealed on round 1
    }));
    
    return {
      capacity,
      food: capacity * BUNKER_RESOURCES.FOOD_PER_PERSON,
      water: capacity * BUNKER_RESOURCES.WATER_PER_PERSON,
      medicine: capacity * BUNKER_RESOURCES.MEDICINE_PER_PERSON,
      power: BUNKER_RESOURCES.DEFAULT_POWER,
      rooms: roomsWithRevealState
    };
  }

  private dealTraits(room: GameRoom): void {
    const traitTypes: TraitType[] = ['profession', 'biology', 'hobby', 'phobia', 'baggage', 'fact'];
    const traitsData = dataLoader.getTraits(room.language || 'en');
    
    for (const playerId of Object.keys(room.players)) {
      const player = room.players[playerId];
      
      for (const traitType of traitTypes) {
        const traitPool = traitsData[traitType];
        const randomTrait = traitPool[Math.floor(Math.random() * traitPool.length)];
        
        player.traits[traitType] = {
          id: randomTrait.id,
          name: randomTrait.name,
          description: randomTrait.description,
          isRevealed: false
        };
      }
    }
  }

  private getFirstTraitToReveal(room: GameRoom): TraitType | null {
    return room.settings?.firstTraitToReveal || null;
  }

  /**
   * Reveals a trait card for the current player during their turn.
   * Enforces game rules: must be current turn, card not already revealed,
   * and profession must be revealed before other traits.
   */
  revealCard(room: GameRoom, playerId: string, traitType: TraitType): boolean {
    if (room.status !== 'PLAYING') {
      return false;
    }

    const currentPlayer = room.turnOrder[room.currentTurnIndex];
    if (currentPlayer !== playerId) {
      return false;
    }

    // Check if player has already revealed max allowed cards this turn
    if (room.cardsRevealedThisTurn >= room.cardsToRevealPerTurn) {
      return false;
    }

    const player = room.players[playerId];
    if (!player || player.traits[traitType].isRevealed) {
      return false;
    }

    // First trait must be revealed before any other cards
    const firstTrait = this.getFirstTraitToReveal(room);
    if (firstTrait && traitType !== firstTrait && !player.traits[firstTrait].isRevealed) {
      return false;
    }

    player.traits[traitType].isRevealed = true;
    room.cardsRevealedThisTurn++;
    return true;
  }

  /**
   * Ends the current player's turn and advances to next non-exiled player.
   * Validates that profession was revealed and minimum cards were shown.
   * Triggers voting phase when all players have taken their turn.
   */
  endTurn(room: GameRoom, playerId: string): boolean {
    if (room.status !== 'PLAYING') return false;

    // Check if it's this player's turn
    const currentPlayer = room.turnOrder[room.currentTurnIndex];
    if (currentPlayer !== playerId) return false;

    const player = room.players[playerId];
    const firstTrait = this.getFirstTraitToReveal(room);
    
    // If a specific first trait is configured, it must be revealed first
    if (firstTrait && !player.traits[firstTrait].isRevealed) {
      return false; // Must reveal first trait before ending turn
    }
    
    // Check if player revealed enough cards this turn
    if (room.cardsRevealedThisTurn < room.cardsToRevealPerTurn) {
      return false; // Not enough cards revealed this turn
    }

    // Reset cards revealed counter for next turn
    room.cardsRevealedThisTurn = 0;

    // Find next non-exiled player
    let nextIndex = room.currentTurnIndex;
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

    if (room.currentTurnIndex === 0) {
      this.startVotingPhase(room);
    }
    return true;
  }

  private startVotingPhase(room: GameRoom): void {
    room.status = 'VOTING';
    
    // Reset voting state
    for (const player of Object.values(room.players)) {
      if (!player.isExiled) {
        player.hasVoted = false;
        player.votesReceived = 0;
      }
    }
  }

  /**
   * Processes a vote submission during VOTING phase.
   * Automatically triggers vote resolution when all active players have voted.
   * Each player can only vote once per voting phase.
   */
  submitVote(room: GameRoom, voterId: string, targetId: string): { success: boolean; events: ChatMessage[] } {
    if (room.status !== 'VOTING') {
      return { success: false, events: [] };
    }

    const voter = room.players[voterId];
    const target = room.players[targetId];

    if (!voter || !target || voter.hasVoted || voter.isExiled || target.isExiled) {
      return { success: false, events: [] };
    }

    voter.hasVoted = true;
    target.votesReceived++;

    // Check if all active players have voted
    const activePlayers = Object.values(room.players).filter(p => !p.isExiled);
    const allVoted = activePlayers.every(p => p.hasVoted);

    let events: ChatMessage[] = [];
    if (allVoted) {
      events = this.processVotingResults(room);
    }

    return { success: true, events };
  }

  /**
   * Resolves voting by exiling the player with most votes.
   * If tied, first player with max votes is exiled (deterministic).
   * Checks win condition: if survivors <= capacity, game ends and all cards revealed.
   * Otherwise, starts new round and reveals next bunker room.
   */
  private processVotingResults(room: GameRoom): ChatMessage[] {
    const events: ChatMessage[] = [];
    const activePlayers = Object.values(room.players).filter(p => !p.isExiled);
    
    if (activePlayers.length === 0) return events;

    // Find player with most votes
    let maxVotes = 0;
    let exiledPlayer: any = null;

    for (const player of activePlayers) {
      if (player.votesReceived > maxVotes) {
        maxVotes = player.votesReceived;
        exiledPlayer = player;
      }
    }

    // Exile the player with most votes
    if (exiledPlayer && maxVotes > 0) {
      exiledPlayer.isExiled = true;
    }

    // Check win condition
    const remainingPlayers = Object.values(room.players).filter(p => !p.isExiled);
    
    if (remainingPlayers.length <= room.bunker!.capacity) {
      room.status = 'FINISHED';
      // Reveal all cards
      this.revealAllCards(room);
      
      // Log game finished event
      const event = this.chatManager.addSystemEvent(
        room,
        'GAME_FINISHED',
        `Game over! ${remainingPlayers.length} survivors remain in the bunker.`,
        { 
          survivors: remainingPlayers.map(p => ({ id: p.id, name: p.name })),
          bunkerCapacity: room.bunker!.capacity 
        }
      );
      if (event) events.push(event);
    } else {
      // Start new round - reveal next room
      room.round++;
      room.status = 'PLAYING';
      
      // Find first non-exiled player for the new round
      let startIndex = 0;
      while (startIndex < room.turnOrder.length && room.players[room.turnOrder[startIndex]].isExiled) {
        startIndex++;
      }
      room.currentTurnIndex = startIndex >= room.turnOrder.length ? 0 : startIndex;
      
      // Log round started event
      const roundEvent = this.chatManager.addSystemEvent(
        room,
        'ROUND_STARTED',
        `Round ${room.round} has started`,
        { round: room.round, remainingPlayers: remainingPlayers.length }
      );
      if (roundEvent) events.push(roundEvent);
      
      // Reveal the next bunker room (index = round - 1 since round starts at 1)
      if (room.bunker && room.bunker.rooms[room.round - 1]) {
        room.bunker.rooms[room.round - 1].isRevealed = true;
        
        // Log bunker room revealed event
        const revealedRoom = room.bunker.rooms[room.round - 1];
        const roomEvent = this.chatManager.addSystemEvent(
          room,
          'BUNKER_ROOM_REVEALED',
          `New bunker room revealed: ${revealedRoom.name}`,
          { roomName: revealedRoom.name, round: room.round }
        );
        if (roomEvent) events.push(roomEvent);
      }
    }
    
    return events;
  }

  private revealAllCards(room: GameRoom): void {
    for (const player of Object.values(room.players)) {
      for (const traitType of Object.keys(player.traits) as TraitType[]) {
        player.traits[traitType].isRevealed = true;
      }
    }
  }

  /**
   * Returns a masked view of the room for a specific player.
   * Hides unrevealed trait cards (showing '???') and unrevealed bunker rooms.
   * During FINISHED state, all cards are visible to everyone.
   * Uses deep cloning to prevent accidental mutation of master state.
   */
  getMaskedRoom(room: GameRoom, playerId: string): any {
    // 1. Deep clone the room structure so we don't mutate the master state
    let maskedRoom: any;
    try {
      maskedRoom = structuredClone(room);
    } catch (error) {
      console.error('Failed to clone room data:', error);
      return null;
    }
    
    // 2. Clear the players list so we can rebuild it with masked data
    maskedRoom.players = {};

    for (const [id, player] of Object.entries(room.players)) {
      // If game is over, or it's the player's own profile, don't mask
      if (room.status === 'FINISHED' || id === playerId) {
        try {
          maskedRoom.players[id] = structuredClone(player);
        } catch (error) {
          console.error('Failed to clone player data:', error);
          maskedRoom.players[id] = player;
        }
        continue;
      }

      // 3. Mask other players' traits
      let maskedPlayer: any;
      try {
        maskedPlayer = structuredClone(player);
      } catch (error) {
        console.error('Failed to clone player data for masking:', error);
        maskedPlayer = player;
      }
      const traitTypes: any[] = ['profession', 'biology', 'hobby', 'phobia', 'baggage', 'fact'];

      for (const traitType of traitTypes) {
        const trait = maskedPlayer.traits[traitType];
        
        // If the card hasn't been revealed to the group yet, hide the details
        if (!trait.isRevealed) {
          maskedPlayer.traits[traitType] = {
            ...trait,
            name: '???',
            description: 'This card has not been revealed yet.'
          };
        }
      }

      maskedRoom.players[id] = maskedPlayer;
    }

    // 4. Mask hidden bunker rooms
    if (maskedRoom.bunker?.rooms) {
      maskedRoom.bunker.rooms = maskedRoom.bunker.rooms.map((r: any) => {
        if (!r.isRevealed) {
          return {
            ...r,
            name: '???',
            description: 'This room has not been revealed yet.'
          };
        }
        return r;
      });
    }

    // Include host disconnected timestamp in masked data
    maskedRoom.hostDisconnectedAt = room.hostDisconnectedAt;

    return maskedRoom;
  }
}
