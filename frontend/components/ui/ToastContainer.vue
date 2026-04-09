<template>
  <div class="fixed top-4 right-4 z-[99999] space-y-2">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast-notification"
      :class="toast.type"
      @click="removeToast(toast.id)"
    >
      <div class="toast-content">
        <span class="toast-icon">{{ getIcon(toast.type) }}</span>
        <span class="toast-message">{{ toast.message }}</span>
        <button class="toast-close" @click.stop="removeToast(toast.id)">×</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '~/composables/useToast';

const { toasts, removeToast } = useToast();

const getIcon = (type: string) => {
  const icons = {
    error: '⚠',
    success: '✓',
    info: 'ℹ',
    warning: '⚡',
  };
  return icons[type as keyof typeof icons] || 'ℹ';
};
</script>

<style scoped>
.toast-notification {
  min-width: 300px;
  max-width: 400px;
  padding: 12px 16px;
  border-radius: 4px;
  border: 2px solid;
  cursor: pointer;
  animation: slideIn 0.3s ease-out;
}

.toast-notification.error {
  background: rgba(239, 68, 68, 0.1);
  border-color: #ef4444;
  color: #ef4444;
}

.toast-notification.success {
  background: rgba(34, 197, 94, 0.1);
  border-color: #22c55e;
  color: #22c55e;
}

.toast-notification.info {
  background: rgba(59, 130, 246, 0.1);
  border-color: #3b82f6;
  color: #3b82f6;
}

.toast-notification.warning {
  background: rgba(234, 179, 8, 0.1);
  border-color: #eab308;
  color: #eab308;
}

.toast-content {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  text-transform: uppercase;
}

.toast-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.toast-message {
  flex: 1;
  line-height: 1.4;
}

.toast-close {
  background: transparent;
  border: none;
  color: inherit;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  padding: 0 4px;
  flex-shrink: 0;
}

.toast-close:hover {
  opacity: 0.7;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>
