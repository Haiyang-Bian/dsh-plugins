import * as Cordis from '/cordis.js'
import * as Slots from '/slots.js'
import { ThemePresenter } from '/presenter.js'
const R = window.React, h = R.createElement, flush = window.ReactDOM.flushSync
const tick = () => new Promise(resolve => requestAnimationFrame(() => resolve()))
function observable(initial) { let value = initial; const listeners = new Set(); return { getSnapshot: () => value, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn) }, set: next => { value = next; for (const fn of listeners) fn() }, listeners } }
function defineStore(spec) { return { create() { const source = observable(spec.init()); return { ...source, actions: Object.fromEntries(Object.entries(spec.actions).map(([key, mutation]) => [key, (...args) => { const next = structuredClone(source.getSnapshot()); mutation(next, ...args); source.set(next) }])) } } } }
const jsx = (type, props, key) => h(type, { ...props, key }), jsxs = jsx
const modules = { react: R, 'react-dom': window.ReactDOM, 'react-dom/client': window.ReactDOM, 'react/jsx-runtime': { jsx, jsxs, Fragment: R.Fragment }, '@deepseek-ai/cordis': Cordis, '@deepseek-ai/dsh-client-ui-slots': Slots, '@deepseek-ai/dsh-client-store': { defineStore }, '@deepseek-ai/dsh-client-ui-primitives': new Proxy({ Tooltip: ({ children }) => h(R.Fragment, null, children), isDarwinDesktop: () => false }, { get: (t, k) => t[k] || (() => h('span', null, '◌')) }) }
const shared = name => { if (!(name in modules)) throw Error('Missing ' + name); return modules[name] }
const installed = name => factories.get('@deepseek-ai/dsh-' + name)(shared)
let ctx, theme, usageFiber, assertions = 0, activeIntervals = 0
const visibilityListeners = new Set(), addListener = document.addEventListener.bind(document), removeListener = document.removeEventListener.bind(document)
document.addEventListener = (type, listener, options) => { if (type === 'visibilitychange') visibilityListeners.add(listener); return addListener(type, listener, options) }
document.removeEventListener = (type, listener, options) => { if (type === 'visibilitychange') visibilityListeners.delete(listener); return removeListener(type, listener, options) }
const originalInterval = window.setInterval, originalClearInterval = window.clearInterval, intervals = new Set()
window.setInterval = (...args) => { const id = originalInterval(...args); intervals.add(id); activeIntervals = intervals.size; return id }
window.clearInterval = id => { intervals.delete(id); activeIntervals = intervals.size; originalClearInterval(id) }
const check = (condition, label) => { if (!condition) throw Error(label); assertions++; console.log('PASS', label) }
const waitFor = async predicate => { for (let i = 0; i < 150; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 20)) } throw Error('等待界面超时') }
try {
  ctx = new Cordis.Context(); ctx.on('internal/error', error => console.error('Cordis error', error)); installed('client-ui-renderer').apply(ctx)
  const absent = observable({ key: undefined, hooks: {}, keyedHooks: {}, props: {} }); ctx.slots.installScope('session', { current: absent, bindingSource: () => absent })
  ctx.slots.installLocale({ getSnapshot: () => ({ revision: 0 }), subscribe: () => () => {}, bind: () => key => ({ 'session.new': '新对话', 'session.new.label': '新对话', 'toggle.collapse': '收起侧边栏' }[key] || key) })
  const generation = observable(undefined), connectionState = observable({ status: 'connected' })
  ctx.provide('connection', { isLoopback: true, generation, state: connectionState, registerGenerationSource: () => () => {}, start: () => ({ stop() {} }), rpc: { open: () => { throw Error('No stream used') }, call: async (_channel, endpoint, payload, signal) => {
    const [namespace, method] = endpoint.split('/'); const response = await fetch('/rpc', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ namespace, method, args: payload.args }) }); return response.json()
  } } })
  installed('typert-registry').apply(ctx); installed('api-gateway').apply(ctx)
  const layoutModule = installed('client-ui-layout'), store = layoutModule.fixture.createLayoutStore().create()
  const panelSource = { getSnapshot: () => store.getSnapshot().panelInfo, subscribe: store.subscribe }
  const layout = new layoutModule.LayoutController(store.actions, id => ctx.slots.entries('main').some(e => e.options.key === id), panelSource); ctx.provide('layout', layout)
  const usePanelInfo = select => select(R.useSyncExternalStore(panelSource.subscribe, panelSource.getSnapshot))
  const sessions = { byId: { original: { id: 'original', title: '原先的对话', retainedBy: { mainView: 1 } } } }
  const useSessions = select => select(sessions)
  const useStore = select => select(R.useSyncExternalStore(store.subscribe, store.getSnapshot))
  ctx.slots.provideRoot({ hooks: { panelInfo: panelSource } })
  ctx.slots.register({ name: 'root', children: { sidebar: { kind: 'single', scope: 'root' }, main: { kind: 'keyed', scope: 'root' }, rightbar: { kind: 'single', scope: 'root' }, 'shell.overlay': { kind: 'list', scope: 'root' }, 'shell.leading': { kind: 'single', scope: 'root' } }, inject: () => ({ useStore, useSessions, usePanelInfo, actions: store.actions, t: x => x }) }, layoutModule.fixture.AppFrame)
  const sidebar = installed('client-ui-sidebar').fixture.SidebarRoot
  const panels = observable([])
  ctx.slots.register({ name: 'sidebar', children: Object.fromEntries(['sidebar.brand.mark', 'sidebar.brand.name', 'sidebar.toggle.badge', 'sidebar.workspaces', 'sidebar.settings', 'sidebar.footer.action', 'sidebar.panellist'].map(name => [name, { kind: name.endsWith('action') || name.endsWith('panellist') ? 'list' : 'single', scope: 'root' }])), inject: () => ({ t: key => ({ 'session.new': '新对话', 'session.new.label': '新对话' }[key] || key), startSession: () => layout.selectPanel(null), toggleSidebar: () => layout.toggleSidebar(), selectPanel: id => layout.selectPanel(id), usePanels: select => select(R.useSyncExternalStore(panels.subscribe, panels.getSnapshot)), useShortcuts: select => select([]), usePanelInfo }) }, sidebar)
  const syncPanels = () => panels.set(ctx.slots.entries('sidebar.panellist').map(e => ({ id: e.options.id, label: e.options.label })))
  ctx.slots.subscribe('sidebar.panellist', syncPanels); syncPanels()
  ctx.slots.register({ name: 'sidebar.brand.name' }, () => h('span', null, 'DeepSeek Harness'))
  ctx.slots.register({ name: 'sidebar.workspaces' }, () => h('div', { id: 'workspace' }, '工作区'))
  ctx.slots.register({ name: 'main', key: 'conversation' }, () => h('div', { id: 'conversation' }, '原先的对话'))
  const preferences = observable({ value: { preference: 'light', fontSize: 14 } })
  theme = new (installed('client-ui-theme').fixture.ThemeRuntime)(ctx, { getSnapshot: preferences.getSnapshot, subscribe: preferences.subscribe, set: (key, value) => { const next = structuredClone(preferences.getSnapshot()); next.value[key] = value; preferences.set(next) } }); ctx.provide('theme', theme)
  const presenter = new ThemePresenter(), present = snapshot => presenter.apply(snapshot)
  ctx.on('theme/change', present); present(theme.getTheme())
  const appearance = ctx.plugin(factories.get('dsh-appearance')(shared)); await tick()
  usageFiber = ctx.plugin(factories.get('dsh-usage')(shared)); await usageFiber.await(); console.log('usage fiber', usageFiber.status, ctx.slots.entries('main').map(e => e.options.key)); await tick(); await tick()
  ctx.uiRenderer.mount(document.querySelector('#app'))
  const open = async () => { document.querySelector('button[aria-label="统计数据"]').click(); await waitFor(() => document.querySelector('.dsh-usage .charts')); await tick() }
  async function run() {
    assertions = 0
    check(document.querySelector('button[aria-label="统计数据"]'), '原生导航按钮')
    const nav = document.querySelector('button[aria-label="统计数据"]'), newChat = document.querySelector('button[aria-label="新对话"]'), workspaceNode = document.querySelector('#workspace')
    check((newChat.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING) && (nav.compareDocumentPosition(workspaceNode) & Node.DOCUMENT_POSITION_FOLLOWING), '按钮位于新对话与工作区之间')
    await open(); check(document.querySelector('button[aria-label="统计数据"]').getAttribute('aria-current') === 'page', '宿主选中状态')
    check(document.querySelectorAll('.dsh-usage .charts > section').length === 6, '六组实际图表')
    check(document.querySelectorAll('.dsh-usage svg').length >= 6, 'SVG 图表已渲染')
    check(document.querySelectorAll('.dsh-usage details').length === 6, '可访问数据表')
    check(document.querySelectorAll('.dsh-usage select').length === 4, '完整筛选栏')
    check(activeIntervals === 1, '页面仅一个刷新定时器')
    check(visibilityListeners.size === 1, '页面仅一个可见性订阅')
    const models = document.querySelectorAll('.dsh-usage select')[2]; models.value = models.options[1].value; models.dispatchEvent(new Event('change', { bubbles: true })); await waitFor(() => document.querySelector('.dsh-usage .charts')); check(document.querySelector('.dsh-usage .summary').textContent.includes('15'), '模型筛选经真实严格 RPC 生效')
    models.value = ''; models.dispatchEvent(new Event('change', { bubbles: true })); await tick()
    const dates = document.querySelector('.dsh-usage select'); dates.value = 'custom'; dates.dispatchEvent(new Event('change', { bubbles: true })); await tick()
    const dateInputs = document.querySelectorAll('.dsh-usage input[type=date]'), setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
    const localToday = ['year', 'month', 'day'].map(k => parts.find(p => p.type === k).value).join('-')
    for (const input of dateInputs) { setter.call(input, localToday); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); await tick() }
    await waitFor(() => document.querySelector('.dsh-usage .summary .card:nth-child(2) .value')?.textContent === '1')
    check(document.querySelector('.dsh-usage .summary .card:nth-child(2) .value').textContent === '1', '自定义本地日期包含截止日且不包含前一天')
    const blobs = new Map(), captured = [], create = URL.createObjectURL, revoke = URL.revokeObjectURL, click = HTMLAnchorElement.prototype.click
    URL.createObjectURL = blob => { const url = create(blob); blobs.set(url, blob); return url }
    URL.revokeObjectURL = url => { blobs.delete(url); revoke(url) }
    HTMLAnchorElement.prototype.click = function () { captured.push({ filename: this.download, blob: blobs.get(this.href) }) }
    try {
      for (const format of ['JSON', 'CSV']) {
        [...document.querySelectorAll('.dsh-usage button')].find(b => b.textContent === '导出 ' + format).click(); await waitFor(() => captured.length === (format === 'JSON' ? 1 : 2)); await tick()
        const item = captured.at(-1), text = await item.blob.text()
        check(item.filename.endsWith('.' + format.toLowerCase()), format + ' 文件名')
        check(format === 'JSON' ? JSON.parse(text).totals.calls === 1 : text.includes(localToday + ',') && text.split('\r\n').length === 2, format + ' 导出当前筛选经严格 RPC 返回的数据')
      }
      await tick(); check(blobs.size === 0, '导出 Blob URL 清理')
    } finally { URL.createObjectURL = create; URL.revokeObjectURL = revoke; HTMLAnchorElement.prototype.click = click }
    layout.selectPanel(null); await tick(); await tick(); check(document.querySelector('#conversation'), '返回原会话'); check(activeIntervals === 0, '关闭页面清除刷新定时器')
    check(visibilityListeners.size === 0, '关闭页面移除可见性订阅')
    await open(); check(document.querySelectorAll('.dsh-usage select')[2].value === '', '重开页面使用默认筛选'); check(sessions.byId.original.retainedBy.mainView === 1, '会话选择保持')
    for (const id of ['light', 'dark', 'sunset', 'aurora', 'sage', 'system']) { theme.setTheme(id); await tick(); const style = getComputedStyle(document.querySelector('.dsh-usage .card')); check(theme.getTheme().preference === id, id + ' 真实主题激活'); check(style.borderRadius === '20px', id + ' 浮岛卡片'); check(style.color !== style.backgroundColor, id + ' 文字可见') }
    theme.setTheme('sage'); await tick()
    for (let i = 0; i < 3; i++) { await usageFiber.dispose(); await tick(); await tick(); check(activeIntervals === 0, '卸载定时器基线 ' + i); check(visibilityListeners.size === 0, '卸载可见性订阅基线 ' + i); check(!document.querySelector('button[aria-label="统计数据"]'), '卸载导航贡献 ' + i); check(layout.panelInfo.getSnapshot().activePanelId === null, '卸载返回会话 ' + i); check(!document.querySelector('style[data-dsh-usage]'), '卸载样式 ' + i); usageFiber = ctx.plugin(factories.get('dsh-usage')(shared)); await tick(); await tick(); await open() }
    check(connectionState.listeners.size === 1, '连续启停连接订阅基线')
    window.usageResult = { passed: assertions, error: null }; document.querySelector('#status').textContent = `${assertions} 项通过 · 真实宿主渲染器与严格 RPC`
  }
  document.querySelector('#theme-choice').onchange = event => theme.setTheme(event.target.value)
  document.querySelector('#run').onclick = () => run().catch(error => { window.usageResult = { passed: assertions, error: error.message }; document.querySelector('#error').textContent = error.stack })
  await run()
} catch (error) { window.usageResult = { passed: assertions, error: error.message }; document.querySelector('#error').textContent = error.stack; document.querySelector('#status').textContent = '验证失败'; console.error(error) }
