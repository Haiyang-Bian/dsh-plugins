import type { ClientContext } from './types'
import { decorationCSS } from './styles'

const ATTRIBUTE = 'data-dsx-surface-theme'
const LAYOUT_ATTRIBUTE = 'data-dsh-appearance-layout'

/** Keep host surfaces decorated even while Settings is closed. */
export function mountThemeDecoration(ctx: ClientContext): () => void {
  const body = document.body
  const previous = body.getAttribute(ATTRIBUTE)
  const previousLayout = body.getAttribute(LAYOUT_ATTRIBUTE)
  const css = document.createElement('style')
  let unsubscribe: (() => void) | undefined
  let disposed = false
  const dispose = (): void => {
    if (disposed) return
    disposed = true
    unsubscribe?.()
    css.remove()
    if (previous === null) body.removeAttribute(ATTRIBUTE)
    else body.setAttribute(ATTRIBUTE, previous)
    if (previousLayout === null) body.removeAttribute(LAYOUT_ATTRIBUTE)
    else body.setAttribute(LAYOUT_ATTRIBUTE, previousLayout)
  }
  try {
    css.dataset.plugin = 'dsh-appearance-decoration'
    css.textContent = decorationCSS
    document.head.appendChild(css)
    const sync = (): void => {
      // Read the latest state: custom preference restoration can publish a
      // nested event before this listener receives the outer host snapshot.
      const id = ctx.theme.getTheme().active.id
      if (id === 'aurora' || id === 'sage') body.setAttribute(ATTRIBUTE, id)
      else body.removeAttribute(ATTRIBUTE)
      if (['sunset', 'aurora', 'sage'].includes(id)) body.setAttribute(LAYOUT_ATTRIBUTE, 'island')
      else body.removeAttribute(LAYOUT_ATTRIBUTE)
    }
    unsubscribe = ctx.on('theme/change', sync)
    sync()
    return dispose
  } catch (error) {
    dispose()
    throw error
  }
}
