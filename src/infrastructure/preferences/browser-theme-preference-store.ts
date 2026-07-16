import type { ThemeMode, ThemePreferenceStore } from '../../core/ports'

const themeStorageKey = 'learnt-theme'

export class BrowserThemePreferenceStore implements ThemePreferenceStore {
  getThemeMode(): ThemeMode {
    const storedTheme = safeLocalStorage()?.getItem(themeStorageKey)

    if (storedTheme === 'dark' || storedTheme === 'light') {
      return storedTheme
    }

    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: light)').matches
    ) {
      return 'light'
    }

    return 'dark'
  }

  setThemeMode(theme: ThemeMode): void {
    safeLocalStorage()?.setItem(themeStorageKey, theme)
  }
}

export function createBrowserThemePreferenceStore(): ThemePreferenceStore {
  return new BrowserThemePreferenceStore()
}

function safeLocalStorage(): Storage | null {
  if (typeof globalThis.localStorage === 'undefined') {
    return null
  }

  return globalThis.localStorage
}
