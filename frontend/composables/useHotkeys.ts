import { onMounted, onUnmounted, type Ref } from 'vue';

interface HotkeyConfig {
  key: string | string[];
  handler: (e: KeyboardEvent) => void;
  condition?: () => boolean;
  preventDefault?: boolean;
}

export function useHotkeys(hotkeys: HotkeyConfig[]) {
  const handleKeyPress = (e: KeyboardEvent) => {
    for (const hotkey of hotkeys) {
      const keys = Array.isArray(hotkey.key) ? hotkey.key : [hotkey.key];
      const keyMatches = keys.some(k => 
        e.key === k || e.code === k || e.key.toLowerCase() === k.toLowerCase()
      );
      
      if (keyMatches && (!hotkey.condition || hotkey.condition())) {
        if (hotkey.preventDefault !== false) {
          e.preventDefault();
        }
        hotkey.handler(e);
        return;
      }
    }
  };

  onMounted(() => {
    window.addEventListener('keydown', handleKeyPress);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyPress);
  });
}

export function useHotkeysWithCondition(hotkeys: HotkeyConfig[], condition: Ref<boolean>) {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (!condition.value) return;
    
    for (const hotkey of hotkeys) {
      const keys = Array.isArray(hotkey.key) ? hotkey.key : [hotkey.key];
      const keyMatches = keys.some(k => 
        e.key === k || e.code === k || e.key.toLowerCase() === k.toLowerCase()
      );
      
      if (keyMatches && (!hotkey.condition || hotkey.condition())) {
        if (hotkey.preventDefault !== false) {
          e.preventDefault();
        }
        hotkey.handler(e);
        return;
      }
    }
  };

  onMounted(() => {
    window.addEventListener('keydown', handleKeyPress);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyPress);
  });
}
