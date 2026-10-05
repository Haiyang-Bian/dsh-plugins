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
  '@deepseek-ai/dsh-client-ui-primitives': new Proxy({ Tooltip: ({ children }) => h(R.Fragment, null, children), isDarwinDesktop: () => false }, { get: (target, name) => target[name] || primitive }),
}
const shared = name => { if (!(name in modules)) throw new Error('Missing shared module ' + name); return modules[name] }
const status = document.getElementById('status')
const errorNode = document.getElementById('error')
const runButton = document.getElementById('run')
const ids = ['ui', 'button', 'brand', 'composer', 'heading', 'markdown']
const node = id => id === 'button' ? document.querySelector('._2H3hWW_newSession') : id === 'brand' ? document.querySelector('._2H3hWW_brandName') : document.getElementById(id)
const family = id => getComputedStyle(node(id)).fontFamily
const capture = () => Object.fromEntries(ids.map(id => [id, family(id)]))
const same = (a, b) => ids.every(id => a[id] === b[id])
// Only the fixture changes window modes; plugin CSS owns no window listeners.
let setSidebarOwner
function setShellMode(windows, collapsed, preference = 280) {
  const html = document.documentElement
  const frame = document.querySelector('.host-preview')
  html.toggleAttribute('data-windows-titlebar', windows)
  if (windows) html.style.setProperty('--dsh-windows-titlebar-height', '32px')
  else html.style.removeProperty('--dsh-windows-titlebar-height')
  frame.toggleAttribute('data-sidebar-collapsed', collapsed)
  const width = collapsed ? (windows ? 0 : 56) : preference
  frame.style.setProperty('--dsh-windows-sidebar-width', width + 'px')
  if (setSidebarOwner) flush(() => setSidebarOwner({ collapsed, width }))
  frame.style.gridTemplateColumns = width + 'px minmax(0,1fr) minmax(0,0px)'
  document.querySelector('#layout-handle').style.left = width + 'px'
  document.querySelector('#windows-mode').checked = windows
  document.querySelector('#collapsed-mode').checked = collapsed
}
for (const id of ['windows-mode', 'collapsed-mode']) document.getElementById(id).addEventListener('change', () => {
  setShellMode(document.getElementById('windows-mode').checked, document.getElementById('collapsed-mode').checked)
  syncRightMode()
})
function setRightMode(open = false, overlay = false, fullscreen = false, empty = false, split = false) {
  const frame = document.querySelector('.host-preview')
  const panel = document.querySelector('[data-sidebar-right-panel]')
  const left = parseFloat(document.querySelector('#layout-handle').style.left)
  const width = fullscreen ? frame.clientWidth - left : split ? 400 : 240
  panel.style.width = width + 'px'; panel.style.setProperty('--dsh-sidebar-width', width + 'px')
  panel.dataset.sidebarRightPanel = fullscreen ? 'fullscreen' : 'push'
  panel.toggleAttribute('data-sidebar-right-open', open); panel.setAttribute('aria-hidden', !open)
  frame.style.gridTemplateColumns = left + 'px minmax(0,1fr) minmax(0,' + (open && !overlay && !fullscreen ? width : 0) + 'px)'
  document.querySelector('[data-dockkit-host="dock"][data-dockkit-column="0"]').style.display = empty ? 'none' : ''
  document.querySelector('[data-dockkit-empty]').style.display = empty ? '' : 'none'
  document.querySelector('[data-dockkit-host="dock"][data-dockkit-column="1"]').style.display = split && !empty ? '' : 'none'
  document.querySelector('[data-dockkit-divider]').style.display = split && !empty ? '' : 'none'
  document.querySelector('#right-layout').style.gridTemplateColumns = split && !empty ? 'minmax(0,1fr) 0px minmax(0,1fr)' : 'minmax(0,1fr)'
  for (const [id, value] of Object.entries({ 'right-mode': open, 'overlay-mode': overlay, 'fullscreen-mode': fullscreen, 'empty-mode': empty, 'split-mode': split })) document.getElementById(id).checked = value
}
function syncRightMode() {
  setRightMode(...['right-mode', 'overlay-mode', 'fullscreen-mode', 'empty-mode', 'split-mode'].map(id => document.getElementById(id).checked))
}
for (const id of ['right-mode', 'overlay-mode', 'fullscreen-mode', 'empty-mode', 'split-mode']) document.getElementById(id).addEventListener('change', syncRightMode)
document.getElementById('preview-mode').addEventListener('change', event => document.querySelector('main').classList.toggle('preview-only', event.target.checked))
function layoutSnapshot() {
  const properties = ['marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderRadius', 'borderTopWidth', 'borderRightWidth', 'boxShadow', 'maxWidth', 'overflow']
  return JSON.stringify(['.BynINW_sidebarCol', '.BynINW_centerCol', '._2H3hWW_root', '[data-sidebar-right-panel]', '#right-pane', '[data-dockkit-empty]'].map(selector => {
    const css = getComputedStyle(document.querySelector(selector))
    return properties.map(name => css[name])
  }))
}
function contrast(selector) {
  const css = getComputedStyle(document.querySelector(selector))
  const luminance = color => {
    const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number)
    const rgb = color.startsWith('color(srgb') ? channels : channels.map(value => value / 255)
    return rgb.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
      .reduce((total, value, index) => total + value * [.2126, .7152, .0722][index], 0)
  }
  const [a,b] = [luminance(css.color), luminance(css.backgroundColor)]
  return (Math.max(a,b) + .05) / (Math.min(a,b) + .05)
}

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
  let baseline, codeBaseline
  const surface = selector => getComputedStyle(document.querySelector(selector))
  const surfaceSelectors = ['.BynINW_frame', '.BynINW_centerCol', '.BynINW_sidebarCol', '._2H3hWW_root', '.Dc7zOa_root', '[data-conversation-content]']
  let plainSurfaces, plainLayout
  const t = key => ({ appearance: '外观', light: '浅色', dark: '深色', system: '跟随系统', 'fontSize.title': '正文字号', 'fontSize.description': '字体大小', 'fontSize.increase': '增大字号', 'fontSize.decrease': '减小字号', 'fontSize.unit': 'px' }[key] || key)
  const localeListeners = new Set()
  ctx.slots.installLocale({ getSnapshot: () => ({ revision: 0 }), subscribe: fn => { localeListeners.add(fn); return () => localeListeners.delete(fn) }, bind: () => t })
  const SidebarRoot = factories.get('@deepseek-ai/dsh-client-ui-sidebar')(shared).fixture.SidebarRoot
  const panels = [{ id: 'plugins', label: '插件' }, { id: 'cron', label: '自动化任务' }]
  const sidebarT = key => ({ 'session.new': '新会话', 'session.new.label': '新建会话', 'toggle.open': '打开侧边栏', 'toggle.collapse': '收起侧边栏' }[key] || key)
  let setOpen
  function SettingsRoot({ renderSlot }) {
    const [open, update] = R.useState(true); setOpen = update
    const [sidebar, updateSidebar] = R.useState({ collapsed: false, width: 280 }); setSidebarOwner = updateSidebar
    return h(R.Fragment, null, window.ReactDOM.createPortal(renderSlot('sidebar', sidebar), document.querySelector('#sidebar-mount')), h('div', { className: 'settings-shell', 'data-shortcut-modal': 'settings' }, h('h3', null, '设置 → 通用'),
      h('button', { onClick: () => update(!open), id: 'toggle-settings' }, open ? '关闭设置' : '打开设置'),
      open && renderSlot('settings.general.item', {})))
  }
  ctx.slots.register({ name: 'root', children: { sidebar: { kind: 'single', scope: 'root' }, 'settings.general.item': { kind: 'list', scope: 'root' } } }, SettingsRoot)
  ctx.slots.register({ name: 'sidebar', children: Object.fromEntries(['sidebar.brand.mark', 'sidebar.brand.name', 'sidebar.toggle.badge', 'sidebar.workspaces', 'sidebar.settings', 'sidebar.footer.action', 'sidebar.panellist'].map(name => [name, { kind: name.endsWith('action') || name.endsWith('panellist') ? 'list' : 'single', scope: 'root' }])),
    inject: () => ({ t: sidebarT, startSession: () => {}, toggleSidebar: () => {}, selectPanel: () => {}, usePanels: select => select(panels), useShortcuts: select => select([]), usePanelInfo: select => select({ activePanelId: null }) }) }, SidebarRoot)
  ctx.slots.register({ name: 'sidebar.brand.name' }, () => h('span', null, 'DeepSeek Harness'))
  // The shell and slot anchors are real installed components; workspace rows are samples.
  const workspaceHTML = document.querySelector('#workspace-template').innerHTML
  ctx.slots.register({ name: 'sidebar.workspaces' }, ({ wide }) => h('div', { hidden: !wide, style: { display: wide ? 'contents' : 'none' }, dangerouslySetInnerHTML: { __html: workspaceHTML } }))
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
  const unmount = ctx.uiRenderer.mount(document.getElementById('settings'))
  await tick()
  baseline = capture(); codeBaseline = family('code')
  plainSurfaces = surfaceSelectors.map(selector => surface(selector).backgroundImage); plainLayout = layoutSnapshot()
  let activated = ctx.plugin(entry)
  await tick()
  runButton.disabled = false; status.textContent = '准备就绪'
  runButton.addEventListener('click', async () => {
    runButton.disabled = true; status.textContent = '运行中'
    document.documentElement.classList.add('fixture-checking')
    setShellMode(false, false); setRightMode()
    try {
      check(document.querySelector('.BynINW_sidebarCol > [data-slot="sidebar"] > ._2H3hWW_root') && getComputedStyle(document.querySelector('[data-slot="sidebar"]')).display === 'contents', '真实侧栏组件经官方插槽锚点渲染，避免直接子级夹具误判')
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
        check(document.body.getAttribute('data-dsx-surface-theme') === id && ['.BynINW_frame', '.BynINW_sidebarCol', '.BynINW_centerCol'].every(selector => surface(selector).backgroundImage.includes('gradient')) && ['._2H3hWW_root', '.Dc7zOa_root', '[data-conversation-content]'].every(selector => surface(selector).backgroundImage === 'none'), id + ' 渐变外壳与柔和浮岛生效，内层透明以免重复铺底')
        check(surface('[data-composer-card]').backgroundImage === 'none' && surface('[data-composer-card]').backgroundColor !== 'rgba(0, 0, 0, 0)' && family('code') === codeBaseline, id + ' 输入卡片为实色，代码字体保持不变')
        check(surface('[data-theme="' + id + '"] .dsx-theme-swatch').backgroundImage.includes('gradient'), id + ' 设置卡片显示对应渐变预览')
      }
      for (const id of ['sunset', 'aurora', 'sage']) {
        flush(() => document.querySelector('[data-theme="' + id + '"]').click())
        const frame = document.querySelector('.BynINW_frame').getBoundingClientRect()
        const sidebar = document.querySelector('.BynINW_sidebarCol').getBoundingClientRect()
        const center = document.querySelector('.BynINW_centerCol').getBoundingClientRect()
        check(contrast('#tooltip') >= 4.5, id + ' 宿主 tooltip 白字对比度至少 4.5:1')
        check(contrast('#tooltip-key') >= 4.5, id + ' tooltip 快捷键提示清晰可读')
        check(contrast('#toast') >= 4.5, id + ' 宿主 toast 文字对比度至少 4.5:1')
        check(document.body.getAttribute('data-dsh-appearance-layout') === 'island' && sidebar.left > frame.left && center.left > sidebar.right && center.right < frame.right && surface('.BynINW_centerCol').borderRadius !== '0px' && surface('.BynINW_centerCol').boxShadow !== 'none' && surface('.BynINW_frame').columnGap === 'normal' && surface('.BynINW_frame').paddingLeft === '0px' && !document.querySelector('[data-rightbar-col]').style.cssText, id + ' 浮岛在原有网格内留白，不改变宿主轨道和右栏锚点')
        check(surface('[data-shortcut-modal="settings"]').boxShadow !== 'none' && surface('.dsx-settings-row').borderRadius !== '0px' && surface('[data-composer-card]').borderRadius !== '0px' && surface('[data-composer-card]').backgroundImage === 'none', id + ' 设置、设置行与输入框保持独立实色浮岛')
        setShellMode(true, false)
        check(document.querySelector('.BynINW_centerCol').getBoundingClientRect().top > document.querySelector('.BynINW_frame').getBoundingClientRect().top + 32 && document.querySelector('#layout-handle').style.left === '280px', id + ' Windows 标题栏留白与原有拖拽位置保留')
        setShellMode(true, true)
        check(document.querySelector('.BynINW_sidebarCol').getBoundingClientRect().width === 0 && surface('.BynINW_sidebarCol').boxShadow === 'none' && document.querySelector('.BynINW_centerCol').getBoundingClientRect().left - document.querySelector('.BynINW_frame').getBoundingClientRect().left < 16, id + ' Windows 收起侧栏后无残留浮岛或横向占位')
        setShellMode(false, false)
        const rect = selector => document.querySelector(selector).getBoundingClientRect()
        const edge = rect('.BynINW_sidebarCol').right
        check(rect('._2H3hWW_root').right <= edge && edge - rect('._2H3hWW_newSession').right >= 12 && edge - rect('#workspace-row').right >= 12 && edge - rect('#workspace-time').right >= 20, id + ' 内层固定宽度受浮岛约束，按钮、长标题行和时间保留右侧间距')
        for (const width of [264, 280, 420]) {
          setShellMode(true, false, width)
          const sideEdge = rect('.BynINW_sidebarCol').right
          check(rect('._2H3hWW_root').width < width && sideEdge - rect('._2H3hWW_newSession').right >= 12 && sideEdge - rect('#workspace-row').right >= 12 && sideEdge - rect('#workspace-time').right >= 20 && surface('._2H3hWW_root').backgroundImage === 'none', id + ' Windows 插槽侧栏宽度 ' + width + ' px 时保留内容边距且不重复铺底')
        }
        setShellMode(false, false)
        document.querySelector('#workspace-row').classList.add('hIlkoa_menuOpen')
        check(edge - rect('#workspace-actions').right >= 20, id + ' 会话操作按钮显示时仍保留右侧间距')
        document.querySelector('#workspace-row').classList.remove('hIlkoa_menuOpen')
        const list = document.querySelector('._9lTDKa_list')
        list.scrollTop = 100
        check(list.scrollTop > 0 && list.scrollWidth <= list.clientWidth, id + ' 工作区列表可纵向滚动且没有横向溢出')
        list.scrollTop = 0
        setRightMode(true); await tick()
        const right = rect('#right-pane'), column = rect('[data-rightbar-col]'), shell = rect('.BynINW_frame')
        check(right.left > column.left && right.right < shell.right && right.top > shell.top && right.bottom < shell.bottom && surface('#right-pane').borderRadius === surface('.BynINW_centerCol').borderRadius && surface('#right-pane').overflow === 'hidden' && surface('#right-pane').boxShadow !== 'none', id + ' 停靠右栏上下及两侧留白，标签和内容统一圆角裁切')
        setRightMode(true, true); await tick()
        check(rect('[data-rightbar-col]').width === 0 && rect('#right-pane').width > 200 && rect('#right-pane').right < rect('.BynINW_frame').right, id + ' 零宽轨道右栏仍正常覆盖主内容并保持右侧留白')
        setRightMode(true, true, false, true); await tick()
        check(surface('[data-dockkit-empty] > [data-dockkit-pane]').borderRadius === surface('#right-pane').borderRadius && surface('[data-dockkit-empty]').backgroundColor === 'rgba(0, 0, 0, 0)', id + ' 空右栏同样圆角，外层不残留方角底色')
        setRightMode(true, true, false, false, true); await tick()
        check(rect('[data-dockkit-column="1"] > [data-dockkit-pane]').width > 100 && surface('[data-dockkit-column="1"] > [data-dockkit-pane]').borderRadius === surface('#right-pane').borderRadius && surface('[data-dockkit-divider]').pointerEvents !== 'none', id + ' 双停靠面板圆角一致，分隔拖拽柄仍可命中')
        setShellMode(true, false); setRightMode(true, true, true); await tick()
        check(rect('#right-pane').top >= rect('.BynINW_frame').top + 32 + 6 && rect('#right-pane').left >= rect('.BynINW_centerCol').left && surface('#right-pane').borderTopRightRadius !== '0px', id + ' Windows 全屏右栏保持标题栏间距与四角圆角')
        setShellMode(true, true); setRightMode(true, true, true); await tick()
        check(rect('.BynINW_sidebarCol').width === 0 && rect('#right-pane').left > rect('.BynINW_frame').left && rect('#right-pane').right < rect('.BynINW_frame').right, id + ' 左栏收起后全屏右栏没有横向越界')
        setRightMode(false); await tick()
        check(surface('#right-pane').visibility === 'hidden', id + ' 右栏关闭后停靠内容保持隐藏')
        setShellMode(false, false); setRightMode()
      }
      for (const id of ['sunset', 'dark', 'light', 'system']) {
        flush(() => document.querySelector('[data-theme="' + id + '"]').click())
        check(!document.body.hasAttribute('data-dsx-surface-theme') && surfaceSelectors.every((selector, index) => surface(selector).backgroundImage === plainSurfaces[index]), id + ' 不残留蓝绿装饰')
        if (id !== 'sunset') check(!document.body.hasAttribute('data-dsh-appearance-layout') && layoutSnapshot() === plainLayout, id + ' 恢复宿主布局、边距和阴影')
      }
      check(same(capture(), selected), '切换全部主题后字体保持生效')
      flush(() => document.querySelector('[data-theme="sage"]').click())
      theme.adopt(); await tick()
      check(theme.getTheme().preference === 'sage' && document.querySelector('[data-theme="sage"]').getAttribute('aria-pressed') === 'true', '宿主同步后自定义主题和选中状态正确')
      flush(() => setOpen(false)); check(!document.querySelector('.dsx-font-select') && same(capture(), selected) && surface('.BynINW_centerCol').backgroundImage.includes('gradient') && document.body.getAttribute('data-dsh-appearance-layout') === 'island', '关闭设置后字体、主题和宿主背景仍生效')
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
      check(!document.querySelector('style[data-plugin="dsh-appearance"]') && !document.querySelector('style[data-plugin="dsh-appearance-decoration"]') && !document.body.hasAttribute('data-dsx-surface-theme') && !document.body.hasAttribute('data-dsh-appearance-layout') && layoutSnapshot() === plainLayout && same(capture(), baseline), '最终卸载清除插件样式、装饰属性与字体覆盖')
      activated = ctx.plugin(entry); await tick()
      select('system'); flush(() => document.querySelector('[data-theme="system"]').click())
      theme.setFontSize(14)
      status.textContent = 'PASS ' + count + ' 项浏览器集成检查'; status.className = 'pass'
    } catch (error) { status.textContent = 'FAIL'; errorNode.textContent = error.stack }
    finally { document.documentElement.classList.remove('fixture-checking') }
  })
} catch (error) { status.textContent = 'FAIL'; errorNode.textContent = error.stack }
