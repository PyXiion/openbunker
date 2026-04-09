<template>
  <Teleport to="body">
    <div 
      v-if="visible && !isClosing"
      class="card-floating-overlay"
      @click.self="close"
    >
      <div 
        class="playing-card floating"
        :class="[variant, { 'card-revealed': revealed, 'card-exiting': isExiting, 'is-dragging': isDragging }]"
        :style="{ 
          left: currentPosition.x + 'px', 
          top: currentPosition.y + 'px'
        }"
      >
        <!-- Drag Handle / Header -->
        <div class="drag-handle" @mousedown.prevent="startDrag">
          <div class="drag-indicator">⋮⋮</div>
        </div>
        <!-- Arrow pointing to source -->
        <div class="card-arrow-container">
          <div class="card-arrow-line"></div>
          <div class="card-arrow-head"></div>
        </div>
        
        <!-- Card Back (Hidden) -->
        <div v-if="!revealed" class="card-face card-back" style="margin-top: 20px;">
          <div class="classified-stamp">{{ hiddenLabel }}</div>
        </div>
        
        <!-- Card Front (Revealed) -->
        <div v-else class="card-face card-front" style="margin-top: 20px;">
          <div class="card-header" :class="headerColorClass">
            <span class="card-type">{{ title }}</span>
          </div>
          <div class="card-body">
            <h3 class="card-title">{{ subtitle }}</h3>
            <p class="card-description">{{ description }}</p>
          </div>
          <div class="card-footer">
            <span class="card-id">{{ footerId }}</span>
          </div>
        </div>

        <!-- Close Button -->
        <button 
          @click="close"
          class="close-btn"
        >
          ×
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';

interface Position {
  x: number;
  y: number;
}

interface Props {
  visible: boolean;
  position: Position;
  variant?: string;
  revealed?: boolean;
  hiddenLabel?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  footerId?: string;
  headerColorClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  revealed: false,
  hiddenLabel: 'HIDDEN',
  title: '',
  subtitle: '',
  description: '',
  footerId: '',
  headerColorClass: 'bg-gray-600'
});

const emit = defineEmits<{
  close: [];
  updatePosition: [pos: Position];
}>();

const isClosing = ref(false);
const isExiting = ref(false);

// Drag state
const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });
const currentPosition = ref({ x: props.position.x, y: props.position.y });

// Sync with prop changes
watch(() => props.position, (newPos) => {
  if (!isDragging.value) {
    currentPosition.value = { x: newPos.x, y: newPos.y };
  }
}, { immediate: true });

const startDrag = (event: MouseEvent) => {
  isDragging.value = true;
  dragOffset.value = {
    x: event.clientX - currentPosition.value.x,
    y: event.clientY - currentPosition.value.y
  };
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
};

const onDrag = (event: MouseEvent) => {
  if (!isDragging.value) return;
  currentPosition.value = {
    x: event.clientX - dragOffset.value.x,
    y: event.clientY - dragOffset.value.y
  };
};

const stopDrag = () => {
  if (isDragging.value) {
    isDragging.value = false;
    emit('updatePosition', { ...currentPosition.value });
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
  }
};

const close = () => {
  stopDrag();
  isClosing.value = true;
  emit('close');
  isClosing.value = false;
};

onUnmounted(() => {
  stopDrag();
});
</script>

<style scoped>
.playing-card {
  position: relative;
  width: 260px;
  background: var(--color-base, #1a1a1a);
  border: 3px solid var(--color-contrast, #e0e0e0);
  box-shadow: 
    8px 8px 0 rgba(0, 0, 0, 0.5),
    inset 0 0 0 1px rgba(255, 255, 255, 0.1);
}

.card-floating-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: auto;
}

.playing-card.floating {
  position: fixed;
  z-index: 10000;
}

/* No animations - style guide compliance */

.close-btn {
  position: absolute;
  top: -12px;
  right: -12px;
  width: 28px;
  height: 28px;
  background: var(--color-accent, #ff6b35);
  color: white;
  border: 2px solid white;
  font-weight: bold;
  font-size: 18px;
  line-height: 1;
  cursor: crosshair;
  z-index: 10001;
}

.playing-card.is-dragging {
  cursor: crosshair;
  opacity: 0.95;
}

.drag-handle {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 24px;
  cursor: crosshair;
  z-index: 10002;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}

.drag-handle:hover {
  background: rgba(255, 255, 255, 0.05);
}

.drag-handle:active {
  cursor: crosshair;
}

.playing-card.is-dragging .drag-handle {
  cursor: crosshair;
}

.drag-indicator {
  font-size: 10px;
  color: var(--color-contrast, #e0e0e0);
  opacity: 0.4;
  letter-spacing: 2px;
  user-select: none;
  pointer-events: none;
}

.drag-handle:hover .drag-indicator {
  opacity: 0.7;
}

/* Arrow pointing to click source - Technical connector */
.card-arrow-container {
  position: absolute;
  left: -24px;
  top: 140px;
  width: 24px;
  height: 20px;
  display: flex;
  align-items: center;
}

.card-arrow-line {
  width: 16px;
  height: 2px;
  background: var(--color-contrast, #e0e0e0);
  border: 1px solid var(--color-contrast, #e0e0e0);
}

.card-arrow-head {
  width: 0;
  height: 0;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-right: 8px solid var(--color-contrast, #e0e0e0);
  margin-left: -2px;
}

/* Card Back Styles - Technical Document Hidden */
.card-back {
  display: flex;
  background: repeating-linear-gradient(
    0deg,
    var(--color-base, #1a1a1a),
    var(--color-base, #1a1a1a) 2px,
    rgba(255, 255, 255, 0.03) 2px,
    rgba(255, 255, 255, 0.03) 4px
  );
  align-items: center;
  justify-content: center;
  min-height: 320px;
  border: 2px dashed var(--color-contrast, #e0e0e0);
  margin: 6px;
}

.classified-stamp {
  font-size: 16px;
  font-weight: bold;
  color: var(--color-accent, #ff6b35);
  border: 3px solid var(--color-accent, #ff6b35);
  padding: 12px 24px;
  text-transform: uppercase;
  letter-spacing: 4px;
  font-family: 'Courier New', monospace;
  background: rgba(0, 0, 0, 0.5);
}

/* Card Front Styles - Technical Spec Sheet */
.card-front {
  border: 2px solid var(--color-contrast, #e0e0e0);
  margin: 6px;
}

.card-header {
  padding: 10px 12px;
  text-align: center;
  border-bottom: 2px solid var(--color-contrast, #e0e0e0);
  background: var(--color-contrast, #e0e0e0);
}

.card-type {
  font-size: 12px;
  font-weight: bold;
  color: var(--color-base, #1a1a1a);
  text-transform: uppercase;
  letter-spacing: 2px;
  font-family: 'Courier New', monospace;
}

.card-body {
  padding: 16px;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: var(--color-base, #1a1a1a);
}

.card-title {
  font-size: 18px;
  font-weight: bold;
  color: var(--color-contrast, #e0e0e0);
  margin-bottom: 12px;
  line-height: 1.3;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 1px;
  border-bottom: 1px solid var(--color-contrast, #e0e0e0);
  padding-bottom: 8px;
}

.card-description {
  font-size: 12px;
  color: var(--color-contrast, #e0e0e0);
  line-height: 1.5;
  text-align: left;
  font-family: 'Courier New', monospace;
  opacity: 0.9;
}

.card-footer {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-top: 2px solid var(--color-contrast, #e0e0e0);
  text-align: right;
}

.card-id {
  font-size: 9px;
  color: var(--color-contrast, #e0e0e0);
  font-family: 'Courier New', monospace;
  letter-spacing: 1px;
  opacity: 0.6;
}

/* Variant Styles */
.playing-card.profession {
  border-color: #60a5fa;
  box-shadow: 8px 8px 0 rgba(96, 165, 250, 0.3);
}

.playing-card.biology {
  border-color: #f472b6;
  box-shadow: 8px 8px 0 rgba(244, 114, 182, 0.3);
}

.playing-card.hobby {
  border-color: #4ade80;
  box-shadow: 8px 8px 0 rgba(74, 222, 128, 0.3);
}

.playing-card.phobia {
  border-color: #a78bfa;
  box-shadow: 8px 8px 0 rgba(167, 139, 250, 0.3);
}

.playing-card.baggage {
  border-color: #fb923c;
  box-shadow: 8px 8px 0 rgba(251, 146, 60, 0.3);
}

.playing-card.fact {
  border-color: #22d3ee;
  box-shadow: 8px 8px 0 rgba(34, 211, 238, 0.3);
}

/* Trait-colored arrows */
.playing-card.profession .card-arrow-line {
  background: #60a5fa;
  border-color: #60a5fa;
}
.playing-card.profession .card-arrow-head {
  border-right-color: #60a5fa;
}

.playing-card.biology .card-arrow-line {
  background: #f472b6;
  border-color: #f472b6;
}
.playing-card.biology .card-arrow-head {
  border-right-color: #f472b6;
}

.playing-card.hobby .card-arrow-line {
  background: #4ade80;
  border-color: #4ade80;
}
.playing-card.hobby .card-arrow-head {
  border-right-color: #4ade80;
}

.playing-card.phobia .card-arrow-line {
  background: #a78bfa;
  border-color: #a78bfa;
}
.playing-card.phobia .card-arrow-head {
  border-right-color: #a78bfa;
}

.playing-card.baggage .card-arrow-line {
  background: #fb923c;
  border-color: #fb923c;
}
.playing-card.baggage .card-arrow-head {
  border-right-color: #fb923c;
}

.playing-card.fact .card-arrow-line {
  background: #22d3ee;
  border-color: #22d3ee;
}
.playing-card.fact .card-arrow-head {
  border-right-color: #22d3ee;
}
</style>
