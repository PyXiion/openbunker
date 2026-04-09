import { computed, ref, watch, onUnmounted } from 'vue';
import { useGameStore } from '~/stores/game';

export function useHostSelectionCountdown() {
  const gameStore = useGameStore();
  
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

  return {
    isChoosingNewHost,
    nextHostName,
    remainingSeconds
  };
}
