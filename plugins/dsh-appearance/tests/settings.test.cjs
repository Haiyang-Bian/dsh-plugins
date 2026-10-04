const test = require('node:test')
const assert = require('node:assert/strict')
const { environment, settingsHost, plugin } = require('./helpers.cjs')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const fontKey = 'demo-sunset-theme:font'
const customKey = 'demo-sunset-theme:custom-font'
const themeKey = 'demo-sunset-theme:theme'
function render(h, id) {
  const entry = h.row(id)
  const { hooks, ...props } = entry.inject()
  for (const [name, source] of Object.entries(hooks)) props['use' + name[0].toUpperCase() + name.slice(1)] = selector => selector(source.getSnapshot())
  return renderToStaticMarkup(React.createElement(entry.component, props))
}
function assertClean(env, h) {
  assert.equal(h.injectors.size, 0)
  assert.equal(h.listeners.size, 0)
  assert.equal(h.overrides.size, 0)
  assert.equal(env.timers.size, 0)
  assert.equal(env.blobs.size, 0)
  assert.equal(env.document.head.children.length, 0)
  assert.equal(env.document.body.children.length, 0)
  assert.equal(env.document.events.size, 0)
  assert.equal(env.document.body.getAttribute('data-dsx-surface-theme'), null)
  assert.equal(env.document.body.getAttribute('data-dsh-appearance-layout'), null)
  assert.deepEqual(h.state.themes.map(theme => theme.id), ['light', 'dark'])
  assert.equal(h.row('appearance').component, h.originalAppearance)
  assert.equal(h.row('font-size').component, h.originalSize)
  assert.equal(h.rows().length, 2)
}

for (const id of ['mono', 'segoe', 'custom', 'system', 'missing']) {
  test('restores font ' + id + ' without opening Settings', async () => {
    const env = environment({ store: new Map([[fontKey, id], [customKey, 'Example Font']]) })
    const h = await settingsHost()
    plugin(env).apply(h.ctx)
    assert.equal(h.overrides.size, ['system', 'missing'].includes(id) ? 0 : 1)
    assert.equal(env.store.get(fontKey), id === 'missing' ? 'system' : id)
    assert.equal(env.document.body.children.length, 0)
    assert.equal(env.document.events.size, 0)
    await h.dispose()
    assertClean(env, h)
  })
}

test('shadows Appearance, keeps the official size row, restores both on unload', async () => {
  const env = environment()
  const h = await settingsHost()
  plugin(env).apply(h.ctx)
  assert.equal(h.row('appearance').options.priority, -100)
  assert.notEqual(h.row('appearance').component, h.originalAppearance)
  assert.equal(h.row('font-size').component, h.originalSize)
  assert.deepEqual(h.rows().map(entry => entry.options.id), ['appearance', 'dsh-appearance-font', 'font-size', 'dsh-appearance-log'])
  assert.match(render(h, 'appearance'), /跟随系统/)
  assert.equal((render(h, 'appearance').match(/data-theme=/g) || []).length, 6)
  assert.equal((render(h, 'dsh-appearance-font').match(/<optgroup/g) || []).length, 6)
  assert.match(render(h, 'dsh-appearance-font'), /自定义字体/)
  assert.match(render(h, 'dsh-appearance-log'), /<details class=/)
  assert.doesNotMatch(render(h, 'dsh-appearance-log'), / open=/)
  await h.dispose()
  assertClean(env, h)
})

test('custom theme and font remain active through settings owner removal and return', async () => {
  const env = environment()
  const h = await settingsHost()
  plugin(env).apply(h.ctx)
  h.face('appearance').selectTheme('sage')
  h.face('dsh-appearance-font').selectFont('verdana')
  const source = h.face('dsh-appearance-font').hooks.font
  h.closeOwner()
  h.adopt()
  assert.equal(env.document.body.getAttribute('data-dsx-surface-theme'), 'sage')
  assert.equal(h.state.preference, 'sage')
  assert.match(h.ctx.theme.getTheme().active.tokens['--dsw-font-family'], /Verdana/)
  h.openOwner()
  assert.equal(h.face('dsh-appearance-font').hooks.font, source)
  assert.match(render(h, 'dsh-appearance-font'), /value="verdana" selected/)
  assert.match(render(h, 'appearance'), /data-theme="sage" aria-pressed="true"/)
  await h.dispose()
  assertClean(env, h)
})

test('decorations follow restored, switched and built-in themes without Settings', async () => {
  const env = environment({ store: new Map([[themeKey, 'aurora']]) })
  const h = await settingsHost({ noOwner: true })
  plugin(env).apply(h.ctx)
  const attribute = 'data-dsx-surface-theme'
  assert.equal(env.document.body.getAttribute(attribute), 'aurora')
  h.adopt()
  assert.equal(env.document.body.getAttribute(attribute), 'aurora')
  h.openOwner()
  const face = h.face('appearance')
  face.selectTheme('sage')
  assert.equal(env.document.body.getAttribute(attribute), 'sage')
  for (const id of ['sunset', 'light', 'dark', 'system']) {
    face.selectTheme('sage')
    face.selectTheme(id)
    assert.equal(env.document.body.getAttribute(attribute), null)
  }
  face.selectTheme('aurora')
  await h.dispose()
  h.publish()
  assertClean(env, h)
})

test('decoration initialization failure restores previous body attribute and removes partial style', () => {
  const env = environment()
  const h = { theme: { getTheme: () => { throw new Error('Snapshot failed') } }, on: (_event, listener) => {
    subscribed.add(listener); return () => subscribed.delete(listener)
  } }
  const subscribed = new Set()
  env.document.body.setAttribute('data-dsx-surface-theme', 'previous')
  env.document.body.setAttribute('data-dsh-appearance-layout', 'previous-layout')
  const { mountThemeDecoration } = env.load('theme-decoration.ts')
  assert.throws(() => mountThemeDecoration(h), /Snapshot failed/)
  assert.equal(env.document.body.getAttribute('data-dsx-surface-theme'), 'previous')
  assert.equal(env.document.body.getAttribute('data-dsh-appearance-layout'), 'previous-layout')
  assert.equal(subscribed.size, 0)
  assert.equal(env.document.head.children.length, 0)
})

test('waits for an absent settings declaration while restoring font immediately', async () => {
  const env = environment({ store: new Map([[fontKey, 'mono']]) })
  const h = await settingsHost({ noOwner: true })
  plugin(env).apply(h.ctx)
  assert.equal(h.rows().length, 0)
  assert.equal(h.overrides.size, 1)
  h.openOwner()
  assert.equal(h.rows().length, 4)
  await h.dispose()
  assertClean(env, h)
})

test('empty custom font and unknown selection normalize to system', async () => {
  const env = environment({ store: new Map([[fontKey, 'custom'], [customKey, '   ']]) })
  const h = await settingsHost()
  plugin(env).apply(h.ctx)
  const face = h.face('dsh-appearance-font')
  assert.equal(face.hooks.font.getSnapshot().id, 'system')
  face.selectFont('mono')
  face.selectFont('missing')
  assert.equal(h.overrides.size, 0)
  face.applyCustom('  Georgia  ')
  assert.equal(env.store.get(customKey), 'Georgia')
  assert.equal(h.ctx.theme.getTheme().active.tokens['--dsw-font-family'], 'Georgia')
  face.applyCustom(' ')
  assert.equal(h.overrides.size, 0)
  assert.equal(face.hooks.font.getSnapshot().id, 'system')
  await h.dispose()
  assertClean(env, h)
})

test('failed font override keeps the previous saved choice and active layer', async () => {
  const env = environment()
  const h = await settingsHost()
  plugin(env).apply(h.ctx)
  const face = h.face('dsh-appearance-font')
  face.selectFont('mono')
  h.ctx.theme.overrideTokens = () => { throw new Error('Bad font') }
  assert.throws(() => face.applyCustom('Fail Font'), /Bad font/)
  assert.equal(face.hooks.font.getSnapshot().id, 'mono')
  assert.equal(env.store.get(fontKey), 'mono')
  assert.equal(env.store.has(customKey), false)
  assert.equal(h.overrides.size, 1)
  await h.dispose()
  assertClean(env, h)
})

test('shared font token survives every theme, with code and system reset preserved', async () => {
  const env = environment()
  const h = await settingsHost()
  plugin(env).apply(h.ctx)
  const font = h.face('dsh-appearance-font')
  const theme = h.face('appearance')
  font.selectFont('verdana')
  for (const id of ['sunset', 'aurora', 'sage', 'dark', 'light', 'system']) {
    theme.selectTheme(id)
    const tokens = h.ctx.theme.getTheme().active.tokens
    assert.match(tokens['--dsw-font-family'], /Verdana/)
    assert.equal(tokens['--dsw-font-family-brand'], tokens['--dsw-font-family'])
    assert.equal(tokens['--ds-font-family-code'], undefined)
  }
  font.selectFont('system')
  assert.equal(h.overrides.size, 0)
  await h.dispose()
  assertClean(env, h)
})

test('appearance actions honor URL initialization and hand builtins back to host', async () => {
  const env = environment({ search: '?theme=sunset' })
  const h = await settingsHost()
  plugin(env).apply(h.ctx)
  const theme = h.face('appearance')
  assert.equal(h.state.preference, 'sunset')
  theme.selectTheme('sage')
  h.adopt()
  assert.equal(h.state.preference, 'sage')
  for (const builtin of ['light', 'dark', 'system']) {
    theme.selectTheme('sage')
    theme.selectTheme(builtin)
    h.adopt()
    assert.equal(h.state.preference, builtin)
    assert.equal(env.store.has(themeKey), false)
  }
  await h.dispose()
  assertClean(env, h)
})

test('official size control accepts both boundaries without another size row', async () => {
  const env = environment()
  const h = await settingsHost()
  plugin(env).apply(h.ctx)
  for (const size of [10, 22]) {
    h.ctx.theme.setFontSize(size)
    h.adopt()
    assert.equal(h.state.fontSize, size)
  }
  assert.equal(h.rows().filter(row => row.options.id === 'font-size').length, 1)
  assert.throws(() => h.ctx.theme.setFontSize(23), /Invalid/)
  await h.dispose()
  assertClean(env, h)
})

for (const options of [{ failRegister: 'aurora' }, { failOverride: true }, { failRow: 'dsh-appearance-log' }]) {
  test('startup failure rolls back resources: ' + JSON.stringify(options), async () => {
    const env = environment({ store: new Map([[fontKey, 'mono']]) })
    const h = await settingsHost(options)
    assert.throws(() => plugin(env).apply(h.ctx))
    await h.dispose()
    assertClean(env, h)
  })
}

test('style append failure removes the partial node and all activation state', async () => {
  const env = environment()
  const append = env.document.head.appendChild.bind(env.document.head)
  env.document.head.appendChild = node => { append(node); throw new Error('DOM failed') }
  const h = await settingsHost()
  assert.throws(() => plugin(env).apply(h.ctx), /DOM failed/)
  await h.dispose()
  assertClean(env, h)
})

test('stable sources publish host changes and stop after disposal', async () => {
  const env = environment()
  const h = await settingsHost()
  plugin(env).apply(h.ctx)
  const source = h.face('appearance').hooks.appearance
  assert.equal(source.getSnapshot(), source.getSnapshot())
  let updates = 0
  source.subscribe(() => updates++)
  h.face('appearance').selectTheme('sunset')
  assert.ok(updates > 0)
  await h.dispose()
  const stopped = updates
  h.publish()
  assert.equal(updates, stopped)
  assertClean(env, h)
})

test('export can finish after the settings owner closes', async () => {
  const env = environment({ opfs: true })
  const h = await settingsHost()
  plugin(env).apply(h.ctx)
  const exporting = h.face('dsh-appearance-log').exportLog()
  h.closeOwner()
  await exporting
  assert.equal(env.downloads.length, 1)
  assert.match(await env.downloads[0].text(), /registered/)
  h.openOwner()
  await h.dispose()
  assertClean(env, h)
})

test('thirty activation cycles restore original rows and resource baseline', async () => {
  const env = environment({ opfs: true, store: new Map([[fontKey, 'mono'], [themeKey, 'sage']]) })
  const h = await settingsHost()
  const entry = plugin(env)
  for (let i = 0; i < 30; i++) {
    entry.apply(h.ctx)
    assert.equal(h.state.preference, 'sage')
    await h.dispose()
    await h.dispose()
    assertClean(env, h)
  }
  assert.equal(env.opfs.active, 0)
})
