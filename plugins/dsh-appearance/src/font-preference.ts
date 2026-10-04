import { FONTS, FONT_SOURCE } from './fonts'
import { observable } from './observable'
import { readCustomFont, readSavedFont, writeCustomFont, writeSavedFont } from './storage'
import type { ClientContext } from './types'
import type { Log } from './log'

export interface FontSnapshot {
  readonly id: string
  readonly customName: string
}

/** Font overrides belong to plugin activation, never to a settings render. */
export function createFontPreference(ctx: ClientContext, log: Log) {
  const source = observable<FontSnapshot>({ id: 'system', customName: readCustomFont().trim() })
  let fontRelease = () => {}
  let disposed = false

  function apply(id: string, customName: string): void {
    if (disposed) return
    const family = id === 'system' ? '' : id === 'custom' ? customName
      : FONTS.find(font => font.id === id)?.family || ''
    if (!family) id = 'system'
    // Install before releasing the previous identity. Failed validation keeps
    // the old layer alive; the host's stale layer disposer is a no-op.
    const release = family ? ctx.theme.overrideTokens(FONT_SOURCE, {
      '--dsw-font-family': { light: family, dark: family },
      '--dsw-font-family-brand': { light: family, dark: family },
    }) : () => {}
    fontRelease()
    fontRelease = release
    writeSavedFont(id)
    source.publish({ id, customName })
    log.log('font selected: %s', id)
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    source.dispose()
    fontRelease()
  }

  try { apply(readSavedFont(), source.getSnapshot().customName) }
  catch (error) { dispose(); throw error }

  return {
    source,
    select(id: string) { apply(id, source.getSnapshot().customName) },
    applyCustom(name: string) {
      if (disposed) return
      const trimmed = name.trim()
      apply('custom', trimmed)
      writeCustomFont(trimmed)
    },
    dispose,
  }
}

export type FontPreference = ReturnType<typeof createFontPreference>
