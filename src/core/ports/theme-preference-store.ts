export type ThemeMode = 'dark' | 'light'

export interface ThemePreferenceStore {
  getThemeMode(): ThemeMode
  setThemeMode(theme: ThemeMode): void
}
