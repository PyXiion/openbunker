<template>
  <div class="flex flex-col gap-4">
    <div v-if="isHost" class="flex items-center gap-3">
      <input 
        type="checkbox" 
        id="autoCapacity"
        :checked="isAutoCapacity"
        class="w-4 h-4 accent-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
        @change="$emit('autoCapacityChange', ($event.target as HTMLInputElement).checked)"
      />
      <label for="autoCapacity" class="font-mono text-sm">
        {{ $t('components.gameLobby.autoCapacity', { count: currentCapacity }) }}
      </label>
      <Tooltip 
        :content="$t('components.gameLobby.autoCapacityHelp')"
        position="right"
      />
    </div>
    
    <div v-if="isHost && !isAutoCapacity" class="flex items-center gap-3">
      <label for="customCapacity" class="font-mono text-sm whitespace-nowrap">
        {{ $t('components.gameLobby.customCapacity') }}:
      </label>
      <input 
        type="number" 
        id="customCapacity"
        :value="customCapacity"
        :min="minCapacity"
        :max="maxCapacity"
        class="w-20 bg-contrast/10 border-2 border-contrast px-2 py-1 font-mono text-sm focus:outline-none focus:border-accent transition-colors"
        @input="$emit('update:customCapacity', Number(($event.target as HTMLInputElement).value))"
        @change="$emit('capacityChange')"
      />
      <span class="font-mono text-sm text-accent">
        {{ $t('components.gameLobby.capacityRange', { min: minCapacity, max: maxCapacity }) }}
      </span>
      <Tooltip 
        :content="$t('components.gameLobby.customCapacityHelp')"
        position="right"
      />
    </div>
    
    <div v-if="!isHost" class="font-mono text-sm">
      {{ $t('components.gameLobby.bunkerCapacity', { count: currentCapacity }) }}
      <span v-if="!settings?.bunkerCapacity" class="text-accent">
        ({{ $t('components.gameLobby.auto') }})
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import Tooltip from '../ui/Tooltip.vue';

interface RoomSettings {
  bunkerCapacity?: number | null;
}

defineProps<{
  isHost: boolean;
  isAutoCapacity: boolean;
  customCapacity: number;
  currentCapacity: number;
  minCapacity: number;
  maxCapacity: number;
  settings?: RoomSettings;
}>();

defineEmits<{
  autoCapacityChange: [value: boolean];
  'update:customCapacity': [value: number];
  capacityChange: [];
}>();
</script>
