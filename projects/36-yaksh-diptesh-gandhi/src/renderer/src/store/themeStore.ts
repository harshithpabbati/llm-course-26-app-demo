import { create } from 'zustand'

type Theme = 'light' | 'dark'

interface ThemeStore {
  theme: Theme
  isLoading: boolean
  setTheme: (theme: Theme) => Promise<void>
  toggleTheme: () => Promise<void>
  initTheme: () => Promise<void>
}

export const useThemeStore = create<ThemeStore>((set, get) => {
  // 设置监听器（只设置一次）
  if (typeof window !== 'undefined' && window.api) {
    window.api.settings.onSettingsChange((newSettings) => {
      const newTheme = newSettings.theme
      set({ theme: newTheme })
      // 更新 HTML 元素的 class
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      console.log('[ThemeStore] Theme changed to:', newTheme)
    })
  }

  return {
    theme: 'dark',
    isLoading: true,

    initTheme: async () => {
      try {
        const theme = await window.api.settings.get('theme')
        set({ theme, isLoading: false })
        // 更新 HTML 元素的 class
        if (theme === 'dark') {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      } catch (error) {
        console.error('Failed to load theme:', error)
        set({ isLoading: false })
      }
    },

    setTheme: async (theme) => {
      try {
        // 先更新 UI
        set({ theme })
        if (theme === 'dark') {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
        // 然后保存到 electron-store
        await window.api.settings.set('theme', theme)
      } catch (error) {
        console.error('Failed to save theme:', error)
      }
    },

    toggleTheme: async () => {
      const currentTheme = get().theme
      const newTheme = currentTheme === 'light' ? 'dark' : 'light'
      await get().setTheme(newTheme)
    }
  }
})
