const THEME_STORAGE_KEY = 'bunker-theme'

export type ThemeMode = 'system' | 'dark' | 'light'

export function useTheme() {
  const theme = ref<ThemeMode>('system')

  // Load theme from localStorage on mount
  onMounted(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored && (stored === 'system' || stored === 'dark' || stored === 'light')) {
      theme.value = stored as ThemeMode
    }
    applyTheme()
  })

  // Watch for theme changes
  watch(theme, () => {
    localStorage.setItem(THEME_STORAGE_KEY, theme.value)
    applyTheme()
  })

  // Listen for system theme changes
  onMounted(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', applyTheme)
    
    onUnmounted(() => {
      mediaQuery.removeEventListener('change', applyTheme)
    })
  })

  function applyTheme() {
    const html = document.documentElement
    
    if (theme.value === 'dark') {
      html.classList.add('dark')
    } else if (theme.value === 'light') {
      html.classList.remove('dark')
    } else {
      // System preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) {
        html.classList.add('dark')
      } else {
        html.classList.remove('dark')
      }
    }
  }

  function toggleTheme() {
    const modes: ThemeMode[] = ['system', 'dark', 'light']
    const currentIndex = modes.indexOf(theme.value)
    theme.value = modes[(currentIndex + 1) % modes.length]
  }

  function setTheme(newTheme: ThemeMode) {
    theme.value = newTheme
  }

  const currentTheme = computed(() => {
    if (theme.value !== 'system') return theme.value
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  return {
    theme,
    currentTheme,
    toggleTheme,
    setTheme
  }
}
