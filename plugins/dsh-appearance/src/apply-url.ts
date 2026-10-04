/** URL theme is an initial preference, never a delayed command. */
import type { ClientContext } from './types'

export function readUrlTheme(ctx: ClientContext): string | null {
  const wanted = new URLSearchParams(location.search).get('theme')
  return wanted && (wanted === 'system' || ctx.theme.getTheme().themes.some((t) => t.id === wanted))
    ? wanted
    : null
}
