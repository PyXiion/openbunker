<template>
  <div class="tech-tile tech-boot-fade">
    <div class="tech-tile-header">{{ $t('components.gameLobby.lobby') }}</div>
    
    <div class="mb-5">
      <h3 class="font-bold uppercase mb-3 text-contrast/90">
        {{ $t('components.gameLobby.players') }} ({{ Object.keys(gameStore.room?.players || {}).length }}/{{ GAME_CONSTANTS.MAX_PLAYERS }})
      </h3>
      <div class="tech-grid-tight grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <div 
          v-for="player in Object.values(gameStore.room?.players || {})" 
          :key="player.id"
          class="tech-card flex justify-between items-center"
        >
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 border-2 border-contrast flex items-center justify-center overflow-hidden bg-base">
              <img 
                v-if="player.avatarUrl" 
                :src="player.avatarUrl" 
                :alt="player.name"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full bg-contrast/10 flex items-center justify-center">
                <span class="text-contrast font-bold text-xs">
                  {{ player.name.charAt(0).toUpperCase() }}
                </span>
              </div>
            </div>
            <span class="truncate">
              {{ player.name }} {{ player.isHost ? `(${$t('components.gameLobby.host')})` : '' }}
            </span>
          </div>
          <button 
            v-if="gameStore.currentPlayer?.isHost && !player.isHost"
            @click="kickPlayer(player.id)"
            class="tech-button text-sm px-2 py-1 ml-2"
            :title="$t('components.gameLobby.kickPlayer')"
          >
            ×
          </button>
        </div>
      </div>
    </div>

    <!-- Bunker Capacity Settings - Host Only -->
    <div v-if="gameStore.currentPlayer?.isHost" class="mb-6 tech-tile">
      <h3 class="font-bold uppercase mb-4 text-contrast/90">
        {{ $t('components.gameLobby.bunkerSettings') }}
      </h3>
      
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <input 
            type="checkbox" 
            id="autoCapacity"
            v-model="isAutoCapacity"
            class="w-4 h-4 accent-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
            @change="onAutoCapacityChange"
          />
          <label for="autoCapacity" class="font-mono text-sm">
            {{ $t('components.gameLobby.autoCapacity', { count: autoCalculatedCapacity }) }}
          </label>
          <Tooltip 
            :content="$t('components.gameLobby.autoCapacityHelp')"
            position="right"
          />
        </div>
        
        <div v-if="!isAutoCapacity" class="flex items-center gap-3">
          <label for="customCapacity" class="font-mono text-sm whitespace-nowrap">
            {{ $t('components.gameLobby.customCapacity') }}:
          </label>
          <input 
            type="number" 
            id="customCapacity"
            v-model.number="customCapacity"
            :min="minCapacity"
            :max="maxCapacity"
            class="w-20 bg-contrast/10 border-2 border-contrast px-2 py-1 font-mono text-sm focus:outline-none focus:border-accent transition-colors"
            @change="updateCapacity"
          />
          <span class="font-mono text-sm text-accent">
            {{ $t('components.gameLobby.capacityRange', { min: minCapacity, max: maxCapacity }) }}
          </span>
          <Tooltip 
            :content="$t('components.gameLobby.customCapacityHelp')"
            position="right"
          />
        </div>
        
        <!-- First Trait to Reveal Setting -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <label for="firstTrait" class="font-mono text-sm">
              {{ $t('components.gameLobby.firstTraitToReveal') }}:
            </label>
            <Tooltip 
              :content="$t('components.gameLobby.firstTraitHelp')"
              position="right"
            />
          </div>
          <select 
            id="firstTrait"
            v-model="selectedFirstTrait"
            class="w-full bg-contrast/10 border-2 border-contrast px-2 py-1 font-mono text-sm focus:outline-none focus:border-accent transition-colors"
            @change="updateFirstTrait"
          >
            <option value="">{{ $t('components.gameLobby.anyTrait') }}</option>
            <option v-for="trait in availableTraits" :key="trait" :value="trait">
              {{ $t(`traits.types.${trait}`) }}
            </option>
          </select>
        </div>
        
        <!-- Content Filter Setting -->
        <div class="flex items-center gap-3">
          <input 
            type="checkbox" 
            id="contentFilter"
            v-model="enableContentFilter"
            class="w-4 h-4 accent-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
            @change="updateContentFilter"
          />
          <label for="contentFilter" class="font-mono text-sm">
            {{ $t('components.gameLobby.enableContentFilter') }}
          </label>
          <Tooltip 
            :content="$t('components.gameLobby.contentFilterHelp')"
            position="right"
          />
        </div>
      </div>
    </div>
    
    <!-- Display settings for non-hosts -->
    <div v-else class="mb-6 tech-tile space-y-3">
      <h3 class="font-bold uppercase mb-3 text-contrast/90">
        {{ $t('components.gameLobby.bunkerSettings') }}
      </h3>
      <p class="font-mono text-sm">
        {{ $t('components.gameLobby.bunkerCapacity', { count: currentCapacity }) }}
        <span v-if="!gameStore.room?.settings?.bunkerCapacity" class="text-accent">
          ({{ $t('components.gameLobby.auto') }})
        </span>
      </p>
      <p class="font-mono text-sm">
        {{ $t('components.gameLobby.firstTraitToReveal') }}: 
        <span class="text-accent">
          {{ gameStore.room?.settings?.firstTraitToReveal 
            ? $t(`traits.types.${gameStore.room.settings.firstTraitToReveal}`) 
            : $t('components.gameLobby.anyTrait') }}
        </span>
      </p>
      <p class="font-mono text-sm">
        {{ $t('components.gameLobby.enableContentFilter') }}: 
        <span class="text-accent">
          {{ gameStore.room?.settings?.enableContentFilter !== false ? $t('common.enabled') : $t('common.disabled') }}
        </span>
      </p>
    </div>

    <TechButton 
      v-if="gameStore.canStartGame"
      @click="$emit('start')"
    >
      {{ $t('components.gameLobby.startGame') }} <span class="tui-fkey-hint">[ENTER]</span>
    </TechButton>
    
    <div v-else-if="!gameStore.playerId" class="text-sm font-mono text-accent p-2 border border-accent/30 bg-accent/5 tech-pulse tech-signal-noise">
      {{ $t('components.gameLobby.reconnecting') }}
    </div>
    
    <div v-else-if="isChoosingNewHost" class="text-sm font-mono text-accent p-2 border border-accent/30 bg-accent/5 tech-pulse tech-signal-noise">
      {{ $t('components.gameLobby.choosingNewHost', { playerName: nextHostName, seconds: remainingSeconds }) }}
    </div>
    
    <div v-else class="text-sm font-mono text-contrast/70">
      {{ gameStore.currentPlayer?.isHost 
        ? $t('components.gameLobby.waitingForPlayers', { min: GAME_CONSTANTS.MIN_PLAYERS_TO_START })
        : $t('components.gameLobby.waitingForHost') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue';
import { GAME_CONSTANTS } from '~/constants/game';
import { useGameStore } from '~/stores/game';
import { useHotkeys } from '~/composables/useHotkeys';
import { useSocket } from '~/composables/useSocket';
import Tooltip from './Tooltip.vue';
import TechButton from './TechButton.vue';

const gameStore = useGameStore();
const { kickPlayer: socketKickPlayer, updateSettings } = useSocket();

const emit = defineEmits<{
  start: [];
  kick: [playerId: string];
}>();

// Hotkeys
useHotkeys([
  {
    key: 'Enter',
    handler: () => emit('start'),
    condition: () => gameStore.canStartGame,
    preventDefault: true
  }
]);

const kickPlayer = (playerId: string) => {
  if (!gameStore.room?.roomId) return;
  socketKickPlayer(gameStore.room.roomId, playerId);
};

// Bunker capacity settings
const DEFAULT_CAPACITY_RATIO = 0.6;
const minCapacity = 1;
const maxCapacity = 10;

const playerCount = computed(() => Object.keys(gameStore.room?.players || {}).length);

const autoCalculatedCapacity = computed(() => 
  Math.max(2, Math.floor(playerCount.value * DEFAULT_CAPACITY_RATIO))
);

const currentCapacity = computed(() => {
  const settings = gameStore.room?.settings;
  if (settings?.bunkerCapacity !== undefined && settings.bunkerCapacity !== null) {
    return settings.bunkerCapacity;
  }
  return autoCalculatedCapacity.value;
});

const isAutoCapacity = ref(true);
const customCapacity = ref(2);

// First trait to reveal settings
const availableTraits = ['profession', 'biology', 'hobby', 'phobia', 'baggage', 'fact'] as const;
const selectedFirstTrait = ref<string>('');

// Content filter setting
const enableContentFilter = ref(true);

// Watch for room changes to sync local state with server state
watch(() => gameStore.room?.settings?.bunkerCapacity, (newVal) => {
  if (newVal === undefined || newVal === null) {
    isAutoCapacity.value = true;
  } else {
    isAutoCapacity.value = false;
    customCapacity.value = newVal;
  }
}, { immediate: true });

// Watch for first trait setting changes
watch(() => gameStore.room?.settings?.firstTraitToReveal, (newVal) => {
  selectedFirstTrait.value = newVal || '';
}, { immediate: true });

// Watch for content filter setting changes
watch(() => gameStore.room?.settings?.enableContentFilter, (newVal) => {
  enableContentFilter.value = newVal !== false; // Default to true
}, { immediate: true });

const updateFirstTrait = () => {
  if (!gameStore.room?.roomId) return;
  const value = selectedFirstTrait.value || null;
  updateSettings(gameStore.room.roomId, { firstTraitToReveal: value as any });
};

const updateContentFilter = () => {
  if (!gameStore.room?.roomId) return;
  updateSettings(gameStore.room.roomId, { enableContentFilter: enableContentFilter.value });
};

const onAutoCapacityChange = () => {
  if (isAutoCapacity.value) {
    // Switch to auto - send null to server
    if (gameStore.room?.roomId) {
      updateSettings(gameStore.room.roomId, { bunkerCapacity: null });
    }
  } else {
    // Switch to custom - use current custom value
    updateCapacity();
  }
};

const updateCapacity = () => {
  if (!gameStore.room?.roomId) return;
  
  // Clamp value to valid range
  let value = Math.max(minCapacity, Math.min(maxCapacity, customCapacity.value));
  customCapacity.value = value;
  
  updateSettings(gameStore.room.roomId, { bunkerCapacity: value });
};

// Check if there's no host but a host ownership expiry is set (host left, choosing new host)
const isChoosingNewHost = computed(() => {
  if (!gameStore.room) return false;
  const hasHost = Object.values(gameStore.room.players).some(p => p.isHost);
  return !hasHost && gameStore.room.hostOwnershipExpiry !== undefined;
});

// Get the next host name (first player in turn order)
const nextHostName = computed(() => {
  if (!gameStore.room || gameStore.room.turnOrder.length === 0) return '';
  const nextHostId = gameStore.room.turnOrder[0];
  const nextHost = gameStore.room.players[nextHostId];
  return nextHost?.name || '';
});

// Countdown timer
const remainingSeconds = ref(0);
let countdownInterval: ReturnType<typeof setInterval> | null = null;

const updateCountdown = () => {
  if (!gameStore.room?.hostOwnershipExpiry) {
    remainingSeconds.value = 0;
    return;
  }
  const remaining = Math.ceil((gameStore.room.hostOwnershipExpiry - Date.now()) / 1000);
  remainingSeconds.value = Math.max(0, remaining);
};

// Start/stop countdown based on state
watch(isChoosingNewHost, (choosing) => {
  if (choosing) {
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
  } else {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }
}, { immediate: true });

onUnmounted(() => {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
});
</script>
