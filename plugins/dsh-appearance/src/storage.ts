/** Legacy keys are retained after renaming to dsh-appearance. */
/** Plugin preferences. DSH persists only built-in theme ids, so custom
 *  themes and font choices are stored per browser origin. */

export const FONT_STORAGE_KEY = 'demo-sunset-theme:font'
export const CUSTOM_FONT_STORAGE_KEY = 'demo-sunset-theme:custom-font'
export const THEME_STORAGE_KEY = 'demo-sunset-theme:theme'

export function readSavedTheme(): string | null {
  try { return localStorage.getItem(THEME_STORAGE_KEY) || null }
  catch { return null }
}

export function writeSavedTheme(id: string | null): void {
  try {
    if (id) localStorage.setItem(THEME_STORAGE_KEY, id)
    else localStorage.removeItem(THEME_STORAGE_KEY)
  } catch { /* preference remains usable without persistence */ }
}

export function readSavedFont(): string {
  try { return localStorage.getItem(FONT_STORAGE_KEY) || 'system' }
  catch { return 'system' }
}

export function readCustomFont(): string {
  try { return localStorage.getItem(CUSTOM_FONT_STORAGE_KEY) || '' }
  catch { return '' }
}

export function writeSavedFont(id: string): void {
  try { localStorage.setItem(FONT_STORAGE_KEY, id) } catch { /* ignore */ }
}

export function writeCustomFont(value: string): void {
  try { localStorage.setItem(CUSTOM_FONT_STORAGE_KEY, value) } catch { /* ignore */ }
}
