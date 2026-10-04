/** Bundle entry — DSH loads this via window.__ModuleLoader__.load({factory}).
 *
 *  Registers themes and contributes appearance controls to General settings.
 */
import { sunsetTokens } from './tokens/sunset'
import { auroraTokens } from './tokens/aurora'
import { sageTokens }   from './tokens/sage'
import { registerSettings } from './settings'
import { createFontPreference } from './font-preference'
import { createThemePreference } from './preferences'
import { mountThemeDecoration } from './theme-decoration'
import { Log } from './log'
import type { ClientContext } from './types'

window.__ModuleLoader__.load({
  id: 'dsh-appearance',
  factory: (require) => {
    const React = require('react')
    return {
      name: 'dsh-appearance',
      inject: ['theme', 'slots'],
      apply(ctx: ClientContext) {
        const log = new Log()
        const releases: Array<() => void | Promise<void>> = []
        let disposal: Promise<void> | undefined
        const dispose = (): Promise<void> => {
          if (disposal) return disposal
          disposal = (async () => {
            for (const release of releases.splice(0).reverse()) {
              try { await release() }
              catch (error) { log.warn('cleanup failed: %s', error) }
            }
            log.log('disposed (settings removed, fonts released, themes unregistered)')
            await log.dispose()
          })()
          return disposal
        }
        // Own cleanup before registration or mounting can fail.
        ctx.effect(() => dispose, 'dsh-appearance: dispose')
        void log.init()

        try {
          for (const definition of [
            { id: 'sunset', colorScheme: 'dark' as const, tokens: sunsetTokens },
            { id: 'aurora', colorScheme: 'light' as const, tokens: auroraTokens },
            { id: 'sage', colorScheme: 'light' as const, tokens: sageTokens },
          ]) releases.push(ctx.theme.register(definition))

          const themes = ctx.theme.getTheme().themes
          log.log('registered %d themes: %s', themes.length, themes.map((t) => t.id).join(', '))
          const fonts = createFontPreference(ctx, log)
          releases.push(fonts.dispose)
          const preference = createThemePreference(ctx, log)
          releases.push(preference.dispose)
          releases.push(mountThemeDecoration(ctx))
          const settings = registerSettings(ctx, log, preference, fonts, React)
          releases.push(settings.dispose)
        } catch (error) {
          void dispose().catch((failure) => console.warn('[dsh-appearance] cleanup failed', failure))
          throw error
        }
      },
    }
  },
})
