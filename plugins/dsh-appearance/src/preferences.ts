import type { ClientContext } from './types'
import type { Log } from './log'
import { readUrlTheme } from './apply-url'
import { readSavedTheme, writeSavedTheme } from './storage'

const BUILTIN_THEMES = new Set(['light', 'dark', 'system'])

export interface ThemePreference {
  select(id: string): void
  dispose(): void
}

/** Custom choices stay authoritative until a built-in is selected here. */
export function createThemePreference(ctx: ClientContext, log: Log): ThemePreference {
  const registered = (id: string): boolean => id === 'system'
    || ctx.theme.getTheme().themes.some((t) => t.id === id)
  let custom: string | null = null
  let disposed = false
  let restoring = false

  function select(id: string): void {
    if (disposed) return
    if (!registered(id)) throw new Error(`theme "${id}" is not registered`)
    const previous = custom
    custom = BUILTIN_THEMES.has(id) ? null : id
    try {
      ctx.theme.setTheme(id)
      writeSavedTheme(custom)
    } catch (error) {
      custom = previous
      throw error
    }
  }

  const unsubscribe = ctx.on('theme/change', () => {
    if (disposed || restoring || !custom || ctx.theme.getTheme().preference === custom) return
    if (!registered(custom)) {
      custom = null
      writeSavedTheme(null)
      return
    }
    restoring = true
    try { ctx.theme.setTheme(custom) }
    catch (error) { log.warn('theme restore failed: %s', error) }
    finally { restoring = false }
  })
  const dispose = (): void => {
    if (disposed) return
    disposed = true
    unsubscribe()
  }

  try {
    const saved = readSavedTheme()
    const validSaved = saved && !BUILTIN_THEMES.has(saved) && registered(saved) ? saved : null
    if (saved && !validSaved) writeSavedTheme(null)
    const initial = readUrlTheme(ctx) || validSaved
    if (initial) select(initial)
    return { select, dispose }
  } catch (error) {
    dispose()
    throw error
  }
}
