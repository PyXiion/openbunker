<template>
  <div class="tech-tile tech-scan-bar">
    <div class="tech-tile-header">{{ $t('components.bunkerStats.bunkerStatus') }}</div>
    <div v-if="bunker" class="space-y-4">
      <!-- Stats Grid -->
      <div class="tech-grid-tight grid-cols-2 gap-2 text-sm">
        <div class="border-2 border-contrast p-2 bg-base">
          <div class="mb-1">{{ $t('components.bunkerStats.capacity') }}: {{ activePlayerCount }}/{{ bunker.capacity }}</div>
          <div class="tui-progress">
            <span class="tui-progress-bar">
              <span class="tui-progress-fill" :style="{ width: `${(activePlayerCount / bunker.capacity) * 100}%` }"></span>
              <span class="tui-progress-empty" :style="{ width: `${100 - (activePlayerCount / bunker.capacity) * 100}%` }"></span>
            </span>
          </div>
        </div>
        <div>{{ $t('components.bunkerStats.food') }}: {{ bunker.food }} {{ $t('components.bunkerStats.days') }}</div>
        <div>{{ $t('components.bunkerStats.water') }}: {{ bunker.water }} {{ $t('components.bunkerStats.days') }}</div>
        <div>{{ $t('components.bunkerStats.medicine') }}: {{ bunker.medicine }} {{ $t('components.bunkerStats.units') }}</div>
        <div class="col-span-2 border-2 border-contrast p-2 bg-base">
          <div class="mb-1">{{ $t('components.bunkerStats.power') }}: {{ bunker.power }}%</div>
          <div class="tui-progress">
            <span class="tui-progress-bar">
              <span class="tui-progress-fill" :style="{ width: `${bunker.power}%` }"></span>
              <span class="tui-progress-empty" :style="{ width: `${100 - bunker.power}%` }"></span>
            </span>
          </div>
        </div>
      </div>
      
      <!-- Bunker Map Schematic -->
      <div v-if="bunker.rooms?.length" class="border-t-2 border-contrast pt-4">
        <div class="text-xs uppercase font-bold mb-2 text-contrast/70">BUNKER MAP // {{ bunker.rooms.length }} ROOMS</div>
        <div class="bunker-map">
          <div 
            v-for="(room, index) in displayedRooms" 
            :key="room.id"
            class="room"
            :class="[
              room.isRevealed ? 'room-revealed cursor-pointer' : 'room-hidden'
            ]"
            :style="{ gridColumn: room.x + 1, gridRow: room.y + 1 }"
            @click="room.isRevealed && openRoomCard(room, $event)"
          >
            <div class="room-symbol">{{ index + 1 }}</div>
            <div class="room-name">{{ room.isRevealed ? shortName(room.name) : '???' }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Room Card Overlay -->
    <LazyPlayingCard
      :visible="selectedRoom !== null"
      :position="cardPosition"
      variant="default"
      :revealed="true"
      title="BUNKER ROOM"
      :subtitle="selectedRoom?.name || ''"
      :description="selectedRoom?.description || ''"
      :footer-id="selectedRoom?.id || ''"
      header-color-class="bg-gray-500"
      @close="selectedRoom = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface BunkerRoom {
  id: string;
  name: string;
  description: string;
  isRevealed: boolean;
}

interface Props {
  bunker: {
    capacity: number;
    food: number;
    water: number;
    medicine: number;
    power: number;
    rooms?: BunkerRoom[];
  } | null;
  activePlayerCount: number;
}

const props = defineProps<Props>();

interface DisplayedRoom extends BunkerRoom {
  x: number;
  y: number;
}

const selectedRoom = ref<BunkerRoom | null>(null);
const cardPosition = ref({ x: 0, y: 0 });

const gridWidth = computed(() => {
  if (!props.bunker?.rooms?.length) return 3;
  const count = props.bunker.rooms.length;
  return Math.min(5, Math.max(3, Math.ceil(Math.sqrt(count))));
});

const gridHeight = computed(() => {
  if (!props.bunker?.rooms?.length) return 2;
  const count = props.bunker.rooms.length;
  return Math.min(4, Math.max(2, Math.ceil(count / gridWidth.value)));
});

// Position rooms in spiral pattern (memoized computed property)
const displayedRooms = computed<DisplayedRoom[]>(() => {
  if (!props.bunker?.rooms?.length) return [];

  const rooms = props.bunker.rooms;
  const roomCount = rooms.length;
  const w = gridWidth.value;
  const h = gridHeight.value;
  const centerX = Math.floor(w / 2);
  const centerY = Math.floor(h / 2);

  // Spiral from center
  const positions: { x: number; y: number }[] = [];
  positions.push({ x: centerX, y: centerY });
  const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  let dirIdx = 0;
  let steps = 1;
  let x = centerX, y = centerY;

  while (positions.length < roomCount) {
    for (let rep = 0; rep < 2 && positions.length < roomCount; rep++) {
      for (let i = 0; i < steps && positions.length < roomCount; i++) {
        x += directions[dirIdx][0];
        y += directions[dirIdx][1];
        if (x >= 0 && x < w && y >= 0 && y < h) {
          positions.push({ x, y });
        }
      }
      dirIdx = (dirIdx + 1) % 4;
    }
    steps++;
  }

  return rooms.map((room, i) => ({
    ...room,
    x: positions[i]?.x ?? 0,
    y: positions[i]?.y ?? 0,
  }));
});

function shortName(name: string): string {
  // Return first 3 chars uppercase for the grid cell
  return name.substring(0, 3).toUpperCase();
}

function openRoomCard(room: BunkerRoom, event: MouseEvent) {
  selectedRoom.value = room;
  // Position card near the click but ensure it stays on screen
  const rect = (event.target as HTMLElement).getBoundingClientRect();
  cardPosition.value = {
    x: rect.left + 70,
    y: rect.top - 150
  };
}
</script>

<style scoped>
.bunker-map {
  display: grid;
  grid-template-columns: repeat(v-bind('gridWidth'), 60px);
  grid-template-rows: repeat(v-bind('gridHeight'), 50px);
  gap: 8px;
  position: relative;
  padding: 8px;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 24px,
    rgba(0, 0, 0, 0.03) 24px,
    rgba(0, 0, 0, 0.03) 25px
  ),
  repeating-linear-gradient(
    90deg,
    transparent,
    transparent 24px,
    rgba(0, 0, 0, 0.03) 24px,
    rgba(0, 0, 0, 0.03) 25px
  );
  border: 2px solid var(--color-contrast);
}

.room {
  width: 50px;
  height: 40px;
  border: 3px solid;
  @apply border-contrast bg-base text-contrast;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
  position: relative;
}

.room:hover {
  @apply bg-contrast text-base;
}

.room:active {
  @apply bg-accent text-base;
}

.room-symbol {
  font-size: 14px;
  line-height: 1;
  font-weight: 900;
}

.room-name {
  font-size: 8px;
  margin-top: 2px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Hidden room - shows as locked/unknown */
.room-hidden {
  border-style: dashed;
  opacity: 0.6;
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 3px,
    rgba(0, 0, 0, 0.1) 3px,
    rgba(0, 0, 0, 0.1) 6px
  );
  cursor: not-allowed;
}

/* Revealed room - solid border, interactive */
.room-revealed {
  border-style: solid;
}
</style>
