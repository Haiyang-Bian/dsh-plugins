import * as Cordis from '/cordis.js'
import * as Slots from '/slots.js'
import { ThemePresenter } from '/presenter.js'

const R = window.React
const h = R.createElement
const flush = window.ReactDOM.flushSync
const tick = () => new Promise(resolve => requestAnimationFrame(() => resolve()))
// Store fixture implements the official handle contract. Rendering, hook
// binding, slot ownership, typography and font-size controls use installed code.
function defineStore(spec) {
  return { spec, create() {
    let value = spec.init()
    const listeners = new Set()
    const actions = Object.fromEntries(Object.entries(spec.actions).map(([key, mutation]) => [key, (...args) => {
      value = { ...value }; mutation(value, ...args); for (const listener of [...listeners]) listener()
    }]))
    return { actions, getSnapshot: () => value, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn) } }
  } }
}
const jsx = (type, props, key) => h(type, { ...props, key })
const jsxs = (type, { children, ...props }, key) => h(type, { ...props, key }, ...children)
const primitive = () => h('span', { 'aria-hidden': true }, '▴')
const modules = {
  react: R, 'react-dom': window.ReactDOM, 'react-dom/client': window.ReactDOM,
  'react/jsx-runtime': { jsx, jsxs, Fragment: R.Fragment },
  '@deepseek-ai/cordis': Cordis, '@deepseek-ai/dsh-client-ui-slots': Slots,
  '@deepseek-ai/dsh-client-store': { defineStore },
  '@deepseek-ai/dsh-client-ui-primitives': new Proxy({}, { get: () => primitive }),
}
const shared = name => { if (!(name in modules)) throw new Error('Missing shared module ' + name); return modules[name] }
const status = document.getElementById('status')
const errorNode = document.getElementById('error')
const runButton = document.getElementById('run')
const ids = ['ui', 'button', 'brand', 'composer', 'heading', 'markdown']
const family = id => getComputedStyle(document.getElementById(id)).fontFamily
const capture = () => Object.fromEntries(ids.map(id => [id, family(id)]))
const same = (a, b) => ids.every(id => a[id] === b[id])
let count = 0
function check(condition, label) {
  if (!condition) throw new Error(label)
  count++
  const item = document.createElement('li'); item.className = 'pass'; item.textContent = 'PASS ' + label
  document.getElementById('results').append(item)
}
try {
  for (const key of ['font', 'custom-font', 'theme']) localStorage.removeItem('demo-sunset-theme:' + key)
  const ctx = new Cordis.Context()
  factories.get('@deepseek-ai/dsh-client-ui-renderer')(shared).apply(ctx)
  const absentBinding = { key: undefined, hooks: {}, keyedHooks: {}, props: {} }
  const absentSource = { getSnapshot: () => absentBinding, subscribe: () => () => {} }
  ctx.slots.installScope('session', { current: absentSource, bindingSource: () => absentSource })
  const installed = factories.get('@deepseek-ai/dsh-client-ui-theme')(shared).fixture
  const durable = { value: { preference: 'system', fontSize: 14 } }
  const scope = { getSnapshot: () => durable, set: (field, value) => { durable.value[field] = value }, subscribe: () => () => {} }
  const theme = new installed.ThemeRuntime(ctx, scope)
  ctx.provide('theme', theme)
  const presenter = new ThemePresenter()
  const present = snapshot => presenter.apply(snapshot)
  ctx.on('theme/change', present); present(theme.getTheme())
  const baseline = capture(); const codeBaseline = family('code')
  const surface = selector => getComputedStyle(document.querySelector(selector))
  const surfaceSelectors = ['.BynINW_frame', '.BynINW_centerCol', '.BynINW_sidebarCol', '._2H3hWW_root', '.Dc7zOa_root', '[data-conversation-content]']
  const plainSurfaces = surfaceSelectors.map(selector => surface(selector).backgroundImage)
  const t = key => ({ appearance: '外观', light: '浅色', dark: '深色', system: '跟随系统', 'fontSize.title': '正文字号', 'fontSize.description': '字体大小', 'fontSize.increase': '增大字号', 'fontSize.decrease': '减小字号', 'fontSize.unit': 'px' }[key] || key)
  const localeListeners = new Set()
  ctx.slots.installLocale({ getSnapshot: () => ({ revision: 0 }), subscribe: fn => { localeListeners.add(fn); return () => localeListeners.delete(fn) }, bind: () => t })
  let setOpen
  function SettingsRoot({ renderSlot }) {
    const [open, update] = R.useState(true); setOpen = update
    return h('div', { className: 'settings-shell' }, h('h3', null, '设置 → 通用'),
      h('button', { onClick: () => update(!open), id: 'toggle-settings' }, open ? '关闭设置' : '打开设置'),
      open && renderSlot('settings.general.item', {}))
  }
  ctx.slots.register({ name: 'root', children: { 'settings.general.item': { kind: 'list', scope: 'root' } } }, SettingsRoot)
  const appearanceStore = installed.createAppearanceRowStore()
  const fontSizeStore = installed.createFontSizeRowStore()
  let appearanceActions, sizeActions
  function sync(snapshot) {
    appearanceActions?.sync(snapshot.preference, snapshot.revision)
    sizeActions?.sync(snapshot.fontSize, snapshot.revision)
  }
  ctx.on('theme/change', sync)
  ctx.slots.register({ name: 'settings.general.item', id: 'appearance', order: 10, locale: 'settings.theme', store: appearanceStore,
    inject: actions => { appearanceActions = actions; sync(theme.getTheme()); return { setTheme: id => theme.setTheme(id) } } }, installed.AppearanceRow)
  ctx.slots.register({ name: 'settings.general.item', id: 'font-size', order: 11, locale: 'settings.theme', store: fontSizeStore,
    inject: actions => { sizeActions = actions; sync(theme.getTheme()); return { setFontSize: size => theme.setFontSize(size) } } }, installed.FontSizeRow)
  const entry = factories.get('dsh-appearance')(shared)
  let activated = ctx.plugin(entry)
  const unmount = ctx.uiRenderer.mount(document.getElementById('settings'))
  await tick()
  runButton.disabled = false; status.textContent = '准备就绪'
  runButton.addEventListener('click', async () => {
    runButton.disabled = true; status.textContent = '运行中'
    try {
      check(document.querySelectorAll('.dsx-theme-card').length === 6 && !document.querySelector('.dsx-root'), '六个主题合并到设置，悬浮窗已移除')
      check(getComputedStyle(document.querySelector('[aria-pressed="true"]')).outlineStyle === 'solid' && getComputedStyle(document.body).getPropertyValue('--dsw-alias-bg-layer-2').trim(), '宿主颜色变量和主题选中样式有效')
      check(document.querySelectorAll('optgroup').length === 6 && document.querySelector('.dsx-font-select').options.length === 16, '分组下拉保留 15 个预设及自定义选项')
      check(!document.querySelector('details').open, '日志默认折叠')
      function select(id) { flush(() => { const select = document.querySelector('.dsx-font-select'); select.value = id; select.dispatchEvent(new Event('change', { bubbles: true })) }) }
      select('verdana')
      const selected = capture()
      check(ids.every(id => selected[id].includes('Verdana')) && getComputedStyle(document.querySelector('.dsx-font-select')).fontFamily.includes('Verdana'), '主界面、输入框、Markdown 和设置字体同步变化')
      check(family('code') === codeBaseline, '代码字体保持不变')
      for (const id of ['aurora', 'sage']) {
        flush(() => document.querySelector('[data-theme="' + id + '"]').click())
        check(document.body.getAttribute('data-dsx-surface-theme') === id && surfaceSelectors.every(selector => surface(selector).backgroundImage.includes('gradient')), id + ' 渐变实际覆盖宿主外壳、侧栏和聊天区域')
        check(surface('[data-composer-card]').backgroundImage === 'none' && surface('[data-composer-card]').backgroundColor !== 'rgba(0, 0, 0, 0)' && family('code') === codeBaseline, id + ' 输入卡片为实色，代码字体保持不变')
        check(surface('[data-theme="' + id + '"] .dsx-theme-swatch').backgroundImage.includes('gradient'), id + ' 设置卡片显示对应渐变预览')
      }
      for (const id of ['sunset', 'dark', 'light', 'system']) {
        flush(() => document.querySelector('[data-theme="' + id + '"]').click())
        check(!document.body.hasAttribute('data-dsx-surface-theme') && surfaceSelectors.every((selector, index) => surface(selector).backgroundImage === plainSurfaces[index]), id + ' 不残留蓝绿装饰')
      }
      check(same(capture(), selected), '切换全部主题后字体保持生效')
      flush(() => document.querySelector('[data-theme="sage"]').click())
      theme.adopt(); await tick()
      check(theme.getTheme().preference === 'sage' && document.querySelector('[data-theme="sage"]').getAttribute('aria-pressed') === 'true', '宿主同步后自定义主题和选中状态正确')
      flush(() => setOpen(false)); check(!document.querySelector('.dsx-font-select') && same(capture(), selected) && surface('.Dc7zOa_root').backgroundImage.includes('gradient'), '关闭设置后字体、主题和宿主背景仍生效')
      flush(() => setOpen(true)); check(document.querySelector('.dsx-font-select').value === 'verdana', '重开设置恢复当前字体选择')
      select('custom')
      const input = document.querySelector('.dsx-custom-input')
      flush(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Georgia'); input.dispatchEvent(new Event('input', { bubbles: true })) })
      check(same(capture(), selected), '自定义字体输入在提交前不改变字体')
      flush(() => input.closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
      check(ids.every(id => family(id) === 'Georgia'), '自定义字体提交后作用于主界面正文')
      select('custom')
      flush(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(document.querySelector('.dsx-custom-input'), 'Unsubmitted Font'); document.querySelector('.dsx-custom-input').dispatchEvent(new Event('input', { bubbles: true })) })
      flush(() => setOpen(false)); flush(() => setOpen(true))
      check(document.querySelector('.dsx-custom-input').value === 'Georgia', '关闭设置丢弃未提交字体输入')
      const sizeButtons = [...document.querySelectorAll('button')].filter(button => /增大字号|减小字号/.test(button.getAttribute('aria-label') || ''))
      check(sizeButtons.length === 2, '保留官方字号控件且未创建重复字号行')
      const increase = sizeButtons.find(button => button.getAttribute('aria-label') === '增大字号')
      const decrease = sizeButtons.find(button => button.getAttribute('aria-label') === '减小字号')
      for (let i = 0; i < 20; i++) flush(() => increase.click())
      check(theme.getTheme().fontSize === 22 && increase.disabled, '官方字号上限为 22 px')
      for (let i = 0; i < 20; i++) flush(() => decrease.click())
      check(theme.getTheme().fontSize === 10 && decrease.disabled, '官方字号下限为 10 px')
      flush(() => document.querySelector('[data-theme="system"]').click()); theme.adopt()
      check(!localStorage.getItem('demo-sunset-theme:theme') && theme.getTheme().preference === 'system', '切回内置主题解除自定义主题优先权')
      select('system'); check(same(capture(), baseline), '系统默认恢复宿主字体')
      select('verdana'); await activated.dispose(); await tick()
      check(same(capture(), baseline) && !document.querySelector('.dsx-font-select') && document.querySelectorAll('.v01cdW_themeCube').length === 3, '卸载恢复官方外观行并移除字体覆盖')
      activated = ctx.plugin(entry); await tick()
      check(document.querySelector('.dsx-font-select').value === 'verdana' && ids.every(id => family(id).includes('Verdana')), '再次启用恢复字体和设置贡献')
      await activated.dispose(); await tick()
      check(!document.querySelector('style[data-plugin="dsh-appearance"]') && !document.querySelector('style[data-plugin="dsh-appearance-decoration"]') && !document.body.hasAttribute('data-dsx-surface-theme') && same(capture(), baseline), '最终卸载清除插件样式、装饰属性与字体覆盖')
      activated = ctx.plugin(entry); await tick()
      select('system'); flush(() => document.querySelector('[data-theme="system"]').click())
      theme.setFontSize(14)
      status.textContent = 'PASS ' + count + ' 项浏览器集成检查'; status.className = 'pass'
    } catch (error) { status.textContent = 'FAIL'; errorNode.textContent = error.stack }
  })
} catch (error) { status.textContent = 'FAIL'; errorNode.textContent = error.stack }
