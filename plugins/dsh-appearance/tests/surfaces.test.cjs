const test = require('node:test')
const assert = require('node:assert/strict')
const { environment, settingsHost, plugin } = require('./helpers.cjs')

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
  return rgb.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((total, value, index) => total + value * [.2126, .7152, .0722][index], 0)
}
// Installed DSH 0.2.0-rc.2 Tooltip uses static neutral-bluish-00 (white),
// not label-primary. Toast also defaults to a white foreground.
for (const name of ['sunset', 'aurora', 'sage']) {
  test(name + ' keeps tooltip and toast readable with host white text', () => {
    const env = environment()
    const tokens = env.load('tokens/' + name + '.ts')[name + 'Tokens']
    for (const key of ['--dsw-alias-tooltip-bg', '--dsw-alias-toast-bg']) {
      assert.ok(1.05 / (luminance(tokens[key]) + .05) >= 4.5, key + ' must reach 4.5:1')
    }
  })
}

test('islands follow only plugin themes, survive Settings closure and clear on builtins', async () => {
  const env = environment({ store: new Map([['demo-sunset-theme:theme', 'sage']]) })
  const host = await settingsHost()
  plugin(env).apply(host.ctx)
  const attr = 'data-dsh-appearance-layout'
  for (const id of ['sunset', 'aurora', 'sage']) {
    host.face('appearance').selectTheme(id)
    host.closeOwner(); host.adopt()
    assert.equal(env.document.body.getAttribute(attr), 'island')
    host.openOwner()
    for (const builtin of ['light', 'dark', 'system']) {
      host.face('appearance').selectTheme(id)
      host.face('appearance').selectTheme(builtin)
      assert.equal(env.document.body.getAttribute(attr), null)
    }
  }
  const release = host.ctx.theme.register({ id: 'other-plugin', colorScheme: 'light', tokens: {} })
  host.ctx.theme.setTheme('other-plugin')
  assert.equal(env.document.body.getAttribute(attr), null)
  release()
  await host.dispose()
  host.publish()
  assert.equal(env.document.body.getAttribute(attr), null)
  assert.equal(env.document.head.children.length, 0)
  assert.equal(host.listeners.size, 0)
})

test('decoration disposal restores prior attributes and is safe to repeat', async () => {
  const env = environment()
  const body = env.document.body
  body.setAttribute('data-dsx-surface-theme', 'previous-theme')
  body.setAttribute('data-dsh-appearance-layout', 'previous-layout')
  const host = await settingsHost()
  const release = host.ctx.theme.register({ id: 'sage', colorScheme: 'light', tokens: {} })
  host.ctx.theme.setTheme('sage')
  const { mountThemeDecoration } = env.load('theme-decoration.ts')
  const dispose = mountThemeDecoration(host.ctx)
  assert.equal(body.getAttribute('data-dsh-appearance-layout'), 'island')
  dispose(); dispose()
  assert.equal(body.getAttribute('data-dsx-surface-theme'), 'previous-theme')
  assert.equal(body.getAttribute('data-dsh-appearance-layout'), 'previous-layout')
  assert.equal(host.listeners.size, 0)
  assert.equal(env.document.head.children.length, 0)
  release()
})
