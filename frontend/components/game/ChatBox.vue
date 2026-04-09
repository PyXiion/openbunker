<template>
  <div 
    ref="chatContainer"
    class="chat-container tech-tile" 
    :class="{ 'is-collapsed': isCollapsed }"
    :style="containerStyle"
  >
    <div 
      class="tech-tile-header flex justify-between items-center cursor-pointer" 
      @click="toggleCollapse"
    >
      <div class="flex items-center gap-2">
        <span>{{ $t('components.chat.title') }}</span>
        <span v-if="unreadCount > 0" class="bg-accent text-base px-2 py-0.5 text-xs tech-blink">{{ unreadCount }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs">{{ isCollapsed ? '[+]' : '[-]' }}</span>
        <span class="tui-fkey-hint">[C]</span>
      </div>
    </div>
    
    <div v-show="!isCollapsed" class="flex flex-col" style="height: calc(100% - 40px); overflow: hidden;">
      <div ref="messagesContainer" class="flex-1 overflow-y-auto border-2 border-contrast bg-base mb-2 p-2 space-y-2 font-mono text-sm min-h-0 tui-scroll-down">
        <div
          v-for="message in chatHistory"
          :key="message.id"
          class="border-l-2 pl-2 break-words tech-data-stream"
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
          ref="inputRef"
          v-model="newMessage"
          type="text"
          class="border-2 border-contrast bg-base p-2 font-mono text-sm flex-1 tui-prompt"
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
      
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useGameStore } from '~/stores/game';
import { useSocket } from '~/composables/useSocket';
import { useHotkeys } from '~/composables/useHotkeys';
import { logger } from '~/utils/logger';

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


// Hotkeys
useHotkeys([
  {
    key: 'c',
    handler: () => toggleCollapse(),
    preventDefault: true
  }
]);

// Computed styles for positioning and sizing
const containerStyle = computed(() => {
  return {
    position: 'fixed' as const,
    bottom: '1rem',
    right: '1rem',
    width: isCollapsed.value ? '320px' : '320px',
    height: isCollapsed.value ? 'auto' : '400px',
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
watch(() => chatHistory.value.length, async (newLength, oldLength) => {
  await nextTick();
  scrollToBottom();
  
  // Increment unread count if collapsed and there's a new message
  if (isCollapsed.value && newLength > (oldLength || 0)) {
    const newMessage = chatHistory.value[chatHistory.value.length - 1];
    // Only count messages from other players (exclude own messages, system, and event messages)
    if (newMessage.playerId !== currentPlayerId.value && newMessage.type === 'CHAT') {
      unreadCount.value++;
    }
  }
});

onMounted(() => {
  scrollToBottom();
});



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

.is-collapsed {
  min-height: auto;
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
  font-family: 'Courier New', monospace;
  font-size: 0.875em;
}

:deep(pre) {
  background: var(--contrast-color, #e5e5e5);
  color: var(--base-color, #1a1a1a);
  padding: 0.5rem;
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
