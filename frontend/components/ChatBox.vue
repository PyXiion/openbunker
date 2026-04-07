<template>
  <div class="tech-tile" :class="{ 'is-collapsed': isCollapsed }">
    <div class="tech-tile-header flex justify-between items-center cursor-pointer" @click="toggleCollapse">
      <div class="flex items-center gap-2">
        <span>{{ $t('components.chat.title') }}</span>
        <span v-if="unreadCount > 0" class="bg-accent text-base px-2 py-0.5 text-xs">{{ unreadCount }}</span>
      </div>
      <span class="text-xs">{{ isCollapsed ? '[+]' : '[-]' }}</span>
    </div>
    
    <div v-show="!isCollapsed" class="flex flex-col">
      <div ref="messagesContainer" class="h-64 overflow-y-auto border-2 border-contrast bg-base mb-2 p-2 space-y-2 font-mono text-sm">
        <div
          v-for="message in chatHistory"
          :key="message.id"
          class="border-l-2 pl-2"
          :class="getMessageClasses(message)"
        >
          <div class="flex justify-between text-xs opacity-75">
            <span :class="{ 'text-accent': message.type !== 'CHAT' }">{{ message.playerName }}</span>
            <span>{{ formatTime(message.timestamp) }}</span>
          </div>
          <div class="flex items-start gap-1">
            <span v-if="message.type === 'EVENT'" class="text-accent">{{ getEventIcon(message.eventType) }}</span>
            <span>{{ message.message }}</span>
          </div>
        </div>
        
        <div v-if="chatHistory.length === 0" class="text-contrast/50 text-center py-4 italic">
          {{ $t('components.chat.empty') }}
        </div>
      </div>
      
      <div class="flex gap-2">
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
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
    scrollToBottom();
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
.is-collapsed {
  min-height: auto;
}

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
