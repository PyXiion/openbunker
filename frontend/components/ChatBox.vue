<template>
  <div 
    ref="chatContainer"
    class="chat-container tech-tile" 
    :class="{ 'is-collapsed': isCollapsed, 'is-dragging': isDragging, 'is-resizing': isResizing }"
    :style="containerStyle"
  >
    <div 
      class="tech-tile-header flex justify-between items-center cursor-move" 
      @mousedown="startDrag"
      @click="handleHeaderClick"
    >
      <div class="flex items-center gap-2">
        <span>{{ $t('components.chat.title') }}</span>
        <span v-if="unreadCount > 0" class="bg-accent text-base px-2 py-0.5 text-xs">{{ unreadCount }}</span>
      </div>
      <span class="text-xs">{{ isCollapsed ? '[+]' : '[-]' }}</span>
    </div>
    
    <div v-show="!isCollapsed" class="flex flex-col" style="height: calc(100% - 40px); overflow: hidden;">
      <div ref="messagesContainer" class="flex-1 overflow-y-auto border-2 border-contrast bg-base mb-2 p-2 space-y-2 font-mono text-sm min-h-0">
        <div
          v-for="message in chatHistory"
          :key="message.id"
          class="border-l-2 pl-2 break-words"
          :class="getMessageClasses(message)"
        >
          <div class="flex justify-between text-xs opacity-75">
            <span :class="{ 'text-accent': message.type !== 'CHAT' }">{{ message.playerName }}</span>
            <span>{{ formatTime(message.timestamp) }}</span>
          </div>
          <div class="flex items-start gap-1 break-words">
            <span v-if="message.type === 'EVENT'" class="text-accent flex-shrink-0">{{ getEventIcon(message.eventType) }}</span>
            <div class="chat-message-content flex-1 min-w-0">
              <MarkdownRenderer :content="message.message" />
            </div>
          </div>
        </div>
        
        <div v-if="chatHistory.length === 0" class="text-contrast/50 text-center py-4 italic">
          {{ $t('components.chat.empty') }}
        </div>
      </div>
      
      <div class="flex gap-2 flex-shrink-0" style="padding-right: 16px; margin-bottom: 8px;">
        <input
          v-model="newMessage"
          type="text"
          class="flex-1 border-2 border-contrast bg-base p-2 font-mono text-sm"
          :placeholder="$t('components.chat.placeholder')"
          maxlength="500"
          @keyup.enter="sendMessage"
          :disabled="!canChat"
        />
        <button
          class="tech-button text-sm"
          :disabled="!canSendMessage"
          @click="sendMessage"
        >
          {{ $t('components.chat.send') }}
        </button>
      </div>
      
      <!-- Resize Handle -->
      <div 
        v-if="!isCollapsed && !isMobile"
        class="resize-handle flex-shrink-0"
        @mousedown="startResize"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M9 9L12 12M6 9L9 12M3 9L6 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useGameStore } from '~/stores/game';
import { useSocket } from '~/composables/useSocket';

const props = defineProps<{
  roomId: string;
}>();

const gameStore = useGameStore();
const { sendChatMessage } = useSocket();



const newMessage = ref('');
const isCollapsed = ref(true);
const messagesContainer = ref<HTMLElement | null>(null);
const unreadCount = ref(0);
const chatContainer = ref<HTMLElement | null>(null);

// Draggable and resizable state
const position = ref({ x: 0, y: 0 });
const size = ref({ width: 320, height: 400 });
const isDragging = ref(false);
const isResizing = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0 });
const isMobile = ref(false);
const hasDragged = ref(false);
const dragThreshold = 5; // pixels

// Computed styles for positioning and sizing
const containerStyle = computed(() => {
  if (isMobile.value) {
    // Mobile: use fixed positioning (current behavior)
    return {
      position: 'fixed' as const,
      bottom: '1rem',
      right: '1rem',
      width: '20rem'
    };
  }
  
  // Desktop: use absolute positioning with saved/custom values
  return {
    position: 'absolute' as const,
    left: `${position.value.x}px`,
    top: `${position.value.y}px`,
    width: isCollapsed.value ? '320px' : `${size.value.width}px`,
    height: isCollapsed.value ? 'auto' : `${size.value.height}px`,
    zIndex: 50
  };
});

const chatHistory = computed(() => gameStore.chatHistory);
const currentPlayerId = computed(() => gameStore.playerId);
const canChat = computed(() => gameStore.room?.status !== 'FINISHED');
const canSendMessage = computed(() => 
  canChat.value && newMessage.value.trim().length > 0
);

// Auto-scroll to bottom when new messages arrive
watch(chatHistory, async (newHistory, oldHistory) => {
  await nextTick();
  scrollToBottom();
  
  // Increment unread count if collapsed and there's a new message
  if (isCollapsed.value && newHistory.length > (oldHistory?.length || 0)) {
    const newMessage = newHistory[newHistory.length - 1];
    // Only count messages from other players (exclude own messages, system, and event messages)
    if (newMessage.playerId !== currentPlayerId.value && newMessage.type === 'CHAT') {
      unreadCount.value++;
    }
  }
}, { deep: true });

onMounted(() => {
  detectMobile();
  loadPersistedState();
  scrollToBottom();
  
  // Add global event listeners
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  window.addEventListener('resize', handleWindowResize);
});

onUnmounted(() => {
  // Clean up event listeners
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
  window.removeEventListener('resize', handleWindowResize);
});

function detectMobile() {
  isMobile.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function loadPersistedState() {
  if (isMobile.value) return;
  
  try {
    const saved = localStorage.getItem('chatbox-state');
    if (saved) {
      const state = JSON.parse(saved);
      position.value = state.position || { x: 0, y: 0 };
      size.value = state.size || { width: 320, height: 400 };
      
      // Ensure position is within viewport
      constrainToViewport();
    } else {
      // Default position (bottom-right)
      setDefaultPosition();
    }
  } catch (error) {
    console.error('Error loading chatbox state:', error);
    setDefaultPosition();
  }
}

function setDefaultPosition() {
  const margin = 16;
  const elementWidth = isCollapsed.value ? 320 : size.value.width;
  const elementHeight = isCollapsed.value ? 40 : size.value.height;
  
  position.value = {
    x: window.innerWidth - elementWidth - margin,
    y: window.innerHeight - elementHeight - margin
  };
}

function savePersistedState() {
  if (isMobile.value) return;
  
  try {
    const state = {
      position: position.value,
      size: size.value
    };
    localStorage.setItem('chatbox-state', JSON.stringify(state));
  } catch (error) {
    console.error('Error saving chatbox state:', error);
  }
}

function startDrag(event: MouseEvent) {
  if (isMobile.value) return;
  
  event.preventDefault();
  event.stopPropagation();
  
  isDragging.value = true;
  hasDragged.value = false;
  dragStart.value = {
    x: event.clientX - position.value.x,
    y: event.clientY - position.value.y
  };
}

function startResize(event: MouseEvent) {
  if (isMobile.value) return;
  
  event.preventDefault();
  event.stopPropagation();
  
  isResizing.value = true;
  resizeStart.value = {
    x: event.clientX,
    y: event.clientY,
    width: size.value.width,
    height: size.value.height
  };
}

function handleMouseMove(event: MouseEvent) {
  if (isDragging.value) {
    const newX = event.clientX - dragStart.value.x;
    const newY = event.clientY - dragStart.value.y;
    
    // Check if we've moved beyond the threshold
    const deltaX = Math.abs(newX - (position.value.x));
    const deltaY = Math.abs(newY - (position.value.y));
    
    if (deltaX > dragThreshold || deltaY > dragThreshold) {
      hasDragged.value = true;
    }
    
    position.value = {
      x: Math.max(0, Math.min(newX, window.innerWidth - (isCollapsed.value ? 320 : size.value.width))),
      y: Math.max(0, Math.min(newY, window.innerHeight - (isCollapsed.value ? 40 : size.value.height)))
    };
  } else if (isResizing.value) {
    const deltaX = event.clientX - resizeStart.value.x;
    const deltaY = event.clientY - resizeStart.value.y;
    
    const newWidth = Math.max(320, Math.min(resizeStart.value.width + deltaX, window.innerWidth * 0.8));
    const newHeight = Math.max(200, Math.min(resizeStart.value.height + deltaY, window.innerHeight * 0.8));
    
    size.value = { width: newWidth, height: newHeight };
    
    // Adjust position if resizing would go out of bounds
    constrainToViewport();
  }
}

function handleMouseUp() {
  if (isDragging.value || isResizing.value) {
    isDragging.value = false;
    isResizing.value = false;
    savePersistedState();
    
    // Reset drag flag after a short delay to allow click events to complete
    setTimeout(() => {
      hasDragged.value = false;
    }, 10);
  }
}

function handleWindowResize() {
  if (!isMobile.value) {
    constrainToViewport();
  }
}

function constrainToViewport() {
  const elementWidth = isCollapsed.value ? 320 : size.value.width;
  const elementHeight = isCollapsed.value ? 40 : size.value.height;
  
  const maxX = window.innerWidth - elementWidth;
  const maxY = window.innerHeight - elementHeight;
  
  position.value = {
    x: Math.max(0, Math.min(position.value.x, maxX)),
    y: Math.max(0, Math.min(position.value.y, maxY))
  };
}

function handleHeaderClick() {
  // Only toggle collapse if we haven't dragged
  if (!hasDragged.value) {
    toggleCollapse();
  }
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
  if (!isCollapsed.value) {
    unreadCount.value = 0;
    nextTick(() => {
      scrollToBottom();
    });
  }
}

function sendMessage() {
  const message = newMessage.value.trim();
  if (!message || !canChat.value) return;
  
  sendChatMessage(props.roomId, message);
  newMessage.value = '';
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  // Simply use toLocaleTimeString which should automatically convert to local time
  return date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit'
  });
}

function getMessageClasses(message: any): string {
  const isOwn = message.playerId === currentPlayerId.value;
  
  if (message.type === 'EVENT') {
    return 'border-accent text-contrast';
  }
  if (message.type === 'SYSTEM') {
    return 'border-contrast/50 text-contrast/75';
  }
  if (isOwn) {
    return 'border-accent text-contrast';
  }
  return 'border-contrast text-contrast';
}

function getEventIcon(eventType?: string): string {
  const icons: Record<string, string> = {
    'PLAYER_JOIN': '>',
    'PLAYER_LEFT': '<',
    'PLAYER_KICKED': 'X',
    'GAME_STARTED': '▶',
    'CARD_REVEALED': '●',
    'VOTE_SUBMITTED': '◆',
    'PLAYER_EXILED': 'X',
    'ROUND_STARTED': '↻',
    'BUNKER_ROOM_REVEALED': '□',
    'GAME_FINISHED': '■',
    'HOST_CHANGED': '♔',
    'CHAT_MESSAGE': '◈'
  };
  return icons[eventType || ''] || '◈';
}
</script>

<style scoped>
.chat-container {
  transition: none;
  overflow: hidden;
}

.chat-container:not(.is-dragging):not(.is-resizing) {
  transition: width 0.2s ease, height 0.2s ease;
}

.is-collapsed {
  min-height: auto;
}

.is-dragging, .is-resizing {
  opacity: 0.9;
  user-select: none;
}

.resize-handle {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  color: var(--contrast-color, #e5e5e5);
  opacity: 0.6;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--base-color, #1a1a1a);
  border: 2px solid var(--contrast-color, #e5e5e5);
  border-top: none;
  border-left: none;
  z-index: 10;
}

.resize-handle:hover {
  opacity: 1;
  color: var(--accent-color, #ff4444);
}

/* Markdown styling to match tech aesthetic */
:deep(.chat-message-content) {
  line-height: 1.4;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

:deep(p) {
  margin: 0;
}

:deep(p:first-child) {
  margin-top: 0;
}

:deep(p:last-child) {
  margin-bottom: 0;
}

:deep(strong) {
  color: var(--accent-color, #ff4444);
  font-weight: bold;
}

:deep(em) {
  color: var(--contrast-color, #e5e5e5);
  font-style: italic;
}

:deep(code) {
  background: var(--contrast-color, #e5e5e5);
  color: var(--base-color, #1a1a1a);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-family: 'Courier New', monospace;
  font-size: 0.875em;
}

:deep(pre) {
  background: var(--contrast-color, #e5e5e5);
  color: var(--base-color, #1a1a1a);
  padding: 0.5rem;
  border-radius: 0.25rem;
  font-family: 'Courier New', monospace;
  font-size: 0.875em;
  overflow-x: auto;
  margin: 0.25rem 0;
}

:deep(a) {
  color: var(--accent-color, #ff4444);
  text-decoration: underline;
}

:deep(a:hover) {
  color: var(--accent-color, #ff6666);
  text-decoration: none;
}

:deep(ul), :deep(ol) {
  margin: 0.25rem 0;
  padding-left: 1.5rem;
}

:deep(li) {
  margin: 0.125rem 0;
}

:deep(blockquote) {
  border-left: 2px solid var(--accent-color, #ff4444);
  padding-left: 0.75rem;
  margin: 0.25rem 0;
  color: var(--contrast-color, #e5e5e5);
  opacity: 0.8;
}

:deep(h1), :deep(h2), :deep(h3) {
  margin: 0.5rem 0 0.25rem 0;
  color: var(--accent-color, #ff4444);
}

:deep(h1) { font-size: 1.1em; }
:deep(h2) { font-size: 1.05em; }
:deep(h3) { font-size: 1em; }

/* Scrollbar styling to match tech aesthetic */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: var(--base-color, #1a1a1a);
  border-left: 2px solid var(--contrast-color, #e5e5e5);
}

::-webkit-scrollbar-thumb {
  background: var(--contrast-color, #e5e5e5);
  border: 2px solid var(--base-color, #1a1a1a);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--accent-color, #ff4444);
}
</style>
