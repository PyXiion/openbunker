<template>
  <div class="tech-tile tech-boot-fade">
    <div class="tech-tile-header">{{ $t('components.gameLobby.lobby') }}</div>
    
    <div class="gamelobby-layout">
      <!-- Left: Player List -->
      <div class="gamelobby-main">
        <PlayerListEnhanced
          :players="Object.values(gameStore.room?.players || {})"
          :player-count="Object.keys(gameStore.room?.players || {}).length"
          :max-players="gameConfig.max_players"
          :is-current-user-host="!!gameStore.currentPlayer?.isHost"
          @kick="kickPlayer"
          @toggle-ready="handleToggleReady"
        />
      </div>
      
      <!-- Right: Settings Panel -->
      <div class="gamelobby-sidebar">
        <GameSettingsUnified
          :is-host="!!gameStore.currentPlayer?.isHost"
          :is-auto-capacity="isAutoCapacity"
          :custom-capacity="customCapacity"
          :current-capacity="currentCapacity"
          :min-capacity="MIN_CAPACITY"
          :max-capacity="MAX_CAPACITY"
          :initial-first-trait="gameStore.room?.settings?.firstTraitToReveal || undefined"
          :initial-content-filter="gameStore.room?.settings?.enableContentFilter"
          :settings="gameStore.room?.settings"
          @auto-capacity-change="onAutoCapacityChange($event)"
          @update:custom-capacity="customCapacity = $event"
          @capacity-change="updateCapacity"
          @update-first-trait="updateFirstTrait"
          @update-content-filter="updateContentFilter"
        />
      </div>
    </div>
    
    <!-- Footer: Game Start Section -->
    <GameStartSectionEnhanced
      :can-start-game="gameStore.canStartGame"
      :has-player-id="!!gameStore.playerId"
      :is-current-user-host="!!gameStore.currentPlayer?.isHost"
      :min-players="gameConfig.min_players"
      @start="$emit('start')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useGameStore } from '~/stores/game';
import { useHotkeys } from '~/composables/useHotkeys';
import { useSocket } from '~/composables/useSocket';
import PlayerListEnhanced from '../player/PlayerListEnhanced.vue';
import GameSettingsUnified from './GameSettingsUnified.vue';
import GameStartSectionEnhanced from './GameStartSectionEnhanced.vue';

const config = useRuntimeConfig();
const gameConfig = config.public.gameConfig || { min_players: 2, max_players: 12 };

const gameStore = useGameStore();
const { kickPlayer: socketKickPlayer, updateSettings, toggleReady } = useSocket();

const emit = defineEmits<{
  start: [];
  kick: [playerId: string];
}>();

// Hotkeys
useHotkeys([
  {
    key: 'Enter',
    handler: () => emit('start'),
    condition: () => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputFocused = activeTag === 'input' || activeTag === 'textarea';
      return gameStore.canStartGame && !isInputFocused;
    },
    preventDefault: true
  }
]);

const kickPlayer = (playerId: string) => {
  if (!gameStore.room?.roomId) return;
  socketKickPlayer(gameStore.room.roomId, playerId);
};

const handleToggleReady = () => {
  if (!gameStore.room?.roomId) return;
  toggleReady(gameStore.room.roomId);
};

// Capacity settings
const MIN_CAPACITY = 2;
const playerCount = computed(() => Object.keys(gameStore.room?.players || {}).length);
const MAX_CAPACITY = computed(() => Math.max(2, playerCount.value - 1));

const currentCapacity = computed(() => {
  const settings = gameStore.room?.settings;
  return settings?.bunkerCapacity ?? 2;
});

const isAutoCapacity = ref(true);
const customCapacity = ref(2);

watch(() => gameStore.room?.settings?.bunkerCapacity, (newVal) => {
  if (newVal === undefined || newVal === null) {
    isAutoCapacity.value = true;
  } else {
    isAutoCapacity.value = false;
    customCapacity.value = newVal;
  }
}, { immediate: true });

const onAutoCapacityChange = (isEnabled: boolean) => {
  if (isEnabled) {
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
  let value = Math.max(MIN_CAPACITY, Math.min(MAX_CAPACITY.value, customCapacity.value));
  customCapacity.value = value;
  updateSettings(gameStore.room.roomId, { bunkerCapacity: value });
};

// First trait to reveal settings
const selectedFirstTrait = ref<string>('');

// Content filter setting
const enableContentFilter = ref(true);

// Watch for first trait setting changes
watch(() => gameStore.room?.settings?.firstTraitToReveal, (newVal) => {
  selectedFirstTrait.value = newVal || '';
}, { immediate: true });

// Watch for content filter setting changes
watch(() => gameStore.room?.settings?.enableContentFilter, (newVal) => {
  enableContentFilter.value = newVal !== false;
}, { immediate: true });

const updateFirstTrait = (value: string) => {
  if (!gameStore.room?.roomId) return;
  updateSettings(gameStore.room.roomId, { firstTraitToReveal: (value || null) as any });
};

const updateContentFilter = (value: boolean) => {
  if (!gameStore.room?.roomId) return;
  updateSettings(gameStore.room.roomId, { enableContentFilter: value });
};
</script>
