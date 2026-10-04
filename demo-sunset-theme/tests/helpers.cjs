const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

class Element {
  constructor(tag, document) {
    this.tagName = tag
    this.document = document
    this.children = []
    this.parent = null
    this.dataset = {}
    this.style = {}
    this.attributes = {}
    this.events = new Map()
    this.className = ''
    this.id = ''
    this.textContent = ''
    this.value = ''
    this.disabled = false
  }
  appendChild(child) { child.parent = this; this.children.push(child); return child }
  removeChild(child) { this.children = this.children.filter((c) => c !== child); child.parent = null; return child }
  remove() { this.parent?.removeChild(this) }
  replaceChildren(...children) {
    for (const child of this.children) child.parent = null
    this.children = []
    for (const child of children) this.appendChild(child)
  }
  contains(node) { return this === node || this.children.some((child) => child.contains(node)) }
  setAttribute(key, value) { this.attributes[key] = String(value) }
  getAttribute(key) { return this.attributes[key] ?? null }
  removeAttribute(key) { delete this.attributes[key] }
  addEventListener(name, callback) {
    if (!this.events.has(name)) this.events.set(name, new Set())
    this.events.get(name).add(callback)
  }
  removeEventListener(name, callback) { this.events.get(name)?.delete(callback) }
  dispatch(name, fields = {}) {
    let stopped = false
    const event = { target: this, stopPropagation() { stopped = true }, preventDefault() {}, ...fields }
    for (let node = this; node && !stopped; node = node.parent) {
      for (const callback of [...(node.events.get(name) || [])]) callback(event)
    }
  }
  click() { if (!this.disabled) this.dispatch('click') }
  focus() { this.document.activeElement = this }
  blur() { this.document.activeElement = null }
  get classList() {
    return {
      add: (name) => { this.className = [...new Set([...this.className.split(' '), name])].join(' ') },
      remove: (name) => { this.className = this.className.split(' ').filter((item) => item !== name).join(' ') },
      contains: (name) => this.className.split(' ').includes(name),
    }
  }
}

function find(root, predicate) {
  if (predicate(root)) return root
  for (const child of root.children) {
    const found = find(child, predicate)
    if (found) return found
  }
  return null
}

function environment(options = {}) {
  const document = new Element('document')
  document.document = document
  document.head = document.appendChild(new Element('head', document))
  document.body = document.appendChild(new Element('body', document))
  document.activeElement = null
  document.createElement = (tag) => new Element(tag, document)
  document.getElementById = (id) => find(document, (element) => element.id === id)
  const store = options.store || new Map()
  const storageFaults = { read: false, write: false, ...options.storageFaults }
  const opfs = { content: options.opfsContent || '', read: false, write: false, close: false,
    opens: 0, commits: 0, aborted: 0, active: 0, maxActive: 0, ...options.opfsFaults }
  const file = {
    getFile: async () => {
      if (opfs.read) throw new Error('OPFS read failed')
      const text = opfs.content
      return { size: Buffer.byteLength(text), text: async () => text }
    },
    createWritable: async () => {
      opfs.opens++
      opfs.active++
      opfs.maxActive = Math.max(opfs.maxActive, opfs.active)
      let pending = ''
      let finished = false
      const finish = () => { if (!finished) opfs.active--; finished = true }
      return {
        write: async (text) => { if (opfs.write) throw new Error('OPFS write failed'); pending = text },
        close: async () => {
          if (opfs.close) throw new Error('OPFS close failed')
          opfs.content = pending; opfs.commits++; finish()
        },
        abort: async () => { opfs.aborted++; finish() },
      }
    },
  }
  const root = { getFileHandle: async () => file }
  const timers = new Map()
  const blobs = new Map()
  const downloads = []
  const messages = []
  let nextTimer = 0
  let nextUrl = 0
  let lockQueue = Promise.resolve()
  const sandbox = {
    document, Blob, TextEncoder, URLSearchParams,
    location: { search: options.search || '' },
    navigator: {
      storage: options.opfs ? { getDirectory: options.getDirectory || (async () => root) } : {},
      locks: {
        request: (_name, work) => {
          const task = lockQueue.then(() => work({ name: _name }))
          lockQueue = task.catch(() => undefined)
          return task
        },
      },
    },
    localStorage: {
      getItem: (key) => { if (storageFaults.read) throw new Error('Storage disabled'); return store.get(key) ?? null },
      setItem: (key, value) => { if (storageFaults.write) throw new Error('Quota exceeded'); store.set(key, String(value)) },
      removeItem: (key) => { if (storageFaults.write) throw new Error('Storage disabled'); store.delete(key) },
    },
    console: { log: (...args) => messages.push(args), warn: (...args) => messages.push(args) },
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id },
    clearTimeout: (id) => timers.delete(id),
    URL: {
      createObjectURL: (blob) => { const url = 'blob:test-' + ++nextUrl; blobs.set(url, blob); downloads.push(blob); return url },
      revokeObjectURL: (url) => blobs.delete(url),
    },
  }
  sandbox.window = { setTimeout: sandbox.setTimeout }
  const context = vm.createContext(sandbox)
  const modules = new Map()
  function load(relative) {
    const filename = path.resolve(__dirname, '..', 'src', relative)
    if (modules.has(filename)) return modules.get(filename).exports
    const module = { exports: {} }
    modules.set(filename, module)
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText
    const run = vm.runInContext('(function(require, module, exports) {\n' + code + '\n})', context, { filename })
    run((name) => load(path.relative(path.join(__dirname, '..', 'src'), path.resolve(path.dirname(filename), name + '.ts'))), module, module.exports)
    return module.exports
  }
  return { sandbox, context, document, store, timers, blobs, downloads, messages, storageFaults, opfs, load,
    find: (predicate) => find(document, predicate),
    byClass: (name) => find(document, (node) => node.classList.contains(name)),
    runTimers: () => { for (const [id, timer] of [...timers]) { timers.delete(id); timer.callback() } },
  }
}

// Contract fixture checked against installed DSH ui-theme 0.2.0-rc.2:
// custom ids do not persist; settings adoption publishes synchronously;
// system is a preference, not a member of the theme registry.
function host(options = {}) {
  const listeners = new Set()
  const effects = []
  const overrides = new Map()
  const writes = []
  const state = { preference: options.preference || 'system', fontSize: options.fontSize ?? 14,
    themes: [{ id: 'light', colorScheme: 'light', tokens: {} }, { id: 'dark', colorScheme: 'dark', tokens: {} }] }
  const persisted = { preference: state.preference, fontSize: state.fontSize }
  let revision = 0
  let dark = false
  const snapshot = () => {
    const id = state.preference === 'system' ? (dark ? 'dark' : 'light') : state.preference
    const active = state.themes.find((theme) => theme.id === id)
    const tokens = { ...active.tokens }
    for (const layer of overrides.values()) for (const [name, pair] of Object.entries(layer)) tokens[name] = pair[active.colorScheme]
    return { ...state, active: { ...active, tokens }, revision }
  }
  const publish = () => { revision++; for (const listener of [...listeners]) listener(snapshot()) }
  const ctx = {
    theme: {
      getTheme: snapshot,
      register: (definition) => {
        if (state.themes.some((theme) => theme.id === definition.id)) throw new Error('Duplicate theme ' + definition.id)
        if (options.failRegister === definition.id) throw new Error('Registration failed')
        state.themes.push(definition); publish()
        return () => {
          state.themes = state.themes.filter((theme) => theme !== definition)
          if (state.preference === definition.id) state.preference = 'system'
          publish()
        }
      },
      setTheme: (id) => {
        if (id !== 'system' && !state.themes.some((theme) => theme.id === id)) throw new Error('Unknown theme ' + id)
        if (state.preference === id) return
        state.preference = id
        if (['light', 'dark', 'system'].includes(id)) { persisted.preference = id; writes.push({ preference: id }) }
        publish()
      },
      setFontSize: (px) => {
        if (!Number.isInteger(px) || px < 10 || px > 22) throw new Error('Invalid font size')
        state.fontSize = px; persisted.fontSize = px; writes.push({ fontSize: px }); publish()
      },
      overrideTokens: (source, tokens) => {
        if (options.failOverride) throw new Error('Font override failed')
        overrides.set(source, tokens); publish()
        return () => { if (overrides.get(source) === tokens) { overrides.delete(source); publish() } }
      },
    },
    on: (_event, listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    effect: (execute) => {
      const cleanup = execute()
      let disposal
      const dispose = () => disposal ||= Promise.resolve(cleanup())
      effects.push(dispose)
      return dispose
    },
  }
  return { ctx, state, overrides, writes, listeners, effects,
    adopt: () => { Object.assign(state, persisted); publish() },
    setDark: (value) => { dark = value; publish() },
    publish,
    dispose: async () => { for (const dispose of [...effects].reverse()) await dispose() },
  }
}

function plugin(env) {
  if (!env.pluginFactory) {
    env.sandbox.window.__ModuleLoader__ = { load: ({ factory }) => { env.pluginFactory = factory } }
    env.load('client.ts')
  }
  return env.pluginFactory((name) => {
    if (name !== 'react') throw new Error('Unexpected shared module ' + name)
    return require('react')
  })
}

/** Real SlotCore handles priority, owner collapse and registration ordering. */
async function settingsHost(options = {}) {
  const { SlotCore } = await import('@deepseek-ai/dsh-client-ui-slots')
  const h = host(options)
  const core = new SlotCore()
  const injectors = new Set()
  let ownerRelease
  const originalAppearance = () => null
  const originalSize = () => null
  const key = 'settings.general.item'
  h.ctx.slots = {
    register: (metadata, component) => {
      if (metadata.id === options.failRow) throw new Error('Slot registration failed')
      return core.register(metadata, component)
    },
    inject: (slot, callback) => {
      const entry = { release: null }
      injectors.add(entry)
      const update = () => {
        entry.release?.(); entry.release = null
        if (core.spec(slot)) entry.release = callback()
      }
      const stop = core.subscribeDeclaration(slot, update)
      try { update() } catch (error) { stop(); injectors.delete(entry); throw error }
      return () => { stop(); entry.release?.(); entry.release = null; injectors.delete(entry) }
    },
  }
  h.openOwner = () => {
    ownerRelease = core.register({ name: 'root', children: { [key]: { kind: 'list', scope: 'root' } } }, () => null)
    core.register({ name: key, id: 'appearance', order: 10 }, originalAppearance)
    core.register({ name: key, id: 'font-size', order: 11 }, originalSize)
  }
  h.closeOwner = () => { ownerRelease?.(); ownerRelease = null }
  h.row = (id) => core.entriesOfSlot(key).find(entry => entry.options.id === id)
  h.face = (id) => h.row(id).inject()
  h.rows = () => core.entriesOfSlot(key)
  Object.assign(h, { core, injectors, originalAppearance, originalSize })
  if (!options.noOwner) h.openOwner()
  return h
}

function registerCustom(h) {
  for (const id of ['sunset', 'aurora', 'sage']) h.ctx.theme.register({ id, colorScheme: id === 'sunset' ? 'dark' : 'light', tokens: {} })
}

module.exports = { environment, host, settingsHost, plugin, registerCustom }
