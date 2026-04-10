import { computed, ref, watch, onUnmounted } from 'vue';
import { useGameStore } from '~/stores/game';

export function useHostDisconnectCountdown() {
  const gameStore = useGameStore();
  
  // Check if host is disconnected
  const isHostDisconnected = computed(() => {
    return !!gameStore.room?.hostDisconnectedAt;
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
    if (!gameStore.room?.hostDisconnectedAt) {
      remainingSeconds.value = 0;
      return;
    }
    const elapsed = Date.now() - gameStore.room.hostDisconnectedAt;
    const remaining = 30 - Math.ceil(elapsed / 1000);
    remainingSeconds.value = Math.max(0, remaining);
  };

  // Start/stop countdown based on state
  watch(isHostDisconnected, (disconnected) => {
    if (disconnected) {
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

  return {
    isHostDisconnected,
    nextHostName,
    remainingSeconds
  };
}
