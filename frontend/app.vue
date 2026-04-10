<template>
  <div class="h-screen bg-base text-contrast flex flex-col tech-scanline tech-crt-flicker overflow-hidden">
    <NuxtPage class="flex-1" />
    <SiteFooter />
    <div v-if="gameStore.room" class="tui-status-bar">
      <span>{{ gameStore.room.roomId }} | {{ $t(`game.status.${(gameStore.room.status || 'lobby').toLowerCase()}`) }} | Round {{ gameStore.room.round }}</span>
      <span class="flex gap-2">
        <span class="tui-fkey-hint">[C] Chat</span>
        <span class="tui-fkey-hint">[H] Help</span>
      </span>
    </div>
    <ToastContainer />
  </div>
</template>

<script setup>
// Main app component
const gameStore = useGameStore();
const socket = useSocket();
const { useHotkeys } = await import('~/composables/useHotkeys');

// Hotkeys
useHotkeys([
  {
    key: 'h',
    handler: () => {
      alert('Help: [C] Toggle Chat | [SPACE] End Turn (your turn) | [ENTER] Start Game (lobby)');
    },
    condition: () => !!gameStore.room,
    preventDefault: true
  }
]);

// Initialize app state
onMounted(async () => {
  // Load persisted state on app startup
  gameStore.loadPersistedState();
  
  // Socket connection is now room-specific and handled in pages
  // No longer maintain global persistent connection
});
</script>
