<template>
  <div class="min-h-screen bg-base text-contrast p-8">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="tech-tile mb-8">
        <div class="text-center">
          <h1 class="text-4xl font-bold text-center uppercase">{{ $t('app.title') }}</h1>
          <p class="text-center mt-4">{{ $t('app.subtitle') }}</p>
        </div>
      </div>

      <!-- Game Description -->
      <div class="tech-tile mb-8 border-2 border-contrast">
        <p class="text-center text-lg leading-relaxed">{{ $t('pages.index.gameDescription') }}</p>
      </div>

      <!-- Two column layout -->
      <div class="tech-grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        <!-- Login Form -->
        <div class="tech-tile lg:col-span-2">
          <div class="tech-tile-header">{{ $t('pages.index.joinGame') }}</div>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-bold uppercase mb-2">{{ $t('pages.index.nickname') }}</label>
              <input 
                v-model="playerName" 
                type="text" 
                class="w-full border-2 border-contrast bg-base p-2 font-mono"
                :placeholder="$t('pages.index.nicknamePlaceholder')"
                maxlength="20"
                @keydown.enter="handleEnter"
              />
            </div>

            <div>
              <label class="block text-sm font-bold uppercase mb-2">{{ $t('pages.index.roomCode') }}</label>
              <div class="flex items-center">
                <input 
                  v-model="roomId" 
                  type="text" 
                  class="w-full border-2 border-contrast bg-base p-2 font-mono uppercase"
                  :placeholder="$t('pages.index.roomCodePlaceholder')"
                  maxlength="6"
                  @input="roomId = ($event.target as HTMLInputElement).value.toUpperCase()"
                  @keydown.enter="handleEnter"
                />
                <button 
                  @click="roomId = ''" 
                  class="tech-button ml-2"
                  :disabled="!roomId"
                >
                  {{ $t('pages.index.clear') }}
                </button>
              </div>
            </div>

            <div class="tech-grid grid-cols-2 gap-4">
              <button 
                @click="createRoom" 
                :disabled="!playerName || !!roomId"
                class="tech-button disabled:opacity-50"
              >
                {{ $t('pages.index.createRoom') }}
              </button>
              <button 
                @click="joinRoom" 
                :disabled="!playerName || !roomId"
                class="tech-button disabled:opacity-50"
              >
                {{ $t('pages.index.joinRoom') }}
              </button>
            </div>
          </div>

          <!-- Error Display -->
          <div v-if="gameStore.error" class="mt-4 p-2 border-2 border-accent bg-base">
            <p class="text-accent font-bold uppercase">{{ $t('pages.index.error') }}: {{ $t(gameStore.error) }}</p>
          </div>

          <!-- Kicked Alert -->
          <div v-if="gameStore.kickedMessage" class="mt-4 p-2 border-2 border-accent bg-base flex justify-between items-center">
            <p class="text-accent font-bold uppercase">{{ $t(gameStore.kickedMessage) }}</p>
            <button @click="gameStore.setKickedMessage(null)" class="text-accent hover:text-contrast ml-2">×</button>
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
          <div class="space-y-2 text-sm font-mono">
            <p v-for="(step, index) in $tm('pages.index.instructionSteps')" :key="index">
              {{ (index as number) + 1 }}. {{ $rt(step) }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const gameStore = useGameStore();
const socket = useSocket();

const playerName = ref(gameStore.playerName || '');
const roomId = ref('');

// Auto-connect on mount
onMounted(() => {
  socket.connect();
});

const createRoom = () => {
  if (!playerName.value.trim()) return;
  
  gameStore.setPlayerName(playerName.value);
  socket.createRoom(playerName.value);
};

const joinRoom = () => {
  if (!playerName.value.trim() || !roomId.value.trim()) return;
  
  gameStore.setPlayerName(playerName.value);
  socket.joinRoom(roomId.value.toUpperCase(), playerName.value);
};

const handleEnter = () => {
  if (roomId.value.trim()) {
    joinRoom();
  } else {
    createRoom();
  }
};

// Redirect to game room when joined
watch(() => gameStore.room, (room) => {
  if (room) {
    navigateTo(`/room/${room.roomId}`);
  }
});
</script>
