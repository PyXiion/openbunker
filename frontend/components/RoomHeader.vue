<template>
  <div class="tech-tile mb-4 tech-boot-fade">
    <div class="tech-grid grid-cols-3 gap-4">
      <div>
        <span class="font-bold uppercase">{{ $t('components.roomHeader.room') }}:</span> {{ gameStore.room?.roomId }}
      </div>
      <div class="text-center">
        <span class="font-bold uppercase">{{ $t('components.roomHeader.status') }}:</span> {{ $t(`game.status.${(gameStore.room?.status || 'lobby').toLowerCase()}`) }}
      </div>
      <div class="text-right">
        <span class="font-bold uppercase">{{ $t('components.roomHeader.round') }}:</span> {{ gameStore.room?.round }}
      </div>
    </div>
    <div class="mt-2 flex justify-between items-center">
        <div class="flex gap-2">
          <button 
            @click="copyRoomCode" 
            class="tech-button text-sm"
            :class="{ 'text-green-400': copied, 'cursor-pointer': true }"
          >
            {{ copied ? $t('components.roomHeader.copied') : $t('components.roomHeader.copyCode') }}
          </button>
          <button 
            v-if="gameStore.currentPlayer?.isHost && gameStore.room?.status === 'LOBBY'"
            @click="regenerateCode"
            class="tech-button text-sm"
            :title="$t('components.roomHeader.regenerateCode')"
          >
            {{ $t('components.roomHeader.newCode') }}
          </button>
        </div>
        <button @click="$emit('leave')" class="tech-button text-sm">
          {{ $t('components.roomHeader.leaveRoom') }}
        </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const gameStore = useGameStore();
const { regenerateRoomCode } = useSocket();
const copied = ref(false);

const copyRoomCode = () => {
  if (!gameStore.room?.roomId) return;
  navigator.clipboard.writeText(gameStore.room.roomId);
  copied.value = true;
  setTimeout(() => copied.value = false, 2000);
};

const regenerateCode = () => {
  if (!gameStore.room?.roomId) return;
  regenerateRoomCode(gameStore.room.roomId);
};

defineEmits<{
  leave: [];
}>();
</script>
