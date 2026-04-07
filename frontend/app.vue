<template>
  <div class="min-h-screen bg-base text-contrast flex flex-col">
    <NuxtPage class="flex-1" />
    <SiteFooter />
  </div>
</template>

<script setup>
// Main app component
const gameStore = useGameStore();
const socket = useSocket();

// Initialize app state
onMounted(() => {
  // Load persisted state on app startup
  gameStore.loadPersistedState();
  
  // Initialize socket connection
  socket.connect();
});
</script>
