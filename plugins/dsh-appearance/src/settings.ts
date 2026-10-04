import type * as React from 'react'
import type { HostObservable, InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { FONTS, FONT_GROUPS } from './fonts'
import type { FontPreference } from './font-preference'
import type { ThemePreference } from './preferences'
import type { Log } from './log'
import type { ClientContext, ThemeSnapshot } from './types'
import { observable } from './observable'
import { settingsCSS } from './styles'
import { auroraDecoration, sageDecoration } from './tokens/decoration'

const SLOT = 'settings.general.item'
const THEMES = [
  { id: 'light', label: '浅色', color: '#e8eaed' },
  { id: 'dark', label: '深色', color: '#1f2125' },
  { id: 'system', label: '跟随系统', color: 'linear-gradient(135deg, #e8eaed 50%, #1f2125 50%)' },
  { id: 'sunset', label: 'Sunset', color: '#d9a35f' },
  { id: 'aurora', label: 'Aurora', color: auroraDecoration.sidebar },
  { id: 'sage', label: 'Sage', color: sageDecoration.sidebar },
] as const

interface AppearanceInjected {
  hooks: { appearance: HostObservable<ThemeSnapshot> }
  selectTheme(id: string): void
}
interface FontInjected {
  hooks: { font: FontPreference['source'] }
  selectFont(id: string): void
  applyCustom(name: string): void
}
interface LogInjected {
  hooks: { sink: HostObservable<string> }
  exportLog(): Promise<void>
}
type RowProps<I extends object> = PropsRuntime<typeof SLOT> & InjectFace<I>

/** Components consume callbacks and renderer-generated hooks, never ctx. */
export function createSettingsComponents(React: typeof import('react')) {
  const h = React.createElement
  function AppearanceRow({ useAppearance, selectTheme }: RowProps<AppearanceInjected>) {
    const snapshot = useAppearance(value => value)
    const [error, setError] = React.useState('')
    return h('section', { className: 'dsx-settings-row', 'aria-label': '外观' },
      h('h3', { className: 'dsx-settings-title' }, '外观'),
      h('div', { className: 'dsx-theme-grid', role: 'group', 'aria-label': '颜色主题' },
        THEMES.map(theme => h('button', {
          key: theme.id, type: 'button', className: 'dsx-theme-card',
          'data-theme': theme.id, 'aria-pressed': snapshot.preference === theme.id,
          onClick: () => {
            try { selectTheme(theme.id); setError('') }
            catch { setError('主题切换失败，请重试。') }
          },
        }, h('span', { className: 'dsx-theme-swatch', style: { background: theme.color }, 'aria-hidden': true }), theme.label))),
      error && h('p', { className: 'dsx-settings-error', role: 'alert' }, error))
  }

  function FontRow({ useFont, selectFont, applyCustom }: RowProps<FontInjected>) {
    const snapshot = useFont(value => value)
    const [custom, setCustom] = React.useState(snapshot.id === 'custom')
    const [draft, setDraft] = React.useState(snapshot.customName)
    const [error, setError] = React.useState('')
    const inputId = React.useId()
    function submit(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault()
      try { applyCustom(draft); setCustom(Boolean(draft.trim())); setError('') }
      catch { setError('字体切换失败，请检查字体名称后重试。') }
    }
    return h('section', { className: 'dsx-settings-row', 'aria-label': '字体' },
      h('div', { className: 'dsx-font-control' },
        h('label', { className: 'dsx-settings-title', htmlFor: inputId }, '字体'),
        h('select', {
          id: inputId, className: 'dsx-font-select', value: custom ? 'custom' : snapshot.id,
          onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
            const id = event.target.value
            if (id === 'custom') { setCustom(true); setError(''); return }
            try { selectFont(id); setCustom(false); setError('') }
            catch { setError('字体切换失败，请重试。') }
          },
        }, FONT_GROUPS.map(group => h('optgroup', { key: group.id, label: group.label },
          FONTS.filter(font => font.group === group.id).map(font => h('option', { key: font.id, value: font.id }, font.label)))),
        h('option', { value: 'custom' }, '自定义字体'))),
      custom && h('form', { className: 'dsx-custom-row', onSubmit: submit },
        h('input', {
          className: 'dsx-custom-input', value: draft, type: 'text', 'aria-label': '自定义字体名',
          placeholder: '本机字体名，例如 Georgia',
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDraft(event.target.value),
        }), h('button', { className: 'dsx-settings-button', type: 'submit' }, '应用')),
      h('p', { className: 'dsx-settings-note' }, '使用本机字体，作用于界面及正文；代码保持原有等宽字体。'),
      error && h('p', { className: 'dsx-settings-error', role: 'alert' }, error))
  }

  function LogRow({ useSink, exportLog }: RowProps<LogInjected>) {
    const sink = useSink(value => value)
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState('')
    const mounted = React.useRef(false)
    React.useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
    const label = sink === 'opfs' ? 'OPFS 文件' : sink === 'localStorage' ? '浏览器本地存储'
      : sink === 'console' ? '内存（未持久化）' : '正在初始化'
    async function exportFile() {
      if (busy) return
      setBusy(true)
      setError('')
      try { await exportLog() }
      catch { if (mounted.current) setError('日志导出失败，请重试。') }
      finally { if (mounted.current) setBusy(false) }
    }
    return h('details', { className: 'dsx-settings-row' },
      h('summary', { className: 'dsx-log-summary' }, '主题插件日志'),
      h('div', { className: 'dsx-log-content' },
        h('span', { role: 'status', className: 'dsx-settings-note' }, '存储：' + label),
        h('button', { type: 'button', className: 'dsx-settings-button', disabled: busy, onClick: exportFile }, busy ? '正在导出…' : '导出 .log')),
      error && h('p', { className: 'dsx-settings-error', role: 'alert' }, error))
  }
  return { AppearanceRow, FontRow, LogRow }
}

/** UI registration lifetime is independent of whether Settings is open. */
export function registerSettings(ctx: ClientContext, log: Log, themes: ThemePreference,
  fonts: FontPreference, React: typeof import('react')) {
  const appearance = observable(ctx.theme.getTheme())
  const sink = observable(log.sinkLabel())
  const releases: Array<() => void | Promise<void>> = [() => appearance.dispose(), () => sink.dispose()]
  const css = document.createElement('style')
  releases.push(() => css.remove())
  let disposal: Promise<void> | undefined
  function dispose(): Promise<void> {
    if (disposal) return disposal
    disposal = (async () => {
      for (const release of releases.splice(0).reverse()) {
        try { await release() }
        catch (error) { log.warn('settings cleanup failed: %s', error) }
      }
    })()
    return disposal
  }
  // Also cover setup failures before the caller can retain the returned handle.
  ctx.effect(() => dispose, 'dsh-appearance: settings cleanup')
  try {
    css.dataset.plugin = 'dsh-appearance'
    css.textContent = settingsCSS
    document.head.appendChild(css)
    releases.push(ctx.on('theme/change', () => appearance.publish(ctx.theme.getTheme())))
    releases.push(log.onSinkChange(() => sink.publish(log.sinkLabel())))
    const components = createSettingsComponents(React)
    const warn = <T,>(name: string, work: () => T): T => {
      try { return work() }
      catch (error) { log.warn('%s failed: %s', name, error); throw error }
    }
    releases.push(ctx.slots.inject(SLOT, () => {
      const rows: Array<() => void> = []
      const clear = () => { for (const release of rows.splice(0).reverse()) release() }
      try {
        rows.push(ctx.slots.register({
          name: SLOT, id: 'appearance', priority: -100, order: 10,
          inject: (): AppearanceInjected => ({ hooks: { appearance },
            selectTheme: id => warn('theme selection', () => themes.select(id)) }),
        }, components.AppearanceRow))
        rows.push(ctx.slots.register({
          name: SLOT, id: 'dsh-appearance-font', order: 10.5,
          inject: (): FontInjected => ({ hooks: { font: fonts.source },
            selectFont: id => warn('font selection', () => fonts.select(id)),
            applyCustom: name => warn('custom font selection', () => fonts.applyCustom(name)) }),
        }, components.FontRow))
        rows.push(ctx.slots.register({
          name: SLOT, id: 'dsh-appearance-log', order: 12,
          inject: (): LogInjected => ({ hooks: { sink },
            exportLog: async () => {
              try { await log.exportAsFile() }
              catch (error) { log.warn('log export failed: %s', error); throw error }
            } }),
        }, components.LogRow))
        return clear
      } catch (error) { clear(); throw error }
    }))
    return { dispose }
  } catch (error) {
    void dispose().catch(failure => console.warn('[dsh-appearance] settings cleanup failed', failure))
    throw error
  }
}
