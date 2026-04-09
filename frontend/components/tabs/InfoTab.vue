<template>
  <div class="flex flex-col gap-3">
    <p class="font-mono text-sm">
      {{ $t('components.gameLobby.bunkerCapacity', { count: currentCapacity }) }}
      <span v-if="!settings?.bunkerCapacity" class="text-accent">
        ({{ $t('components.gameLobby.auto') }})
      </span>
    </p>
    <p class="font-mono text-sm">
      {{ $t('components.gameLobby.firstTraitToReveal') }}: 
      <span class="text-accent">
        {{ settings?.firstTraitToReveal 
          ? $t(`traits.types.${settings.firstTraitToReveal}`) 
          : $t('components.gameLobby.anyTrait') }}
      </span>
    </p>
    <p class="font-mono text-sm">
      {{ $t('components.gameLobby.enableContentFilter') }}: 
      <span class="text-accent">
        {{ settings?.enableContentFilter !== false ? $t('common.enabled') : $t('common.disabled') }}
      </span>
    </p>
  </div>
</template>

<script setup lang="ts">
interface RoomSettings {
  bunkerCapacity?: number | null;
  firstTraitToReveal?: string | null;
  enableContentFilter?: boolean;
}

defineProps<{
  currentCapacity: number;
  settings?: RoomSettings;
}>();
</script>
