<template>
  <div class="min-h-screen bg-base text-contrast p-4">
    <div v-if="!isAuthenticated" class="text-center">
      <p>{{ $t('pages.room.loading') }}</p>
    </div>
    <div v-else-if="!gameStore.room" class="text-center">
      <p>{{ $t('pages.room.loading') }}</p>
    </div>

    <div v-else class="max-w-7xl mx-auto">
      <RoomHeader @leave="confirmLeaveRoom" />

      <GameLobby 
        v-if="gameStore.room.status === 'LOBBY'" 
        @start="startGame"
      />

      <GamePlaying 
        v-else-if="gameStore.room.status === 'PLAYING'"
        @reveal="revealCard"
        @end-turn="endTurn"
      />

      <GameVoting 
        v-else-if="gameStore.room.status === 'VOTING'"
        :active-players="gameStore.activePlayers"
        :current-player-id="gameStore.playerId"
        :has-voted="gameStore.currentPlayer?.hasVoted || false"
        @vote="submitVote"
      />

      <GameFinished 
        v-else-if="gameStore.room.status === 'FINISHED'"
        :players="gameStore.room.players"
      />

      <!-- Chat Box -->
      <LazyChatBox 
        v-if="gameStore.room" 
        :room-id="gameStore.room.roomId" 
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoomService } from '~/services/room.service';

const route = useRoute();
const gameStore = useGameStore();
const socket = useSocket();
const auth = useAuth();
const { leaveRoom: leaveRoomApi } = useRoomService();

// Check if authenticated, redirect to login if not
const isAuthenticated = computed(() => auth.currentUser.value || auth.guestUser.value);

// Connect to room WebSocket on mount
onMounted(async () => {
  // Check if authenticated
  const playerName = auth.currentUser.value?.username || auth.guestUser.value?.username;
  if (!playerName) {
    // Redirect to login with redirect URL as query parameter
    navigateTo('/login?redirect=' + encodeURIComponent(route.path));
    return;
  }

  const currentRoomId = route.params.roomId as string;

  // If we don't have room state, user might have navigated directly to room URL
  // In this case, we need to join via REST API first
  if (!gameStore.room || gameStore.room.roomId !== currentRoomId) {
    try {
      gameStore.setPlayerName(playerName);
      const response = await useRoomService().joinRoom(currentRoomId, playerName);
      // Connect to WebSocket after successful REST call
      await socket.connectToRoom(currentRoomId);
    } catch (error) {
      console.error('Failed to join room:', error);
      gameStore.setError('errors.room_not_found');
      navigateTo('/');
      return;
    }
  } else {
    // We already have room state from previous page, just connect WebSocket
    try {
      await socket.connectToRoom(currentRoomId);
    } catch (error) {
      console.error('Failed to connect to room WebSocket:', error);
      gameStore.setError('errors.connection_failed');
      navigateTo('/');
    }
  }
});

const startGame = () => {
  if (gameStore.room) {
    socket.startGame(gameStore.room.roomId);
  }
};

const revealCard = (traitType: string) => {
  if (!gameStore.isMyTurn || !gameStore.canRevealCard) return;
  if (gameStore.currentPlayer?.traits[traitType as keyof typeof gameStore.currentPlayer.traits]?.isRevealed) return;
  
  // If a specific first trait is configured, it must be revealed first
  const firstTrait = gameStore.room?.settings?.firstTraitToReveal;
  if (firstTrait && traitType !== firstTrait && gameStore.mustRevealFirstTrait) return;
  
  if (gameStore.room) {
    socket.revealCard(gameStore.room.roomId, traitType);
  }
};

const endTurn = () => {
  if (!gameStore.isMyTurn) return;
  
  if (gameStore.room) {
    socket.endTurn(gameStore.room.roomId);
  }
};

const submitVote = (targetId: string) => {
  if (gameStore.currentPlayer?.hasVoted) return;
  
  if (gameStore.room) {
    socket.submitVote(gameStore.room.roomId, targetId);
  }
};

const confirmLeaveRoom = () => {
  // Show confirmation only if game is actively playing or voting
  if (gameStore.room?.status === 'PLAYING' || gameStore.room?.status === 'VOTING') {
    if (confirm($t('pages.room.leaveConfirm'))) {
      leaveRoom();
    }
  } else {
    leaveRoom();
  }
};

const leaveRoom = async () => {
  // Call REST API to leave room
  if (gameStore.room) {
    try {
      await leaveRoomApi(gameStore.room.roomId);
    } catch (error) {
      console.error('Failed to leave room via REST API:', error);
    }
  }

  // Disconnect WebSocket
  socket.disconnectFromRoom();

  // Clear room state
  gameStore.clearRoomState();
  navigateTo('/');
};
</script>
