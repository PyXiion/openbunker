<template>
  <div class="h-full bg-base text-contrast p-8 overflow-y-auto">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="tech-tile mb-6">
        <div class="text-center">
          <h1 class="text-5xl font-bold text-center uppercase mb-2">{{ $t('app.title') }}</h1>
          <p class="text-center text-contrast/70">{{ $t('app.subtitle') }}</p>
        </div>
      </div>

      <!-- Mini Profile -->
      <div v-if="auth.isAuthenticated.value || auth.isGuest.value" class="tech-tile mb-8 border-2 border-contrast">
        <!-- Guest Notice -->
        <div v-if="auth.isGuest.value" class="p-3 border-b border-contrast/30 mb-4">
          <p class="text-xs text-contrast/70 font-mono">
            {{ $t('pages.index.guestNotice') }} • {{ $t('pages.index.guestUpgradePrompt') }}
          </p>
        </div>

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 border-2 border-contrast flex items-center justify-center bg-base overflow-hidden">
              <img
                v-if="auth.currentUser.value?.avatarUrl"
                :src="auth.currentUser.value.avatarUrl"
                :alt="auth.currentUser.value.username"
                class="w-full h-full object-cover"
              />
              <span v-else class="text-xl font-bold uppercase">{{ (auth.currentUser.value?.username || auth.guestUser.value?.username || '?')[0] }}</span>
            </div>
            <div>
              <p class="font-bold uppercase">{{ auth.currentUser.value?.username || auth.guestUser.value?.username }}</p>
              <p class="text-xs text-contrast/60 font-mono">
                {{ auth.isAuthenticated.value ? $t('pages.index.authenticated') : $t('pages.index.guest') }}
                <span class="ml-2">ID: {{ (auth.currentUser.value?.userId || auth.guestUser.value?.userId || '').slice(0, 8) }}...</span>
              </p>
            </div>
          </div>
          <div class="flex gap-2">
            <TechButton
              @click="navigateTo('/profile')"
              variant="contrast"
              size="sm"
            >
              {{ $t('profile.profile') }}
            </TechButton>
            <TechButton
              @click="auth.logout"
              variant="accent"
              size="sm"
            >
              {{ $t('pages.index.logout') }}
            </TechButton>
          </div>
        </div>
      </div>

      <!-- Two column layout -->
      <div class="tech-grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Login Form -->
        <div class="tech-tile">
          <div class="tech-tile-header">{{ $t('pages.index.joinGame') }}</div>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-bold uppercase mb-2 text-contrast/90">{{ $t('pages.index.roomCode') }}</label>
              <div class="flex items-center">
                <input 
                  v-model="roomId" 
                  type="text" 
                  class="w-full border-2 border-contrast bg-base p-3 font-mono text-lg uppercase focus:outline-none focus:border-accent transition-colors"
                  :placeholder="$t('pages.index.roomCodePlaceholder')"
                  maxlength="6"
                  @input="roomId = ($event.target as HTMLInputElement).value.toUpperCase()"
                  @keydown.enter="handleEnter"
                />
                <TechButton 
                  @click="roomId = ''" 
                  class="ml-2"
                  :disabled="!roomId"
                >
                  {{ $t('pages.index.clear') }}
                </TechButton>
              </div>
            </div>

            <div class="tech-grid grid-cols-2 gap-4">
              <TechButton 
                @click="createRoom" 
                :disabled="!!roomId"
                :is-loading="isCreatingRoom"
              >
                {{ $t('pages.index.createRoom') }}
              </TechButton>
              <TechButton 
                @click="joinRoom" 
                :disabled="!roomId"
                :is-loading="isJoiningRoom"
              >
                {{ $t('pages.index.joinRoom') }}
              </TechButton>
            </div>
          </div>

          <!-- Error Display -->
          <div v-if="gameStore.error" class="mt-4 p-3 border-2 border-accent bg-base flex justify-between items-center">
            <p class="text-accent font-bold uppercase text-sm">{{ $t('pages.index.error') }}: {{ $t(gameStore.error) }}</p>
            <button @click="gameStore.setError(null)" class="text-accent hover:text-contrast ml-2 text-xl">×</button>
          </div>

          <!-- Kicked Alert -->
          <div v-if="gameStore.kickedMessage" class="mt-4 p-3 border-2 border-accent bg-base flex justify-between items-center">
            <p class="text-accent font-bold uppercase text-sm">{{ $t(gameStore.kickedMessage) }}</p>
            <button @click="gameStore.setKickedMessage(null)" class="text-accent hover:text-contrast ml-2 text-xl">×</button>
          </div>

          <!-- Connection Status -->
          <div class="mt-4 flex items-center justify-center gap-2 font-mono text-sm">
            <div 
              class="border-2 border-contrast w-4 h-4 flex items-center justify-center"
              :class="gameStore.connected ? 'bg-base' : 'bg-contrast'"
            >
              <span 
                class="block w-2 h-2"
                :class="gameStore.connected ? 'bg-accent' : 'bg-base'"
              ></span>
            </div>
            <div class="border-2 border-contrast px-2 py-1 bg-base flex items-center gap-2">
              <span class="text-contrast/60 uppercase text-xs">{{ $t('pages.index.status') }}</span>
              <span 
                class="font-bold uppercase"
                :class="gameStore.connected ? 'text-contrast' : 'text-accent'"
              >
                {{ gameStore.connected ? $t('pages.index.connected') : $t('pages.index.disconnected') }}
              </span>
            </div>
            <div class="flex gap-px border-2 border-contrast p-px">
              <span 
                v-for="i in 3" 
                :key="i"
                class="w-1 h-3"
                :class="gameStore.connected ? 'bg-contrast' : 'bg-gray-300'"
              ></span>
            </div>
          </div>
        </div>

        <!-- Instructions -->
        <div class="tech-tile">
          <div class="tech-tile-header">{{ $t('pages.index.instructions') }}</div>
          <div class="text-sm prose" v-html="renderedInstructions"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MarkdownIt from 'markdown-it';

const gameStore = useGameStore();
const socket = useSocket();
const auth = useAuth();

const roomId = ref('');
const isCreatingRoom = ref(false);
const isJoiningRoom = ref(false);

const md = new MarkdownIt();

const renderedInstructions = computed(() => {
  const steps = $t('pages.index.instructionSteps');
  return md.render(steps);
});

const getPlayerName = () => {
  return auth.currentUser.value?.username || auth.guestUser.value?.username || '';
};

const createRoom = () => {
  const playerName = getPlayerName();
  if (!playerName) return;
  
  isCreatingRoom.value = true;
  gameStore.setPlayerName(playerName);
  socket.createRoom(playerName);
};

const joinRoom = () => {
  const playerName = getPlayerName();
  if (!playerName || !roomId.value.trim()) return;
  
  isJoiningRoom.value = true;
  gameStore.setPlayerName(playerName);
  socket.joinRoom(roomId.value.toUpperCase(), playerName);
};

const handleEnter = () => {
  if (roomId.value.trim()) {
    joinRoom();
  } else {
    createRoom();
  }
};

// Redirect to login if not authenticated
onMounted(() => {
  if (!auth.currentUser.value && !auth.guestUser.value) {
    navigateTo('/login');
  }
  // Reset loading states on mount
  isCreatingRoom.value = false;
  isJoiningRoom.value = false;
  // Clear room state to ensure buttons are enabled
  gameStore.clearRoomState();
});

// Redirect to game room when joined
watch(() => gameStore.room, (room) => {
  if (room) {
    isCreatingRoom.value = false;
    isJoiningRoom.value = false;
    navigateTo(`/room/${room.roomId}`);
  }
});

// Reset loading state on error
watch(() => gameStore.error, (error) => {
  if (error) {
    isCreatingRoom.value = false;
    isJoiningRoom.value = false;
  }
});

// Reset loading states on reconnection
watch(() => gameStore.connected, (connected) => {
  if (connected) {
    isCreatingRoom.value = false;
    isJoiningRoom.value = false;
  }
});

// Ensure roomId is cleared when navigating to index page
watch(() => gameStore.room, (room) => {
  if (!room && roomId.value) {
    roomId.value = '';
  }
});
</script>
