<template>
  <div class="flex flex-col gap-4">
    <!-- First Trait to Reveal Setting -->
    <div v-if="isHost" class="flex flex-col gap-2">
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
        @change="$emit('updateFirstTrait', selectedFirstTrait)"
      >
        <option value="">{{ $t('components.gameLobby.anyTrait') }}</option>
        <option v-for="trait in availableTraits" :key="trait" :value="trait">
          {{ $t(`traits.types.${trait}`) }}
        </option>
      </select>
    </div>
    
    <!-- Content Filter Setting -->
    <div v-if="isHost" class="flex items-center gap-3">
      <input 
        type="checkbox" 
        id="contentFilter"
        v-model="enableContentFilter"
        class="w-4 h-4 accent-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
        @change="$emit('updateContentFilter', enableContentFilter)"
      />
      <label for="contentFilter" class="font-mono text-sm">
        {{ $t('components.gameLobby.enableContentFilter') }}
      </label>
      <Tooltip 
        :content="$t('components.gameLobby.contentFilterHelp')"
        position="right"
      />
    </div>
    
    <!-- Display for non-hosts -->
    <div v-if="!isHost" class="font-mono text-sm">
      <p class="mb-2">
        {{ $t('components.gameLobby.firstTraitToReveal') }}: 
        <span class="text-accent">
          {{ settings?.firstTraitToReveal 
            ? $t(`traits.types.${settings.firstTraitToReveal}`) 
            : $t('components.gameLobby.anyTrait') }}
        </span>
      </p>
      <p>
        {{ $t('components.gameLobby.enableContentFilter') }}: 
        <span class="text-accent">
          {{ settings?.enableContentFilter !== false ? $t('common.enabled') : $t('common.disabled') }}
        </span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import Tooltip from '../ui/Tooltip.vue';

interface RoomSettings {
  firstTraitToReveal?: string | null;
  enableContentFilter?: boolean;
}

const availableTraits = ['profession', 'biology', 'hobby', 'phobia', 'baggage', 'fact'] as const;

const props = defineProps<{
  isHost: boolean;
  initialFirstTrait?: string;
  initialContentFilter?: boolean;
  settings?: RoomSettings;
}>();

const selectedFirstTrait = ref<string>('');
const enableContentFilter = ref(true);

defineEmits<{
  updateFirstTrait: [value: string];
  updateContentFilter: [value: boolean];
}>();

watch(() => [props.initialFirstTrait, props.initialContentFilter] as const, ([firstTrait, contentFilter]) => {
  selectedFirstTrait.value = firstTrait || '';
  enableContentFilter.value = contentFilter !== false;
}, { immediate: true });
</script>
