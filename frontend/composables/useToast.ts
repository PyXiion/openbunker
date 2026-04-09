import { ref } from 'vue';

interface Toast {
  id: string;
  message: string;
  type: 'error' | 'success' | 'info' | 'warning';
  duration?: number;
}

const toasts = ref<Toast[]>([]);

export const useToast = () => {
  const addToast = (message: string, type: 'error' | 'success' | 'info' | 'warning' = 'info', duration = 5000) => {
    const id = Date.now().toString();
    toasts.value.push({ id, message, type, duration });
    
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    
    return id;
  };

  const removeToast = (id: string) => {
    const index = toasts.value.findIndex(t => t.id === id);
    if (index > -1) {
      toasts.value.splice(index, 1);
    }
  };

  const error = (message: string, duration?: number) => addToast(message, 'error', duration);
  const success = (message: string, duration?: number) => addToast(message, 'success', duration);
  const info = (message: string, duration?: number) => addToast(message, 'info', duration);
  const warning = (message: string, duration?: number) => addToast(message, 'warning', duration);

  return {
    toasts,
    addToast,
    removeToast,
    error,
    success,
    info,
    warning,
  };
};
