<template>
  <div class="mb-6 tech-tile">
    <h3 class="font-bold uppercase mb-4 text-contrast/90">
      {{ $t('components.gameLobby.bunkerSettings') }}
    </h3>
    
    <!-- Tabs -->
    <div class="settings-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab-button', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>
    
    <!-- Tab Content -->
    <div class="tab-content">
      <CapacityTab
        v-if="activeTab === 'capacity'"
        :is-host="isHost"
        :is-auto-capacity="isAutoCapacity"
        :custom-capacity="customCapacity"
        :current-capacity="currentCapacity"
        :min-capacity="minCapacity"
        :max-capacity="maxCapacity"
        :settings="settings"
        @auto-capacity-change="$emit('autoCapacityChange', $event)"
        @update:custom-capacity="$emit('update:customCapacity', $event)"
        @capacity-change="$emit('capacityChange')"
      />
      
      <RulesTab
        v-if="activeTab === 'rules'"
        :is-host="isHost"
        :initial-first-trait="initialFirstTrait"
        :initial-content-filter="initialContentFilter"
        :settings="settings"
        @update-first-trait="$emit('updateFirstTrait', $event)"
        @update-content-filter="$emit('updateContentFilter', $event)"
      />
      
      <InfoTab
        v-if="activeTab === 'info'"
        :current-capacity="currentCapacity"
        :settings="settings"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import CapacityTab from '../tabs/CapacityTab.vue';
import RulesTab from '../tabs/RulesTab.vue';
import InfoTab from '../tabs/InfoTab.vue';

interface RoomSettings {
  bunkerCapacity?: number | null;
  firstTraitToReveal?: string | null;
  enableContentFilter?: boolean;
}

defineProps<{
  isHost: boolean;
  isAutoCapacity: boolean;
  customCapacity: number;
  currentCapacity: number;
  minCapacity: number;
  maxCapacity: number;
  initialFirstTrait?: string;
  initialContentFilter?: boolean;
  settings?: RoomSettings;
}>();

defineEmits<{
  autoCapacityChange: [value: boolean];
  'update:customCapacity': [value: number];
  capacityChange: [];
  updateFirstTrait: [value: string];
  updateContentFilter: [value: boolean];
}>();

const activeTab = ref<string>('capacity');

const tabs = [
  { id: 'capacity', label: $t('components.gameLobby.tabCapacity') },
  { id: 'rules', label: $t('components.gameLobby.tabRules') },
  { id: 'info', label: $t('components.gameLobby.tabInfo') }
];
</script>
